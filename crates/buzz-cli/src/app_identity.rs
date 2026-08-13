use std::ffi::OsStr;
use std::path::Path;
use std::sync::OnceLock;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum AppEnvironment {
    Development,
    Staging,
    Production,
}

static PROCESS_ENVIRONMENT: OnceLock<AppEnvironment> = OnceLock::new();

pub(crate) fn initialize_from_argv0(argv0: Option<&OsStr>) {
    let _ = PROCESS_ENVIRONMENT.set(resolve_environment(
        std::env::var("BUZZ_DEEP_LINK_SCHEME").ok().as_deref(),
        std::env::var("BUZZ_APP_BUNDLE_IDENTIFIER").ok().as_deref(),
        argv0
            .map(Path::new)
            .and_then(Path::file_name)
            .and_then(OsStr::to_str),
    ));
}

fn resolve_environment(
    scheme: Option<&str>,
    bundle_identifier: Option<&str>,
    executable_name: Option<&str>,
) -> AppEnvironment {
    for value in [scheme, bundle_identifier, executable_name]
        .into_iter()
        .flatten()
        .map(str::trim)
    {
        match value {
            "namleh-buzz-dev" | "com.namlehstudios.buzz.dev" => {
                return AppEnvironment::Development;
            }
            "namleh-buzz-staging" | "com.namlehstudios.buzz.staging" => {
                return AppEnvironment::Staging;
            }
            "namleh-buzz" | "com.namlehstudios.buzz" => {
                return AppEnvironment::Production;
            }
            _ => {}
        }
    }
    AppEnvironment::Production
}

fn current() -> AppEnvironment {
    PROCESS_ENVIRONMENT
        .get()
        .copied()
        .unwrap_or(AppEnvironment::Production)
}

pub(crate) fn deep_link_scheme() -> &'static str {
    match current() {
        AppEnvironment::Development => "namleh-buzz-dev",
        AppEnvironment::Staging => "namleh-buzz-staging",
        AppEnvironment::Production => "namleh-buzz",
    }
}

pub(crate) fn bundle_identifier() -> &'static str {
    match current() {
        AppEnvironment::Development => "com.namlehstudios.buzz.dev",
        AppEnvironment::Staging => "com.namlehstudios.buzz.staging",
        AppEnvironment::Production => "com.namlehstudios.buzz",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standalone_cli_names_resolve_without_environment_variables() {
        assert_eq!(
            resolve_environment(None, None, Some("namleh-buzz-dev")),
            AppEnvironment::Development
        );
        assert_eq!(
            resolve_environment(None, None, Some("namleh-buzz-staging")),
            AppEnvironment::Staging
        );
        assert_eq!(
            resolve_environment(None, None, Some("namleh-buzz")),
            AppEnvironment::Production
        );
    }

    #[test]
    fn managed_environment_identity_takes_precedence_over_binary_name() {
        assert_eq!(
            resolve_environment(
                Some("namleh-buzz-staging"),
                Some("com.namlehstudios.buzz.staging"),
                Some("buzz")
            ),
            AppEnvironment::Staging
        );
    }

    #[test]
    fn upstream_and_unknown_names_fail_closed_to_namleh_production() {
        assert_eq!(
            resolve_environment(Some("buzz"), Some("xyz.block.buzz.app"), Some("buzz")),
            AppEnvironment::Production
        );
    }
}
