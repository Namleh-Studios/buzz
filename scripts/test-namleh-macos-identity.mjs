import assert from "node:assert/strict";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const readJson = (path) =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"));
const read = (path) => readFileSync(resolve(root, path), "utf8");

const identities = readJson("desktop/namleh-app-identities.json");
const environments = ["development", "staging", "production"];
const uniqueFields = [
  "productName",
  "bundleIdentifier",
  "deepLinkScheme",
  "keyringService",
  "keychainAccessGroup",
  "nestDirectory",
  "managedRuntimeDirectory",
  "cliLinkName",
];

assert.deepEqual(Object.keys(identities), environments);
for (const field of uniqueFields) {
  const values = environments.map(
    (environment) => identities[environment][field],
  );
  assert.equal(
    new Set(values).size,
    environments.length,
    `${field} must be unique`,
  );
}

for (const environment of environments) {
  const identity = identities[environment];
  assert.match(identity.bundleIdentifier, /^com\.namlehstudios\.buzz(?:\.|$)/);
  assert.match(identity.deepLinkScheme, /^namleh-buzz(?:-|$)/);
  assert.match(identity.keyringService, /^com\.namlehstudios\.buzz(?:\.|$)/);
  assert.match(
    identity.keychainAccessGroup,
    /^962M5A4PL7\.com\.namlehstudios\.buzz(?:\.|$)/,
  );
  assert.doesNotMatch(
    JSON.stringify(identity),
    /xyz\.block\.buzz|buzz-desktop/,
  );
}

for (const environment of ["staging", "production"]) {
  const identity = identities[environment];
  for (const field of [
    "updaterChannel",
    "updaterManifestNamespace",
    "updaterAuthorizationAudience",
    "updaterPublicKeyEnv",
    "updaterPrivateKeyEnv",
    "updaterEndpointEnv",
    "signingIdentity",
  ]) {
    assert.ok(identity[field], `${environment}.${field} must be defined`);
  }
}
for (const field of [
  "updaterChannel",
  "updaterManifestNamespace",
  "updaterAuthorizationAudience",
  "updaterPublicKeyEnv",
  "updaterPrivateKeyEnv",
  "updaterEndpointEnv",
]) {
  assert.notEqual(
    identities.staging[field],
    identities.production[field],
    `${field} must be isolated`,
  );
}

const baseConfig = readJson("desktop/src-tauri/tauri.conf.json");
assert.equal(baseConfig.productName, identities.development.productName);
assert.equal(baseConfig.identifier, identities.development.bundleIdentifier);
assert.deepEqual(baseConfig.plugins["deep-link"].desktop.schemes, [
  identities.development.deepLinkScheme,
]);
const developmentOverlay = readJson("desktop/src-tauri/tauri.dev.conf.json");
assert.equal(
  developmentOverlay.productName,
  identities.development.productName,
);
assert.equal(
  developmentOverlay.identifier,
  identities.development.bundleIdentifier,
);

for (const environment of ["staging", "production"]) {
  const config = readJson(
    `desktop/src-tauri/tauri.namleh.${environment}.conf.json`,
  );
  const identity = identities[environment];
  assert.equal(config.productName, identity.productName);
  assert.equal(config.identifier, identity.bundleIdentifier);
  assert.deepEqual(config.plugins["deep-link"].desktop.schemes, [
    identity.deepLinkScheme,
  ]);
  assert.equal(
    "version" in config,
    false,
    `${environment} identity must survive version changes`,
  );
}

const rustIdentity = read("desktop/src-tauri/src/app_identity.rs");
for (const environment of environments) {
  const identity = identities[environment];
  for (const field of uniqueFields) {
    assert.ok(
      rustIdentity.includes(identity[field]),
      `Rust identity must include ${environment}.${field}`,
    );
  }
}
for (const variable of [
  "HF_HOME",
  "HF_HUB_CACHE",
  "HUGGINGFACE_HUB_CACHE",
  "HF_XET_CACHE",
  "MESH_LLM_DATA_DIR",
  "MESH_LLM_RUNTIME_ROOT",
]) {
  assert.ok(
    rustIdentity.includes(`\"${variable}\"`),
    `${variable} must be scoped by the app identity`,
  );
}

const rustEntryPoint = read("desktop/src-tauri/src/lib.rs");
assert.ok(rustEntryPoint.includes("configure_process_cache_environment"));
assert.doesNotMatch(rustEntryPoint, /arg\.starts_with\(\"buzz:\/\/\"\)/);

const infoPlist = read("desktop/src-tauri/Info.plist");
assert.doesNotMatch(infoPlist, /<key>CFBundle(?:DisplayName|Name)<\/key>/);
assert.doesNotMatch(infoPlist, /<string>Buzz needs/);

const releaseBuilder = read("desktop/scripts/build-namleh-release-config.mjs");
for (const field of [
  "updaterPublicKeyEnv",
  "updaterEndpointEnv",
  "updaterManifestNamespace",
]) {
  assert.ok(releaseBuilder.includes(field));
}

const generatedConfigs = [];
try {
  for (const environment of ["staging", "production"]) {
    const identity = identities[environment];
    const otherEnvironment =
      environment === "staging" ? "production" : "staging";
    const otherIdentity = identities[otherEnvironment];
    const endpoint = `https://updates.namlehstudios.com/${identity.updaterManifestNamespace}/${identity.updaterChannel}/latest.json`;
    const publicKey = `${environment}-public-key`;
    const generatedPath = resolve(
      root,
      `desktop/src-tauri/tauri.namleh.${environment}.release.conf.json`,
    );
    generatedConfigs.push(generatedPath);
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, "desktop/scripts/build-namleh-release-config.mjs"),
        environment,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          [identity.updaterPublicKeyEnv]: publicKey,
          [identity.updaterEndpointEnv]: endpoint,
        },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const generated = readJson(
      `desktop/src-tauri/tauri.namleh.${environment}.release.conf.json`,
    );
    assert.equal(generated.identifier, identity.bundleIdentifier);
    assert.equal(generated.productName, identity.productName);
    assert.equal(generated.plugins.updater.pubkey, publicKey);
    assert.deepEqual(generated.plugins.updater.endpoints, [endpoint]);
    assert.deepEqual(generated.plugins["deep-link"].desktop.schemes, [
      identity.deepLinkScheme,
    ]);
    assert.equal(
      JSON.stringify(generated).includes(
        otherIdentity.updaterManifestNamespace,
      ),
      false,
    );
  }

  const staging = identities.staging;
  const crossChannel = spawnSync(
    process.execPath,
    [
      resolve(root, "desktop/scripts/build-namleh-release-config.mjs"),
      "staging",
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        [staging.updaterPublicKeyEnv]: "staging-public-key",
        [staging.updaterEndpointEnv]:
          "https://updates.namlehstudios.com/production/latest.json",
      },
      encoding: "utf8",
    },
  );
  assert.notEqual(
    crossChannel.status,
    0,
    "staging must reject a production updater feed",
  );
} finally {
  for (const path of generatedConfigs) {
    if (existsSync(path)) unlinkSync(path);
  }
}

console.log("Namleh macOS identity contract passed");
