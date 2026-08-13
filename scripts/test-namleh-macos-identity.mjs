import assert from "node:assert/strict";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { createNamlehReleaseEnvironment } from "../desktop/scripts/namleh-release-environment.mjs";

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
  "nestDirectory",
  "managedRuntimeDirectory",
  "cliLinkName",
  "appDataNamespace",
  "cacheNamespace",
  "logNamespace",
  "providerBindingPath",
  "browserCheckpointPath",
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
  assert.doesNotMatch(
    JSON.stringify(identity),
    /xyz\.block\.buzz|buzz-desktop/,
  );
  assert.equal(identity.appDataNamespace, identity.bundleIdentifier);
  assert.equal(identity.cacheNamespace, identity.bundleIdentifier);
  assert.equal(identity.logNamespace, identity.bundleIdentifier);
  assert.ok(identity.providerBindingPath.startsWith(identity.bundleIdentifier));
  assert.ok(identity.browserCheckpointPath.startsWith(identity.bundleIdentifier));
}
assert.equal(
  new Set(
    environments.map(
      (environment) => identities[environment].keychainAccessGroup,
    ),
  ).size,
  environments.length,
  "all environments must use distinct Keychain access groups",
);
for (const environment of environments) {
  assert.match(
    identities[environment].keychainAccessGroup,
    /^962M5A4PL7\.com\.namlehstudios\.buzz(?:\.|$)/,
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
    "updaterEndpoint",
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
  "updaterEndpoint",
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
  "MESH_LLM_HASH_CACHE_DIR",
]) {
  assert.ok(
    rustIdentity.includes(`\"${variable}\"`),
    `${variable} must be scoped by the app identity`,
  );
}

const rustEntryPoint = read("desktop/src-tauri/src/lib.rs");
assert.ok(rustEntryPoint.includes("configure_process_cache_environment"));
assert.doesNotMatch(rustEntryPoint, /arg\.starts_with\(\"buzz:\/\/\"\)/);

for (const path of [
  "web/src/features/invite/ui/InvitePage.tsx",
  "web/src/features/repos/ui/ConnectButton.tsx",
]) {
  const source = read(path);
  assert.ok(source.includes("appDeepLink"), `${path} must use the Namleh scheme`);
  assert.doesNotMatch(source, /buzz:\/\//);
}
const webIdentity = read("web/src/shared/lib/app-identity.ts");
assert.ok(webIdentity.includes('hostname === "buzz-staging.namlehstudios.com"'));
assert.ok(webIdentity.includes('return "namleh-buzz-staging"'));
assert.ok(webIdentity.includes('hostname === "buzz.namlehstudios.com"'));
assert.ok(webIdentity.includes('return "namleh-buzz"'));
assert.ok(webIdentity.includes("Cannot resolve Namleh Buzz identity for web host"));
assert.doesNotMatch(webIdentity, /\|\|\s*["']namleh-buzz["']/);
const cliLinks = read("crates/buzz-cli/src/links.rs");
assert.doesNotMatch(cliLinks, /format!\(\"buzz:\/\//);
const cliIdentity = read("crates/buzz-cli/src/app_identity.rs");
assert.ok(cliIdentity.includes("BUZZ_DEEP_LINK_SCHEME"));
assert.ok(cliIdentity.includes("BUZZ_APP_BUNDLE_IDENTIFIER"));
assert.ok(cliIdentity.includes("namleh-buzz-staging"));
const channelTemplateProductionSource = read(
  "crates/buzz-cli/src/commands/channel_templates.rs",
).split("#[cfg(test)]")[0];
assert.doesNotMatch(
  channelTemplateProductionSource,
  /xyz\.block\.buzz\.app/,
);

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
const releaseRunner = `${read("desktop/scripts/run-namleh-tauri.mjs")}\n${read(
  "desktop/scripts/namleh-release-environment.mjs",
)}`;
for (const token of [
  "updaterPrivateKeyEnv",
  "updaterAuthorizationAudience",
  "signingIdentity",
  "BUZZ_UPDATER_PUBLIC_KEY",
  "BUZZ_UPDATER_ENDPOINT",
  "TAURI_SIGNING_PRIVATE_KEY",
  "APPLE_SIGNING_IDENTITY",
]) {
  assert.ok(releaseRunner.includes(token), `release runner must consume ${token}`);
}
assert.doesNotMatch(releaseRunner, /--no-sign/);

const stagingIdentity = identities.staging;
const productionIdentity = identities.production;
const sanitizedStagingEnvironment = createNamlehReleaseEnvironment({
  parentEnvironment: {
    [stagingIdentity.updaterPublicKeyEnv]: "staging-public",
    [stagingIdentity.updaterPrivateKeyEnv]: "staging-private",
    [stagingIdentity.updaterEndpointEnv]: stagingIdentity.updaterEndpoint,
    [productionIdentity.updaterPublicKeyEnv]: "production-public",
    [productionIdentity.updaterPrivateKeyEnv]: "production-private",
    [productionIdentity.updaterEndpointEnv]: productionIdentity.updaterEndpoint,
  },
  environment: "staging",
  identity: stagingIdentity,
  otherIdentity: productionIdentity,
  updaterPublicKey: "staging-public",
  updaterPrivateKey: "staging-private",
  updaterEndpoint: stagingIdentity.updaterEndpoint,
  releaseVersion: "0.5.8",
});
for (const variable of [
  productionIdentity.updaterPublicKeyEnv,
  productionIdentity.updaterPrivateKeyEnv,
  productionIdentity.updaterEndpointEnv,
]) {
  assert.equal(
    sanitizedStagingEnvironment[variable],
    undefined,
    `staging child environment must not inherit ${variable}`,
  );
}

const generatedConfigs = [];
try {
  for (const environment of ["staging", "production"]) {
    const identity = identities[environment];
    const otherEnvironment =
      environment === "staging" ? "production" : "staging";
    const otherIdentity = identities[otherEnvironment];
    const endpoint = identity.updaterEndpoint;
    const publicKey = `${environment}-public-key`;
    const generatedPath = resolve(
      root,
      `desktop/src-tauri/tauri.namleh.${environment}.release.conf.json`,
    );
    generatedConfigs.push(generatedPath);
    const transition = [];
    for (const version of ["0.5.8", "0.5.9", "0.5.8"]) {
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
            NAMLEH_RELEASE_VERSION: version,
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
      assert.equal(generated.version, version);
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
      transition.push({
        identifier: generated.identifier,
        productName: generated.productName,
        deepLinkSchemes: generated.plugins["deep-link"].desktop.schemes,
        updaterEndpoints: generated.plugins.updater.endpoints,
        entitlements: generated.bundle.macOS.entitlements,
      });
    }
    assert.deepEqual(transition[0], transition[1]);
    assert.deepEqual(transition[1], transition[2]);
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
        NAMLEH_RELEASE_VERSION: "0.5.8",
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

  for (const invalidEndpoint of [
    "https://github.com/block/buzz/releases/download/staging/namleh-buzz-staging/latest.json",
    "https://user:pass@updates.namlehstudios.com/staging/namleh-buzz-staging/latest.json",
    "https://updates.namlehstudios.com/production/namleh-buzz-production/staging/namleh-buzz-staging/latest.json",
  ]) {
    const rejected = spawnSync(
      process.execPath,
      [
        resolve(root, "desktop/scripts/build-namleh-release-config.mjs"),
        "staging",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          NAMLEH_RELEASE_VERSION: "0.5.8",
          [staging.updaterPublicKeyEnv]: "staging-public-key",
          [staging.updaterEndpointEnv]: invalidEndpoint,
        },
        encoding: "utf8",
      },
    );
    assert.notEqual(
      rejected.status,
      0,
      `staging must reject updater endpoint ${invalidEndpoint}`,
    );
  }
} finally {
  for (const path of generatedConfigs) {
    if (existsSync(path)) unlinkSync(path);
  }
}

console.log("Namleh macOS identity contract passed");
