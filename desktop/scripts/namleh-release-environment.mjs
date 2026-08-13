export function createNamlehReleaseEnvironment({
  parentEnvironment,
  environment,
  identity,
  otherIdentity,
  updaterPublicKey,
  updaterPrivateKey,
  updaterEndpoint,
  releaseVersion,
}) {
  const buildEnvironment = { ...parentEnvironment };
  for (const variable of [
    otherIdentity.updaterPublicKeyEnv,
    otherIdentity.updaterPrivateKeyEnv,
    otherIdentity.updaterEndpointEnv,
  ]) {
    delete buildEnvironment[variable];
  }
  Object.assign(buildEnvironment, {
    NAMLEH_APP_ENV: environment,
    NAMLEH_RELEASE_VERSION: releaseVersion,
    VITE_NAMLEH_APP_ENV: environment,
    VITE_NAMLEH_DEEP_LINK_SCHEME: identity.deepLinkScheme,
    BUZZ_UPDATER_PUBLIC_KEY: updaterPublicKey,
    BUZZ_UPDATER_ENDPOINT: updaterEndpoint,
    TAURI_SIGNING_PRIVATE_KEY: updaterPrivateKey,
    APPLE_SIGNING_IDENTITY: identity.signingIdentity,
    NAMLEH_UPDATER_AUTHORIZATION_AUDIENCE:
      identity.updaterAuthorizationAudience,
    NAMLEH_UPDATER_CHANNEL: identity.updaterChannel,
    NAMLEH_UPDATER_MANIFEST_NAMESPACE: identity.updaterManifestNamespace,
  });
  return buildEnvironment;
}
