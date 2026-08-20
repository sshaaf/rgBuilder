//! Deep discover manifest flags on universe bundle (CFG, taint, migration parity).

mod dashboard_harness;
mod universe_harness;

use dashboard_harness::{copy_dir_all, rgbuilder_bin};
use std::path::Path;
use std::process::Command;
use universe_harness::{assert_universe_bundle, in_tree_ecommerce_java};

fn run_deep_discover(repo: &Path) -> std::process::Output {
    Command::new(rgbuilder_bin())
        .args([
            "-r",
            repo.to_str().unwrap(),
            "discover",
            ".",
            "--languages",
            "java",
            "--with-universe",
            "--with-cfg",
            "--with-security",
            "--with-taint",
            "--with-harmonic",
            "--export-migration-hints",
        ])
        .output()
        .expect("spawn deep discover")
}

#[test]
fn ecommerce_java_deep_universe_manifest_flags() {
    if !rgbuilder_dashboard::universe_dist_embedded() {
        eprintln!("skip: dashboard/dist-universe not embedded");
        return;
    }

    let fixture = in_tree_ecommerce_java();
    if !fixture.is_dir() {
        eprintln!("skip: ecommerce-java fixture missing");
        return;
    }

    let tmp = tempfile::tempdir().expect("tempdir");
    let repo = tmp.path().join("repo");
    copy_dir_all(&fixture, &repo).expect("copy fixture");
    let _ = std::fs::remove_dir_all(repo.join(".rgbuilder"));
    let _ = std::fs::remove_dir_all(repo.join(".rbuilder"));

    let output = run_deep_discover(&repo);
    assert!(
        output.status.success(),
        "deep discover failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    assert_universe_bundle(&repo, 50);

    let uni = repo.join(".rgbuilder/universe");
    let manifest: serde_json::Value =
        serde_json::from_slice(&std::fs::read(uni.join("manifest.json")).unwrap()).unwrap();
    let analysis = &manifest["analysis"];

    assert_eq!(analysis["cfg_available"], true);
    assert_eq!(analysis["blast_available"], true);
    assert_eq!(analysis["migration_available"], true);

    assert!(uni.join("taint_index.json").is_file());
    assert!(uni.join("migration_graph.json").is_file());
    assert!(uni.join("migration_plan.json").is_file());

    let taint: serde_json::Value =
        serde_json::from_slice(&std::fs::read(uni.join("taint_index.json")).unwrap()).unwrap();
    assert_eq!(taint["schema_version"], 1);

    let migration: serde_json::Value =
        serde_json::from_slice(&std::fs::read(uni.join("migration_graph.json")).unwrap()).unwrap();
    assert!(
        migration["communities"]
            .as_array()
            .map(|a| !a.is_empty())
            .unwrap_or(false)
    );
}
