//! Write `universe.json` and `search_landmarks.json` for the universe bundle.

use crate::export_context::{DashboardExportContext, resolve_analysis};
use crate::export_util::write_json_compact;
use crate::metagraph::MetagraphExport;
use crate::universe_layout::{UniverseLayout, compute_universe_layout};
use rgbuilder_graph::backend::MemoryBackend;
use rgbuilder_graph::backend::GraphBackend;
use rgbuilder_graph::schema::NodeType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use uuid::Uuid;

pub const UNIVERSE_JSON_FILE: &str = "universe.json";
pub const SEARCH_LANDMARKS_FILE: &str = "search_landmarks.json";
pub const SEARCH_LANDMARKS_SCHEMA_VERSION: u32 = 1;
pub const DEFAULT_LANDMARK_LIMIT: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchLandmarksPayload {
    pub schema_version: u32,
    pub landmarks: Vec<SearchLandmark>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchLandmark {
    pub node_index: u32,
    pub name: String,
    pub qualified_name: String,
    pub community_id: Option<usize>,
    pub position: crate::universe_layout::Vec3,
}

pub fn write_universe_json(out_dir: &Path, export: &MetagraphExport) -> Result<(), String> {
    let layout = compute_universe_layout(
        &export.communities.communities,
        &export.meta.nodes,
        &export.meta.edges,
    );
    write_json_compact(&out_dir.join(UNIVERSE_JSON_FILE), &layout)
}

pub fn write_search_landmarks(
    backend: &MemoryBackend,
    repo_root: &Path,
    out_dir: &Path,
    layout: &UniverseLayout,
    uuid_to_index: &HashMap<Uuid, u32>,
    ctx: DashboardExportContext<'_>,
) -> Result<(), String> {
    let landmarks = compute_search_landmarks(backend, repo_root, layout, uuid_to_index, ctx)?;
    if landmarks.is_empty() {
        return Ok(());
    }
    let payload = SearchLandmarksPayload {
        schema_version: SEARCH_LANDMARKS_SCHEMA_VERSION,
        landmarks,
    };
    write_json_compact(&out_dir.join(SEARCH_LANDMARKS_FILE), &payload)
}

fn compute_search_landmarks(
    backend: &MemoryBackend,
    repo_root: &Path,
    layout: &UniverseLayout,
    uuid_to_index: &HashMap<Uuid, u32>,
    ctx: DashboardExportContext<'_>,
) -> Result<Vec<SearchLandmark>, String> {
    let results = resolve_analysis(&ctx, repo_root)?;
    let centrality = results.centrality.as_ref();
    let mut ranked: Vec<(u32, f32, String, String, Option<usize>)> = Vec::new();

    for compact_id in 0..results.node_count() {
        let Some(uuid) = results.get_uuid(compact_id as u32) else {
            continue;
        };
        let Some(&index) = uuid_to_index.get(&uuid) else {
            continue;
        };
        let Ok(Some(node)) = backend.get_node(uuid) else {
            continue;
        };
        if node.node_type != NodeType::Function {
            continue;
        }
        let pagerank = centrality
            .and_then(|c| c.pagerank.get(compact_id).copied())
            .unwrap_or(0.0);
        let qn = node
            .qualified_name
            .as_ref()
            .map(|s| s.to_string())
            .unwrap_or_else(|| node.name.to_string());
        let community_id = node
            .properties
            .get("community_id")
            .and_then(|v| v.parse::<usize>().ok());
        ranked.push((
            index,
            pagerank,
            node.name.to_string(),
            qn,
            community_id,
        ));
    }

    ranked.sort_by(|a, b| {
        b.1.partial_cmp(&a.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.2.cmp(&b.2))
    });
    ranked.truncate(DEFAULT_LANDMARK_LIMIT);

    let community_pos: HashMap<usize, crate::universe_layout::Vec3> = layout
        .communities
        .iter()
        .map(|c| (c.id, c.position.clone()))
        .collect();

    Ok(ranked
        .into_iter()
        .filter_map(|(node_index, _, name, qualified_name, community_id)| {
            let position = community_id
                .and_then(|cid| community_pos.get(&cid))
                .cloned()
                .unwrap_or(crate::universe_layout::Vec3 {
                    x: 0.0,
                    y: 0.0,
                    z: 0.0,
                });
            Some(SearchLandmark {
                node_index,
                name,
                qualified_name,
                community_id,
                position,
            })
        })
        .collect())
}

pub fn layout_for_export(export: &MetagraphExport) -> UniverseLayout {
    compute_universe_layout(
        &export.communities.communities,
        &export.meta.nodes,
        &export.meta.edges,
    )
}

pub fn universe_layout_fingerprint(layout: &UniverseLayout) -> String {
    let json = serde_json::to_vec(layout).unwrap_or_default();
    blake3::hash(&json).to_hex().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::communities::CommunitiesPayload;
    use crate::metagraph::{MetagraphExport, MetagraphPayload};

    #[test]
    fn search_landmarks_schema_roundtrip() {
        let payload = SearchLandmarksPayload {
            schema_version: SEARCH_LANDMARKS_SCHEMA_VERSION,
            landmarks: vec![SearchLandmark {
                node_index: 1,
                name: "main".into(),
                qualified_name: "com.example.main".into(),
                community_id: Some(0),
                position: crate::universe_layout::Vec3 {
                    x: 1.0,
                    y: 2.0,
                    z: 3.0,
                },
            }],
        };
        let json = serde_json::to_string(&payload).unwrap();
        let back: SearchLandmarksPayload = serde_json::from_str(&json).unwrap();
        assert_eq!(back.landmarks.len(), 1);
    }

    #[test]
    fn write_universe_json_from_export() {
        let export = MetagraphExport {
            meta: MetagraphPayload {
                schema_version: 3,
                mode: "package_metagraph".into(),
                community_only: false,
                threshold_community_only: 50_000,
                source_node_count: 10,
                nodes: vec![],
                edges: vec![],
            },
            communities: CommunitiesPayload {
                schema_version: 1,
                modularity: 0.5,
                communities: vec![],
            },
        };
        let dir = tempfile::tempdir().unwrap();
        write_universe_json(dir.path(), &export).unwrap();
        assert!(dir.path().join(UNIVERSE_JSON_FILE).is_file());
    }
}
