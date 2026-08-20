//! Optional maintainer smoke: markdown repo universe export.

mod universe_harness;

use std::path::PathBuf;
use std::process::Command;
use universe_harness::{assert_universe_bundle, rgbuilder_bin};

const DEFAULT_K8S_WEBSITE: &str = "example/k8s-website";

#[test]
#[ignore = "maintainer smoke — requires example/k8s-website checkout"]
fn k8s_website_markdown_universe_export_smoke() {
    if !rgbuilder_dashboard::universe_dist_embedded() {
        eprintln!("skip: dashboard/dist-universe not embedded");
        return;
    }

    let repo = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(DEFAULT_K8S_WEBSITE);
    if !repo.is_dir() {
        eprintln!("skip: {DEFAULT_K8S_WEBSITE} not present");
        return;
    }

    let output = Command::new(rgbuilder_bin())
        .args([
            "-r",
            repo.to_str().unwrap(),
            "discover",
            ".",
            "--languages",
            "markdown",
            "--with-universe",
        ])
        .output()
        .expect("spawn discover");

    assert!(
        output.status.success(),
        "discover failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    assert_universe_bundle(&repo, 1);
}
