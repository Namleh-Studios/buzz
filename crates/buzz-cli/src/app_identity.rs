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

pub(crate) fn initialize_from_argv0(argv0: Option<&OsStr>) -> Result<(), String> {
    let environment = resolve_environment(
        std::env::var("BUZZ_DEEP_LINK_SCHEME").ok().as_deref(),
        std::env::var("BUZZ_APP_BUNDLE_IDENTIFIER").ok().as_deref(),
        argv0
            .map(Path::new)
            .and_then(Path::file_name)
            .and_then(OsStr::to_str),
    )?;
    let _ = PROCESS_ENVIRONMENT.set(environment);
    Ok(())
}

fn resolve_environment(
    scheme: Option<&str>,
    bundle_identifier: Option<&str>,
    executable_name: Option<&str>,
) -> Result<AppEnvironment, String> {
    fn parse(value: &str) -> Option<AppEnvironment> {
        match value.trim() {
            "namleh-buzz-dev" | "com.namlehstudios.buzz.dev" => Some(AppEnvironment::Development),
            "namleh-buzz-staging" | "com.namlehstudios.buzz.staging" => {
                Some(AppEnvironment::Staging)
            }
            "namleh-buzz" | "com.namlehstudios.buzz" => Some(AppEnvironment::Production),
            _ => None,
        }
    }

    let supplied = [scheme, bundle_identifier, executable_name]
        .into_iter()
        .flatten()
        .filter_map(parse)
        .collect::<Vec<_>>();
    let environment = supplied
        .first()
        .copied()
        .unwrap_or(AppEnvironment::Production);
    if supplied.iter().any(|candidate| *candidate != environment) {
        return Err("conflicting Namleh Buzz application identities".to_string());
    }
    Ok(environment)
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
            resolve_environment(None, None, Some("namleh-buzz-dev")).unwrap(),
            AppEnvironment::Development
        );
        assert_eq!(
            resolve_environment(None, None, Some("namleh-buzz-staging")).unwrap(),
            AppEnvironment::Staging
        );
        assert_eq!(
            resolve_environment(None, None, Some("namleh-buzz")).unwrap(),
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
            )
            .unwrap(),
            AppEnvironment::Staging
        );
    }

    #[test]
    fn upstream_and_unknown_names_fail_closed_to_namleh_production() {
        assert_eq!(
            resolve_environment(Some("buzz"), Some("xyz.block.buzz.app"), Some("buzz")).unwrap(),
            AppEnvironment::Production
        );
    }

    #[test]
    fn conflicting_recognized_identities_are_rejected() {
        assert!(resolve_environment(
            Some("namleh-buzz-dev"),
            Some("com.namlehstudios.buzz.dev"),
            Some("namleh-buzz-staging"),
        )
        .is_err());
        assert!(resolve_environment(
            Some("namleh-buzz-staging"),
            Some("com.namlehstudios.buzz"),
            Some("buzz"),
        )
        .is_err());
    }
}
