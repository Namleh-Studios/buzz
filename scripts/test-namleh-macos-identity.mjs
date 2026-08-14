import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { createNamlehReleaseEnvironment } from "../desktop/scripts/namleh-release-environment.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = (path) =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"));
const read = (path) => readFileSync(resolve(root, path), "utf8");
const readBytes = (path) => readFileSync(resolve(root, path));
const sha256 = (path) =>
  createHash("sha256").update(readBytes(path)).digest("hex");

function pngDimensions(path) {
  const bytes = readBytes(path);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function icnsTypes(path) {
  const bytes = readBytes(path);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "icns");
  const types = new Set();
  for (let offset = 8; offset + 8 <= bytes.length; ) {
    const length = bytes.readUInt32BE(offset + 4);
    assert.ok(length >= 8 && offset + length <= bytes.length);
    types.add(bytes.subarray(offset, offset + 4).toString("ascii"));
    offset += length;
  }
  return types;
}

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
  assert.ok(
    identity.browserCheckpointPath.startsWith(identity.bundleIdentifier),
  );
}

assert.equal(
  sha256("desktop/src-tauri/icons/namleh/source/namleh-icon.svg"),
  "1086d6ed3aacc7e2940abbfbce653308ec8baf7263eb9d77cf9f1d743f15e511",
  "the committed Namleh icon must match the approved source asset",
);
const generatedAssetHashes = {
  "desktop/src-tauri/icons/namleh/source/namleh-menu-template.png":
    "7760178c97a7629b27a40e034b1a6136ff54efe08e3657daf9f72907894f7934",
  "desktop/src-tauri/icons/namleh/production/source.svg":
    "236ca4595a2a04c202bef6febe65eef7db0380583c08cac22b8b0270ecfad509",
  "desktop/src-tauri/icons/namleh/production/32x32.png":
    "b045e8954a1779841f90174a1769322831d3930c1ae038fd20c855deb5c6dc7a",
  "desktop/src-tauri/icons/namleh/production/128x128.png":
    "2985e4b82bd08df18c7aee04a8cb4798282c17ad1fc9bb557837857b45896659",
  "desktop/src-tauri/icons/namleh/production/128x128@2x.png":
    "dc34edd90cce86712b5c684f26424c033f58e473d627b050c001c058a6350fb9",
  "desktop/src-tauri/icons/namleh/production/icon.icns":
    "4caa08162ded25fe03d8659298c77660e0943c5e2c654b684d948967dabd664c",
  "desktop/src-tauri/icons/namleh/production/dmg-background.svg":
    "9dab2ec279f3a4f84f6920aee539b23a4f4fc7e1c11ca02097507f664788aa34",
  "desktop/src-tauri/icons/namleh/production/dmg-background.png":
    "252362917242bd94fe7e019107d394978d792bac00504f2ac94ddde42a930190",
  "desktop/src-tauri/icons/namleh/staging/source.svg":
    "9b6cb90cacf76e806044cb325128700634187d0b870873a318b6c52ae4e56ae7",
  "desktop/src-tauri/icons/namleh/staging/32x32.png":
    "62f07234a721575b4f48e93f5b5fc63db8979a68cd617b093f3575ef4ff21036",
  "desktop/src-tauri/icons/namleh/staging/128x128.png":
    "2b5d1fda952601f4fbd2035f83c23b3c0d8ae31fe36311b60cbef81940be66b9",
  "desktop/src-tauri/icons/namleh/staging/128x128@2x.png":
    "c9c650a22464d7ac776033159d75b49584a41ab36222b040a60536cc23a18bf5",
  "desktop/src-tauri/icons/namleh/staging/icon.icns":
    "edddfa9435698eee1a120dd71b59cbbdb5f4270168ee91798ba84ac8c363521a",
  "desktop/src-tauri/icons/namleh/staging/dmg-background.svg":
    "4b5d8a477910f5a6eeea9b0a1c02757ebceee5acd4aed286e90c10acac6dbd85",
  "desktop/src-tauri/icons/namleh/staging/dmg-background.png":
    "c62be2e4f1ca54e22cdc88d9010d22d76cac0098cf3e34f078810bd79b319f7d",
  "desktop/public/namleh-production-app-icon@2x.png":
    "cb214f0f03d12552978cd597f811b82855e485a3207d74b2850b1f21e604a38b",
  "desktop/public/namleh-production-app-icon@3x.png":
    "098b4a32842b8f35b9f40e19c8b6cb9ef30d705dae4d81c68f04ee602ed95415",
  "desktop/public/namleh-staging-app-icon@2x.png":
    "dd9a000944febe37449903cba89f644fb07138b4a06d032a4221f53ca6142609",
  "desktop/public/namleh-staging-app-icon@3x.png":
    "df1d6d57d5924965dc30dc3cfa307057c73993c651bde0de8af769648560c74c",
};
for (const [path, expectedHash] of Object.entries(generatedAssetHashes)) {
  assert.equal(sha256(path), expectedHash, `${path} must match approved output`);
}
assert.deepEqual(
  pngDimensions(
    "desktop/src-tauri/icons/namleh/source/namleh-menu-template.png",
  ),
  [64, 64],
);
for (const environment of ["production", "staging"]) {
  const iconRoot = `desktop/src-tauri/icons/namleh/${environment}`;
  assert.deepEqual(pngDimensions(`${iconRoot}/32x32.png`), [32, 32]);
  assert.deepEqual(pngDimensions(`${iconRoot}/128x128.png`), [128, 128]);
  assert.deepEqual(pngDimensions(`${iconRoot}/128x128@2x.png`), [256, 256]);
  assert.deepEqual(
    pngDimensions(`${iconRoot}/dmg-background.png`),
    [1320, 1064],
  );
  const types = icnsTypes(`${iconRoot}/icon.icns`);
  for (const type of [
    "is32",
    "il32",
    "ic07",
    "ic08",
    "ic09",
    "ic10",
    "ic11",
    "ic12",
    "ic13",
    "ic14",
  ]) {
    assert.ok(types.has(type), `${environment} ICNS must contain ${type}`);
  }
  const overlay = readJson(
    `desktop/src-tauri/tauri.namleh.${environment}.conf.json`,
  );
  assert.equal(overlay.bundle.publisher, "Namleh Studios");
  assert.match(overlay.bundle.copyright, /Block, Inc\./);
  assert.match(overlay.bundle.copyright, /Namleh Studios/);
  assert.deepEqual(overlay.bundle.icon, [
    `icons/namleh/${environment}/32x32.png`,
    `icons/namleh/${environment}/128x128.png`,
    `icons/namleh/${environment}/128x128@2x.png`,
    `icons/namleh/${environment}/icon.icns`,
  ]);
  assert.equal(
    overlay.bundle.macOS.dmg.background,
    `icons/namleh/${environment}/dmg-background.png`,
  );
  assert.deepEqual(
    pngDimensions(`desktop/public/namleh-${environment}-app-icon@2x.png`),
    [224, 224],
  );
  assert.deepEqual(
    pngDimensions(`desktop/public/namleh-${environment}-app-icon@3x.png`),
    [336, 336],
  );
}
assert.notDeepEqual(
  readBytes("desktop/src-tauri/icons/namleh/production/32x32.png"),
  readBytes("desktop/src-tauri/icons/namleh/staging/32x32.png"),
  "the staging Dock/Finder icon must remain distinct at small sizes",
);
assert.match(
  read("desktop/src-tauri/icons/namleh/staging/source.svg"),
  />S<\/text>/,
  "staging identity must include a non-color marker",
);
assert.doesNotMatch(
  read("desktop/src-tauri/icons/namleh/production/source.svg"),
  />S<\/text>/,
);

const rendererIdentity = read("desktop/src/shared/appIdentity.ts");
assert.ok(rendererIdentity.includes("APP_ICON_SRC"));
assert.ok(rendererIdentity.includes("Object.hasOwn"));
assert.ok(rendererIdentity.includes("import.meta.env?.VITE_NAMLEH_APP_ENV"));
for (const identity of Object.values(identities)) {
  assert.ok(rendererIdentity.includes(identity.productName));
  assert.ok(rendererIdentity.includes(identity.bundleIdentifier));
  assert.ok(rendererIdentity.includes(identity.deepLinkScheme));
}
assert.ok(read("desktop/src/main.tsx").includes("APP_PRODUCT_NAME"));
assert.ok(read("desktop/src-tauri/src/huddle/window.rs").includes("product_name"));
assert.ok(
  read("desktop/src-tauri/capabilities/default.json").includes(
    "core:window:allow-set-title",
  ),
);
assert.ok(read("desktop/index.html").includes("buzz-theme-cache-v2"));
assert.doesNotMatch(read("desktop/index.html"), /href="\/buzz\.svg/);
assert.ok(read("desktop/src/main.tsx").includes('"#app-favicon"'));
const builderlabSource = read("desktop/src-tauri/src/builderlab.rs");
const builderlabProductionSource = builderlabSource.split("#[cfg(test)]")[0];
assert.ok(builderlabSource.includes("{{PRODUCT_NAME}}"));
assert.ok(builderlabSource.includes("namleh-icon.svg"));
assert.doesNotMatch(builderlabProductionSource, /bee-mask/);
const developmentConfig = readJson("desktop/src-tauri/tauri.conf.json");
assert.equal(developmentConfig.bundle.publisher, "Namleh Studios");
assert.deepEqual(developmentConfig.bundle.icon, [
  "icons/namleh/production/32x32.png",
  "icons/namleh/production/128x128.png",
  "icons/namleh/production/128x128@2x.png",
  "icons/namleh/production/icon.icns",
  "icons/icon.ico",
]);
assert.equal(
  developmentConfig.bundle.macOS.dmg.background,
  "icons/namleh/production/dmg-background.png",
);
for (const path of [
  "desktop/src/app/App.tsx",
  "desktop/src/features/communities/ui/HostedCommunityOnboarding.tsx",
  "desktop/src/features/onboarding/ui/LandingBees.tsx",
  "desktop/src/features/onboarding/ui/OnboardingChrome.tsx",
]) {
  assert.ok(
    read(path).includes("NamlehAppMark"),
    `${path} must use Namleh identity art`,
  );
}
for (const path of [
  "desktop/src/features/onboarding/ui/IdentityRecoveryPairing.tsx",
  "desktop/src/features/profile/ui/NostrBindConsentDialog.tsx",
  "desktop/src/features/settings/ui/MobilePairingCard.tsx",
]) {
  assert.ok(
    read(path).includes("APP_ICON_SRC"),
    `${path} must use the environment app icon`,
  );
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
    "updaterPrivateKeyPasswordEnv",
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
  "updaterPrivateKeyPasswordEnv",
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
    rustIdentity.includes(`"${variable}"`),
    `${variable} must be scoped by the app identity`,
  );
}
const rustEntryPoint = read("desktop/src-tauri/src/lib.rs");
assert.ok(rustEntryPoint.includes("configure_process_cache_environment"));
assert.doesNotMatch(rustEntryPoint, /arg\.starts_with\("buzz:\/\/"\)/);
assert.ok(
  rustEntryPoint.indexOf("if reset_outcome.failed") <
    rustEntryPoint.indexOf("ensure_isolated_storage"),
  "isolated storage must be recreated only after reset succeeds",
);
const secretStore = read("desktop/src-tauri/src/secret_store.rs");
const resetCleanup = secretStore.slice(
  secretStore.indexOf("pub fn delete_all_with_legacy_cleanup"),
  secretStore.indexOf("pub fn verify_fully_wiped"),
);
assert.ok(
  resetCleanup.indexOf("write_pending_dpk_reset_keys(&all_keys)") <
    resetCleanup.indexOf("for key in &all_keys"),
  "development DPK reset inventory must be written before destructive cleanup",
);

for (const path of [
  "web/src/features/invite/ui/InvitePage.tsx",
  "web/src/features/repos/ui/ConnectButton.tsx",
]) {
  const source = read(path);
  assert.ok(
    source.includes("appDeepLink"),
    `${path} must use the Namleh scheme`,
  );
  assert.doesNotMatch(source, /buzz:\/\//);
}
const webIdentity = read("web/src/shared/lib/app-identity.ts");
assert.ok(
  webIdentity.includes('hostname === "buzz-staging.namlehstudios.com"'),
);
assert.ok(webIdentity.includes('? "namleh-buzz-staging"'));
assert.ok(webIdentity.includes('hostname === "buzz.namlehstudios.com"'));
assert.ok(webIdentity.includes('? "namleh-buzz"'));
assert.ok(
  webIdentity.includes("Cannot resolve Namleh Buzz identity for web host"),
);
assert.ok(webIdentity.includes("Namleh Buzz identity does not match web host"));
assert.doesNotMatch(webIdentity, /\|\|\s*["']namleh-buzz["']/);
const cliLinks = read("crates/buzz-cli/src/links.rs");
assert.doesNotMatch(cliLinks, /format!\("buzz:\/\//);
const cliIdentity = read("crates/buzz-cli/src/app_identity.rs");
assert.ok(cliIdentity.includes("BUZZ_DEEP_LINK_SCHEME"));
assert.ok(cliIdentity.includes("BUZZ_APP_BUNDLE_IDENTIFIER"));
assert.ok(cliIdentity.includes("namleh-buzz-staging"));
const channelTemplateProductionSource = read(
  "crates/buzz-cli/src/commands/channel_templates.rs",
).split("#[cfg(test)]")[0];
assert.doesNotMatch(channelTemplateProductionSource, /xyz\.block\.buzz\.app/);

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
  assert.ok(
    releaseRunner.includes(token),
    `release runner must consume ${token}`,
  );
}
assert.doesNotMatch(releaseRunner, /--no-sign/);

const stagingIdentity = identities.staging;
const productionIdentity = identities.production;
const sanitizedStagingEnvironment = createNamlehReleaseEnvironment({
  parentEnvironment: {
    [stagingIdentity.updaterPublicKeyEnv]: "staging-public",
    [stagingIdentity.updaterPrivateKeyEnv]: "staging-private",
    [stagingIdentity.updaterPrivateKeyPasswordEnv]: "staging-password",
    [stagingIdentity.updaterEndpointEnv]: stagingIdentity.updaterEndpoint,
    [productionIdentity.updaterPublicKeyEnv]: "production-public",
    [productionIdentity.updaterPrivateKeyEnv]: "production-private",
    [productionIdentity.updaterPrivateKeyPasswordEnv]: "production-password",
    [productionIdentity.updaterEndpointEnv]: productionIdentity.updaterEndpoint,
  },
  environment: "staging",
  identity: stagingIdentity,
  otherIdentity: productionIdentity,
  updaterPublicKey: "staging-public",
  updaterPrivateKey: "staging-private",
  updaterPrivateKeyPassword: "staging-password",
  updaterEndpoint: stagingIdentity.updaterEndpoint,
  releaseVersion: "0.5.8",
});
for (const variable of [
  productionIdentity.updaterPublicKeyEnv,
  productionIdentity.updaterPrivateKeyEnv,
  productionIdentity.updaterPrivateKeyPasswordEnv,
  productionIdentity.updaterEndpointEnv,
]) {
  assert.equal(
    sanitizedStagingEnvironment[variable],
    undefined,
    `staging child environment must not inherit ${variable}`,
  );
}
assert.equal(
  sanitizedStagingEnvironment.TAURI_SIGNING_PRIVATE_KEY_PASSWORD,
  "staging-password",
);

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
      assert.equal(generated.bundle.publisher, "Namleh Studios");
      assert.deepEqual(generated.bundle.icon, [
        `icons/namleh/${environment}/32x32.png`,
        `icons/namleh/${environment}/128x128.png`,
        `icons/namleh/${environment}/128x128@2x.png`,
        `icons/namleh/${environment}/icon.icns`,
      ]);
      assert.equal(
        generated.bundle.macOS.dmg.background,
        `icons/namleh/${environment}/dmg-background.png`,
      );
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
