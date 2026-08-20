//! Deterministic 3D layout for universe export (communities, bridges, package frames).

use crate::communities::CommunitySummary;
use crate::metagraph::{Metaedge, Metanode};
use rgbuilder_graph::backend::{GraphBackend, MemoryBackend};
use rgbuilder_graph::schema::{Node, NodeType};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::f64::consts::PI;
use uuid::Uuid;

pub const UNIVERSE_JSON_SCHEMA_VERSION: u32 = 2;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UniverseCommunity {
    pub id: usize,
    pub label: String,
    pub color: String,
    pub position: Vec3,
    pub member_count: u32,
    pub glow_radius: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UniverseBridge {
    pub source_community_id: usize,
    pub target_community_id: usize,
    pub weight: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UniverseUnit {
    pub id: u32,
    pub label: String,
    pub kind: String,
    pub member_indices: Vec<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loc_estimate: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UniversePackage {
    pub id: u32,
    pub community_id: usize,
    pub label: String,
    pub position: Vec3,
    pub member_indices: Vec<u32>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub units: Vec<UniverseUnit>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loc_estimate: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UniverseLayout {
    pub schema_version: u32,
    pub communities: Vec<UniverseCommunity>,
    pub bridges: Vec<UniverseBridge>,
    pub packages: Vec<UniversePackage>,
}

/// Precompute universe layout from metagraph + community summaries.
pub fn compute_universe_layout(
    communities: &[CommunitySummary],
    metanodes: &[Metanode],
    metaedges: &[Metaedge],
) -> UniverseLayout {
    let community_positions = community_positions(communities);
    let bridges = bridge_edges(metanodes, metaedges);
    let packages = package_frames(metanodes, &community_positions);

    let communities_out: Vec<UniverseCommunity> = communities
        .iter()
        .map(|c| {
            let pos = community_positions
                .get(&c.id)
                .copied()
                .unwrap_or(Vec3 {
                    x: 0.0,
                    y: 0.0,
                    z: 0.0,
                });
            UniverseCommunity {
                id: c.id,
                label: c.label.clone(),
                color: c.color.clone(),
                position: pos,
                member_count: c.member_count,
                glow_radius: (c.member_count as f64).sqrt() * 4.0 + 40.0,
            }
        })
        .collect();

    UniverseLayout {
        schema_version: UNIVERSE_JSON_SCHEMA_VERSION,
        communities: communities_out,
        bridges,
        packages,
    }
}

fn community_positions(communities: &[CommunitySummary]) -> std::collections::HashMap<usize, Vec3> {
    let mut out = std::collections::HashMap::new();
    let n = communities.len().max(1);
    let radius = 420.0;
    for (i, c) in communities.iter().enumerate() {
        let t = i as f64 / n as f64;
        let angle = t * 2.0 * PI;
        let wobble = (c.id as f64 * 0.613).sin() * 35.0;
        out.insert(
            c.id,
            Vec3 {
                x: radius * angle.cos() + wobble,
                y: radius * angle.sin() * 0.85,
                z: (c.id as f64 * 0.91).sin() * 80.0,
            },
        );
    }
    out
}

fn bridge_edges(metanodes: &[Metanode], metaedges: &[Metaedge]) -> Vec<UniverseBridge> {
    let community_of: std::collections::HashMap<u32, usize> = metanodes
        .iter()
        .filter_map(|n| n.community_id.map(|cid| (n.id, cid)))
        .collect();

    let mut weights: std::collections::HashMap<(usize, usize), u32> =
        std::collections::HashMap::new();
    for edge in metaedges {
        let Some(&src_c) = community_of.get(&edge.source) else {
            continue;
        };
        let Some(&dst_c) = community_of.get(&edge.target) else {
            continue;
        };
        if src_c == dst_c {
            continue;
        }
        let (a, b) = if src_c <= dst_c {
            (src_c, dst_c)
        } else {
            (dst_c, src_c)
        };
        *weights.entry((a, b)).or_default() += edge.weight;
    }

    let mut bridges: Vec<UniverseBridge> = weights
        .into_iter()
        .map(|((source_community_id, target_community_id), weight)| UniverseBridge {
            source_community_id,
            target_community_id,
            weight,
        })
        .collect();
    bridges.sort_by(|a, b| {
        b.weight
            .cmp(&a.weight)
            .then_with(|| a.source_community_id.cmp(&b.source_community_id))
    });
    bridges
}

fn package_frames(
    metanodes: &[Metanode],
    community_positions: &std::collections::HashMap<usize, Vec3>,
) -> Vec<UniversePackage> {
    use rayon::prelude::*;

    let mut by_community: std::collections::HashMap<usize, Vec<&Metanode>> =
        std::collections::HashMap::new();
    for node in metanodes {
        let Some(cid) = node.community_id else {
            continue;
        };
        by_community.entry(cid).or_default().push(node);
    }

    let mut packages: Vec<UniversePackage> = by_community
        .par_iter()
        .flat_map(|(&community_id, nodes)| {
            let center = community_positions.get(&community_id).copied().unwrap_or(Vec3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            });
            let mut sorted: Vec<&Metanode> = nodes.to_vec();
            sorted.sort_by_key(|n| n.id);
            let count = sorted.len().max(1);
            let local_radius = 55.0 + (count as f64).sqrt() * 8.0;
            sorted
                .into_iter()
                .enumerate()
                .map(move |(i, node)| {
                    let angle = (i as f64 / count as f64) * 2.0 * PI + (community_id as f64 * 0.17);
                    UniversePackage {
                        id: node.id,
                        community_id,
                        label: node.label.clone(),
                        position: Vec3 {
                            x: center.x + local_radius * angle.cos(),
                            y: center.y + local_radius * angle.sin(),
                            z: center.z + (node.id as f64 * 0.31).sin() * 12.0,
                        },
                        member_indices: node.member_indices.clone(),
                        units: Vec::new(),
                        loc_estimate: None,
                    }
                })
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();
    packages.sort_by_key(|p| p.id);
    packages
}

struct MemberNode {
    index: u32,
    name: String,
    qualified_name: Option<String>,
    file_path: Option<String>,
    node_type: NodeType,
    loc: u32,
}

fn node_loc(node: &Node) -> u32 {
    match (node.start_line, node.end_line) {
        (Some(s), Some(e)) if e >= s => (e - s + 1) as u32,
        _ => 0,
    }
}

fn load_member_nodes(
    backend: &MemoryBackend,
    index_to_uuid: &HashMap<u32, Uuid>,
    member_indices: &[u32],
) -> Vec<MemberNode> {
    let mut out = Vec::with_capacity(member_indices.len());
    for &idx in member_indices {
        let Some(uuid) = index_to_uuid.get(&idx) else {
            continue;
        };
        let Ok(Some(node)) = backend.get_node(*uuid) else {
            continue;
        };
        out.push(MemberNode {
            index: idx,
            name: node.name.to_string(),
            qualified_name: node.qualified_name.as_ref().map(|s| s.to_string()),
            file_path: node.file_path.as_ref().map(|s| s.to_string()),
            node_type: node.node_type,
            loc: node_loc(&node),
        });
    }
    out
}

fn is_type_unit(node_type: NodeType) -> bool {
    matches!(
        node_type,
        NodeType::Class | NodeType::Struct | NodeType::Interface | NodeType::Enum
    )
}

fn unit_label(name: &str, file_path: &Option<String>) -> String {
    if !name.is_empty() {
        return name.to_string();
    }
    file_path
        .as_ref()
        .and_then(|p| p.rsplit(['/', '\\']).next())
        .unwrap_or("file")
        .to_string()
}

fn sum_loc(members: &[MemberNode], indices: &[u32]) -> Option<u32> {
    let total: u32 = members
        .iter()
        .filter(|m| indices.contains(&m.index))
        .map(|m| m.loc)
        .sum();
    if total > 0 { Some(total) } else { None }
}

fn file_path_units(
    functions: &[&MemberNode],
    members: &[MemberNode],
    id_start: u32,
) -> Vec<UniverseUnit> {
    let mut by_path: HashMap<String, Vec<u32>> = HashMap::new();
    for f in functions {
        let key = f
            .file_path
            .clone()
            .unwrap_or_else(|| "(unknown)".to_string());
        by_path.entry(key).or_default().push(f.index);
    }
    let mut paths: Vec<String> = by_path.keys().cloned().collect();
    paths.sort();
    paths
        .into_iter()
        .enumerate()
        .map(|(i, path)| {
            let member_indices = by_path.get(&path).cloned().unwrap_or_default();
            let label = path.rsplit(['/', '\\']).next().unwrap_or(&path).to_string();
            let loc_estimate = sum_loc(members, &member_indices);
            UniverseUnit {
                id: id_start + i as u32,
                label,
                kind: "file".into(),
                member_indices,
                loc_estimate,
            }
        })
        .collect()
}

/// Group package members into L4 units (class, file, or module).
pub fn compute_package_units(
    backend: &MemoryBackend,
    index_to_uuid: &HashMap<u32, Uuid>,
    member_indices: &[u32],
) -> Vec<UniverseUnit> {
    let members = load_member_nodes(backend, index_to_uuid, member_indices);
    if members.is_empty() {
        return vec![];
    }

    let classes: Vec<&MemberNode> = members.iter().filter(|m| is_type_unit(m.node_type)).collect();
    let functions: Vec<&MemberNode> = members
        .iter()
        .filter(|m| m.node_type == NodeType::Function)
        .collect();
    let modules: Vec<&MemberNode> = members
        .iter()
        .filter(|m| m.node_type == NodeType::Module)
        .collect();

    if !classes.is_empty() {
        let mut units = Vec::new();
        let mut assigned = HashSet::new();
        for (uid, class) in classes.iter().enumerate() {
            let class_qn = class
                .qualified_name
                .as_deref()
                .unwrap_or(class.name.as_str());
            let mut unit_members = vec![class.index];
            for f in &functions {
                if assigned.contains(&f.index) {
                    continue;
                }
                let fn_qn = f.qualified_name.as_deref().unwrap_or(f.name.as_str());
                let qn_match = fn_qn.starts_with(&format!("{class_qn}.")) || fn_qn == class_qn;
                let file_match = class.file_path.is_some() && f.file_path == class.file_path;
                if qn_match || file_match {
                    unit_members.push(f.index);
                    assigned.insert(f.index);
                }
            }
            units.push(UniverseUnit {
                id: uid as u32,
                label: unit_label(&class.name, &class.file_path),
                kind: "class".into(),
                member_indices: unit_members.clone(),
                loc_estimate: sum_loc(&members, &unit_members),
            });
        }
        let remaining: Vec<&MemberNode> = functions
            .iter()
            .copied()
            .filter(|f| !assigned.contains(&f.index))
            .collect();
        if !remaining.is_empty() {
            units.extend(file_path_units(
                &remaining,
                &members,
                units.len() as u32,
            ));
        }
        return units;
    }

    if !modules.is_empty() {
        return modules
            .iter()
            .enumerate()
            .map(|(i, m)| UniverseUnit {
                id: i as u32,
                label: m.name.clone(),
                kind: "module".into(),
                member_indices: vec![m.index],
                loc_estimate: if m.loc > 0 { Some(m.loc) } else { None },
            })
            .collect();
    }

    if !functions.is_empty() {
        return file_path_units(&functions, &members, 0);
    }

    vec![]
}

/// Attach export-time L4 units and LoC estimates to a precomputed layout.
pub fn enrich_layout_with_units(
    layout: &mut UniverseLayout,
    backend: &MemoryBackend,
    index_to_uuid: &HashMap<u32, Uuid>,
) {
    for pkg in &mut layout.packages {
        let units = compute_package_units(backend, index_to_uuid, &pkg.member_indices);
        if units.is_empty() {
            continue;
        }
        let total: u32 = units.iter().filter_map(|u| u.loc_estimate).sum();
        pkg.loc_estimate = if total > 0 { Some(total) } else { None };
        pkg.units = units;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::communities::CommunitySummary;

    fn sample_communities() -> Vec<CommunitySummary> {
        vec![
            CommunitySummary {
                id: 0,
                label: "platform".into(),
                color: "#3b82f6".into(),
                member_count: 100,
                package_count: 2,
            },
            CommunitySummary {
                id: 1,
                label: "payments".into(),
                color: "#f97316".into(),
                member_count: 80,
                package_count: 1,
            },
        ]
    }

    fn sample_metanodes() -> Vec<Metanode> {
        vec![
            Metanode {
                id: 0,
                label: "com.example.a".into(),
                size: 50,
                functions: 40,
                classes: 10,
                avg_complexity: 1.0,
                x: 0.0,
                y: 0.0,
                member_indices: vec![0, 1],
                community_id: Some(0),
            },
            Metanode {
                id: 1,
                label: "com.example.b".into(),
                size: 50,
                functions: 40,
                classes: 10,
                avg_complexity: 1.0,
                x: 0.0,
                y: 0.0,
                member_indices: vec![2],
                community_id: Some(1),
            },
        ]
    }

    #[test]
    fn universe_layout_deterministic() {
        let communities = sample_communities();
        let metanodes = sample_metanodes();
        let a = compute_universe_layout(&communities, &metanodes, &[]);
        let b = compute_universe_layout(&communities, &metanodes, &[]);
        assert_eq!(a, b);
    }

    #[test]
    fn universe_bridges_reference_valid_communities() {
        let communities = sample_communities();
        let metanodes = sample_metanodes();
        let metaedges = vec![Metaedge {
            source: 0,
            target: 1,
            weight: 3,
            kind: "calls".into(),
        }];
        let layout = compute_universe_layout(&communities, &metanodes, &metaedges);
        let ids: std::collections::HashSet<_> = layout.communities.iter().map(|c| c.id).collect();
        for b in &layout.bridges {
            assert!(ids.contains(&b.source_community_id));
            assert!(ids.contains(&b.target_community_id));
        }
    }
}
