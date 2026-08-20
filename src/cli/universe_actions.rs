//! Whitelisted universe actions for `POST /api/universe/actions` (SSE progress).

use axum::body::Body;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use std::convert::Infallible;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio_stream::{StreamExt as _, wrappers::ReceiverStream};

pub const ACTION_TIMEOUT: Duration = Duration::from_secs(600);

#[derive(Debug, serde::Deserialize)]
pub struct UniverseActionRequest {
    pub action: String,
    #[serde(default)]
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
struct ActionEvent {
    #[serde(rename = "type")]
    kind: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    line: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    exit_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

pub fn resolve_action(action: &str) -> Option<&'static str> {
    match action {
        "semantic_index" => Some("semantic_index"),
        "discover_refresh" => Some("discover_refresh"),
        "cfg_refresh" => Some("cfg_refresh"),
        _ => None,
    }
}

/// CLI hint text for copy-only universe command entries.
#[allow(dead_code)]
pub fn action_cli_hint(action: &str, repo: &Path) -> Option<String> {
    let repo = repo.display();
    match action {
        "semantic_index" => Some(format!(
            "rg-build -r {repo} semantic index --embedder vocab"
        )),
        "discover_refresh" => Some(format!("rg-build -r {repo} discover . --with-universe")),
        "cfg_refresh" => Some(format!(
            "rg-build -r {repo} discover . --with-universe --with-cfg"
        )),
        _ => None,
    }
}

fn build_argv(action: &str, bin: &Path, repo: &Path) -> Result<Vec<String>, String> {
    if resolve_action(action).is_none() {
        return Err(format!("unknown action `{action}`"));
    }
    let repo = repo.to_string_lossy();
    let bin = bin.to_string_lossy();
    Ok(match action {
        "semantic_index" => vec![
            bin.into(),
            "-r".into(),
            repo.into(),
            "semantic".into(),
            "index".into(),
            "--embedder".into(),
            "hash".into(),
        ],
        "discover_refresh" => vec![
            bin.into(),
            "-r".into(),
            repo.into(),
            "discover".into(),
            ".".into(),
            "--with-universe".into(),
        ],
        "cfg_refresh" => vec![
            bin.into(),
            "-r".into(),
            repo.into(),
            "discover".into(),
            ".".into(),
            "--with-universe".into(),
            "--with-cfg".into(),
        ],
        _ => return Err(format!("unknown action `{action}`")),
    })
}

fn format_sse(payload: &ActionEvent) -> String {
    let json = serde_json::to_string(payload).unwrap_or_else(|_| "{}".into());
    format!("data: {json}\n\n")
}

fn push_event(tx: &tokio::sync::mpsc::Sender<String>, payload: ActionEvent) {
    let _ = tx.try_send(format_sse(&payload));
}

async fn stream_subprocess(
    tx: tokio::sync::mpsc::Sender<String>,
    repo: PathBuf,
    argv: Vec<String>,
    action: String,
    command_display: String,
) {
    push_event(
        &tx,
        ActionEvent {
            kind: "started",
            action: Some(action.clone()),
            command: Some(command_display),
            line: None,
            exit_code: None,
            message: None,
        },
    );

    let program = match argv.first() {
        Some(p) => p.clone(),
        None => {
            push_event(
                &tx,
                ActionEvent {
                    kind: "error",
                    action: Some(action),
                    command: None,
                    line: None,
                    exit_code: None,
                    message: Some("empty command".into()),
                },
            );
            return;
        }
    };
    let args: Vec<String> = argv.into_iter().skip(1).collect();

    let mut child = match Command::new(&program)
        .args(&args)
        .current_dir(&repo)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
    {
        Ok(c) => c,
        Err(err) => {
            push_event(
                &tx,
                ActionEvent {
                    kind: "error",
                    action: Some(action),
                    command: None,
                    line: None,
                    exit_code: None,
                    message: Some(err.to_string()),
                },
            );
            return;
        }
    };

    let stdout = match child.stdout.take() {
        Some(s) => s,
        None => {
            push_event(
                &tx,
                ActionEvent {
                    kind: "error",
                    action: Some(action),
                    command: None,
                    line: None,
                    exit_code: None,
                    message: Some("failed to capture stdout".into()),
                },
            );
            let _ = child.kill().await;
            return;
        }
    };
    let stderr = child.stderr.take();

    let tx_out = tx.clone();
    let action_out = action.clone();
    let stdout_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => break,
                Ok(_) => {
                    let trimmed = line.trim_end_matches(['\r', '\n']).to_string();
                    if !trimmed.is_empty() {
                        push_event(
                            &tx_out,
                            ActionEvent {
                                kind: "stdout",
                                action: Some(action_out.clone()),
                                command: None,
                                line: Some(trimmed),
                                exit_code: None,
                                message: None,
                            },
                        );
                    }
                }
                Err(err) => {
                    push_event(
                        &tx_out,
                        ActionEvent {
                            kind: "error",
                            action: Some(action_out),
                            command: None,
                            line: None,
                            exit_code: None,
                            message: Some(err.to_string()),
                        },
                    );
                    break;
                }
            }
        }
    });

    let tx_err = tx.clone();
    let action_err = action.clone();
    let stderr_task = stderr.map(|stderr| {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break,
                    Ok(_) => {
                        let trimmed = line.trim_end_matches(['\r', '\n']).to_string();
                        if !trimmed.is_empty() {
                            push_event(
                                &tx_err,
                                ActionEvent {
                                    kind: "stdout",
                                    action: Some(action_err.clone()),
                                    command: None,
                                    line: Some(trimmed),
                                    exit_code: None,
                                    message: None,
                                },
                            );
                        }
                    }
                    Err(_) => break,
                }
            }
        })
    });

    let status = tokio::select! {
        status = child.wait() => status,
        _ = tokio::time::sleep(ACTION_TIMEOUT) => {
            let _ = child.kill().await;
            push_event(
                &tx,
                ActionEvent {
                    kind: "error",
                    action: Some(action.clone()),
                    command: None,
                    line: None,
                    exit_code: None,
                    message: Some(format!(
                        "action timed out after {}s",
                        ACTION_TIMEOUT.as_secs()
                    )),
                },
            );
            let _ = stdout_task.await;
            if let Some(t) = stderr_task {
                let _ = t.await;
            }
            return;
        }
    };

    let _ = stdout_task.await;
    if let Some(t) = stderr_task {
        let _ = t.await;
    }

    match status {
        Ok(exit) => {
            let code = exit.code().unwrap_or(-1);
            if exit.success() {
                push_event(
                    &tx,
                    ActionEvent {
                        kind: "completed",
                        action: Some(action),
                        command: None,
                        line: None,
                        exit_code: Some(code),
                        message: None,
                    },
                );
            } else {
                push_event(
                    &tx,
                    ActionEvent {
                        kind: "error",
                        action: Some(action),
                        command: None,
                        line: None,
                        exit_code: Some(code),
                        message: Some(format!("process exited with code {code}")),
                    },
                );
            }
        }
        Err(err) => {
            push_event(
                &tx,
                ActionEvent {
                    kind: "error",
                    action: Some(action),
                    command: None,
                    line: None,
                    exit_code: None,
                    message: Some(err.to_string()),
                },
            );
        }
    }
}

pub async fn handle_universe_action(
    bin: PathBuf,
    repo: PathBuf,
    action_lock: Arc<Mutex<()>>,
    body: UniverseActionRequest,
) -> Result<Response, (StatusCode, String)> {
    if resolve_action(&body.action).is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("unknown action `{}`", body.action),
        ));
    }
    if !body.args.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "extra args are not supported for universe actions".into(),
        ));
    }

    let argv = build_argv(&body.action, &bin, &repo)
        .map_err(|msg| (StatusCode::BAD_REQUEST, msg))?;
    let command_display = argv.join(" ");
    let action_name = body.action;

    let guard = action_lock
        .clone()
        .try_lock_owned()
        .map_err(|_| {
            (
                StatusCode::CONFLICT,
                "another universe action is already running".into(),
            )
        })?;

    let (tx, rx) = tokio::sync::mpsc::channel(128);
    tokio::spawn(async move {
        let _guard = guard;
        stream_subprocess(tx, repo, argv, action_name, command_display).await;
    });

    let stream = ReceiverStream::new(rx).map(|chunk| {
        Ok::<axum::body::Bytes, Infallible>(axum::body::Bytes::from(chunk))
    });

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "text/event-stream".parse().unwrap());
    headers.insert(header::CACHE_CONTROL, "no-cache".parse().unwrap());

    Ok((headers, Body::from_stream(stream)).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_whitelisted_actions() {
        assert_eq!(resolve_action("semantic_index"), Some("semantic_index"));
        assert_eq!(resolve_action("discover_refresh"), Some("discover_refresh"));
        assert!(resolve_action("rm_rf").is_none());
    }

    #[test]
    fn build_argv_rejects_unknown() {
        assert!(build_argv("evil", Path::new("/bin/rg-build"), Path::new("/tmp")).is_err());
    }

    #[test]
    fn cli_hints_include_repo() {
        let hint = action_cli_hint("semantic_index", Path::new("/repo")).unwrap();
        assert!(hint.contains("semantic index"));
        assert!(hint.contains("/repo"));
    }

    #[test]
    fn sse_frame_format() {
        let frame = format_sse(&ActionEvent {
            kind: "started",
            action: Some("semantic_index".into()),
            command: None,
            line: None,
            exit_code: None,
            message: None,
        });
        assert!(frame.starts_with("data: "));
        assert!(frame.ends_with("\n\n"));
    }
}
