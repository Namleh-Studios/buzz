export function createNamlehStagingPreviewEnvironment({
  parentEnvironment,
  identities,
}) {
  const buildEnvironment = { ...parentEnvironment };
  for (const identity of [identities.staging, identities.production]) {
    for (const variable of [
      identity.updaterPublicKeyEnv,
      identity.updaterPrivateKeyEnv,
      identity.updaterPrivateKeyPasswordEnv,
      identity.updaterEndpointEnv,
    ]) {
      delete buildEnvironment[variable];
    }
  }
  for (const variable of [
    "BUZZ_UPDATER_PUBLIC_KEY",
    "BUZZ_UPDATER_ENDPOINT",
    "TAURI_SIGNING_PRIVATE_KEY",
    "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
    "APPLE_SIGNING_IDENTITY",
  ]) {
    delete buildEnvironment[variable];
  }
  Object.assign(buildEnvironment, {
    NAMLEH_APP_ENV: "staging",
    NAMLEH_STAGING_IDENTITY_PREVIEW: "1",
    VITE_NAMLEH_APP_ENV: "staging",
    VITE_NAMLEH_DEEP_LINK_SCHEME: identities.staging.deepLinkScheme,
  });
  return buildEnvironment;
}
