//! Universe bundle validation — shared by CLI + golden-repo tests.

#![allow(dead_code)]

use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

pub use crate::dashboard_harness::rgbuilder_bin;

pub fn run_discover_universe(repo: &Path, languages: Option<&str>) -> Output {
    let bin = rgbuilder_bin();
    let _ = std::fs::remove_dir_all(repo.join(".rgbuilder"));
    let _ = std::fs::remove_dir_all(repo.join(".rbuilder"));
    let mut cmd = Command::new(&bin);
    cmd.args([
        "-r",
        repo.to_str().unwrap(),
        "discover",
        ".",
        "--with-universe",
    ]);
    if let Some(langs) = languages {
        cmd.args(["--languages", langs]);
    }
    cmd.output().expect("spawn rg-build discover --with-universe")
}

pub fn assert_universe_bundle(repo: &Path, min_nodes: u64) {
    let uni = repo.join(".rgbuilder/universe");

    assert!(uni.join("index.html").is_file(), "missing universe index.html");
    assert!(uni.join("manifest.json").is_file(), "missing manifest.json");
    assert!(
        uni.join("graph_payload.bin").is_file(),
        "missing graph_payload.bin"
    );
    assert!(uni.join("universe.json").is_file(), "missing universe.json");
    assert!(
        uni.join("communities.json").is_file(),
        "missing communities.json"
    );
    assert!(uni.join("metagraph.json").is_file(), "missing metagraph.json");
    assert!(uni.join("assets").is_dir(), "missing assets/");

    let has_wasm = std::fs::read_dir(uni.join("assets"))
        .ok()
        .into_iter()
        .flatten()
        .flatten()
        .any(|e| {
            e.path()
                .extension()
                .and_then(|s| s.to_str())
                .is_some_and(|ext| ext == "wasm")
        });
    assert!(has_wasm, "missing wasm under assets/ (offline bundle)");

    let manifest: Value =
        serde_json::from_slice(&std::fs::read(uni.join("manifest.json")).unwrap()).unwrap();
    assert_eq!(manifest["schema_version"], 1);
    assert_eq!(manifest["ui_mode"], "universe");
    assert_eq!(manifest["graph"]["payload_format"], "columnar_v2");
    assert!(
        manifest["graph"]["node_count"].as_u64().unwrap_or(0) >= min_nodes,
        "expected at least {min_nodes} nodes"
    );
    assert_eq!(manifest["universe_json_path"], "universe.json");
}

pub fn assert_universe_cross_artifact(repo: &Path) {
    let uni = repo.join(".rgbuilder/universe");
    let universe: Value =
        serde_json::from_slice(&std::fs::read(uni.join("universe.json")).unwrap()).unwrap();
    let communities: Value =
        serde_json::from_slice(&std::fs::read(uni.join("communities.json")).unwrap()).unwrap();

    let empty: Vec<Value> = vec![];
    let community_ids: std::collections::HashSet<_> = communities["communities"]
        .as_array()
        .unwrap_or(&empty)
        .iter()
        .filter_map(|c| c["id"].as_u64())
        .collect();

    let universe_communities = universe["communities"].as_array().unwrap_or(&empty);
    assert_eq!(
        universe_communities.len(),
        community_ids.len(),
        "universe.json community count mismatch"
    );
    for c in universe_communities {
        let id = c["id"].as_u64().expect("community id");
        assert!(
            community_ids.contains(&id),
            "universe community {id} missing from communities.json"
        );
    }

    for b in universe["bridges"].as_array().unwrap_or(&empty) {
        let src = b["source_community_id"].as_u64().unwrap();
        let dst = b["target_community_id"].as_u64().unwrap();
        assert!(community_ids.contains(&src));
        assert!(community_ids.contains(&dst));
    }
}

pub fn in_tree_ecommerce_java() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("rgbuilder-tests/ecommerce-java")
}
