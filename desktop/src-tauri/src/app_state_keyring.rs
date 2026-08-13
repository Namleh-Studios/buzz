/// Service name for the desktop OS keyring. Every Namleh environment has a
/// distinct service, while standalone worktree launches may request a scoped
/// development service.
fn dev_keyring_service(configured: Option<String>) -> String {
    let base = crate::app_identity::current().keyring_service;
    configured
        .filter(|service| {
            service
                .strip_prefix(base)
                .is_some_and(|suffix| suffix.starts_with('.'))
        })
        .unwrap_or_else(|| base.to_string())
}

pub(crate) fn keyring_service() -> &'static str {
    if crate::app_identity::current().environment
        == crate::app_identity::AppEnvironment::Development
    {
        static DEV_SERVICE: std::sync::OnceLock<String> = std::sync::OnceLock::new();
        DEV_SERVICE
            .get_or_init(|| dev_keyring_service(std::env::var("BUZZ_DEV_KEYRING_SERVICE").ok()))
            .as_str()
    } else {
        crate::app_identity::current().keyring_service
    }
}

pub(super) fn migration_marker_name(service: &str, default_name: &str) -> String {
    if service == crate::app_identity::current().keyring_service {
        default_name.to_string()
    } else {
        format!("identity.{service}.migrated")
    }
}

#[cfg(test)]
mod tests {
    use super::{dev_keyring_service, migration_marker_name};

    #[test]
    fn standalone_scope_must_remain_under_dev_service() {
        assert_eq!(
            dev_keyring_service(Some(
                "com.namlehstudios.buzz.dev.credentials.example".to_string()
            )),
            "com.namlehstudios.buzz.dev.credentials.example"
        );
        assert_eq!(
            dev_keyring_service(Some("buzz-desktop".to_string())),
            "com.namlehstudios.buzz.dev.credentials"
        );
    }

    #[test]
    fn standalone_scope_uses_its_own_migration_marker() {
        assert_eq!(
            migration_marker_name(
                "com.namlehstudios.buzz.dev.credentials",
                "identity.migrated"
            ),
            "identity.migrated"
        );
        assert_eq!(
            migration_marker_name(
                "com.namlehstudios.buzz.dev.credentials.example",
                "identity.migrated"
            ),
            "identity.com.namlehstudios.buzz.dev.credentials.example.migrated"
        );
    }
}
