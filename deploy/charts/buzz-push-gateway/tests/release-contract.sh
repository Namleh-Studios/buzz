#!/usr/bin/env bash
set -euo pipefail
ruby <<'RUBY'
require 'yaml'

auto_text = File.read('.github/workflows/auto-tag-on-release-pr-merge.yml')
publish_text = File.read('.github/workflows/push-gateway-helm-chart.yml')
# Parse first, then pin the cross-workflow strings whose agreement makes this a
# reachable lane rather than an orphan publisher.
YAML.safe_load(auto_text)
YAML.safe_load(publish_text)
[
    'push-chart-release/*)',
    'VERSION="${BRANCH#push-chart-release/}"',
    'TAG_PREFIX="push-chart-v"',
    'gh api --method POST "repos/$GITHUB_REPOSITORY/git/refs"',
    '-f ref="refs/tags/$TAG"',
].each do |needle|
  raise "missing auto-tag gateway chart contract: #{needle}" unless auto_text.include?(needle)
end
[
    'tags: ["push-chart-v[0-9]*"]',
    'version="${INPUT_VERSION:-${REF_NAME#push-chart-v}}"',
    'refs/tags/push-chart-v${version}^{commit}',
    'deploy/charts/buzz-push-gateway',
].each do |needle|
  raise "missing gateway chart publisher contract: #{needle}" unless publish_text.include?(needle)
end
RUBY
