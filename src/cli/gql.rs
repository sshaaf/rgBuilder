//! `rg-build gql` — graph query language execution.

use super::args::OutputFormat;
use super::context::CliContext;
use super::gql_output::gql_result_to_json;
use anyhow::Result;
use rgbuilder_analysis::{AnalysisResults, CommunityQueryContext};
use rgbuilder_graph::backend::GraphBackend;

pub struct GqlArgs {
    pub query: String,
    pub explain: bool,
    pub macro_name: Option<String>,
}

pub fn run(ctx: &CliContext, args: GqlArgs) -> Result<()> {
    use crate::gql::{
        QueryMacroRegistry, execute_explain_with_community, execute_macro_with_community,
        execute_with_community,
    };

    let graph = ctx.load_graph()?;
    let backend = graph.backend();
    let registry = QueryMacroRegistry::with_defaults();
    let community = load_community_context(ctx, backend);

    let result = if let Some(name) = args.macro_name {
        execute_macro_with_community(backend, &registry, &name, community.as_ref())?
    } else if args.explain {
        execute_explain_with_community(backend, &args.query, community.as_ref())?
    } else {
        execute_with_community(backend, &args.query, community.as_ref())?
    };

    if ctx.format == OutputFormat::Json {
        return ctx.emit_json_value(&gql_result_to_json(&result, args.explain));
    }

    if args.explain {
        if let Some(plan) = result.plan {
            for step in &plan.steps {
                println!("{}: {}", step.operation, step.detail);
            }
            println!();
        }
    }

    for row in &result.rows {
        let names: Vec<_> = row.values().map(|binding| binding.name.clone()).collect();
        println!("{}", names.join(" -> "));
    }
    Ok(())
}

pub(crate) fn load_community_context(
    ctx: &CliContext,
    backend: &rgbuilder_graph::backend::MemoryBackend,
) -> Option<CommunityQueryContext> {
    let path = ctx.repo.join(".rgbuilder/analysis_results.bin");
    if !path.is_file() {
        return None;
    }
    let analysis = AnalysisResults::load(&path).ok()?;
    Some(CommunityQueryContext::from_analysis(&analysis, |uuid| {
        backend.get_node(uuid).ok().flatten().map(|n| {
            (
                n.name.to_string(),
                n.file_path.as_ref().map(|s| s.to_string()),
            )
        })
    }))
}
