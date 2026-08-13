use tauri::{AppHandle, Runtime};

use std::path::{Path, PathBuf};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum AppEnvironment {
    Development,
    Staging,
    Production,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct AppIdentity {
    pub environment: AppEnvironment,
    pub product_name: &'static str,
    pub bundle_identifier: &'static str,
    pub deep_link_scheme: &'static str,
    pub keyring_service: &'static str,
    pub keychain_access_group: &'static str,
    pub nest_directory: &'static str,
    pub managed_runtime_directory: &'static str,
    pub cli_link_name: &'static str,
    pub provider_binding_path: &'static str,
    pub browser_checkpoint_path: &'static str,
}

const DEVELOPMENT: AppIdentity = AppIdentity {
    environment: AppEnvironment::Development,
    product_name: "Namleh Buzz Dev",
    bundle_identifier: "com.namlehstudios.buzz.dev",
    deep_link_scheme: "namleh-buzz-dev",
    keyring_service: "com.namlehstudios.buzz.dev.credentials",
    keychain_access_group: "962M5A4PL7.com.namlehstudios.buzz.dev",
    nest_directory: ".namleh-buzz-dev",
    managed_runtime_directory: "Namleh Buzz Dev",
    cli_link_name: "namleh-buzz-dev",
    provider_binding_path: "com.namlehstudios.buzz.dev/provider-bindings",
    browser_checkpoint_path: "com.namlehstudios.buzz.dev/browser-checkpoints",
};

const STAGING: AppIdentity = AppIdentity {
    environment: AppEnvironment::Staging,
    product_name: "Namleh Buzz Staging",
    bundle_identifier: "com.namlehstudios.buzz.staging",
    deep_link_scheme: "namleh-buzz-staging",
    keyring_service: "com.namlehstudios.buzz.staging.credentials",
    keychain_access_group: "962M5A4PL7.com.namlehstudios.buzz.staging",
    nest_directory: ".namleh-buzz-staging",
    managed_runtime_directory: "Namleh Buzz Staging",
    cli_link_name: "namleh-buzz-staging",
    provider_binding_path: "com.namlehstudios.buzz.staging/provider-bindings",
    browser_checkpoint_path: "com.namlehstudios.buzz.staging/browser-checkpoints",
};

const PRODUCTION: AppIdentity = AppIdentity {
    environment: AppEnvironment::Production,
    product_name: "Namleh Buzz",
    bundle_identifier: "com.namlehstudios.buzz",
    deep_link_scheme: "namleh-buzz",
    keyring_service: "com.namlehstudios.buzz.credentials",
    keychain_access_group: "962M5A4PL7.com.namlehstudios.buzz",
    nest_directory: ".namleh-buzz",
    managed_runtime_directory: "Namleh Buzz",
    cli_link_name: "namleh-buzz",
    provider_binding_path: "com.namlehstudios.buzz/provider-bindings",
    browser_checkpoint_path: "com.namlehstudios.buzz/browser-checkpoints",
};

pub(crate) fn current() -> &'static AppIdentity {
    match env!("NAMLEH_DESKTOP_APP_ENV") {
        "development" => &DEVELOPMENT,
        "staging" => &STAGING,
        "production" => &PRODUCTION,
        _ => panic!("invalid NAMLEH_DESKTOP_APP_ENV"),
    }
}

pub(crate) fn isolated_storage_paths(root: &Path) -> [PathBuf; 2] {
    let identity = current();
    [
        root.join(identity.provider_binding_path),
        root.join(identity.browser_checkpoint_path),
    ]
}

pub(crate) fn ensure_isolated_storage() -> Result<(), String> {
    let root = dirs::data_dir().ok_or("cannot resolve platform data directory")?;
    for path in isolated_storage_paths(&root) {
        std::fs::create_dir_all(&path)
            .map_err(|error| format!("create isolated storage {}: {error}", path.display()))?;
    }
    Ok(())
}

#[cfg(any(feature = "mesh-llm", test))]
pub(crate) fn mesh_cache_environment() -> [(&'static str, PathBuf); 7] {
    let root = dirs::cache_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join(current().bundle_identifier)
        .join("mesh-llm");
    [
        ("HF_HOME", root.join("huggingface")),
        ("HF_HUB_CACHE", root.join("huggingface").join("hub")),
        (
            "HUGGINGFACE_HUB_CACHE",
            root.join("huggingface").join("hub"),
        ),
        ("HF_XET_CACHE", root.join("huggingface").join("xet")),
        ("MESH_LLM_DATA_DIR", root.join("data")),
        ("MESH_LLM_RUNTIME_ROOT", root.join("runtime")),
        ("MESH_LLM_HASH_CACHE_DIR", root.join("hashes")),
    ]
}

#[cfg(feature = "mesh-llm")]
pub(crate) fn configure_process_cache_environment() {
    for (name, path) in mesh_cache_environment() {
        std::env::set_var(name, path);
    }
}

pub(crate) fn validate_runtime_config<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let identity = current();
    let configured_identifier = app.config().identifier.as_str();
    let identifier_matches = configured_identifier == identity.bundle_identifier
        || (identity.environment == AppEnvironment::Development
            && configured_identifier
                .strip_prefix(identity.bundle_identifier)
                .is_some_and(|suffix| suffix.starts_with('.')));
    if !identifier_matches {
        return Err(format!(
            "compiled {} identity does not match configured bundle identifier {}",
            identity.bundle_identifier,
            app.config().identifier
        ));
    }
    let configured_name = app.package_info().name.as_str();
    let name_matches = configured_name == identity.product_name
        || (identity.environment == AppEnvironment::Development
            && configured_name.starts_with("Namleh Buzz Dev ("));
    if !name_matches {
        return Err(format!(
            "compiled {} identity does not match configured product name {}",
            identity.product_name,
            app.package_info().name
        ));
    }
    for path in [
        identity.provider_binding_path,
        identity.browser_checkpoint_path,
    ] {
        if !path.starts_with(identity.bundle_identifier) {
            return Err(format!(
                "compiled {} identity has an unscoped storage path {path}",
                identity.bundle_identifier
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{current, AppEnvironment};

    #[test]
    fn default_test_build_uses_namleh_development_identity() {
        let identity = current();
        assert_eq!(identity.environment, AppEnvironment::Development);
        assert_eq!(identity.bundle_identifier, "com.namlehstudios.buzz.dev");
        assert_eq!(identity.deep_link_scheme, "namleh-buzz-dev");
        assert!(!identity.keyring_service.contains("buzz-desktop"));
        assert_eq!(
            identity.keychain_access_group,
            "962M5A4PL7.com.namlehstudios.buzz.dev"
        );
        assert!(!identity.nest_directory.starts_with(".buzz"));
        assert!(identity
            .provider_binding_path
            .starts_with(identity.bundle_identifier));
        assert!(identity
            .browser_checkpoint_path
            .starts_with(identity.bundle_identifier));
    }

    #[test]
    fn mesh_cache_paths_are_scoped_to_the_current_bundle_identifier() {
        let identifier = current().bundle_identifier;
        for (_, path) in super::mesh_cache_environment() {
            assert!(
                path.components()
                    .any(|component| component.as_os_str() == identifier),
                "{} is not scoped to {identifier}",
                path.display()
            );
        }
    }

    #[test]
    fn provider_and_browser_storage_resolve_under_the_current_bundle() {
        let root = std::path::Path::new("/platform-data");
        let paths = super::isolated_storage_paths(root);
        assert_eq!(
            paths[0],
            root.join("com.namlehstudios.buzz.dev/provider-bindings")
        );
        assert_eq!(
            paths[1],
            root.join("com.namlehstudios.buzz.dev/browser-checkpoints")
        );
        assert!(paths
            .iter()
            .all(|path| !path.to_string_lossy().contains("xyz.block.buzz.app")));
    }
}
