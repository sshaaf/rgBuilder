//! Obsidian vault export from markdown context graph nodes.

use rgbuilder_error::Result;
use rgbuilder_graph::backend::MemoryBackend;
use rgbuilder_graph::content_store::ContentStore;
use rgbuilder_graph::schema::{EdgeType, Node, NodeType};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::Path;

/// Max length for a directory path segment (macOS filename limit is 255 bytes).
const MAX_PATH_SEGMENT_LEN: usize = 200;
/// Max stem length before `.md` on note files.
const MAX_NOTE_STEM_LEN: usize = 252;

/// Stats from an Obsidian vault export.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ObsidianExportStats {
    /// Notes written.
    pub notes_written: usize,
    /// Wikilinks emitted from `REFERENCES` edges.
    pub links_written: usize,
}

/// Export heading sections as Obsidian-compatible markdown notes.
pub fn export_obsidian_vault(
    backend: &MemoryBackend,
    content_store: &ContentStore,
    output_dir: &Path,
    repo_root: &Path,
) -> Result<ObsidianExportStats> {
    fs::create_dir_all(output_dir)?;

    let repo_prefix = repo_root
        .canonicalize()
        .unwrap_or_else(|_| repo_root.to_path_buf())
        .to_string_lossy()
        .replace('\\', "/");

    let mut headings: Vec<(uuid::Uuid, String)> = Vec::new();
    backend.for_each_node(|node| {
        if node.node_type == NodeType::Module && node.get_property("kind") == Some("heading") {
            if let Some(qn) = node.qualified_name.as_ref() {
                headings.push((node.id, qn.to_string()));
            }
        }
    })?;

    let mut stats = ObsidianExportStats::default();

    for (id, qn) in headings {
        let body = backend
            .with_node(id, |node| resolve_body(node, content_store))?
            .flatten()
            .unwrap_or_default();

        let note_rel = backend
            .with_node(id, |node| note_relpath_for_heading(node, &repo_prefix))?
            .flatten()
            .unwrap_or_else(|| note_relpath(&qn, &repo_prefix));

        let mut wikilinks: Vec<String> = Vec::new();
        backend.for_each_edge(|edge| {
            if edge.from != id || edge.edge_type != EdgeType::References {
                return;
            }
            if let Ok(label) = backend
                .with_node(edge.to, |n| obsidian_wikilink_for_node(n, &repo_prefix))
                .map(|inner| inner.flatten())
            && let Some(label) = label
            {
                wikilinks.push(format!("[[{label}]]"));
            }
        })?;
        stats.links_written += wikilinks.len();

        let note_path = output_dir.join(&note_rel);
        if let Some(parent) = note_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                rgbuilder_error::Error::GraphError(format!(
                    "create_dir {}: {e}",
                    parent.display()
                ))
            })?;
        }

        let level = backend
            .with_node(id, |n| n.get_property("level").map(|s| s.to_string()))?
            .flatten()
            .unwrap_or_default();

        let mut out = String::new();
        out.push_str("---\n");
        out.push_str(&format!("qualified_name: \"{qn}\"\n"));
        if !level.is_empty() {
            out.push_str(&format!("level: \"{level}\"\n"));
        }
        out.push_str("---\n\n");
        if !body.is_empty() {
            out.push_str(&body);
            out.push('\n');
        }
        for link in wikilinks {
            out.push_str(&link);
            out.push('\n');
        }
        fs::write(&note_path, out).map_err(|e| {
            rgbuilder_error::Error::GraphError(format!("write note {}: {e}", note_path.display()))
        })?;
        stats.notes_written += 1;
    }

    Ok(stats)
}

fn obsidian_wikilink_for_node(node: &Node, repo_prefix: &str) -> Option<String> {
    if node.node_type == NodeType::Module && node.get_property("kind") == Some("heading") {
        return note_relpath_for_heading(node, repo_prefix)
            .as_deref()
            .map(obsidian_link_from_relpath);
    }
    if let Some(qn) = node.qualified_name.as_ref() {
        return Some(obsidian_link_from_relpath(&note_relpath(qn, repo_prefix)));
    }
    if node.node_type == NodeType::File {
        let rel = strip_repo_prefix(
            node.file_path
                .as_ref()
                .map(|s| s.as_ref())
                .unwrap_or(node.name.as_ref()),
            repo_prefix,
        );
        let base = rel
            .strip_suffix(".md")
            .or_else(|| rel.strip_suffix(".mdx"))
            .unwrap_or(&rel);
        return Some(base.to_string());
    }
    None
}

fn note_relpath_for_heading(node: &Node, repo_prefix: &str) -> Option<String> {
    let file = node
        .file_path
        .as_ref()
        .map(|s| s.to_string())
        .unwrap_or_default();
    let rel_file = strip_repo_prefix(&file, repo_prefix);
    let qn = node.qualified_name.as_ref()?;
    let fragment = qn.split('#').nth(1).unwrap_or("");
    Some(note_relpath_from_parts(&rel_file, fragment, qn))
}

fn obsidian_link_from_relpath(note_rel: &str) -> String {
    note_rel
        .strip_suffix(".md")
        .unwrap_or(note_rel)
        .to_string()
}

fn resolve_body(node: &Node, store: &ContentStore) -> Option<String> {
    if let Some(text) = node.get_property("body_text") {
        return Some(text.to_string());
    }
    if let Some(ref_key) = node.get_property("body_ref") {
        return store.get_str(ref_key).map(|s| s.to_string());
    }
    None
}

fn strip_repo_prefix(path: &str, repo_prefix: &str) -> String {
    let mut p = path.replace('\\', "/");
    if let Some(rest) = p.strip_prefix(repo_prefix) {
        p = rest.to_string();
    }
    p = p.strip_prefix('/').unwrap_or(&p).to_string();
    while p.starts_with("./") {
        p = p[2..].to_string();
    }
    p
}

fn note_relpath_from_parts(file_path: &str, fragment: &str, hash_seed: &str) -> String {
    let file = file_path.replace('\\', "/");
    let file_no_ext = file
        .strip_suffix(".md")
        .or_else(|| file.strip_suffix(".mdx"))
        .unwrap_or(&file);
    let base = sanitize_relpath(file_no_ext, hash_seed);
    if fragment.is_empty() {
        format!("{base}.md")
    } else {
        let frag = sanitize_path_component(fragment, hash_seed, MAX_NOTE_STEM_LEN);
        format!("{base}/{frag}.md")
    }
}

fn sanitize_relpath(path: &str, hash_seed: &str) -> String {
    path.split('/')
        .filter(|s| !s.is_empty())
        .map(|seg| sanitize_path_component(seg, &format!("{hash_seed}/{seg}"), MAX_PATH_SEGMENT_LEN))
        .collect::<Vec<_>>()
        .join("/")
}

fn note_relpath(qualified_name: &str, repo_prefix: &str) -> String {
    let normalized = qualified_name.replace('\\', "/");
    if let Some((file, frag)) = normalized.split_once('#') {
        let rel_file = strip_repo_prefix(file, repo_prefix);
        note_relpath_from_parts(&rel_file, frag, qualified_name)
    } else {
        format!(
            "{}.md",
            sanitize_path_component(&normalized, qualified_name, MAX_NOTE_STEM_LEN)
        )
    }
}

fn sanitize_path_component(raw: &str, hash_seed: &str, max_len: usize) -> String {
    let mut cleaned: String = raw
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '-'
            }
        })
        .collect();
    while cleaned.contains("--") {
        cleaned = cleaned.replace("--", "-");
    }
    cleaned = cleaned.trim_matches('-').to_string();
    if cleaned.is_empty() {
        cleaned = "section".to_string();
    }
    if cleaned.chars().count() > max_len {
        let hash = short_hash(hash_seed);
        let keep = max_len.saturating_sub(hash.len() + 1);
        let truncated: String = cleaned.chars().take(keep).collect();
        let truncated = truncated.trim_end_matches('-');
        format!("{truncated}-{hash}")
    } else {
        cleaned
    }
}

fn short_hash(seed: &str) -> String {
    let mut hasher = DefaultHasher::new();
    seed.hash(&mut hasher);
    format!("{:08x}", hasher.finish() & 0xffffffff)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_repo_prefix_removes_dot_slash_after_root() {
        let root = "/repo/k8s-website";
        let path = "/repo/k8s-website/./docs/guide.md";
        assert_eq!(strip_repo_prefix(path, root), "docs/guide.md");
    }

    #[test]
    fn sanitize_truncates_overlong_fragments_with_stable_hash() {
        let long = "a".repeat(443);
        let seed = "docs/post.md#full";
        let once = sanitize_path_component(&long, seed, MAX_NOTE_STEM_LEN);
        let again = sanitize_path_component(&long, seed, MAX_NOTE_STEM_LEN);
        assert_eq!(once, again);
        assert!(once.chars().count() <= MAX_NOTE_STEM_LEN);
        assert!(once.contains('-'));
    }

    #[test]
    fn note_relpath_from_parts_limits_component_length() {
        let frag = "one-of-the-advantages-that-kubernetes-provides-is-the-ability-to-manage-various-environments-easier-and-better-than-traditional-deployment-strategies-for-most-nontrivial-applications-you-have-test-data-staging-and-production-test-data-staging-and-production";
        let rel = note_relpath_from_parts(
            "blog/_posts/2015/using-kubernetes-namespaces-to-manage.md",
            frag,
            "blog/_posts/2015/using-kubernetes-namespaces-to-manage.md#full",
        );
        let max_comp = rel
            .split('/')
            .map(|c| c.chars().count())
            .max()
            .unwrap_or(0);
        assert!(max_comp <= 255);
    }
}
