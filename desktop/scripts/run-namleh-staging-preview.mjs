import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createNamlehStagingPreviewEnvironment } from "./namleh-staging-preview-environment.mjs";

const desktopDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const identities = JSON.parse(
  readFileSync(resolve(desktopDirectory, "namleh-app-identities.json"), "utf8"),
);
const buildEnvironment = createNamlehStagingPreviewEnvironment({
  parentEnvironment: process.env,
  identities,
});
const result = spawnSync(
  "pnpm",
  [
    "tauri",
    "build",
    "--features",
    "mesh-llm",
    "--config",
    "src-tauri/tauri.namleh.staging.conf.json",
    "--bundles",
    "app",
  ],
  { cwd: desktopDirectory, env: buildEnvironment, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
