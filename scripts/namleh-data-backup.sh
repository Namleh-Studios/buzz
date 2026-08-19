#!/usr/bin/env bash
set -euo pipefail

environment="${1:?usage: namleh-data-backup.sh <staging|production> <daily|monthly>}"
cadence="${2:?usage: namleh-data-backup.sh <staging|production> <daily|monthly>}"

case "$environment" in
  staging | production) ;;
  *) echo "environment must be staging or production" >&2; exit 2 ;;
esac
case "$cadence" in
  daily | monthly) ;;
  *) echo "cadence must be daily or monthly" >&2; exit 2 ;;
esac

environment_upper="$(printf '%s' "$environment" | tr '[:lower:]' '[:upper:]')"
environment_prefix="BUZZ_${environment_upper}"
database_url_name="${environment_prefix}_BACKUP_DATABASE_URL"
access_key_name="${environment_prefix}_BACKUP_R2_ACCESS_KEY_ID"
secret_key_name="${environment_prefix}_BACKUP_R2_SECRET_ACCESS_KEY"

database_url="${!database_url_name:?missing $database_url_name}"
export AWS_ACCESS_KEY_ID="${!access_key_name:?missing $access_key_name}"
export AWS_SECRET_ACCESS_KEY="${!secret_key_name:?missing $secret_key_name}"
export AWS_DEFAULT_REGION=auto
: "${CLOUDFLARE_NAMLEH_ACCOUNT_ID:?missing CLOUDFLARE_NAMLEH_ACCOUNT_ID}"

bucket="namleh-buzz-${environment}-backups"
endpoint="https://${CLOUDFLARE_NAMLEH_ACCOUNT_ID}.r2.cloudflarestorage.com"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
if [[ "$cadence" == "daily" ]]; then
  period="$(date -u +%Y-%m-%d)"
  retain=30
else
  period="$(date -u +%Y-%m)"
  retain=12
fi
object_prefix="${cadence}/${period}/${timestamp}"
work_dir="$(mktemp -d)"
trap 'rm -rf -- "$work_dir"' EXIT

pg_dump \
  --dbname "$database_url" \
  --format custom \
  --compress 9 \
  --no-owner \
  --no-privileges \
  >"$work_dir/database.dump"
pg_restore --list <"$work_dir/database.dump" >/dev/null

if [[ "$(psql "$database_url" --no-psqlrc --tuples-only --no-align --command "SELECT to_regclass('_sqlx_migrations') IS NOT NULL;")" == "t" ]]; then
  migration_count="$(psql "$database_url" --no-psqlrc --tuples-only --no-align --command "SELECT count(*) FROM _sqlx_migrations WHERE success;")"
else
  migration_count=0
fi
table_count="$(
  psql "$database_url" --no-psqlrc --tuples-only --no-align --command \
    "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
)"

(
  cd "$work_dir"
  sha256sum database.dump >database.dump.sha256
)
backup_sha256="$(cut -d ' ' -f 1 "$work_dir/database.dump.sha256")"
backup_size="$(wc -c <"$work_dir/database.dump" | tr -d ' ')"
jq -n \
  --arg environment "$environment" \
  --arg cadence "$cadence" \
  --arg createdAt "$timestamp" \
  --arg sourceSha "${GITHUB_SHA:-manual}" \
  --arg sha256 "$backup_sha256" \
  --argjson sizeBytes "$backup_size" \
  --argjson migrationCount "$migration_count" \
  --argjson tableCount "$table_count" \
  '{environment: $environment, cadence: $cadence, createdAt: $createdAt, sourceSha: $sourceSha, sizeBytes: $sizeBytes, sha256: $sha256, migrationCount: $migrationCount, tableCount: $tableCount}' \
  >"$work_dir/metadata.json"

for file in database.dump database.dump.sha256 metadata.json; do
  aws s3 cp \
    --only-show-errors \
    --endpoint-url "$endpoint" \
    - \
    "s3://${bucket}/${object_prefix}/${file}" \
    <"$work_dir/$file"
done

backup_index=0
while IFS= read -r old_prefix; do
  backup_index=$((backup_index + 1))
  if (( backup_index <= retain )); then
    continue
  fi
  aws s3 rm \
    --only-show-errors \
    --recursive \
    --endpoint-url "$endpoint" \
    "s3://${bucket}/${old_prefix}/"
done < <(
  aws s3api list-objects-v2 \
    --endpoint-url "$endpoint" \
    --bucket "$bucket" \
    --prefix "${cadence}/" \
    --output json \
    | jq -r '.Contents[]?.Key | select(endswith("/metadata.json")) | sub("/metadata.json$"; "")' \
    | sort -r
)

echo "Uploaded and verified ${environment} ${cadence} database backup"
