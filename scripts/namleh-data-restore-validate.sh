#!/usr/bin/env bash
set -euo pipefail

environment="${1:?usage: namleh-data-restore-validate.sh <staging|production> <daily|monthly>}"
cadence="${2:?usage: namleh-data-restore-validate.sh <staging|production> <daily|monthly>}"
restore_mode="${3:-validation}"

case "$environment" in
  staging | production) ;;
  *) echo "environment must be staging or production" >&2; exit 2 ;;
esac
case "$cadence" in
  daily | monthly) ;;
  *) echo "cadence must be daily or monthly" >&2; exit 2 ;;
esac
case "$restore_mode" in
  validation | production) ;;
  *) echo "restore mode must be validation or production" >&2; exit 2 ;;
esac

environment_upper="$(printf '%s' "$environment" | tr '[:lower:]' '[:upper:]')"
environment_prefix="BUZZ_${environment_upper}"
access_key_name="${environment_prefix}_BACKUP_R2_ACCESS_KEY_ID"
secret_key_name="${environment_prefix}_BACKUP_R2_SECRET_ACCESS_KEY"
export AWS_ACCESS_KEY_ID="${!access_key_name:?missing $access_key_name}"
export AWS_SECRET_ACCESS_KEY="${!secret_key_name:?missing $secret_key_name}"
export AWS_DEFAULT_REGION=auto
: "${CLOUDFLARE_NAMLEH_ACCOUNT_ID:?missing CLOUDFLARE_NAMLEH_ACCOUNT_ID}"

database_identity() {
  printf '%s' "$1" | sed -E 's#^[^@]*@##; s#[?].*$##'
}

if [[ "$restore_mode" == "production" ]]; then
  [[ "$environment" == "production" ]]
  [[ "${NAMLEH_PRODUCTION_RESTORE_CONFIRMATION:-}" == "RESTORE PRODUCTION DATA" ]]
  : "${PRODUCTION_RESTORE_BACKUP_KEY:?missing PRODUCTION_RESTORE_BACKUP_KEY}"
  : "${BUZZ_PRODUCTION_MIGRATION_DATABASE_URL:?missing BUZZ_PRODUCTION_MIGRATION_DATABASE_URL}"
  restore_database_url="$BUZZ_PRODUCTION_MIGRATION_DATABASE_URL"
else
  : "${BUZZ_RESTORE_VALIDATION_DATABASE_URL:?missing BUZZ_RESTORE_VALIDATION_DATABASE_URL}"
  : "${BUZZ_STAGING_MIGRATION_DATABASE_URL:?missing BUZZ_STAGING_MIGRATION_DATABASE_URL}"
  : "${BUZZ_PRODUCTION_MIGRATION_DATABASE_URL:?missing BUZZ_PRODUCTION_MIGRATION_DATABASE_URL}"
  restore_database_url="$BUZZ_RESTORE_VALIDATION_DATABASE_URL"
  restore_identity="$(database_identity "$restore_database_url")"
  [[ "$restore_identity" != "$(database_identity "$BUZZ_STAGING_MIGRATION_DATABASE_URL")" ]]
  [[ "$restore_identity" != "$(database_identity "$BUZZ_PRODUCTION_MIGRATION_DATABASE_URL")" ]]
fi

bucket="namleh-buzz-${environment}-backups"
endpoint="https://${CLOUDFLARE_NAMLEH_ACCOUNT_ID}.r2.cloudflarestorage.com"
if [[ "$restore_mode" == "production" ]]; then
  backup_key="$PRODUCTION_RESTORE_BACKUP_KEY"
  [[ "$backup_key" == "${cadence}/"*"/database.dump" ]]
else
  backup_key="$({
    aws s3api list-objects-v2 \
      --endpoint-url "$endpoint" \
      --bucket "$bucket" \
      --prefix "${cadence}/" \
      --output json
  } | jq -r '[.Contents[]? | select(.Key | endswith("/database.dump"))] | sort_by(.LastModified) | last | .Key // empty')"
fi
if [[ -z "$backup_key" ]]; then
  echo "no ${environment} ${cadence} backup is available" >&2
  exit 1
fi

work_dir="$(mktemp -d)"
trap 'rm -rf -- "$work_dir"' EXIT
checksum_key="${backup_key%database.dump}database.dump.sha256"
metadata_key="${backup_key%database.dump}metadata.json"
aws s3 cp --only-show-errors --endpoint-url "$endpoint" "s3://${bucket}/${backup_key}" - >"$work_dir/database.dump"
aws s3 cp --only-show-errors --endpoint-url "$endpoint" "s3://${bucket}/${checksum_key}" - >"$work_dir/database.dump.sha256"
aws s3 cp --only-show-errors --endpoint-url "$endpoint" "s3://${bucket}/${metadata_key}" - >"$work_dir/metadata.json"
(
  cd "$work_dir"
  sha256sum --check database.dump.sha256
)
[[ "$(jq -r '.sha256' "$work_dir/metadata.json")" == "$(cut -d ' ' -f 1 "$work_dir/database.dump.sha256")" ]]
[[ "$(jq -r '.sizeBytes' "$work_dir/metadata.json")" == "$(wc -c <"$work_dir/database.dump" | tr -d ' ')" ]]
pg_restore --list <"$work_dir/database.dump" >/dev/null
psql "$restore_database_url" \
  --no-psqlrc \
  --set ON_ERROR_STOP=1 \
  --command "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
pg_restore \
  --dbname "$restore_database_url" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  <"$work_dir/database.dump"

if [[ "$restore_mode" == "production" ]]; then
  psql "$restore_database_url" \
    --no-psqlrc \
    --set ON_ERROR_STOP=1 \
    --command "REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO buzz_app, buzz_backup; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO buzz_app; GRANT SELECT ON ALL TABLES IN SCHEMA public TO buzz_backup; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO buzz_app; GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO buzz_backup; ALTER DEFAULT PRIVILEGES FOR ROLE buzz_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO buzz_app; ALTER DEFAULT PRIVILEGES FOR ROLE buzz_migrator IN SCHEMA public GRANT SELECT ON TABLES TO buzz_backup; ALTER DEFAULT PRIVILEGES FOR ROLE buzz_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO buzz_app; ALTER DEFAULT PRIVILEGES FOR ROLE buzz_migrator IN SCHEMA public GRANT SELECT ON SEQUENCES TO buzz_backup;"
fi

expected_migrations="$(jq -r '.migrationCount' "$work_dir/metadata.json")"
expected_tables="$(jq -r '.tableCount' "$work_dir/metadata.json")"
if [[ "$(psql "$restore_database_url" --no-psqlrc --tuples-only --no-align --command "SELECT to_regclass('_sqlx_migrations') IS NOT NULL;")" == "t" ]]; then
  actual_migrations="$(psql "$restore_database_url" --no-psqlrc --tuples-only --no-align --command "SELECT count(*) FROM _sqlx_migrations WHERE success;")"
else
  actual_migrations=0
fi
actual_tables="$(
  psql "$restore_database_url" --no-psqlrc --tuples-only --no-align --command \
    "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
)"
[[ "$actual_migrations" == "$expected_migrations" ]]
[[ "$actual_tables" == "$expected_tables" ]]

echo "Restored and verified ${environment} ${cadence} backup in ${restore_mode} mode"
