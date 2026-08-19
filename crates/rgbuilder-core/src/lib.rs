//! rgBuilder core library facade — one dependency for graph, analysis, pipeline, and plugins.
#![warn(missing_docs)]

/// Process memory monitoring utilities.
pub mod memory;

/// Graph and program analysis algorithms (`rgbuilder-analysis`).
pub use rgbuilder_analysis as analysis;
/// Shared error types.
pub use rgbuilder_error::{Error, Result};
/// Export helpers for analysis artifacts.
pub use rgbuilder_export as export;
/// Language extraction and discovery.
pub use rgbuilder_extraction as extraction;
/// Graph query language (GQL).
pub use rgbuilder_gql as gql;
/// Graph storage and query layer.
pub use rgbuilder_graph as graph;
/// Incremental update pipeline.
pub use rgbuilder_incremental as incremental;
/// Multi-stage processing pipeline.
pub use rgbuilder_pipeline as pipeline;
/// Language plugin API types.
pub use rgbuilder_plugin_api as plugin;
/// Project configuration parsing.
pub use rgbuilder_project_config as config;
/// Language registry.
pub use rgbuilder_registry as registry;
/// Rule engine.
pub use rgbuilder_rules as rules;
/// Security scanning helpers.
pub use rgbuilder_security as security;
/// Semantic analysis (signatures, IDL).
pub use rgbuilder_semantic as semantic;

pub use rgbuilder_extraction::discovery;
pub use rgbuilder_graph::CodeGraph;
pub use rgbuilder_incremental::changes;
pub use rgbuilder_incremental::{
    ChangeDetail, ChangeDetectionResult, ChangeDetector, ChangeSet, ChangeSummary, FileTracker,
    IncrementalUpdater, UpdateOptions, UpdateResult,
};
pub use rgbuilder_pipeline::parallel;
pub use rgbuilder_pipeline::{PipelineConfig, PipelineStats, ProcessingPipeline, par_filter_map};
pub use rgbuilder_project_config::analyzer::{ConfigAnalyzer, MissingEnvVar, UnusedConfigKey};
pub use rgbuilder_project_config::drift::{
    ConfigDiffEntry, ConfigDiffKind, ConfigDriftReport, compare_configs, format_drift_report,
};
pub use rgbuilder_project_config::project::{HooksConfig, RgbuilderConfig, RiskLevel, WatchConfig};
pub use rgbuilder_project_config::secret_detector::{
    DetectedSecret, SecretDetector, Severity as SecretSeverity,
};
pub use rgbuilder_registry::LanguageRegistry;
pub use rgbuilder_rules::{RuleApplicationReport, RuleEngine, Ruleset};
pub use rgbuilder_semantic::{
    FunctionSignature, IdlFormat, IdlGenerator, SignatureExtractor, TypeInferencer,
};

/// Crate version string (matches `CARGO_PKG_VERSION`).
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
