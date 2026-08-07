//! Language plugin registry wrapper (languages live in `rgbuilder-lang-*` crates).

pub use rgbuilder_config_formats as config;
pub use rgbuilder_lang_runtime as generic;
pub use rgbuilder_plugin_api as plugin_trait;
pub use rgbuilder_plugin_helpers as extraction;
pub use rgbuilder_registry::{plugin_abi, plugin_loader};

pub mod registry;

pub use registry::LanguageRegistry;

/// No-op alias; wiring happens in [`registry::ensure_initialized`].
pub fn ensure_registry_initialized() {
    registry::ensure_initialized();
}
