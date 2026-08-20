//! SSE universe actions on `rg-build serve` (§10.6–10.7).

mod dashboard_harness;
mod universe_harness;

use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use dashboard_harness::{copy_dir_all, rgbuilder_bin};
use universe_harness::run_discover_universe;

fn pick_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

struct ServerGuard {
    child: Child,
}

impl Drop for ServerGuard {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn wait_for_health(base: &str, timeout: Duration) -> bool {
    let client = reqwest::blocking::Client::new();
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if let Ok(resp) = client.get(format!("{base}/api/health")).send() {
            if resp.status().is_success() {
                return true;
            }
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    false
}

fn materialize_repo() -> tempfile::TempDir {
    let fixture =
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/tiny_polyglot_repo");
    let dir = tempfile::tempdir().expect("tempdir");
    copy_dir_all(&fixture, dir.path()).expect("copy fixture");
    let _ = std::fs::remove_dir_all(dir.path().join(".rgbuilder"));
    let _ = std::fs::remove_dir_all(dir.path().join(".rbuilder"));
    dir
}

fn collect_sse_events(body: &str) -> Vec<serde_json::Value> {
    let mut out = Vec::new();
    for block in body.split("\n\n") {
        for line in block.lines() {
            let Some(data) = line.strip_prefix("data:") else {
                continue;
            };
            let data = data.trim();
            if data.is_empty() {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                out.push(v);
            }
        }
    }
    out
}

#[test]
fn universe_action_semantic_index_streams_sse() {
    if !rgbuilder_dashboard::universe_dist_embedded() {
        eprintln!("skip: dashboard/dist-universe not embedded");
        return;
    }

    let dir = materialize_repo();
    let repo = dir.path();
    let discover = run_discover_universe(repo, Some("rust"));
    assert!(
        discover.status.success(),
        "discover failed: {}",
        String::from_utf8_lossy(&discover.stderr)
    );

    let bin = rgbuilder_bin();
    let port = pick_port();
    let base = format!("http://127.0.0.1:{port}");

    let child = Command::new(&bin)
        .args([
            "-r",
            repo.to_str().unwrap(),
            "serve",
            "--host",
            "127.0.0.1",
            "--port",
            &port.to_string(),
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn serve");

    let _guard = ServerGuard { child };
    assert!(wait_for_health(&base, Duration::from_secs(20)));

    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(format!("{base}/api/universe/actions"))
        .header("content-type", "application/json")
        .body(r#"{"action":"semantic_index","args":[]}"#)
        .send()
        .expect("POST universe action");
    assert!(resp.status().is_success(), "expected 200 SSE stream");
    let mime = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    assert!(
        mime.contains("text/event-stream"),
        "expected text/event-stream, got {mime}"
    );

    let body = resp.text().expect("sse body");
    let events = collect_sse_events(&body);
    assert!(
        events.iter().any(|e| e["type"] == "started"),
        "missing started event: {body}"
    );
    assert!(
        events.iter().any(|e| e["type"] == "completed"),
        "missing completed event: {body}"
    );
    let completed = events
        .iter()
        .find(|e| e["type"] == "completed")
        .expect("completed");
    assert_eq!(completed["exit_code"].as_i64(), Some(0));
}

#[test]
fn universe_action_rejects_unknown() {
    if !rgbuilder_dashboard::universe_dist_embedded() {
        eprintln!("skip: dashboard/dist-universe not embedded");
        return;
    }

    let dir = materialize_repo();
    let repo = dir.path();
    let discover = run_discover_universe(repo, Some("rust"));
    assert!(discover.status.success());

    let bin = rgbuilder_bin();
    let port = pick_port();
    let base = format!("http://127.0.0.1:{port}");

    let child = Command::new(&bin)
        .args([
            "-r",
            repo.to_str().unwrap(),
            "serve",
            "--host",
            "127.0.0.1",
            "--port",
            &port.to_string(),
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn serve");

    let _guard = ServerGuard { child };
    assert!(wait_for_health(&base, Duration::from_secs(20)));

    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(format!("{base}/api/universe/actions"))
        .header("content-type", "application/json")
        .body(r#"{"action":"not_allowed","args":[]}"#)
        .send()
        .expect("POST bad action");
    assert_eq!(resp.status(), reqwest::StatusCode::BAD_REQUEST);
}
