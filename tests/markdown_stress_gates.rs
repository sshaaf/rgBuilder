//! Markdown stress gates — kubernetes/website `content/en` (markdown-only discover).
//!
//! ```text
//! ./scripts/fetch-k8s-website-example.sh
//! cargo build --release --bin rg-build
//! cargo test --release --test markdown_stress_gates -- --ignored --nocapture
//! ```

mod dashboard_harness;

use dashboard_harness::rgbuilder_bin;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::time::{Duration, Instant};

const TOLERANCE: f64 = 1.10;
const MIN_HEADING_MODULES: u64 = 500;

pub fn k8s_website_repo_path() -> PathBuf {
    std::env::var("RGBUILDER_K8S_WEBSITE_REPO")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("example/k8s-website")
        })
}

#[derive(Debug, Clone, Default)]
struct DiscoverMetrics {
    wall_secs: f64,
    peak_rss_mb: f64,
    nodes: u64,
    functions: u64,
}

fn parse_profile_summary(log: &str) -> Option<DiscoverMetrics> {
    let mut summary = DiscoverMetrics::default();
    for line in log.lines() {
        if line.contains("[profile] discover summary") {
            summary.wall_secs = parse_field_f64(line, "wall_secs=").unwrap_or(0.0);
            summary.peak_rss_mb = parse_field_f64(line, "peak_rss_mb=").unwrap_or(0.0);
            summary.nodes = parse_field_u64(line, "nodes=").unwrap_or(0);
            summary.functions = parse_field_u64(line, "functions=").unwrap_or(0);
        }
    }
    if summary.wall_secs > 0.0 {
        Some(summary)
    } else {
        None
    }
}

fn parse_field_f64(line: &str, key: &str) -> Option<f64> {
    let rest = line.split(key).nth(1)?;
    rest.split_whitespace().next()?.parse().ok()
}

fn parse_field_u64(line: &str, key: &str) -> Option<u64> {
    let rest = line.split(key).nth(1)?;
    rest.split_whitespace().next()?.parse().ok()
}

fn parse_discover_json(stdout: &str) -> Option<Value> {
    for anchor in ["\"command\": \"discover\"", "\"command\":\"discover\""] {
        if let Some(anchor_idx) = stdout.rfind(anchor) {
            let start = stdout[..anchor_idx].rfind('{')?;
            let slice = &stdout[start..];
            let end = find_json_object_end(slice)?;
            return serde_json::from_str(slice[..=end].trim()).ok();
        }
    }
    None
}

fn find_json_object_end(s: &str) -> Option<usize> {
    let mut depth = 0;
    for (i, ch) in s.char_indices() {
        match ch {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
    }
    None
}

fn resolve_discover_metrics(
    stdout: &str,
    stderr: &str,
    elapsed: Duration,
) -> DiscoverMetrics {
    let combined = format!("{stdout}\n{stderr}");
    if let Some(summary) = parse_profile_summary(&combined) {
        return summary;
    }
    if let Some(doc) = parse_discover_json(stdout) {
        let metrics = doc.get("metrics").and_then(|m| m.as_object());
        let nodes = metrics
            .and_then(|m| m.get("nodes_generated"))
            .and_then(|n| n.as_u64())
            .unwrap_or(0);
        let wall_secs = metrics
            .and_then(|m| m.get("duration_ms"))
            .and_then(|n| n.as_u64())
            .map(|ms| ms as f64 / 1000.0)
            .unwrap_or_else(|| elapsed.as_secs_f64());
        return DiscoverMetrics {
            wall_secs,
            peak_rss_mb: 0.0,
            nodes,
            functions: 0,
        };
    }
    panic!(
        "discover metrics missing (expected [profile] discover summary or JSON payload)\n\
         rg-build: {}\n\
         stdout_bytes={} stderr_bytes={}\n\
         stdout_tail:\n{}\n\
         stderr:\n{}",
        rgbuilder_bin().display(),
        stdout.len(),
        stderr.len(),
        stdout.chars().rev().take(1200).collect::<String>().chars().rev().collect::<String>(),
        stderr
    );
}

fn run_markdown_discover_timed(repo: &Path) -> (Output, Duration) {
    let bin = rgbuilder_bin();
    let start = Instant::now();
    let output = Command::new(&bin)
        .env("RUST_LOG", "info,profile=info")
        .args([
            "-r",
            repo.to_str().unwrap(),
            "-f",
            "json",
            "discover",
            ".",
            "-l",
            "markdown",
            "-v",
        ])
        .output()
        .expect("spawn rg-build discover");
    (output, start.elapsed())
}

fn run_json_gql(repo: &Path, query: &str) -> Value {
    let bin = rgbuilder_bin();
    let output = Command::new(&bin)
        .args([
            "-r",
            repo.to_str().unwrap(),
            "-f",
            "json",
            "gql",
            query,
        ])
        .output()
        .expect("spawn gql");
    assert!(
        output.status.success(),
        "gql failed:\n{}",
        String::from_utf8_lossy(&output.stderr)
    );
    parse_gql_json(&output.stdout).expect("gql json")
}

fn parse_gql_json(stdout: &[u8]) -> Option<Value> {
    let text = String::from_utf8_lossy(stdout);
    for anchor in ["\"rows\"", "\"count\""] {
        if let Some(anchor_idx) = text.rfind(anchor) {
            let start = text[..anchor_idx].rfind('{')?;
            let slice = &text[start..];
            let end = find_json_object_end(slice)?;
            if let Ok(value) = serde_json::from_str(slice[..=end].trim()) {
                return Some(value);
            }
        }
    }
    None
}

fn assert_within_baseline(label: &str, elapsed: Duration, baseline_secs: f64) {
    let limit = baseline_secs * TOLERANCE;
    assert!(
        elapsed.as_secs_f64() <= limit,
        "{label}: {:.1}s exceeds baseline {:.1}s (+10% = {:.1}s)",
        elapsed.as_secs_f64(),
        baseline_secs,
        limit
    );
}

#[test]
#[ignore = "manual: markdown discover on example/k8s-website (kubernetes/website content/en)"]
fn k8s_website_markdown_discover_stress() {
    let repo = k8s_website_repo_path();
    if !repo.is_dir() {
        eprintln!(
            "skip: k8s-website not at {} (run ./scripts/fetch-k8s-website-example.sh)",
            repo.display()
        );
        return;
    }

    let (output, elapsed) = run_markdown_discover_timed(&repo);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "discover failed:\nstdout={stdout}\nstderr={stderr}"
    );

    let metrics = resolve_discover_metrics(&stdout, &stderr, elapsed);
    eprintln!(
        "k8s-website markdown: wall={:.1}s nodes={} functions={} peak_rss_mb={:.0}",
        metrics.wall_secs,
        metrics.nodes,
        metrics.functions,
        metrics.peak_rss_mb
    );

    if let Ok(raw) = std::env::var("RGBUILDER_K8S_WEBSITE_DISCOVER_BASELINE_SECS") {
        let baseline = raw.parse::<f64>().expect("RGBUILDER_K8S_WEBSITE_DISCOVER_BASELINE_SECS");
        assert_within_baseline("k8s-website markdown discover", elapsed, baseline);
    }

    let headings = run_json_gql(
        &repo,
        "MATCH (n:Module) WHERE n.kind = 'heading' RETURN n",
    );
    let heading_count = headings
        .get("count")
        .and_then(|c| c.as_u64())
        .unwrap_or(0);
    eprintln!("k8s-website heading modules: {heading_count}");
    assert!(
        heading_count >= MIN_HEADING_MODULES,
        "expected at least {MIN_HEADING_MODULES} heading modules, got {heading_count}"
    );

    let functions = run_json_gql(&repo, "MATCH (n:Function) RETURN n");
    let function_count = functions
        .get("count")
        .and_then(|c| c.as_u64())
        .unwrap_or(0);
    assert_eq!(
        function_count, 0,
        "markdown-only discover should index no functions"
    );
}
