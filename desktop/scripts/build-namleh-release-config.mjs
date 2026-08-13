import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopDirectory = resolve(scriptDirectory, "..");
const identities = JSON.parse(
  readFileSync(resolve(desktopDirectory, "namleh-app-identities.json"), "utf8"),
);

const environment = process.argv[2];
if (!["staging", "production"].includes(environment)) {
  console.error(
    "Usage: node scripts/build-namleh-release-config.mjs <staging|production>",
  );
  process.exit(1);
}

const identity = identities[environment];
const releaseVersion = process.env.NAMLEH_RELEASE_VERSION?.trim();
const updaterPublicKey = process.env[identity.updaterPublicKeyEnv]?.trim();
const updaterEndpoint = process.env[identity.updaterEndpointEnv]?.trim();
const missing = [];
if (!releaseVersion) missing.push("NAMLEH_RELEASE_VERSION");
if (!updaterPublicKey) missing.push(identity.updaterPublicKeyEnv);
if (!updaterEndpoint) missing.push(identity.updaterEndpointEnv);
if (missing.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missing.join(", ")}`,
  );
  process.exit(1);
}
if (updaterEndpoint !== identity.updaterEndpoint) {
  console.error(
    `${identity.updaterEndpointEnv} must equal ${identity.updaterEndpoint}`,
  );
  process.exit(1);
}

let parsedEndpoint;
try {
  parsedEndpoint = new URL(updaterEndpoint);
} catch {
  console.error(`${identity.updaterEndpointEnv} must be a valid URL`);
  process.exit(1);
}
if (parsedEndpoint.protocol !== "https:") {
  console.error(`${identity.updaterEndpointEnv} must use HTTPS`);
  process.exit(1);
}
if (parsedEndpoint.username || parsedEndpoint.password) {
  console.error(`${identity.updaterEndpointEnv} must not contain credentials`);
  process.exit(1);
}
if (parsedEndpoint.origin !== "https://updates.namlehstudios.com") {
  console.error(
    `${identity.updaterEndpointEnv} must use https://updates.namlehstudios.com`,
  );
  process.exit(1);
}
const endpointSegments = parsedEndpoint.pathname.split("/");
if (!endpointSegments.includes(identity.updaterManifestNamespace)) {
  console.error(
    `${identity.updaterEndpointEnv} must include the ${identity.updaterManifestNamespace} manifest namespace`,
  );
  process.exit(1);
}
if (!endpointSegments.includes(identity.updaterChannel)) {
  console.error(
    `${identity.updaterEndpointEnv} must include the ${identity.updaterChannel} updater channel`,
  );
  process.exit(1);
}
const otherEnvironment = environment === "staging" ? "production" : "staging";
const otherIdentity = identities[otherEnvironment];
if (
  endpointSegments.includes(otherIdentity.updaterManifestNamespace) ||
  endpointSegments.includes(otherIdentity.updaterChannel)
) {
  console.error(
    `${identity.updaterEndpointEnv} must not reference the ${otherEnvironment} updater`,
  );
  process.exit(1);
}
const expectedPath = `/${identity.updaterManifestNamespace}/${identity.updaterChannel}/latest.json`;
if (
  parsedEndpoint.pathname !== expectedPath ||
  parsedEndpoint.search ||
  parsedEndpoint.hash
) {
  console.error(
    `${identity.updaterEndpointEnv} must equal https://updates.namlehstudios.com${expectedPath}`,
  );
  process.exit(1);
}

const config = {
  productName: identity.productName,
  version: releaseVersion,
  identifier: identity.bundleIdentifier,
  build: {
    beforeBuildCommand: {
      script: `VITE_NAMLEH_APP_ENV=${environment} VITE_NAMLEH_DEEP_LINK_SCHEME=${identity.deepLinkScheme} pnpm build`,
      cwd: "..",
      wait: true,
    },
  },
  plugins: {
    updater: {
      pubkey: updaterPublicKey,
      endpoints: [updaterEndpoint],
    },
    "deep-link": {
      desktop: {
        schemes: [identity.deepLinkScheme],
      },
    },
  },
  bundle: {
    createUpdaterArtifacts: true,
    macOS: {
      minimumSystemVersion: "10.15",
      entitlements: `Entitlements.namleh.${environment}.plist`,
    },
  },
};

const outputPath = resolve(
  desktopDirectory,
  `src-tauri/tauri.namleh.${environment}.release.conf.json`,
);
writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
