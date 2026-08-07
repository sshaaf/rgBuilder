//! Built-in Tier 1 language plugin registration.

use rgbuilder_registry::LanguageRegistry;

/// Register all Tier 1 language plugins.
pub fn register_languages(registry: &mut LanguageRegistry) {
    rgbuilder_lang_rust::register(registry);
    rgbuilder_lang_python::register(registry);
    rgbuilder_lang_javascript::register(registry);
    rgbuilder_lang_typescript::register(registry);
    rgbuilder_lang_go::register(registry);
    rgbuilder_lang_java::register(registry);
    rgbuilder_lang_csharp::register(registry);
    rgbuilder_lang_c::register(registry);
    rgbuilder_lang_cpp::register(registry);
}

/// Default registry with config formats and all built-in languages.
pub fn default_registry() -> LanguageRegistry {
    let mut registry = LanguageRegistry::with_config_formats();
    register_languages(&mut registry);
    registry
}
