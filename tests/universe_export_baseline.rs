//! Universe export timing gate (+20% tolerance over baseline).

mod universe_harness;

use std::time::{Duration, Instant};
use universe_harness::{in_tree_ecommerce_java, rgbuilder_bin};

const BASELINE_SECS: f64 = 45.0;
const TOLERANCE: f64 = 1.20;

fn assert_within_baseline(label: &str, elapsed: Duration, baseline_secs: f64) {
    let limit = baseline_secs * TOLERANCE;
    assert!(
        elapsed.as_secs_f64() <= limit,
        "{label}: {:.1}s exceeds {:.1}s baseline (+{}%)",
        elapsed.as_secs_f64(),
        limit,
        ((TOLERANCE - 1.0) * 100.0) as u32
    );
}

#[test]
#[ignore = "perf gate — run with: cargo test --release --test universe_export_baseline -- --ignored --nocapture"]
fn universe_export_within_baseline() {
    if !rgbuilder_dashboard::universe_dist_embedded() {
        eprintln!("skip: dashboard/dist-universe not embedded");
        return;
    }

    let repo = in_tree_ecommerce_java();
    if !repo.is_dir() {
        eprintln!("skip: ecommerce-java fixture missing");
        return;
    }
    let _ = std::fs::remove_dir_all(repo.join(".rgbuilder"));

    let start = Instant::now();
    let output = std::process::Command::new(rgbuilder_bin())
        .args([
            "-r",
            repo.to_str().unwrap(),
            "discover",
            ".",
            "--languages",
            "java",
            "--with-universe",
        ])
        .output()
        .expect("spawn discover");
    let elapsed = start.elapsed();

    assert!(
        output.status.success(),
        "discover failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    assert_within_baseline("ecommerce-java universe export", elapsed, BASELINE_SECS);
    eprintln!(
        "[profile] universe export discover: {:.1}s (baseline {:.1}s)",
        elapsed.as_secs_f64(),
        BASELINE_SECS
    );
}
