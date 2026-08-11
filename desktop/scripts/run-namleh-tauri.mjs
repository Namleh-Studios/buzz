import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
const result = spawnSync(
  "pnpm",
  [
    "tauri",
    "build",
    "--no-sign",
    "--config",
    `src-tauri/tauri.namleh.${environment}.conf.json`,
  ],
  {
    cwd: desktopDirectory,
    env: {
      ...process.env,
      NAMLEH_APP_ENV: environment,
      VITE_NAMLEH_APP_ENV: environment,
      VITE_NAMLEH_DEEP_LINK_SCHEME: identity.deepLinkScheme,
    },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
