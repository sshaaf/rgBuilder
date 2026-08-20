//! Metagraph member indices are present for WASM L2 expand (§8.10).

mod dashboard_harness;
mod universe_harness;

use serde_json::Value;
use universe_harness::{in_tree_ecommerce_java, run_discover_universe};

#[test]
fn ecommerce_java_metanodes_have_expandable_members() {
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

    let output = run_discover_universe(&repo, Some("java"));
    assert!(
        output.status.success(),
        "discover failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let metagraph: Value = serde_json::from_slice(
        &std::fs::read(repo.join(".rgbuilder/universe/metagraph.json")).unwrap(),
    )
    .unwrap();
    let universe: Value = serde_json::from_slice(
        &std::fs::read(repo.join(".rgbuilder/universe/universe.json")).unwrap(),
    )
    .unwrap();

    let empty: Vec<Value> = vec![];
    let nodes = metagraph["nodes"].as_array().unwrap_or(&empty);
    let expandable: Vec<_> = nodes
        .iter()
        .filter(|n| n["member_indices"].as_array().map(|a| !a.is_empty()).unwrap_or(false))
        .collect();
    assert!(
        !expandable.is_empty(),
        "expected at least one metanode with member_indices for L2 expand"
    );

    let packages = universe["packages"].as_array().unwrap_or(&empty);
    assert!(
        !packages.is_empty(),
        "expected universe.json packages for L1 drill-down"
    );
    let with_members = packages
        .iter()
        .filter(|p| p["member_indices"].as_array().map(|a| !a.is_empty()).unwrap_or(false))
        .count();
    assert!(
        with_members > 0,
        "expected package frames with member_indices"
    );
}
