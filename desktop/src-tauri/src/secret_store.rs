//! Environment-scoped OS keyring access for desktop secrets.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyringProbe {
    Present,
    ReachableButEmpty,
    Unreachable,
}

const BLOB_KEY: &str = "secrets";
const DPK_RESET_PENDING_KEY: &str = "dpk-reset-pending";
fn blob_lockfile_path(service: &str) -> PathBuf {
    #[cfg(unix)]
    {
        // Use the real UID so distinct users get distinct lockfiles.
        // SAFETY: getuid() is always safe on Unix — it never fails.
        let uid = unsafe { libc::getuid() };
        PathBuf::from(format!("/tmp/buzz-keychain-{uid}-{service}.lock"))
    }
    #[cfg(not(unix))]
    {
        std::env::temp_dir().join(format!("buzz-keychain-{service}.lock"))
    }
}

#[cfg(feature = "system-keyring")]
fn acquire_blob_lock(service: &str) -> Result<BlobLockGuard, String> {
    let path = blob_lockfile_path(service);
    BlobLockGuard::acquire(&path)
}

#[cfg(feature = "system-keyring")]
struct BlobLockGuard {
    #[cfg(unix)]
    #[allow(dead_code)]
    file: std::fs::File,
    #[cfg(windows)]
    mutex_handle: windows_sys::Win32::Foundation::HANDLE,
}

#[cfg(feature = "system-keyring")]
impl BlobLockGuard {
    fn acquire(path: &std::path::Path) -> Result<Self, String> {
        #[cfg(unix)]
        {
            let file = std::fs::OpenOptions::new()
                .create(true)
                .truncate(false)
                .write(true)
                .open(path)
                .map_err(|e| format!("blob lock open {}: {e}", path.display()))?;
            use std::os::unix::io::AsRawFd;
            let ret = unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX) };
            if ret != 0 {
                let err = std::io::Error::last_os_error();
                return Err(format!("blob lock flock: {err}"));
            }
            return Ok(BlobLockGuard { file });
        }

        #[cfg(windows)]
        {
            let name_str = format!(
                "Local\\BuzzKeychain-{}",
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("default")
            );
            let name_wide: Vec<u16> = name_str
                .encode_utf16()
                .chain(std::iter::once(0u16))
                .collect();
            use windows_sys::Win32::Foundation::WAIT_OBJECT_0;
            use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
            use windows_sys::Win32::System::Threading::{
                CreateMutexW, WaitForSingleObject, INFINITE,
            };
            let handle = unsafe {
                CreateMutexW(
                    std::ptr::null::<SECURITY_ATTRIBUTES>(),
                    0,
                    name_wide.as_ptr(),
                )
            };
            if handle.is_null() {
                let err = std::io::Error::last_os_error();
                return Err(format!("blob lock CreateMutexW: {err}"));
            }
            let wait_result = unsafe { WaitForSingleObject(handle, INFINITE) };
            if wait_result != WAIT_OBJECT_0 {
                if wait_result != windows_sys::Win32::Foundation::WAIT_ABANDONED {
                    let err = std::io::Error::last_os_error();
                    unsafe { windows_sys::Win32::Foundation::CloseHandle(handle) };
                    return Err(format!(
                        "blob lock WaitForSingleObject: {wait_result} / {err}"
                    ));
                }
            }
            return Ok(BlobLockGuard {
                mutex_handle: handle,
            });
        }

        #[allow(unreachable_code)]
        Err("blob lock: unsupported platform".to_string())
    }
}

#[cfg(feature = "system-keyring")]
impl Drop for BlobLockGuard {
    fn drop(&mut self) {
        #[cfg(unix)]
        {}
        #[cfg(windows)]
        {
            unsafe {
                windows_sys::Win32::System::Threading::ReleaseMutex(self.mutex_handle);
                windows_sys::Win32::Foundation::CloseHandle(self.mutex_handle);
            }
        }
    }
}

pub struct SecretStore {
    service: String,
    cache: Mutex<Option<HashMap<String, String>>>,
}

impl SecretStore {
    pub fn keyring(service: impl Into<String>) -> Self {
        SecretStore {
            service: service.into(),
            cache: Mutex::new(None),
        }
    }

    pub fn shared(service: &'static str) -> &'static SecretStore {
        use std::sync::OnceLock;
        static INSTANCE: OnceLock<SecretStore> = OnceLock::new();
        INSTANCE.get_or_init(|| SecretStore::keyring(service))
    }
}

#[cfg(feature = "system-keyring")]
fn is_keyring_availability_error(error_str: &str) -> bool {
    let lower = error_str.to_lowercase();
    lower.contains("keyring")
        || lower.contains("dbus")
        || lower.contains("org.freedesktop.secrets")
        || lower.contains("platform secure storage")
        || lower.contains("no secret service")
}

#[cfg(feature = "system-keyring")]
fn keyring_entry(service: &str, key: &str) -> Result<keyring::Entry, keyring::Error> {
    keyring::Entry::new(service, key)
}

// macOS-specific imports for the Data Protection Keychain backend.
#[cfg(all(feature = "system-keyring", target_os = "macos"))]
use security_framework::base::Error as SFError;
#[cfg(all(feature = "system-keyring", target_os = "macos"))]
use security_framework::passwords::{
    delete_generic_password_options, generic_password, set_generic_password_options,
    PasswordOptions,
};

/// Returns true when the security-framework error is "item not found" (-25300).
#[cfg(all(feature = "system-keyring", target_os = "macos"))]
fn is_not_found(e: &SFError) -> bool {
    e.code() == -25300
}

/// Returns true when DPK is unavailable because the binary lacks the required
/// entitlement (`errSecMissingEntitlement`, -34018). This happens for unsigned
/// dev builds (`tauri dev` / `cargo run`). The caller should fall back to the
/// legacy `keyring` crate path, which uses the old-style keychain and does not
/// require hardened-runtime entitlements.
#[cfg(all(feature = "system-keyring", target_os = "macos"))]
fn is_dpk_unavailable(e: &SFError) -> bool {
    e.code() == -34018
}

/// Build a `PasswordOptions` for the Data Protection Keychain.
#[cfg(all(feature = "system-keyring", target_os = "macos"))]
fn dpk_opts(service: &str, key: &str) -> PasswordOptions {
    let mut opts = PasswordOptions::new_generic_password(service, key);
    opts.use_protected_keychain();
    opts.set_access_group(crate::app_identity::current().keychain_access_group);
    opts
}

#[cfg(all(feature = "system-keyring", target_os = "macos"))]
fn is_development() -> bool {
    crate::app_identity::current().environment == crate::app_identity::AppEnvironment::Development
}

#[cfg(feature = "system-keyring")]
fn write_development_mirrors<L, D>(write_legacy: L, write_dpk: D) -> Result<(), String>
where
    L: FnOnce() -> Result<(), String>,
    D: FnOnce() -> Result<(), String>,
{
    write_legacy()?;
    write_dpk()
}

impl SecretStore {
    #[cfg(all(feature = "system-keyring", target_os = "macos"))]
    fn pending_dpk_reset_keys(&self) -> Result<Option<Vec<String>>, String> {
        let entry = keyring_entry(&self.service, DPK_RESET_PENDING_KEY)
            .map_err(|e| format!("reset marker entry: {e}"))?;
        match entry.get_password() {
            Ok(value) => serde_json::from_str(&value)
                .map(Some)
                .map_err(|e| format!("reset marker json: {e}")),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("reset marker read: {e}")),
        }
    }

    #[cfg(all(feature = "system-keyring", target_os = "macos"))]
    fn write_pending_dpk_reset_keys(&self, keys: &[String]) -> Result<(), String> {
        let value = serde_json::to_string(keys).map_err(|e| format!("reset marker json: {e}"))?;
        let entry = keyring_entry(&self.service, DPK_RESET_PENDING_KEY)
            .map_err(|e| format!("reset marker entry: {e}"))?;
        entry
            .set_password(&value)
            .map_err(|e| format!("reset marker write: {e}"))
    }

    #[cfg(all(feature = "system-keyring", target_os = "macos"))]
    fn clear_pending_dpk_reset(&self) -> Result<(), String> {
        let entry = keyring_entry(&self.service, DPK_RESET_PENDING_KEY)
            .map_err(|e| format!("reset marker entry: {e}"))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("reset marker delete: {e}")),
        }
    }

    /// Finish a DPK cleanup deferred by an unsigned development reset. The
    /// legacy reset marker prevents a later signed launch from resurrecting
    /// credentials that the unsigned process could not access.
    #[cfg(all(feature = "system-keyring", target_os = "macos"))]
    fn finish_pending_dpk_reset(&self) -> Result<bool, String> {
        let Some(keys) = self.pending_dpk_reset_keys()? else {
            return Ok(false);
        };

        let blob_key = BLOB_KEY.to_string();
        for key in keys.iter().chain(std::iter::once(&blob_key)) {
            match delete_generic_password_options(dpk_opts(&self.service, key)) {
                Ok(()) => {}
                Err(ref error) if is_not_found(error) => {}
                Err(ref error) if is_dpk_unavailable(error) => return Ok(true),
                Err(error) => return Err(format!("pending dpk delete {key}: {error}")),
            }
        }
        self.clear_pending_dpk_reset()?;
        Ok(false)
    }

    /// Read the blob from the keychain and return the deserialized map.
    ///
    /// Returns `Ok(None)` when no blob entry exists yet (first launch or
    /// fresh install). Returns `Err` when the backend is unavailable or the
    /// stored JSON is corrupt.
    ///
    /// On success the result is stored in `self.cache` so subsequent calls
    /// within the same process return immediately without a keychain round-trip.
    #[cfg(feature = "system-keyring")]
    fn load_blob(&self) -> Result<Option<HashMap<String, String>>, String> {
        {
            let guard = self.cache.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(ref map) = *guard {
                return Ok(Some(map.clone()));
            }
        }

        let raw = self.read_blob_raw()?;
        let map = match raw {
            None => return Ok(None),
            Some(bytes) => {
                let json = String::from_utf8(bytes).map_err(|e| format!("blob utf8: {e}"))?;
                serde_json::from_str::<HashMap<String, String>>(&json)
                    .map_err(|e| format!("blob json: {e}"))?
            }
        };

        let mut guard = self.cache.lock().unwrap_or_else(|e| e.into_inner());
        if guard.is_none() {
            *guard = Some(map.clone());
        }
        Ok(Some(map))
    }

    #[cfg(all(feature = "system-keyring", target_os = "macos"))]
    fn read_blob_raw(&self) -> Result<Option<Vec<u8>>, String> {
        if is_development() && self.finish_pending_dpk_reset()? {
            return self.read_blob_raw_keyring();
        }
        if is_development() {
            if let Some(bytes) = self.read_blob_raw_keyring()? {
                match set_generic_password_options(&bytes, dpk_opts(&self.service, BLOB_KEY)) {
                    Ok(()) => {}
                    Err(ref error) if is_dpk_unavailable(error) => {}
                    Err(error) => return Err(format!("keychain mirror: {error}")),
                }
                return Ok(Some(bytes));
            }
        }
        match generic_password(dpk_opts(&self.service, BLOB_KEY)) {
            Ok(bytes) => {
                if is_development() {
                    self.write_blob_raw_keyring(&bytes)?;
                }
                Ok(Some(bytes))
            }
            Err(ref error)
                if is_development() && (is_not_found(error) || is_dpk_unavailable(error)) =>
            {
                self.read_blob_raw_keyring()
            }
            Err(ref error) if is_not_found(error) => Ok(None),
            Err(error) => Err(format!("keychain read: {error}")),
        }
    }

    #[cfg(all(feature = "system-keyring", not(target_os = "macos")))]
    fn read_blob_raw(&self) -> Result<Option<Vec<u8>>, String> {
        self.read_blob_raw_keyring()
    }

    #[cfg(feature = "system-keyring")]
    fn read_blob_raw_keyring(&self) -> Result<Option<Vec<u8>>, String> {
        let entry =
            keyring_entry(&self.service, BLOB_KEY).map_err(|e| format!("keyring entry: {e}"))?;
        match entry.get_password() {
            Ok(s) => Ok(Some(s.into_bytes())),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) if is_keyring_availability_error(&e.to_string()) => {
                Err(format!("keyring unavailable: {e}"))
            }
            Err(e) => Err(format!("keyring read: {e}")),
        }
    }

    #[cfg(feature = "system-keyring")]
    fn mutate_blob<F>(&self, f: F) -> Result<(), String>
    where
        F: FnOnce(&mut HashMap<String, String>),
    {
        let _lock = acquire_blob_lock(&self.service)?;

        let raw = self.read_blob_raw()?;
        let current: HashMap<String, String> = match raw {
            None => HashMap::new(),
            Some(bytes) => {
                let json = String::from_utf8(bytes).map_err(|e| format!("blob utf8: {e}"))?;
                serde_json::from_str::<HashMap<String, String>>(&json)
                    .map_err(|e| format!("blob json: {e}"))?
            }
        };

        let mut next = current.clone();
        f(&mut next);

        if next == current {
            let mut guard = self.cache.lock().unwrap_or_else(|e| e.into_inner());
            *guard = Some(current);
            return Ok(());
        }

        let json = serde_json::to_string(&next).map_err(|e| format!("blob serialize: {e}"))?;
        match self.write_blob_raw(json.as_bytes()) {
            Ok(()) => {
                let mut guard = self.cache.lock().unwrap_or_else(|e| e.into_inner());
                *guard = Some(next);
                Ok(())
            }
            Err(e) => {
                let mut guard = self.cache.lock().unwrap_or_else(|e| e.into_inner());
                *guard = None;
                Err(e)
            }
        }
    }

    #[cfg(all(feature = "system-keyring", target_os = "macos"))]
    fn write_blob_raw(&self, bytes: &[u8]) -> Result<(), String> {
        if is_development() {
            return write_development_mirrors(
                || self.write_blob_raw_keyring(bytes),
                || match set_generic_password_options(bytes, dpk_opts(&self.service, BLOB_KEY)) {
                    Ok(()) => Ok(()),
                    Err(ref error) if is_dpk_unavailable(error) => Ok(()),
                    Err(error) => Err(format!("keychain mirror: {error}")),
                },
            );
        }
        match set_generic_password_options(bytes, dpk_opts(&self.service, BLOB_KEY)) {
            Ok(()) => Ok(()),
            Err(error) => Err(format!("keychain write: {error}")),
        }
    }

    #[cfg(all(feature = "system-keyring", not(target_os = "macos")))]
    fn write_blob_raw(&self, bytes: &[u8]) -> Result<(), String> {
        self.write_blob_raw_keyring(bytes)
    }

    #[cfg(feature = "system-keyring")]
    fn write_blob_raw_keyring(&self, bytes: &[u8]) -> Result<(), String> {
        let value = std::str::from_utf8(bytes).map_err(|e| format!("blob utf8 encode: {e}"))?;
        let entry =
            keyring_entry(&self.service, BLOB_KEY).map_err(|e| format!("keyring entry: {e}"))?;
        entry
            .set_password(value)
            .map_err(|e| format!("keyring write: {e}"))
    }

    /// Probe whether `key` exists and whether the backend is reachable.
    pub fn probe(&self, key: &str) -> KeyringProbe {
        #[cfg(feature = "system-keyring")]
        {
            match self.load_blob() {
                Ok(Some(map)) => {
                    if map.contains_key(key) {
                        KeyringProbe::Present
                    } else {
                        // Blob exists but key absent — still check old per-key
                        // entries so a partial migration (e.g. identity migrated
                        // first) doesn't silently drop agent keys.
                        self.probe_legacy_key(key)
                    }
                }
                // No blob yet — check old per-key entries so callers that
                // gate `load()` on `Present` still trigger migration.
                Ok(None) => self.probe_legacy_key(key),
                Err(e) if is_keyring_availability_error(&e) => KeyringProbe::Unreachable,
                Err(_) => KeyringProbe::Unreachable, // corrupt blob — fail closed
            }
        }
        #[cfg(not(feature = "system-keyring"))]
        {
            let _ = key;
            KeyringProbe::Unreachable
        }
    }

    /// Check old per-key DPK/keyring entries for `key`. Used by `probe()` when
    /// the blob doesn't exist yet (first launch after upgrade).
    #[cfg(all(feature = "system-keyring", target_os = "macos"))]
    fn probe_legacy_key(&self, key: &str) -> KeyringProbe {
        match generic_password(dpk_opts(&self.service, key)) {
            Ok(_) => KeyringProbe::Present,
            Err(ref e) if is_not_found(e) => self.probe_legacy_key_keyring(key),
            Err(ref e) if is_dpk_unavailable(e) => self.probe_legacy_key_keyring(key),
            Err(ref e) if is_keyring_availability_error(&e.to_string()) => {
                KeyringProbe::Unreachable
            }
            Err(_) => KeyringProbe::ReachableButEmpty,
        }
    }

    #[cfg(all(feature = "system-keyring", not(target_os = "macos")))]
    fn probe_legacy_key(&self, key: &str) -> KeyringProbe {
        self.probe_legacy_key_keyring(key)
    }

    #[cfg(feature = "system-keyring")]
    fn probe_legacy_key_keyring(&self, key: &str) -> KeyringProbe {
        match keyring_entry(&self.service, key) {
            Ok(entry) => match entry.get_password() {
                Ok(_) => KeyringProbe::Present,
                Err(keyring::Error::NoEntry) => KeyringProbe::ReachableButEmpty,
                Err(e) if is_keyring_availability_error(&e.to_string()) => {
                    KeyringProbe::Unreachable
                }
                Err(_) => KeyringProbe::ReachableButEmpty,
            },
            Err(e) if is_keyring_availability_error(&e.to_string()) => KeyringProbe::Unreachable,
            Err(_) => KeyringProbe::Unreachable,
        }
    }

    /// Load the secret for `key`. `Ok(None)` when there is no entry; `Err` only
    /// when the backend errored in a way that is not "missing".
    ///
    /// On first launch after an upgrade from the per-key DPK format, the blob
    /// will not exist yet. In that case the macOS path falls back to reading the
    /// old per-key DPK entry for `key` specifically, writes it into a new blob,
    /// and deletes the old item — a one-time migration per key. The same
    /// migration fires when the blob exists but the key is absent, covering
    /// partial-migration scenarios (e.g. identity migrated first, agents not yet).
    pub fn load(&self, key: &str) -> Result<Option<String>, String> {
        #[cfg(feature = "system-keyring")]
        {
            match self.load_blob() {
                Ok(Some(map)) => {
                    if let Some(value) = map.get(key) {
                        Ok(Some(value.clone()))
                    } else {
                        // Blob exists but key absent — attempt migration from old
                        // per-key entry. migrate_legacy_key writes the result into
                        // the blob if found, so subsequent loads hit the cache.
                        self.migrate_legacy_key(key)
                    }
                }
                Ok(None) => {
                    // No blob yet — attempt one-time migration from old per-key
                    // DPK entry (macOS) or return Ok(None) (other platforms).
                    self.migrate_legacy_key(key)
                }
                Err(e) => Err(e),
            }
        }
        #[cfg(not(feature = "system-keyring"))]
        {
            let _ = key;
            Err("system-keyring feature disabled".to_string())
        }
    }

    /// Read the secret for `key` without any legacy-migration side effects.
    ///
    /// Read the entire blob without any legacy-migration side effects.
    ///
    /// Returns the full key→value map when a blob exists, `Ok(None)` when no
    /// blob has been written yet, and `Err` only when the backend is
    /// unavailable. Never calls `migrate_legacy_key`.
    #[cfg(test)]
    pub fn load_all_readonly(&self) -> Result<Option<HashMap<String, String>>, String> {
        #[cfg(feature = "system-keyring")]
        {
            self.load_blob()
        }
        #[cfg(not(feature = "system-keyring"))]
        {
            Err("system-keyring feature disabled".to_string())
        }
    }

    /// Insert all entries from `entries` into the blob in a single mutation.
    ///
    /// Entries that already exist in the blob are overwritten; entries not
    /// present in `entries` are left unchanged. If the resulting blob is
    /// identical to what is already stored, no keychain write occurs.
    #[cfg(test)]
    pub fn store_all(&self, entries: &HashMap<String, String>) -> Result<(), String> {
        #[cfg(feature = "system-keyring")]
        {
            self.mutate_blob(|map| {
                for (k, v) in entries {
                    map.insert(k.clone(), v.clone());
                }
            })
        }
        #[cfg(not(feature = "system-keyring"))]
        {
            let _ = entries;
            Err("system-keyring feature disabled".to_string())
        }
    }

    /// On first launch after upgrading from the per-key DPK format, read the
    /// old DPK entry for `key`, write it into a new blob, and delete the old
    /// item. Returns `Ok(None)` when no old entry exists.
    ///
    /// Also handles a one-time migration from the DPK blob format written by
    /// #1267 (before the dev/release split was fixed). Anyone who ran main
    /// while #1267 was present has a DPK blob instead of per-key entries; this
    /// reads it, merges all keys into the legacy blob, and deletes the DPK blob.
    #[cfg(all(feature = "system-keyring", target_os = "macos"))]
    fn migrate_legacy_key(&self, key: &str) -> Result<Option<String>, String> {
        // One-time migration: check for a DPK blob (key = BLOB_KEY = "secrets")
        // written by #1267 before the dev/release split was fixed.
        match generic_password(dpk_opts(&self.service, BLOB_KEY)) {
            Ok(bytes) => {
                let json = String::from_utf8(bytes).map_err(|e| format!("dpk blob utf8: {e}"))?;
                let dpk_map = serde_json::from_str::<HashMap<String, String>>(&json)
                    .map_err(|e| format!("dpk blob json: {e}"))?;
                // Merge all keys from the DPK blob into the legacy blob.
                self.mutate_blob(|map| {
                    for (k, v) in &dpk_map {
                        map.entry(k.clone()).or_insert_with(|| v.clone());
                    }
                })?;
                // Best-effort delete the DPK blob.
                let _ = delete_generic_password_options(dpk_opts(&self.service, BLOB_KEY));
                return Ok(dpk_map.get(key).cloned());
            }
            Err(ref e) if is_not_found(e) => {
                // No DPK blob — fall through to per-key migration.
            }
            Err(ref e) if is_dpk_unavailable(e) => {
                // Unsigned dev build — DPK inaccessible, fall through.
            }
            Err(e) => return Err(format!("dpk blob read: {e}")),
        }

        // Try the old per-key DPK entry.
        match generic_password(dpk_opts(&self.service, key)) {
            Ok(bytes) => {
                let value = String::from_utf8(bytes).map_err(|e| format!("keyring utf8: {e}"))?;
                // Write into blob (creates the blob if it doesn't exist).
                self.store(key, &value)?;
                // Best-effort cleanup of the old per-key entry.
                let _ = delete_generic_password_options(dpk_opts(&self.service, key));
                Ok(Some(value))
            }
            Err(ref e) if is_not_found(e) => {
                // Also check the old keyring-crate entry (pre-#1264 installs).
                self.migrate_legacy_key_keyring(key)
            }
            Err(ref e) if is_dpk_unavailable(e) => {
                // Unsigned dev build — check old keyring-crate entry only.
                self.migrate_legacy_key_keyring(key)
            }
            Err(e) => Err(format!("keyring get: {e}")),
        }
    }

    #[cfg(all(feature = "system-keyring", not(target_os = "macos")))]
    fn migrate_legacy_key(&self, key: &str) -> Result<Option<String>, String> {
        // Non-macOS: no DPK, just check the old keyring-crate per-key entry.
        self.migrate_legacy_key_keyring(key)
    }

    /// Check the old per-key `keyring` crate entry (pre-#1264 format) and
    /// migrate it into the blob if found.
    #[cfg(feature = "system-keyring")]
    fn migrate_legacy_key_keyring(&self, key: &str) -> Result<Option<String>, String> {
        let entry = keyring_entry(&self.service, key).map_err(|e| format!("keyring entry: {e}"))?;
        match entry.get_password() {
            Ok(value) => {
                self.store(key, &value)?;
                let _ = entry.delete_credential();
                Ok(Some(value))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("keyring get: {e}")),
        }
    }

    /// Verify that `key` holds `expected` by reading directly from the OS
    /// backend, bypassing the in-process cache. This is the key innovation for
    /// read-back verification: it proves the OS keyring round-trip, not just
    /// that the in-process cache was updated.
    ///
    /// Returns `Ok(true)` when the stored value matches `expected`, `Ok(false)`
    /// when the entry is absent or holds a different value, and `Err` when the
    /// backend is unavailable.
    pub fn verify_stored_raw(&self, key: &str, expected: &str) -> Result<bool, String> {
        #[cfg(feature = "system-keyring")]
        {
            let raw = self.read_blob_raw()?;
            match raw {
                None => Ok(false),
                Some(bytes) => {
                    let json = String::from_utf8(bytes).map_err(|e| format!("blob utf8: {e}"))?;
                    let map =
                        serde_json::from_str::<std::collections::HashMap<String, String>>(&json)
                            .map_err(|e| format!("blob json: {e}"))?;
                    Ok(map.get(key).is_some_and(|v| v == expected))
                }
            }
        }
        #[cfg(not(feature = "system-keyring"))]
        {
            let _ = (key, expected);
            Err("system-keyring feature disabled".to_string())
        }
    }

    /// Store `value` for `key`. Reports `Err` on availability failures — callers
    /// decide whether to fall back to file storage.
    pub fn store(&self, key: &str, value: &str) -> Result<(), String> {
        #[cfg(feature = "system-keyring")]
        {
            self.mutate_blob(|map| {
                map.insert(key.to_string(), value.to_string());
            })
        }
        #[cfg(not(feature = "system-keyring"))]
        {
            let _ = (key, value);
            Err("system-keyring feature disabled".to_string())
        }
    }

    pub fn delete_all_with_legacy_cleanup(&self) -> Result<(), String> {
        #[cfg(feature = "system-keyring")]
        {
            let _lock = acquire_blob_lock(&self.service)?;

            let blob_keys: Vec<String> = match self.read_blob_raw() {
                Ok(Some(bytes)) => {
                    let json = String::from_utf8(bytes).unwrap_or_default();
                    serde_json::from_str::<std::collections::HashMap<String, String>>(&json)
                        .map(|m| m.into_keys().collect())
                        .unwrap_or_default()
                }
                _ => vec![],
            };

            let mut all_keys = blob_keys;
            if !all_keys.contains(&"identity".to_string()) {
                all_keys.push("identity".to_string());
            }
            #[cfg(target_os = "macos")]
            if is_development() {
                if let Some(pending_keys) = self.pending_dpk_reset_keys()? {
                    for key in pending_keys {
                        if !all_keys.contains(&key) {
                            all_keys.push(key);
                        }
                    }
                }
            }

            #[cfg(target_os = "macos")]
            let mut dpk_cleanup_pending = false;

            for key in &all_keys {
                #[cfg(target_os = "macos")]
                {
                    match delete_generic_password_options(dpk_opts(&self.service, key)) {
                        Ok(()) => {}
                        Err(ref e) if is_not_found(e) => {}
                        Err(ref e) if is_development() && is_dpk_unavailable(e) => {
                            dpk_cleanup_pending = true;
                        }
                        Err(e) => return Err(format!("dpk per-key delete {key}: {e}")),
                    }
                }
                {
                    let entry = keyring_entry(&self.service, key)
                        .map_err(|e| format!("keyring entry constructor {key}: {e}"))?;
                    match entry.delete_credential() {
                        Ok(()) | Err(keyring::Error::NoEntry) => {}
                        Err(e) if is_keyring_availability_error(&e.to_string()) => {
                            return Err(format!("keyring unavailable deleting {key}: {e}"));
                        }
                        Err(e) => {
                            return Err(format!("keyring per-key delete {key}: {e}"));
                        }
                    }
                }
            }
            // Step 2 (cont.): also delete the legacy DPK blob written by #1267.
            #[cfg(target_os = "macos")]
            {
                match delete_generic_password_options(dpk_opts(&self.service, BLOB_KEY)) {
                    Ok(()) => {}
                    Err(ref e) if is_not_found(e) => {}
                    Err(ref e) if is_development() && is_dpk_unavailable(e) => {
                        dpk_cleanup_pending = true;
                    }
                    Err(e) => return Err(format!("dpk blob delete: {e}")),
                }
            }

            // Step 4: delete the main blob entry.
            {
                let entry = keyring_entry(&self.service, BLOB_KEY)
                    .map_err(|e| format!("keyring entry constructor blob: {e}"))?;
                match entry.delete_credential() {
                    Ok(()) | Err(keyring::Error::NoEntry) => {}
                    Err(e) if is_keyring_availability_error(&e.to_string()) => {
                        return Err(format!("keyring unavailable: {e}"));
                    }
                    Err(e) => {
                        return Err(format!("keyring blob delete: {e}"));
                    }
                }
            }

            #[cfg(target_os = "macos")]
            if is_development() {
                if dpk_cleanup_pending {
                    self.write_pending_dpk_reset_keys(&all_keys)?;
                } else {
                    self.clear_pending_dpk_reset()?;
                }
            }

            // Step 5: clear the in-memory cache.
            let mut guard = self.cache.lock().unwrap_or_else(|e| e.into_inner());
            *guard = None;
            Ok(())
        }
        #[cfg(not(feature = "system-keyring"))]
        {
            Ok(()) // No-op: no keyring, nothing to delete.
        }
    }

    /// Verify no identity-bearing keychain entry survives in any shape
    /// that `load("identity")` → `migrate_legacy_key` can consume:
    /// main blob, DPK blob (`BLOB_KEY`), and per-key `"identity"`.
    ///
    /// Returns `true` only when all three shapes are proven absent. An
    /// inaccessible keychain fails closed so reset cannot strand credentials
    /// that a later entitled launch could read.
    pub fn verify_fully_wiped(&self) -> bool {
        #[cfg(feature = "system-keyring")]
        {
            // 1. Main blob must be absent.
            match self.read_blob_raw() {
                Ok(None) => {}
                Ok(Some(_)) => return false,
                Err(_) => return false,
            }
            // 2. Per-key "identity" via legacy keyring must be absent.
            match keyring_entry(&self.service, "identity") {
                Ok(entry) => match entry.get_password() {
                    Err(keyring::Error::NoEntry) => {}
                    Ok(_) => return false,
                    // Any other error (availability, unknown, transient) → fail closed.
                    // Only explicit NoEntry is proof of absence.
                    Err(_) => return false,
                },
                // Constructor failure → cannot verify → fail closed.
                Err(_) => return false,
            }
            // 3. DPK blob (macOS only).
            #[cfg(target_os = "macos")]
            {
                let dpk_reset_pending =
                    is_development() && matches!(self.pending_dpk_reset_keys(), Ok(Some(_)));
                match generic_password(dpk_opts(&self.service, BLOB_KEY)) {
                    Err(ref e) if is_not_found(e) => {}
                    Err(ref e) if dpk_reset_pending && is_dpk_unavailable(e) => {}
                    Ok(_) => return false,
                    // Any other error → fail closed (not proof of absence).
                    Err(_) => return false,
                }
                // 4. Per-key DPK "identity" (macOS only).
                match generic_password(dpk_opts(&self.service, "identity")) {
                    Err(ref e) if is_not_found(e) => {}
                    Err(ref e) if dpk_reset_pending && is_dpk_unavailable(e) => {}
                    Ok(_) => return false,
                    // Any other error → fail closed.
                    Err(_) => return false,
                }
            }
            true
        }
        #[cfg(not(feature = "system-keyring"))]
        {
            true // No keyring = nothing to verify.
        }
    }

    /// Delete the secret for `key`. A missing entry is not an error.
    pub fn delete(&self, key: &str) -> Result<(), String> {
        #[cfg(feature = "system-keyring")]
        {
            self.mutate_blob(|map| {
                map.remove(key);
            })?;
            // Best-effort: also delete any old per-key entry for this key to
            // prevent resurrection on the next probe/load (migration path).
            #[cfg(target_os = "macos")]
            let _ = delete_generic_password_options(dpk_opts(&self.service, key));
            if let Ok(entry) = keyring_entry(&self.service, key) {
                let _ = entry.delete_credential();
            }
            Ok(())
        }
        #[cfg(not(feature = "system-keyring"))]
        {
            let _ = key;
            Err("system-keyring feature disabled".to_string())
        }
    }
}

#[cfg(all(test, feature = "system-keyring"))]
mod tests {
    use super::*;

    // Test-only constructor: pre-seed the cache without touching the OS keychain.
    impl SecretStore {
        fn with_cache(service: &str, cache: Option<HashMap<String, String>>) -> Self {
            SecretStore {
                service: service.to_string(),
                cache: Mutex::new(cache),
            }
        }
    }

    #[test]
    fn probe_returns_present_when_key_in_cache() {
        let mut map = HashMap::new();
        map.insert("identity".to_string(), "nsec1test".to_string());
        let store = SecretStore::with_cache("buzz-test-cache-hit", Some(map));
        // Cache is warm and contains "identity" — probe must return Present
        // without touching the keychain.
        assert_eq!(store.probe("identity"), KeyringProbe::Present);
    }

    #[test]
    fn load_returns_value_when_key_in_cache() {
        let mut map = HashMap::new();
        map.insert("identity".to_string(), "nsec1test".to_string());
        let store = SecretStore::with_cache("buzz-test-load-cache-hit", Some(map));
        // Cache is warm and contains "identity" — load must return the value
        // without touching the keychain.
        assert_eq!(
            store.load("identity").unwrap(),
            Some("nsec1test".to_string())
        );
    }

    #[test]
    fn development_mirror_commits_legacy_before_dpk() {
        let writes = std::cell::RefCell::new(Vec::new());

        write_development_mirrors(
            || {
                writes.borrow_mut().push("legacy");
                Ok(())
            },
            || {
                writes.borrow_mut().push("dpk");
                Ok(())
            },
        )
        .unwrap();

        assert_eq!(*writes.borrow(), ["legacy", "dpk"]);
    }

    #[test]
    fn development_mirror_does_not_advance_dpk_after_legacy_failure() {
        let writes = std::cell::RefCell::new(Vec::new());

        let result = write_development_mirrors(
            || {
                writes.borrow_mut().push("legacy");
                Err("legacy unavailable".to_string())
            },
            || {
                writes.borrow_mut().push("dpk");
                Ok(())
            },
        );

        assert_eq!(result.unwrap_err(), "legacy unavailable");
        assert_eq!(*writes.borrow(), ["legacy"]);
    }

    // ── Cross-process race tests (require real OS keychain) ────────────────

    #[ignore = "requires real OS keychain (run locally)"]
    #[test]
    fn test_stale_warm_cache_add_observes_prior_write() {
        // Simulates the cross-process race that stranded Will's agent keys.
        //
        // Setup: two SecretStore instances for the same service (= two
        // "processes" with separate caches). Process A warms its cache to
        // {k1}. Process B then writes {k1, k2}. Without the fix, A's next
        // mutate_blob would build from its stale {k1} cache and write
        // {k1, k3}, silently dropping k2. With the fix, A always re-reads
        // from the keychain inside the lock, so the result is {k1, k2, k3}.
        let svc = "buzz-test-race-stale-cache";

        // Clean state.
        let setup = SecretStore::keyring(svc);
        let _ = setup.delete("k1");
        let _ = setup.delete("k2");
        let _ = setup.delete("k3");

        // Process A: write k1, warming its cache.
        let store_a = SecretStore::keyring(svc);
        store_a.store("k1", "v1").unwrap();

        // Process B: write k2 (separate instance = separate cache).
        let store_b = SecretStore::keyring(svc);
        store_b.store("k2", "v2").unwrap();

        // Process A: write k3. With the fix, A re-reads inside the lock and
        // sees {k1, k2} before appending k3 — result must be {k1, k2, k3}.
        store_a.store("k3", "v3").unwrap();

        // Verify via a third reader (clean cache).
        let reader = SecretStore::keyring(svc);
        assert_eq!(
            reader.load("k1").unwrap(),
            Some("v1".to_string()),
            "k1 must survive"
        );
        assert_eq!(
            reader.load("k2").unwrap(),
            Some("v2".to_string()),
            "k2 must not be dropped"
        );
        assert_eq!(
            reader.load("k3").unwrap(),
            Some("v3".to_string()),
            "k3 must be written"
        );

        // Cleanup.
        let _ = reader.delete("k1");
        let _ = reader.delete("k2");
        let _ = reader.delete("k3");
    }

    #[ignore = "requires real OS keychain (run locally)"]
    #[test]
    fn test_concurrent_adds_neither_key_dropped() {
        // Two sequential stores from distinct instances (simulating two
        // processes each adding one key) must both be durably visible.
        let svc = "buzz-test-race-concurrent-add";

        let setup = SecretStore::keyring(svc);
        let _ = setup.delete("agent_a");
        let _ = setup.delete("agent_b");

        let store1 = SecretStore::keyring(svc);
        store1.store("agent_a", "nsec1aaa").unwrap();

        let store2 = SecretStore::keyring(svc);
        store2.store("agent_b", "nsec1bbb").unwrap();

        let reader = SecretStore::keyring(svc);
        assert_eq!(
            reader.load("agent_a").unwrap(),
            Some("nsec1aaa".to_string()),
            "agent_a must not be dropped"
        );
        assert_eq!(
            reader.load("agent_b").unwrap(),
            Some("nsec1bbb".to_string()),
            "agent_b must not be dropped"
        );

        // Cleanup.
        let _ = reader.delete("agent_a");
        let _ = reader.delete("agent_b");
    }

    #[test]
    fn test_blob_lockfile_path_is_in_tmp_with_uid() {
        // The lockfile must be at a deterministic per-user path under /tmp —
        // invariant to $TMPDIR — so both a GUI-launched DMG (env-stripped by
        // launchd) and a terminal-launched dev build resolve the same inode and
        // achieve mutual exclusion.
        let path = blob_lockfile_path("buzz-desktop");
        #[cfg(unix)]
        {
            let uid = unsafe { libc::getuid() };
            assert!(
                path.starts_with("/tmp"),
                "lockfile {path:?} must start with /tmp (not $TMPDIR)"
            );
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default();
            assert!(
                name.contains(&uid.to_string()),
                "lockfile {path:?} must contain uid {uid}"
            );
            assert!(
                name.contains("buzz-keychain"),
                "lockfile name must contain 'buzz-keychain'"
            );
        }
        #[cfg(not(unix))]
        {
            assert!(
                path.file_name()
                    .and_then(|n| n.to_str())
                    .is_some_and(|n| n.contains("buzz-keychain")),
                "lockfile name must contain 'buzz-keychain'"
            );
        }
    }

    #[test]
    fn test_blob_lock_acquire_and_release() {
        // Verify the advisory lock can be acquired and released without errors.
        // This exercises the real flock/mutex path on the current platform.
        let guard = acquire_blob_lock("buzz-test-lock-smoke");
        assert!(
            guard.is_ok(),
            "advisory lock acquire must succeed: {:?}",
            guard.err()
        );
        // Drop the guard — lock is released. A second acquire must succeed.
        drop(guard);
        let guard2 = acquire_blob_lock("buzz-test-lock-smoke");
        assert!(
            guard2.is_ok(),
            "advisory lock re-acquire after release must succeed: {:?}",
            guard2.err()
        );
    }

    #[ignore = "requires real OS keychain (run locally)"]
    #[test]
    fn mutate_blob_does_not_advance_cache_on_write_failure() {
        // Copy-on-write safety: if `write_blob_raw` fails (denied prompt,
        // transient outage, ACL rejection), the cache must stay at the last
        // known durable state. A subsequent `store()` for the same key/value
        // must NOT be skipped as a no-op — the equality check must compare
        // against the durable cache, not an unpersisted candidate.
        //
        // This is a real-keychain integration test. Run locally with:
        //   cargo test -p buzz-desktop -- --ignored mutate_blob_does_not_advance
        //
        // On a machine with a reachable keychain the `store()` call succeeds
        // (result.is_ok()) and the write-failure branch is skipped — the test
        // still passes. On a machine where the write is denied (e.g., user
        // clicks Deny in the macOS prompt) result.is_err() and the assertions
        // below verify the cache invariant. We verify that after an error:
        //   1. The cache is not advanced (the previously cached key is intact).
        //   2. The failed key is not present (the dirty candidate was discarded).
        let mut map = HashMap::new();
        map.insert("existing".to_string(), "durable_val".to_string());
        let store = SecretStore::with_cache("buzz-test-cow-write-fail", Some(map));

        // Attempt to add a new key — this calls write_blob_raw against the
        // real keychain; with copy-on-write the cache must remain at {existing}
        // if the write fails.
        let result = store.store("new_key", "new_val");

        if result.is_err() {
            // Write failed (e.g., user denied the keychain prompt): confirm
            // cache was not advanced — the existing key is still intact and
            // the new key was never committed to the in-memory state.
            assert_eq!(
                store.load("existing").unwrap(),
                Some("durable_val".to_string()),
                "cache must remain at last durable state after write failure"
            );
            // load("new_key") goes through the unchanged cache (no entry),
            // then attempts migrate_legacy_key which also fails on a denied
            // keychain, returning either Ok(None) or Err — either is correct
            // since the key was never durably stored.
            let after = store.load("new_key");
            assert!(
                matches!(after, Ok(None) | Err(_)),
                "a key whose write failed must not be visible via load: {after:?}"
            );
        }
        // If result.is_ok() the write succeeded — the cache-integrity invariant
        // does not apply to the success path; no assertion needed here.
    }

    #[test]
    fn availability_error_discriminator() {
        assert!(is_keyring_availability_error("dbus connection failed"));
        assert!(is_keyring_availability_error(
            "org.freedesktop.secrets not provided"
        ));
        assert!(is_keyring_availability_error("No Secret Service"));
        assert!(is_keyring_availability_error(
            "Platform secure storage failure"
        ));
        // A plain "not found" is per-entry, not an availability failure.
        assert!(!is_keyring_availability_error("entry not found"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn dpk_error_discriminators() {
        // errSecMissingEntitlement = -34018 signals unsigned dev build.
        let e = SFError::from_code(-34018);
        assert!(is_dpk_unavailable(&e));
        assert!(!is_not_found(&e));
        // errSecItemNotFound = -25300 is not a DPK-unavailable error.
        let e = SFError::from_code(-25300);
        assert!(is_not_found(&e));
        assert!(!is_dpk_unavailable(&e));
    }

    // Integration tests that exercise the real OS keychain. Skipped in CI
    // (unsigned builds lack keychain entitlements); run locally with:
    //   cargo test -p buzz-desktop -- --ignored blob_
    //
    // Each test uses a unique service name to avoid cross-test pollution.

    #[ignore = "requires real OS keychain (run locally)"]
    #[test]
    fn blob_stores_and_retrieves_multiple_keys() {
        let store = SecretStore::keyring("buzz-test-blob-multi");
        store.store("key_a", "val_a").unwrap();
        store.store("key_b", "val_b").unwrap();
        assert_eq!(store.load("key_a").unwrap(), Some("val_a".to_string()));
        assert_eq!(store.load("key_b").unwrap(), Some("val_b".to_string()));
        assert_eq!(store.load("key_c").unwrap(), None);
        // Cleanup.
        let _ = store.delete("key_a");
        let _ = store.delete("key_b");
    }

    #[ignore = "requires real OS keychain (run locally)"]
    #[test]
    fn blob_probe_present_absent_unreachable() {
        let store = SecretStore::keyring("buzz-test-blob-probe");
        // No blob yet — key absent, backend reachable.
        assert_eq!(store.probe("identity"), KeyringProbe::ReachableButEmpty);
        store.store("identity", "nsec1test").unwrap();
        // Key now present.
        assert_eq!(store.probe("identity"), KeyringProbe::Present);
        // Different key — blob exists but key absent.
        assert_eq!(store.probe("other"), KeyringProbe::ReachableButEmpty);
        // Cleanup.
        let _ = store.delete("identity");
    }

    #[ignore = "requires real OS keychain (run locally)"]
    #[test]
    fn blob_delete_removes_key_not_others() {
        let store = SecretStore::keyring("buzz-test-blob-delete");
        store.store("keep", "keep_val").unwrap();
        store.store("remove", "remove_val").unwrap();
        store.delete("remove").unwrap();
        assert_eq!(store.load("keep").unwrap(), Some("keep_val".to_string()));
        assert_eq!(store.load("remove").unwrap(), None);
        // Cleanup.
        let _ = store.delete("keep");
    }

    #[ignore = "requires real OS keychain (run locally)"]
    #[test]
    fn blob_migration_from_per_key_entry() {
        let svc = "buzz-test-blob-migration";
        let key = "identity";
        let value = "nsec1migrationtest";

        // Seed a per-key entry (old format) — no blob exists.
        let entry = keyring_entry(svc, key).unwrap();
        entry.set_password(value).unwrap();

        // Fresh store — no blob in the keychain yet.
        let store = SecretStore::keyring(svc);

        // probe should find the legacy key.
        assert_eq!(store.probe(key), KeyringProbe::Present);

        // load should migrate it into the blob and return the value.
        assert_eq!(store.load(key).unwrap(), Some(value.to_string()));

        // Old per-key entry should be cleaned up.
        let entry = keyring_entry(svc, key).unwrap();
        assert!(matches!(entry.get_password(), Err(keyring::Error::NoEntry)));

        // Key is now in the blob — probe confirms.
        let store2 = SecretStore::keyring(svc);
        assert_eq!(store2.probe(key), KeyringProbe::Present);
        assert_eq!(store2.load(key).unwrap(), Some(value.to_string()));

        // Cleanup.
        let _ = store2.delete(key);
    }

    #[ignore = "requires real OS keychain (run locally)"]
    #[test]
    fn delete_all_with_legacy_cleanup_removes_per_key_identity() {
        let svc = "buzz-test-delete-all-legacy";
        let key = "identity";
        let value = "nsec1legacytest";

        // Seed a legacy per-key entry (old format, pre-blob migration).
        let entry = keyring_entry(svc, key).unwrap();
        entry.set_password(value).unwrap();

        // Also seed a blob with a different key to exercise the full path.
        let store = SecretStore::keyring(svc);
        store.store("agent:abc123", "nsec1agent").unwrap();

        // Legacy per-key identity should be discoverable via probe.
        let store2 = SecretStore::keyring(svc);
        assert_eq!(store2.probe(key), KeyringProbe::Present);

        // Wipe everything via the sign-out path.
        store2.delete_all_with_legacy_cleanup().unwrap();

        // Fresh store — neither the blob nor the per-key entry should remain.
        let store3 = SecretStore::keyring(svc);
        assert_eq!(
            store3.probe(key),
            KeyringProbe::ReachableButEmpty,
            "per-key identity must not survive delete_all_with_legacy_cleanup"
        );
        assert_eq!(
            store3.load(key).unwrap(),
            None,
            "load must not resurrect the legacy per-key identity"
        );
        // Agent key should also be gone.
        assert_eq!(store3.load("agent:abc123").unwrap(), None);
    }
}
