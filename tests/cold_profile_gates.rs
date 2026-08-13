//! Cold discover profile gates for linux, metasfresh, and kafka.
//!
//! ```text
//! cargo test --release --test cold_profile_gates -- --ignored --nocapture
//! ```

mod dashboard_harness;

use dashboard_harness::{metasfresh_repo_path, rgbuilder_bin};
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::time::{Duration, Instant};

/// Post–field-gating linux cold wall (default discover, no cfg/dashboard/harmonic).
const LINUX_COLD_WALL_BASELINE_SECS: f64 = 170.0;
const LINUX_COLD_MAX_NODES: u64 = 2_800_000;
const METASFRESH_COLD_WALL_BASELINE_SECS: f64 = 531.0;
/// Establish on maintainer machine; override via `RGBUILDER_KAFKA_COLD_BASELINE_SECS`.
const KAFKA_COLD_WALL_BASELINE_SECS: f64 = 600.0;
const TOLERANCE: f64 = 1.10;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ProfileSummary {
    pub wall_secs: f64,
    pub peak_rss_mb: f64,
    pub ingest_peak_rss_mb: f64,
    pub nodes: u64,
    pub functions: u64,
    pub index_graph_build_secs: Option<f64>,
}

pub fn linux_repo_path() -> PathBuf {
    std::env::var("RGBUILDER_LINUX_REPO")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("example/linux")
        })
}

pub fn kafka_repo_path() -> PathBuf {
    std::env::var("RGBUILDER_KAFKA_REPO")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("example/kafka"))
}

pub fn parse_profile_summary(stderr: &str) -> Option<ProfileSummary> {
    let mut summary = ProfileSummary::default();
    for line in stderr.lines() {
        if line.contains("[profile] discover summary") {
            summary.wall_secs = parse_field_f64(line, "wall_secs=")?;
            summary.peak_rss_mb = parse_field_f64(line, "peak_rss_mb=")?;
            summary.ingest_peak_rss_mb = parse_field_f64(line, "ingest_peak_rss_mb=")?;
            summary.nodes = parse_field_u64(line, "nodes=")?;
            summary.functions = parse_field_u64(line, "functions=")?;
        } else if line.contains("[profile] stage") && line.contains("index_graph_build") {
            summary.index_graph_build_secs = Some(parse_field_f64(line, "secs=")?);
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
    let token = rest.split_whitespace().next()?;
    token.parse().ok()
}

fn parse_field_u64(line: &str, key: &str) -> Option<u64> {
    let rest = line.split(key).nth(1)?;
    let token = rest.split_whitespace().next()?;
    token.parse().ok()
}

pub fn run_cold_discover_timed(repo: &Path, extra_args: &[&str]) -> (Output, Duration) {
    let bin = rgbuilder_bin();
    let start = Instant::now();
    let output = Command::new(&bin)
        .env("RUST_LOG", "info,profile=info")
        .args(["-r", repo.to_str().unwrap(), "discover", ".", "-v"])
        .args(extra_args)
        .output()
        .expect("spawn rg-build discover");
    (output, start.elapsed())
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
fn profile_parser_reads_linux_log_snippet() {
    let snippet = r#"2026-08-13T10:50:09.578546Z  INFO profile: [profile] discover summary wall_secs=157.810180667 index_secs=103.66666675 post_index_secs=24.973709293 peak_rss_mb=15256.0 ingest_peak_rss_mb=12929.0 analysis_peak_rss_mb=15256.0 functions=1862845 nodes=3312280 cfg=false security=false
2026-08-13T10:50:09.578564Z  INFO profile: [profile] stage stage="index_graph_build" secs=15.808327416000001 pct_wall=10.017305188540167"#;
    let parsed = parse_profile_summary(snippet).expect("parse");
    assert!((parsed.wall_secs - 157.810).abs() < 0.01);
    assert_eq!(parsed.nodes, 3_312_280);
    assert_eq!(parsed.functions, 1_862_845);
    assert!(parsed.index_graph_build_secs.unwrap() > 15.0);
}

#[test]
#[ignore = "manual: cold discover profile on example/linux"]
fn linux_cold_discover_within_baseline() {
    let repo = linux_repo_path();
    if !repo.is_dir() {
        eprintln!("skip: linux not at {}", repo.display());
        return;
    }

    let (output, elapsed) = run_cold_discover_timed(&repo, &[]);
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "discover failed:\n{stderr}"
    );
    let profile = parse_profile_summary(&stderr).expect("profile summary in stderr");
    eprintln!(
        "linux cold: wall={:.1}s nodes={} index_graph_build={:?}",
        profile.wall_secs, profile.nodes, profile.index_graph_build_secs
    );
    assert!(
        profile.nodes <= LINUX_COLD_MAX_NODES,
        "nodes {} exceed cap {}",
        profile.nodes,
        LINUX_COLD_MAX_NODES
    );
    assert_within_baseline("linux cold discover", elapsed, LINUX_COLD_WALL_BASELINE_SECS);
}

#[test]
#[ignore = "manual: cold discover profile on metasfresh"]
fn metasfresh_cold_discover_within_baseline() {
    let repo = metasfresh_repo_path();
    if !repo.is_dir() {
        eprintln!("skip: metasfresh not at {}", repo.display());
        return;
    }

    let (output, elapsed) = run_cold_discover_timed(
        &repo,
        &["--with-cfg", "--with-security", "--with-taint"],
    );
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(output.status.success(), "discover failed:\n{stderr}");
    let profile = parse_profile_summary(&stderr).expect("profile summary");
    eprintln!(
        "metasfresh cold: wall={:.1}s nodes={} functions={}",
        profile.wall_secs, profile.nodes, profile.functions
    );
    assert_within_baseline(
        "metasfresh cold discover",
        elapsed,
        METASFRESH_COLD_WALL_BASELINE_SECS,
    );
}

#[test]
#[ignore = "manual: cold discover profile on example/kafka"]
fn kafka_cold_discover_within_baseline() {
    let repo = kafka_repo_path();
    if !repo.is_dir() {
        eprintln!("skip: kafka not at {}", repo.display());
        return;
    }

    let baseline = std::env::var("RGBUILDER_KAFKA_COLD_BASELINE_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(KAFKA_COLD_WALL_BASELINE_SECS);

    let (output, elapsed) = run_cold_discover_timed(&repo, &[]);
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(output.status.success(), "discover failed:\n{stderr}");
    let profile = parse_profile_summary(&stderr).expect("profile summary");
    eprintln!(
        "kafka cold: wall={:.1}s nodes={} functions={} (baseline {:.0}s)",
        profile.wall_secs, profile.nodes, profile.functions, baseline
    );
    assert_within_baseline("kafka cold discover", elapsed, baseline);
}
