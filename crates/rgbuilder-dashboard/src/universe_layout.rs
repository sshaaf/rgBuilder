//! Deterministic 3D layout for universe export (communities, bridges, package frames).

use crate::communities::CommunitySummary;
use crate::metagraph::{Metaedge, Metanode};
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

pub const UNIVERSE_JSON_SCHEMA_VERSION: u32 = 1;

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
pub struct UniversePackage {
    pub id: u32,
    pub community_id: usize,
    pub label: String,
    pub position: Vec3,
    pub member_indices: Vec<u32>,
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
                    }
                })
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();
    packages.sort_by_key(|p| p.id);
    packages
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
