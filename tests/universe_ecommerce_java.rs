//! Universe bundle gate on in-tree ecommerce-java fixture.

mod dashboard_harness;
mod universe_harness;

use universe_harness::{
    assert_universe_bundle, assert_universe_cross_artifact, in_tree_ecommerce_java,
    run_discover_universe,
};

#[test]
fn ecommerce_java_universe_bundle() {
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

    assert_universe_bundle(&repo, 50);
    assert_universe_cross_artifact(&repo);
}
