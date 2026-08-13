import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { createNamlehReleaseEnvironment } from "./namleh-release-environment.mjs";

const desktopDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const identities = JSON.parse(
  readFileSync(resolve(desktopDirectory, "namleh-app-identities.json"), "utf8"),
);
const environment = process.argv[2];
if (!["staging", "production"].includes(environment)) {
  console.error(
    "Usage: node scripts/run-namleh-tauri.mjs <staging|production>",
  );
  process.exit(1);
}

const identity = identities[environment];
const otherIdentity =
  identities[environment === "staging" ? "production" : "staging"];
const baseConfig = JSON.parse(
  readFileSync(resolve(desktopDirectory, "src-tauri/tauri.conf.json"), "utf8"),
);
const releaseVersion = baseConfig.version;
const updaterPublicKey = process.env[identity.updaterPublicKeyEnv]?.trim();
const updaterPrivateKey = process.env[identity.updaterPrivateKeyEnv]?.trim();
const updaterPrivateKeyPassword =
  process.env[identity.updaterPrivateKeyPasswordEnv]?.trim();
const updaterEndpoint = process.env[identity.updaterEndpointEnv]?.trim();
const missing = [];
if (!updaterPublicKey) missing.push(identity.updaterPublicKeyEnv);
if (!updaterPrivateKey) missing.push(identity.updaterPrivateKeyEnv);
if (!updaterPrivateKeyPassword) {
  missing.push(identity.updaterPrivateKeyPasswordEnv);
}
if (!updaterEndpoint) missing.push(identity.updaterEndpointEnv);
if (missing.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missing.join(", ")}`,
  );
  process.exit(1);
}

const buildEnvironment = createNamlehReleaseEnvironment({
  parentEnvironment: process.env,
  environment,
  identity,
  otherIdentity,
  updaterPublicKey,
  updaterPrivateKey,
  updaterPrivateKeyPassword,
  updaterEndpoint,
  releaseVersion,
});
const generatedConfig = resolve(
  desktopDirectory,
  `src-tauri/tauri.namleh.${environment}.release.conf.json`,
);

try {
  const configResult = spawnSync(
    process.execPath,
    [
      resolve(desktopDirectory, "scripts/build-namleh-release-config.mjs"),
      environment,
    ],
    { cwd: desktopDirectory, env: buildEnvironment, stdio: "inherit" },
  );
  if (configResult.error) throw configResult.error;
  if (configResult.status !== 0) process.exit(configResult.status ?? 1);

  const result = spawnSync(
    "pnpm",
    [
      "tauri",
      "build",
      "--features",
      "mesh-llm",
      "--config",
      `src-tauri/tauri.namleh.${environment}.release.conf.json`,
    ],
    { cwd: desktopDirectory, env: buildEnvironment, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (existsSync(generatedConfig)) unlinkSync(generatedConfig);
}
