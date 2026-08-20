//! CLI coverage for discover `--with-universe` (#61).

mod dashboard_harness;
mod universe_harness;

use dashboard_harness::{copy_dir_all, rgbuilder_bin};
use universe_harness::{assert_universe_bundle, assert_universe_cross_artifact, run_discover_universe};
use std::path::Path;

fn assert_ok(output: &std::process::Output, label: &str) {
    assert!(
        output.status.success(),
        "{label} failed:\nstdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

fn materialize() -> (tempfile::TempDir, std::path::PathBuf) {
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/tiny_polyglot_repo");
    let tmp = tempfile::tempdir().expect("tempdir");
    let repo = tmp.path().join("repo");
    copy_dir_all(&fixture, &repo).expect("copy fixture");
    let _ = std::fs::remove_dir_all(repo.join(".rgbuilder"));
    let _ = std::fs::remove_dir_all(repo.join(".rbuilder"));
    (tmp, repo)
}

#[test]
fn discover_default_skips_universe_dir() {
    let (_tmp, repo) = materialize();
    let output = std::process::Command::new(rgbuilder_bin())
        .args([
            "-r",
            repo.to_str().unwrap(),
            "discover",
            ".",
            "--languages",
            "java,rust",
        ])
        .output()
        .unwrap();
    assert_ok(&output, "discover default");
    assert!(
        !repo.join(".rgbuilder/universe").exists(),
        "default discover must not write .rgbuilder/universe"
    );
}

#[test]
fn discover_with_universe_writes_bundle() {
    if !rgbuilder_dashboard::universe_dist_embedded() {
        eprintln!("skip: dashboard/dist-universe not embedded");
        return;
    }

    let (_tmp, repo) = materialize();
    let output = run_discover_universe(&repo, Some("java,rust"));
    assert_ok(&output, "discover --with-universe");

    assert_universe_bundle(&repo, 1);
    assert_universe_cross_artifact(&repo);
    assert!(
        !repo.join(".rgbuilder/dashboard/manifest.json").is_file(),
        "--with-universe alone must not write legacy dashboard bundle"
    );
}

#[test]
fn discover_help_documents_universe_flag() {
    let output = std::process::Command::new(rgbuilder_bin())
        .args(["discover", "--help"])
        .output()
        .expect("spawn help");
    assert_ok(&output, "discover --help");
    let help = String::from_utf8_lossy(&output.stdout);
    assert!(
        help.contains("--with-universe"),
        "missing --with-universe in help"
    );
}
