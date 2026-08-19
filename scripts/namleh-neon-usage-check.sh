#!/usr/bin/env bash
set -euo pipefail

environment="${1:?usage: namleh-neon-usage-check.sh <staging|production>}"
case "$environment" in
  staging | production) ;;
  *) echo "environment must be staging or production" >&2; exit 2 ;;
esac
: "${NEON_API_KEY:?missing NEON_API_KEY}"

foundation="deploy/namleh/data-foundation.json"
project_id="$(jq -r --arg environment "$environment" '.environments[$environment].neon.projectId' "$foundation")"
branch_id="$(jq -r --arg environment "$environment" '.environments[$environment].neon.branchId' "$foundation")"
usage="$(
  curl --fail --silent --show-error \
    --header "Authorization: Bearer $NEON_API_KEY" \
    "https://console.neon.tech/api/v2/projects/${project_id}/branches/${branch_id}"
)"

logical_size="$(jq -er '.branch.logical_size | numbers' <<<"$usage")"
compute_seconds="$(jq -er '.branch.compute_time_seconds | numbers' <<<"$usage")"
storage_limit=350000000
compute_limit=288000
failed=false

if (( logical_size >= storage_limit )); then
  echo "::error::Neon ${environment} storage usage is ${logical_size} bytes; the 350 MB warning threshold has been reached"
  failed=true
fi
if (( compute_seconds >= compute_limit )); then
  echo "::error::Neon ${environment} compute usage is ${compute_seconds} seconds; the 80 hour warning threshold has been reached"
  failed=true
fi
if [[ "$failed" == "true" ]]; then
  exit 1
fi

echo "Neon ${environment} usage is below the 350 MB storage and 80 hour compute warning thresholds"
