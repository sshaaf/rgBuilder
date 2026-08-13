//! Shared semantic search execution for CLI and HTTP API.

use super::semantic::{
    expand_gql_neighbors, EngineBlastProvider, CliSemanticScope, SemanticQueryArgs,
};
use super::semantic_output::{
    build_query_response, hit_from_semantic, SemanticHitJson, SemanticQueryJsonResponse,
};
use crate::analysis::{
    expand_semantic_hits, query_communities, query_index_with_fusion, AnalysisResults,
    BlastSummaryProvider, CommunityQueryContext, OnnxReloadOptions, SemanticExpandConfig,
    SemanticExpandMode, SemanticFusionConfig, SemanticIndex,
};
use anyhow::{Context, Result};
use rgbuilder_graph::backend::GraphBackend;
use rgbuilder_graph::CodeGraph;
use serde::Serialize;
use std::path::{Path, PathBuf};

/// Summary for `GET /api/semantic/status`.
#[derive(Debug, Clone, Serialize)]
pub struct SemanticStatusResponse {
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dimensions: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub functions_indexed: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub graph_digest: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

pub fn semantic_index_path(repo: &Path) -> PathBuf {
    SemanticIndex::default_path(repo)
}

pub fn semantic_status(repo: &Path) -> SemanticStatusResponse {
    let path = semantic_index_path(repo);
    if !path.is_file() {
        return SemanticStatusResponse {
            available: false,
            model_id: None,
            dimensions: None,
            functions_indexed: None,
            graph_digest: None,
            message: Some(
                "Semantic index not found — run `rg-build semantic index` then refresh.".into(),
            ),
        };
    }

    match SemanticIndex::load(&path) {
        Ok(index) => SemanticStatusResponse {
            available: true,
            model_id: Some(index.model_id.clone()),
            dimensions: Some(index.dimensions),
            functions_indexed: Some(index.len()),
            graph_digest: index.graph_digest.clone(),
            message: None,
        },
        Err(err) => SemanticStatusResponse {
            available: false,
            model_id: None,
            dimensions: None,
            functions_indexed: None,
            graph_digest: None,
            message: Some(format!("Failed to load semantic index: {err}")),
        },
    }
}

/// Run a semantic query against a loaded index (CLI + HTTP).
pub fn execute_semantic_query(
    repo: &Path,
    graph: &CodeGraph,
    index: &SemanticIndex,
    args: &SemanticQueryArgs,
) -> Result<SemanticQueryJsonResponse> {
    let reload = OnnxReloadOptions {
        model_path: args.model.clone(),
        tokenizer_path: args.tokenizer.clone(),
    };

    let analysis_path = repo.join(".rgbuilder/analysis_results.bin");
    let analysis = if analysis_path.is_file() {
        Some(
            AnalysisResults::load(&analysis_path)
                .with_context(|| format!("load analysis results {}", analysis_path.display()))?,
        )
    } else {
        None
    };

    let fusion = SemanticFusionConfig {
        enabled: args.fusion,
        candidate_pool: args.candidate_pool.max(args.limit),
        keyword_and: args.keyword_and,
        ..SemanticFusionConfig::default()
    };

    if args.scope == CliSemanticScope::Community {
        let analysis = analysis.ok_or_else(|| {
            anyhow::anyhow!(
                "community semantic search requires analysis_results.bin (run `rg-build discover`)"
            )
        })?;
        let backend = graph.backend();
        let ctx = CommunityQueryContext::from_analysis(&analysis, |uuid| {
            backend
                .get_node(uuid)
                .ok()
                .flatten()
                .map(|n| (n.name.to_string(), n.file_path.as_ref().map(|s| s.to_string())))
        });
        let labels: std::collections::HashMap<_, _> = ctx
            .communities
            .iter()
            .map(|c| (c.id, c.label.clone()))
            .collect();
        let community_hits = query_communities(
            index,
            &analysis,
            &labels,
            &args.query,
            args.limit,
            &reload,
        )?;
        let hits: Vec<SemanticHitJson> = community_hits
            .into_iter()
            .map(|h| SemanticHitJson {
                node_id: h.community_id.to_string(),
                name: h.label.clone(),
                qualified_name: Some(format!("community:{}", h.community_id)),
                file_path: Some(format!("{} members", h.member_count)),
                distance: h.distance,
                score: h.score,
                fused_score: None,
                ranking: Some("community".into()),
            })
            .collect();
        return Ok(build_query_response(
            &args.query,
            &index.model_id,
            index.dimensions,
            hits,
            None,
        ));
    }

    let hits = query_index_with_fusion(
        index,
        &args.query,
        args.limit,
        &reload,
        &fusion,
        analysis.as_ref(),
        Some(repo),
    )?;

    let backend = graph.backend();
    let graph_digest = index.graph_digest.clone();

    let expansion = if let Some(mode) = args.expand {
        let expand_mode = match mode {
            super::semantic::CliExpandMode::Neighbors => SemanticExpandMode::Neighbors,
            super::semantic::CliExpandMode::Blast => SemanticExpandMode::Blast,
            super::semantic::CliExpandMode::Gql => SemanticExpandMode::Gql,
            super::semantic::CliExpandMode::All => SemanticExpandMode::All,
        };
        let config = SemanticExpandConfig {
            mode: expand_mode,
            call_depth: args.expand_depth.max(1),
            anchor_limit: args.limit.min(5),
            per_anchor_limit: 20,
        };
        let blast_provider = EngineBlastProvider {
            repo,
            backend,
            graph_digest: graph_digest.clone(),
        };
        let mut expansion = expand_semantic_hits(
            backend,
            &hits,
            &config,
            if matches!(
                expand_mode,
                SemanticExpandMode::Blast | SemanticExpandMode::All
            ) {
                Some(&blast_provider as &dyn BlastSummaryProvider)
            } else {
                None
            },
        )?;

        if matches!(
            expand_mode,
            SemanticExpandMode::Gql | SemanticExpandMode::All
        ) {
            expansion.gql = Some(expand_gql_neighbors(
                backend,
                &hits,
                args.expand_depth.max(1),
                config.anchor_limit,
            )?);
        }
        Some(expansion)
    } else {
        None
    };

    let hit_json: Vec<_> = hits
        .iter()
        .map(|hit| hit_from_semantic(&hit.entry, hit.distance, index.dimensions, Some(hit)))
        .collect();

    Ok(build_query_response(
        &args.query,
        &index.model_id,
        index.dimensions,
        hit_json,
        expansion,
    ))
}
