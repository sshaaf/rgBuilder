//! Dashboard gate — **ecommerce-go** test project (CFG/PDG/taint on Go).
//!
//!   cargo test --release --test dashboard_ecommerce_go
//!
//! Repo path: `/Users/sshaaf/git/rust/rgbuilder-tests/ecommerce-go`
//! (override: `RGBUILDER_GO_REPO`).

mod dashboard_harness;

use dashboard_harness::{
    assert_dashboard_bundle_all_analysis, ecommerce_go_repo_path, run_discover_all,
};
use rgbuilder_dashboard::universe_dist_embedded;

const GO_MIN_NODES: u64 = 20;
const GO_MIN_FUNCTIONS: u64 = 10;
const GO_MIN_METANODES: u64 = 1;

#[test]
fn discover_all_writes_go_cfg_dashboard_bundle() {
    if !universe_dist_embedded() {
        panic!(
            "dashboard/dist-universe not embedded — run cd dashboard && npm run build:universe && cargo build --release"
        );
    }

    let repo = ecommerce_go_repo_path();
    if !repo.is_dir() {
        eprintln!(
            "skip: go test repo not found at {} (set RGBUILDER_GO_REPO)",
            repo.display()
        );
        return;
    }

    let output = run_discover_all(&repo, Some("go"));
    assert!(
        output.status.success(),
        "discover --all on ecommerce-go failed:\nstdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    assert_dashboard_bundle_all_analysis(&repo, GO_MIN_NODES, GO_MIN_METANODES);

    let manifest: serde_json::Value = serde_json::from_slice(
        &std::fs::read(repo.join(".rgbuilder/universe/manifest.json")).unwrap(),
    )
    .unwrap();
    let functions = manifest["metrics"]["function_count"].as_u64().unwrap_or(0);
    assert!(
        functions >= GO_MIN_FUNCTIONS,
        "expected >= {GO_MIN_FUNCTIONS} functions, got {functions}"
    );

    let cfg_index: serde_json::Value = serde_json::from_slice(
        &std::fs::read(repo.join(".rgbuilder/universe/cfg_index.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(cfg_index["available"], true);
    assert!(
        cfg_index["function_count"].as_u64().unwrap_or(0) > 0,
        "cfg_index should list analyzed Go functions"
    );

    eprintln!(
        "ecommerce-go OK: {} nodes, {} functions, {} cfg functions",
        manifest["graph"]["node_count"], functions, cfg_index["function_count"]
    );
}
