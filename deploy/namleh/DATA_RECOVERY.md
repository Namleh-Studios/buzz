# Namleh Buzz data recovery

Daily backups run from `.github/workflows/namleh-data-backup.yml`. Each backup
is checksummed, retained in its environment's private R2 backup bucket, and
restored into the separate `buzz-restore-validation` Neon project. The workflow
keeps 30 daily and 12 monthly recovery sets.

Backups connect as the SQL-created `buzz_backup` role. It can read the public
schema but cannot create databases, roles, schemas, or tables, bypass row-level
security, or replicate. Migration credentials are not available to the backup
step.

Production restoration is manual and fail-closed. A founder-admin selects the
exact `database.dump` key, types `RESTORE PRODUCTION DATA`, and approves the
`production` GitHub environment for the `Namleh production data restore`
workflow. The workflow restores no object unless all three gates pass.

Recovery order is:

1. Restore the selected Neon logical backup and verify its checksum, migration
   count, and public-table count.
2. Verify the production private object bucket before enabling message media or
   Git access.
3. Enable the owner-scoped Browser checkpoint bucket last, after identity,
   community, and channel authorization is healthy.

Never point restore validation at either live Neon database. Production schema
migrations require a fresh successful production backup plus the separate
production-release approval. Schema changes use expand/contract sequencing;
application rollback must remain compatible with the expanded schema.

## Provisioning proof — 2026-08-19

- Staging applied all 28 migrations and restored 54 public tables from a fresh
  read-only-role backup into the isolated validation project. The live probe
  also verified `pgcrypto`, generated full-text search state, transactions, and
  advisory locks.
- Production backed up and restored as an intentionally empty database: zero
  migrations and zero public tables.
- Both `buzz_backup` roles have no role memberships, create, replication, or
  row-security-bypass attributes; direct write probes were denied.
- Staging and production usage checks were below the 350 MB storage and 80 hour
  compute warning thresholds.
- All six R2 buckets were private, and scoped credential probes denied
  cross-environment and cross-purpose access.
