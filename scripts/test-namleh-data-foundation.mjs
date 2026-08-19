#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const foundation = JSON.parse(
  readFileSync(resolve(root, "deploy/namleh/data-foundation.json"), "utf8"),
);
const { staging, production } = foundation.environments;

for (const [name, environment] of Object.entries({ staging, production })) {
  assert.equal(environment.neon.connectionMode, "direct");
  assert.ok(environment.neon.poolSize >= 8 && environment.neon.poolSize <= 10);
  assert.ok(environment.neon.connectAttempts > 1);
  assert.ok(environment.neon.connectBackoffMs > 0);
  assert.equal(environment.neon.backupRole, "buzz_backup");
  assert.match(environment.neon.databaseUrlSecret, new RegExp(`^BUZZ_${name.toUpperCase()}_`));
  assert.match(
    environment.neon.migrationDatabaseUrlSecret,
    new RegExp(`^BUZZ_${name.toUpperCase()}_`),
  );
  assert.equal(
    environment.neon.backupDatabaseUrlSecret,
    `BUZZ_${name.toUpperCase()}_BACKUP_DATABASE_URL`,
  );

  for (const bucket of [
    environment.r2.objectsBucket,
    environment.r2.backupsBucket,
    environment.r2.browserCheckpointsBucket,
  ]) {
    assert.match(bucket, new RegExp(`^namleh-buzz-${name}-`));
  }
}

for (const field of [
  "projectId",
  "branchId",
  "databaseUrlSecret",
  "migrationDatabaseUrlSecret",
  "backupDatabaseUrlSecret",
]) {
  assert.notEqual(staging.neon[field], production.neon[field]);
}

for (const field of [
  "objectsBucket",
  "backupsBucket",
  "browserCheckpointsBucket",
  "runtimeAccessKeySecret",
  "runtimeSecretKeySecret",
  "backupAccessKeySecret",
  "backupSecretKeySecret",
]) {
  assert.notEqual(staging.r2[field], production.r2[field]);
}

assert.equal(foundation.backupPolicy.dailyRetention, 30);
assert.equal(foundation.backupPolicy.monthlyRetention, 12);
assert.equal(foundation.backupPolicy.dailyPrefix, "daily/");
assert.equal(foundation.backupPolicy.monthlyPrefix, "monthly/");
assert.match(foundation.restoreValidation.neonProjectId, /^[-a-z0-9]+$/);
assert.match(foundation.restoreValidation.neonBranchId, /^br-[-a-z0-9]+$/);
assert.equal(
  foundation.restoreValidation.databaseUrlSecret,
  "BUZZ_RESTORE_VALIDATION_DATABASE_URL",
);

const usageCheck = readFileSync(
  resolve(root, "scripts/namleh-neon-usage-check.sh"),
  "utf8",
);
assert.match(usageCheck, /storage_limit=350000000/);
assert.match(usageCheck, /compute_limit=288000/);

const backupScript = readFileSync(
  resolve(root, "scripts/namleh-data-backup.sh"),
  "utf8",
);
assert.match(backupScript, /_BACKUP_DATABASE_URL/);
assert.doesNotMatch(backupScript, /_MIGRATION_DATABASE_URL/);

const productionRestore = readFileSync(
  resolve(root, ".github/workflows/namleh-production-data-restore.yml"),
  "utf8",
);
assert.match(productionRestore, /^    environment: production$/m);
assert.match(productionRestore, /inputs\.confirmation == 'RESTORE PRODUCTION DATA'/);

const backupWorkflow = readFileSync(
  resolve(root, ".github/workflows/namleh-data-backup.yml"),
  "utf8",
);
for (const workflow of [backupWorkflow, productionRestore]) {
  assert.match(
    workflow,
    /ghcr\.io\/bitwarden\/bws:2\.1\.0@sha256:[a-f0-9]{64}/,
  );
  assert.doesNotMatch(workflow, /bitwarden\/sm-action/);
}

console.log("Namleh data foundation contract passed");
