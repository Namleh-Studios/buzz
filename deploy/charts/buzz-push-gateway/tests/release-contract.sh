#!/usr/bin/env bash
set -euo pipefail
auto_text="$(<.github/workflows/auto-tag-on-release-pr-merge.yml)"
publish_text="$(<.github/workflows/push-gateway-helm-chart.yml)"

# shellcheck disable=SC2016 # These are literal workflow expressions.
for needle in \
  'push-chart-release/*)' \
  'VERSION="${BRANCH#push-chart-release/}"' \
  'TAG_PREFIX="push-chart-v"' \
  'gh api --method POST "repos/$GITHUB_REPOSITORY/git/refs"' \
  '-f ref="refs/tags/$TAG"'
do
  if [[ "$auto_text" != *"$needle"* ]]; then
    echo "missing auto-tag gateway chart contract: $needle" >&2
    exit 1
  fi
done

# shellcheck disable=SC2016 # These are literal workflow expressions.
for needle in \
  'tags: ["push-chart-v[0-9]*"]' \
  'version="${INPUT_VERSION:-${REF_NAME#push-chart-v}}"' \
  'refs/tags/push-chart-v${version}^{commit}' \
  'deploy/charts/buzz-push-gateway'
do
  if [[ "$publish_text" != *"$needle"* ]]; then
    echo "missing gateway chart publisher contract: $needle" >&2
    exit 1
  fi
done
