#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

origin_push_urls=$(git remote get-url --push --all origin 2>/dev/null || true)
if [[ -z "$origin_push_urls" || "$origin_push_urls" == *$'\n'* ]]; then
  echo "origin must have exactly one GitHub push URL" >&2
  exit 1
fi

case "$origin_push_urls" in
  https://github.com/*) repo=${origin_push_urls#https://github.com/} ;;
  git@github.com:*) repo=${origin_push_urls#git@github.com:} ;;
  ssh://git@github.com/*) repo=${origin_push_urls#ssh://git@github.com/} ;;
  *)
    echo "origin push URL must point directly to github.com: $origin_push_urls" >&2
    exit 1
    ;;
esac

repo=${repo%.git}
if ! [[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "origin push URL does not contain a valid GitHub owner/repository: $origin_push_urls" >&2
  exit 1
fi

printf '%s\n' "$repo"
