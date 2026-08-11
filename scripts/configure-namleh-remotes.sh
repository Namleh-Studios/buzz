#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

origin_url=$(git remote get-url origin 2>/dev/null || true)
origin_push_url=$(git remote get-url --push origin 2>/dev/null || true)
case "$origin_url" in
  https://github.com/Namleh-Studios/buzz | https://github.com/Namleh-Studios/buzz.git | git@github.com:Namleh-Studios/buzz.git) ;;
  *)
    echo "origin must point to Namleh-Studios/buzz; found: ${origin_url:-missing}" >&2
    exit 1
    ;;
esac
case "$origin_push_url" in
  https://github.com/Namleh-Studios/buzz | https://github.com/Namleh-Studios/buzz.git | git@github.com:Namleh-Studios/buzz.git) ;;
  *)
    echo "origin push must point to Namleh-Studios/buzz; found: ${origin_push_url:-missing}" >&2
    exit 1
    ;;
esac

if git remote get-url upstream >/dev/null 2>&1; then
  git remote set-url upstream https://github.com/block/buzz.git
else
  git remote add upstream https://github.com/block/buzz.git
fi

git remote set-url --push upstream /dev/null

[[ $(git remote get-url upstream) == "https://github.com/block/buzz.git" ]]
[[ $(git remote get-url --push upstream) == "/dev/null" ]]

echo "Namleh fork remotes configured: origin is writable; upstream push is disabled."
