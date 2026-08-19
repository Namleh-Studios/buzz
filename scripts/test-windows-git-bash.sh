#!/usr/bin/env bash
set -euo pipefail

output="$(echo hello | tr '[:lower:]' '[:upper:]')"
[[ "$output" == "HELLO" ]]

git --version
test_repo="$(mktemp -d)"
trap 'rm -rf -- "$test_repo"' EXIT
cd "$test_repo"
git init -q
git -c user.name=ci -c user.email=ci@example.com commit -q --allow-empty -m smoke
[[ "$(git log -1 --format=%s)" == "smoke" ]]

echo "Host Git Bash and git commit round-trip passed"
