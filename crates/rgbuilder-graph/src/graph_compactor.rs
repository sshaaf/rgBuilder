//! Streaming log-structured compaction of a columnar snapshot with a delta segment.
//!
//! Pass 1 filters base nodes by invalidated file paths and appends delta nodes while
//! updating name/type indexes (via spill compile). Pass 2 streams base edges without
//! building a full topology `Vec`, keeping only endpoints present in the alive set.
//! Output is written to a temp path then atomically renamed.

use crate::columnar_snapshot::ColumnarGraphMmap;
use crate::normalize_path_str;
use crate::schema::{Edge, Node, NodeType};
use crate::segmented_spill::{write_columnar_from_spill, SegmentedSpill};
use crate::snapshot::MmappedGraphSnapshot;
use memmap2::Mmap;
use rgbuilder_error::{Error, Result};
use std::collections::HashSet;
use std::fs::File;
use std::path::Path;
use std::sync::Arc;
use uuid::Uuid;

/// Extracted changes to merge into a base columnar snapshot.
#[derive(Debug, Default)]
pub struct DeltaSegment {
    /// Repo-relative (or normalized) file paths whose nodes must be dropped from the base.
    pub invalidated_files: HashSet<String>,
    /// Freshly extracted nodes from added/changed files.
    pub new_nodes: Vec<Node>,
    /// Freshly extracted edges from the delta extract (and optional relation rebuild).
    pub new_edges: Vec<Edge>,
}

impl DeltaSegment {
    /// Create an empty delta.
    pub fn new() -> Self {
        Self::default()
    }

    /// Record a path as invalidated (normalized separators).
    pub fn invalidate_file(&mut self, path: impl AsRef<str>) {
        self.invalidated_files
            .insert(normalize_path_str(path.as_ref()));
    }
}

/// Compacts a base [`ColumnarGraphMmap`] with a [`DeltaSegment`] into a new snapshot file.
pub struct GraphCompactor<'a> {
    base: &'a ColumnarGraphMmap,
    delta: DeltaSegment,
}

/// Statistics from a compaction run.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CompactStats {
    /// Nodes kept from the base snapshot.
    pub nodes_kept: usize,
    /// Nodes dropped due to invalidated files.
    pub nodes_dropped: usize,
    /// Nodes appended from the delta.
    pub nodes_from_delta: usize,
    /// Edges kept from the base snapshot.
    pub edges_kept: usize,
    /// Edges dropped (endpoint not alive).
    pub edges_dropped: usize,
    /// Edges appended from the delta.
    pub edges_from_delta: usize,
    /// Content digest of the written snapshot.
    pub content_digest: String,
}

impl<'a> GraphCompactor<'a> {
    /// Create a compactor over a live mmap and owned delta.
    pub fn new(base: &'a ColumnarGraphMmap, delta: DeltaSegment) -> Self {
        Self { base, delta }
    }

    /// Compact to `output_path` via a sibling `.tmp` file and atomic rename.
    ///
    /// Scratch spill files are written under `scratch_dir` (created if needed) and removed
    /// after a successful compile.
    pub fn compact_to_path(
        self,
        output_path: &Path,
        scratch_dir: &Path,
    ) -> Result<CompactStats> {
        if let Some(parent) = output_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        if scratch_dir.exists() {
            let _ = std::fs::remove_dir_all(scratch_dir);
        }
        std::fs::create_dir_all(scratch_dir)?;

        let mut spill = SegmentedSpill::create(scratch_dir.join("seg"))?;
        let mut alive: HashSet<Uuid> = HashSet::with_capacity(self.base.node_count());
        let mut stats = CompactStats::default();

        // Pass 1: filter base nodes, append delta; indexes built during spill compile.
        for idx in 0..self.base.node_count() {
            let node = self.base.materialize_node_at(idx)?;
            if node_matches_invalidated(&node, &self.delta.invalidated_files) {
                stats.nodes_dropped += 1;
                continue;
            }
            alive.insert(node.id);
            spill.append_node(&node)?;
            stats.nodes_kept += 1;
        }

        for node in &self.delta.new_nodes {
            alive.insert(node.id);
            spill.append_node(node)?;
            stats.nodes_from_delta += 1;
        }

        // Pass 2: stream base edges (no full topology Vec).
        self.base.for_each_edge(|from, to, edge_type| {
            if alive.contains(&from) && alive.contains(&to) {
                spill.append_edge(&Edge::new(from, to, edge_type))?;
                stats.edges_kept += 1;
            } else {
                stats.edges_dropped += 1;
            }
            Ok(())
        })?;

        for edge in &self.delta.new_edges {
            if alive.contains(&edge.from) && alive.contains(&edge.to) {
                spill.append_edge(edge)?;
                stats.edges_from_delta += 1;
            }
        }

        let tmp_path = output_path.with_extension("bin.tmp");
        let finished = spill.finish()?;
        let digest = write_columnar_from_spill(finished, &tmp_path)?;
        stats.content_digest = digest;

        // Atomic replace.
        if output_path.exists() {
            std::fs::remove_file(output_path)?;
        }
        std::fs::rename(&tmp_path, output_path)?;

        if scratch_dir.exists() {
            let _ = std::fs::remove_dir_all(scratch_dir);
        }

        Ok(stats)
    }
}

/// Open a columnar snapshot from `path`, compact with `delta`, write atomically.
pub fn compact_snapshot_file(
    base_path: &Path,
    delta: DeltaSegment,
    output_path: &Path,
    scratch_dir: &Path,
) -> Result<CompactStats> {
    let file = File::open(base_path)?;
    // SAFETY: snapshot file is read-only for the duration of compaction; mapping covers
    // the on-disk columnar bytes only.
    let mmap = Arc::new(unsafe { Mmap::map(&file)? });
    let base = ColumnarGraphMmap::open(mmap)?;
    GraphCompactor::new(&base, delta).compact_to_path(output_path, scratch_dir)
}

/// Compact the default repo snapshot in place (via temp + rename).
pub fn compact_repo_snapshot(repo_root: &Path, delta: DeltaSegment) -> Result<CompactStats> {
    let snapshot_path = MmappedGraphSnapshot::default_path(repo_root);
    if !snapshot_path.exists() {
        return Err(Error::NotFound(format!(
            "snapshot not found at {}",
            snapshot_path.display()
        )));
    }
    let scratch = repo_root.join(".rgbuilder").join("compact-scratch");
    compact_snapshot_file(&snapshot_path, delta, &snapshot_path, &scratch)
}

fn node_matches_invalidated(node: &Node, invalidated: &HashSet<String>) -> bool {
    if invalidated.is_empty() {
        return false;
    }
    let matches_path = |path: &str| {
        let norm = normalize_path_str(path);
        invalidated.contains(&norm)
            || invalidated
                .iter()
                .any(|inv| norm == *inv || norm.ends_with(&format!("/{inv}")))
    };
    if let Some(fp) = &node.file_path {
        return matches_path(fp);
    }
    if node.node_type == NodeType::File {
        return matches_path(&node.name);
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::EdgeType;
    use crate::write_columnar_from_nodes_edges;
    use tempfile::TempDir;

    #[test]
    fn compact_drops_invalidated_file_and_appends_delta() {
        let keep = Node::new(NodeType::Function, "keep".into()).with_file_path("a.rs".into());
        let drop_n =
            Node::new(NodeType::Function, "drop_me".into()).with_file_path("b.rs".into());
        let keep_id = keep.id;
        let drop_id = drop_n.id;
        let e_keep = Edge::new(keep_id, keep_id, EdgeType::Calls);
        let e_drop = Edge::new(keep_id, drop_id, EdgeType::Calls);

        let tmp = TempDir::new().unwrap();
        let base_path = tmp.path().join("base.bin");
        write_columnar_from_nodes_edges(
            vec![keep, drop_n],
            vec![e_keep, e_drop],
            &base_path,
        )
        .unwrap();

        let replacement =
            Node::new(NodeType::Function, "fresh".into()).with_file_path("b.rs".into());
        let fresh_id = replacement.id;
        let mut delta = DeltaSegment::new();
        delta.invalidate_file("b.rs");
        delta.new_nodes.push(replacement);
        delta
            .new_edges
            .push(Edge::new(keep_id, fresh_id, EdgeType::Calls));

        let out = tmp.path().join("out.bin");
        let scratch = tmp.path().join("scratch");
        let stats = compact_snapshot_file(&base_path, delta, &out, &scratch).unwrap();

        assert_eq!(stats.nodes_kept, 1);
        assert_eq!(stats.nodes_dropped, 1);
        assert_eq!(stats.nodes_from_delta, 1);
        assert_eq!(stats.edges_kept, 1); // self-call on keep
        assert!(stats.edges_dropped >= 1);
        assert_eq!(stats.edges_from_delta, 1);

        let file = File::open(&out).unwrap();
        let mmap = Arc::new(unsafe { Mmap::map(&file).unwrap() });
        let col = ColumnarGraphMmap::open(mmap).unwrap();
        assert_eq!(col.node_count(), 2);
        let names: Vec<_> = (0..col.node_count())
            .map(|i| col.materialize_node_at(i).unwrap().name)
            .collect();
        assert!(names.iter().any(|n| n == "keep"));
        assert!(names.iter().any(|n| n == "fresh"));
        assert!(!names.iter().any(|n| n == "drop_me"));

        // Name index rebuilt for live nodes only.
        assert_eq!(col.find_nodes_by_name("fresh").unwrap().len(), 1);
        assert!(col.find_nodes_by_name("drop_me").unwrap().is_empty());
    }
}
