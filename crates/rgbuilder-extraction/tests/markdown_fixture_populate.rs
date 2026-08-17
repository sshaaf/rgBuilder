//! End-to-end extract + populate tests for the markdown-context fixture.

use rgbuilder_extraction::discovery::DiscoveryConfig;
use rgbuilder_extraction::extractor::Extractor;
use rgbuilder_extraction::graph_builder::GraphBuilder;
use rgbuilder_graph::schema::{EdgeType, NodeType};
use std::path::PathBuf;
use std::sync::Arc;

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/markdown-context")
}

#[test]
fn fixture_guide_populates_references_and_contains() {
    let root = fixture_root();
    let guide = root.join("docs/guide.md");
    let registry = Arc::new(rgbuilder_languages::default_registry());
    let extractor = Extractor::new(registry);

    let extraction = extractor.extract_file(&guide).expect("extract guide");
    assert!(
        extraction.symbols.iter().any(|s| s.name == "Checkout Flow"),
        "Checkout Flow symbol"
    );
    assert!(
        extraction.relations.iter().any(|r| {
            r.to.contains("adr.md#payments") || r.to.ends_with("adr.md#payments")
        }),
        "relation to payments fragment"
    );

    let mut builder = GraphBuilder::new();
    extractor
        .populate_graph(&[extraction], &mut builder)
        .expect("populate");

    let (nodes, edges) = builder.into_graph();

    let checkout = nodes
        .iter()
        .find(|n| n.name == "Checkout Flow" && n.node_type == NodeType::Module)
        .expect("Checkout Flow node");
    let cart = nodes
        .iter()
        .find(|n| n.name == "Cart" && n.node_type == NodeType::Module)
        .expect("Cart node");

    assert!(
        edges.iter().any(|e| {
            e.edge_type == EdgeType::Contains && e.from == checkout.id && e.to == cart.id
        }),
        "CONTAINS edge Checkout -> Cart"
    );
    assert!(
        edges.iter().any(|e| {
            e.edge_type == EdgeType::References && e.from == checkout.id
        }),
        "REFERENCES edge from Checkout Flow"
    );
}

#[test]
fn fixture_discover_markdown_file_count() {
    let root = fixture_root();
    let registry = Arc::new(rgbuilder_languages::default_registry());
    let extractor = Extractor::new(registry);
    let config = DiscoveryConfig {
        languages: Some(vec!["markdown".to_string()]),
        ..DiscoveryConfig::default()
    };
    let extractions = extractor
        .extract_repository(&root, &config)
        .expect("discover");
    assert!(
        extractions.len() >= 4,
        "README, guide, adr, overview.mdx — got {}",
        extractions.len()
    );
}

#[test]
fn fixture_readme_populates_frontmatter_variables() {
    let root = fixture_root();
    let readme = root.join("README.md");
    let registry = Arc::new(rgbuilder_languages::default_registry());
    let extractor = Extractor::new(registry);
    let extraction = extractor.extract_file(&readme).expect("README");
    assert!(
        extraction
            .symbols
            .iter()
            .any(|s| s.name == "metadata.author"),
        "metadata.author symbol"
    );

    let mut builder = GraphBuilder::new();
    extractor
        .populate_graph(&[extraction], &mut builder)
        .expect("populate");
    let (nodes, _) = builder.into_graph();
    assert!(
        nodes.iter().any(|n| {
            n.node_type == NodeType::Variable
                && n.name == "metadata.author"
                && n.get_property("kind") == Some("frontmatter")
        }),
        "frontmatter Variable node in graph"
    );
}
