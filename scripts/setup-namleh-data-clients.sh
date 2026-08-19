#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_WORKSPACE:?missing GITHUB_WORKSPACE}"
: "${RUNNER_TEMP:?missing RUNNER_TEMP}"

client_bin="${RUNNER_TEMP}/namleh-data-clients"
install -d -m 0755 "$client_bin"

for client in pg_dump pg_restore psql; do
  # shellcheck disable=SC1003,SC2016 # Write deferred wrapper expressions verbatim.
  printf '%s\n' \
    '#!/usr/bin/env bash' \
    'set -euo pipefail' \
    'exec docker run --rm \' \
    '  --volume "${GITHUB_WORKSPACE}:${GITHUB_WORKSPACE}" \' \
    '  --volume "${RUNNER_TEMP}:${RUNNER_TEMP}" \' \
    '  --workdir "$PWD" \' \
    '  postgres:18.6 "$(basename "$0")" "$@"' \
    >"${client_bin}/${client}"
  chmod 0755 "${client_bin}/${client}"
done

# shellcheck disable=SC1003,SC2016 # Write deferred wrapper expressions verbatim.
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'exec docker run --rm \' \
  '  --env AWS_ACCESS_KEY_ID \' \
  '  --env AWS_SECRET_ACCESS_KEY \' \
  '  --env AWS_DEFAULT_REGION \' \
  '  --volume "${GITHUB_WORKSPACE}:${GITHUB_WORKSPACE}" \' \
  '  --volume "${RUNNER_TEMP}:${RUNNER_TEMP}" \' \
  '  --workdir "$PWD" \' \
  '  amazon/aws-cli:2.36.20 "$@"' \
  >"${client_bin}/aws"
chmod 0755 "${client_bin}/aws"

printf '%s\n' "$client_bin"
