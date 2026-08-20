//! Serve integration when `.rgbuilder/universe/` bundle is present.

mod dashboard_harness;
mod universe_harness;

use universe_harness::{in_tree_ecommerce_java, run_discover_universe};
use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

fn pick_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

fn rgbuilder_bin() -> std::path::PathBuf {
    std::env::var_os("CARGO_BIN_EXE_rg_build")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| {
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/debug/rg-build")
        })
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

#[test]
fn http_serve_prefers_universe_bundle() {
    if !rgbuilder_dashboard::universe_dist_embedded() {
        eprintln!("skip: dashboard/dist-universe not embedded");
        return;
    }

    let repo = in_tree_ecommerce_java();
    if !repo.is_dir() {
        eprintln!("skip: ecommerce-java missing");
        return;
    }
    let _ = std::fs::remove_dir_all(repo.join(".rgbuilder"));
    let _ = std::fs::remove_dir_all(repo.join(".rbuilder"));

    let output = run_discover_universe(&repo, Some("java"));
    assert!(
        output.status.success(),
        "discover failed: {}",
        String::from_utf8_lossy(&output.stderr)
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
    let body = client
        .get(format!("{base}/"))
        .send()
        .expect("GET /")
        .text()
        .expect("body");
    assert!(
        body.contains("universe") || body.contains("rg universe") || body.contains("universe-root"),
        "expected universe index.html"
    );

    if let Ok(entries) = std::fs::read_dir(repo.join(".rgbuilder/universe/assets")) {
        if let Some(wasm) = entries.flatten().find(|e| {
            e.path()
                .extension()
                .and_then(|s| s.to_str())
                .is_some_and(|ext| ext == "wasm")
        }) {
            let resp = client
                .get(format!(
                    "{base}/assets/{}",
                    wasm.file_name().to_string_lossy()
                ))
                .send()
                .expect("GET wasm");
            assert!(resp.status().is_success());
            let mime = resp
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");
            assert!(
                mime.contains("application/wasm"),
                "expected application/wasm, got {mime}"
            );
        }
    }
}
