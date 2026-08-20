//! Dashboard gate — **ecommerce-c** test project (CFG/PDG/taint on C).
//!
//!   cargo test --release --test dashboard_ecommerce_c
//!
//! Repo path: `/Users/sshaaf/git/rust/rgbuilder-tests/ecommerce-c`
//! (override: `RGBUILDER_C_REPO`).

mod dashboard_harness;

use dashboard_harness::{
    assert_dashboard_bundle_all_analysis, ecommerce_c_repo_path, run_discover_all,
};
use rgbuilder_dashboard::universe_dist_embedded;

const C_MIN_NODES: u64 = 30;
const C_MIN_FUNCTIONS: u64 = 15;
const C_MIN_METANODES: u64 = 1;

#[test]
fn discover_all_writes_c_cfg_dashboard_bundle() {
    if !universe_dist_embedded() {
        panic!(
            "dashboard/dist-universe not embedded — run cd dashboard && npm run build:universe && cargo build --release"
        );
    }

    let repo = ecommerce_c_repo_path();
    if !repo.is_dir() {
        eprintln!(
            "skip: C test repo not found at {} (set RGBUILDER_C_REPO)",
            repo.display()
        );
        return;
    }

    let output = run_discover_all(&repo, Some("c"));
    assert!(
        output.status.success(),
        "discover --all on ecommerce-c failed:\nstdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    assert_dashboard_bundle_all_analysis(&repo, C_MIN_NODES, C_MIN_METANODES);

    let manifest: serde_json::Value = serde_json::from_slice(
        &std::fs::read(repo.join(".rgbuilder/universe/manifest.json")).unwrap(),
    )
    .unwrap();
    let functions = manifest["metrics"]["function_count"].as_u64().unwrap_or(0);
    assert!(
        functions >= C_MIN_FUNCTIONS,
        "expected >= {C_MIN_FUNCTIONS} functions, got {functions}"
    );

    let cfg_index: serde_json::Value = serde_json::from_slice(
        &std::fs::read(repo.join(".rgbuilder/universe/cfg_index.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(cfg_index["available"], true);
    assert!(
        cfg_index["function_count"].as_u64().unwrap_or(0) > 0,
        "cfg_index should list analyzed C functions"
    );

    eprintln!(
        "ecommerce-c OK: {} nodes, {} functions, {} cfg functions",
        manifest["graph"]["node_count"], functions, cfg_index["function_count"]
    );
}
