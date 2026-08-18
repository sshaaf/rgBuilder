//! `rg-build metrics` — PageRank, betweenness, and community detection.

use super::args::OutputFormat;
use super::context::CliContext;
use super::metrics_output::{
    MetricsCommunitiesSection, MetricsPagerankSection, build_metrics_response,
    metrics_response_to_json,
};
use crate::analysis::{
    BetweennessCentrality, CommunityDetector, FastPageRank, PetGraphView,
    community_edge_types_for_backend, default_behavioral_edges,
};
use anyhow::Result;
use serde_json::json;

pub struct MetricsArgs {
    pub pagerank: bool,
    pub betweenness: bool,
    pub communities: bool,
    pub iterations: Option<usize>,
}

pub fn run(ctx: &CliContext, args: MetricsArgs) -> Result<()> {
    let run_all = !args.pagerank && !args.betweenness && !args.communities;
    let graph = ctx.load_graph()?;
    let view = PetGraphView::from_backend(graph.backend())?;
    let iterations = args.iterations.unwrap_or(20);
    let allowed = default_behavioral_edges();

    let mut pagerank = None;
    let mut betweenness = None;
    let mut communities = None;

    if args.pagerank || run_all {
        let engine = FastPageRank::new(iterations, 0.85);
        let (scores, stats) = engine.compute(&view, allowed);
        let mut top: Vec<_> = scores
            .iter()
            .filter(|(_, score)| **score > 0.0)
            .map(|(id, score)| (*id, *score))
            .collect();
        if top.is_empty() {
            top = scores.iter().map(|(id, score)| (*id, *score)).collect();
        }
        top.sort_unstable_by(|a, b| b.1.total_cmp(&a.1));
        top.truncate(20);
        let top = top
            .iter()
            .map(|(id, score)| json!({ "node": id.to_string(), "pagerank": score }))
            .collect();
        pagerank = Some(MetricsPagerankSection {
            top,
            converged: stats.converged,
            iterations: stats.iterations_run,
            max_delta: stats.max_delta,
        });
    }

    if args.betweenness || run_all {
        let bc = BetweennessCentrality::compute_unbounded(&view, allowed);
        let mut top: Vec<_> = bc.iter().map(|(id, score)| (id, *score)).collect();
        top.sort_unstable_by(|a, b| b.1.total_cmp(&a.1));
        top.truncate(20);
        betweenness = Some(
            top.iter()
                .map(|(id, s)| json!({ "node": id.to_string(), "score": s }))
                .collect(),
        );
    }

    if args.communities || run_all {
        let detector = CommunityDetector::new();
        let allowed_comm = community_edge_types_for_backend(graph.backend());
        let result = detector.detect_with_view_filtered(&view, &allowed_comm)?;
        communities = Some(MetricsCommunitiesSection {
            count: result.communities.len(),
            modularity: result.modularity,
            assignments: result.assignments.len(),
        });
    }

    let response = build_metrics_response(pagerank, betweenness, communities);

    if ctx.format == OutputFormat::Json {
        ctx.emit_json_value(&metrics_response_to_json(&response))?;
    } else {
        if let Some(pr) = &response.pagerank {
            println!("PageRank: {:?}", pr);
        }
        if let Some(bc) = &response.betweenness {
            println!("Betweenness top: {:?}", bc);
        }
        if let Some(cm) = &response.communities {
            println!("Communities: {:?}", cm);
        }
    }
    Ok(())
}
