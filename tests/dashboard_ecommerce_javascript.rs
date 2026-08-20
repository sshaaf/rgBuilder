//! Dashboard gate — **ecommerce-javascript** test project (CFG/PDG/taint on JavaScript).
//!
//!   cargo test --release --test dashboard_ecommerce_javascript
//!
//! Repo path: `/Users/sshaaf/git/rust/rgbuilder-tests/ecommerce-javascript`
//! (override: `RGBUILDER_JAVASCRIPT_REPO`).

mod dashboard_harness;

use dashboard_harness::{
    assert_dashboard_bundle_all_analysis, ecommerce_javascript_repo_path, run_discover_all,
};
use rgbuilder_dashboard::universe_dist_embedded;

const JS_MIN_NODES: u64 = 40;
const JS_MIN_FUNCTIONS: u64 = 20;
const JS_MIN_METANODES: u64 = 1;

#[test]
fn discover_all_writes_javascript_cfg_dashboard_bundle() {
    if !universe_dist_embedded() {
        panic!(
            "dashboard/dist-universe not embedded — run cd dashboard && npm run build:universe && cargo build --release"
        );
    }

    let repo = ecommerce_javascript_repo_path();
    if !repo.is_dir() {
        eprintln!(
            "skip: javascript test repo not found at {} (set RGBUILDER_JAVASCRIPT_REPO)",
            repo.display()
        );
        return;
    }

    let output = run_discover_all(&repo, Some("javascript"));
    assert!(
        output.status.success(),
        "discover --all on ecommerce-javascript failed:\nstdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    assert_dashboard_bundle_all_analysis(&repo, JS_MIN_NODES, JS_MIN_METANODES);

    let manifest: serde_json::Value = serde_json::from_slice(
        &std::fs::read(repo.join(".rgbuilder/universe/manifest.json")).unwrap(),
    )
    .unwrap();
    let functions = manifest["metrics"]["function_count"].as_u64().unwrap_or(0);
    assert!(
        functions >= JS_MIN_FUNCTIONS,
        "expected >= {JS_MIN_FUNCTIONS} functions, got {functions}"
    );

    let cfg_index: serde_json::Value = serde_json::from_slice(
        &std::fs::read(repo.join(".rgbuilder/universe/cfg_index.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(cfg_index["available"], true);
    assert!(
        cfg_index["function_count"].as_u64().unwrap_or(0) > 0,
        "cfg_index should list analyzed JavaScript functions"
    );

    let calls = manifest["metrics"]["calls_count"].as_u64().unwrap_or(0);
    assert!(
        calls > 0,
        "expected call relations in JavaScript graph, got {calls}"
    );

    eprintln!(
        "ecommerce-javascript OK: {} nodes, {} functions, {} cfg functions, {} calls",
        manifest["graph"]["node_count"], functions, cfg_index["function_count"], calls
    );
}
