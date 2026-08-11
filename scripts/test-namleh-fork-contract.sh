#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
script="$repo_root/scripts/configure-namleh-remotes.sh"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

git -C "$scratch" init -q
git -C "$scratch" -c user.name=ci -c user.email=ci@example.com commit -q --allow-empty -m baseline
git -C "$scratch" branch -M main
git -C "$scratch" remote add origin https://github.com/Namleh-Studios/buzz.git
git -C "$scratch" remote add upstream https://github.com/example/writable-upstream.git
git -C "$scratch" remote set-url --push upstream https://github.com/example/writable-upstream.git

git -C "$scratch" -c safe.directory="$scratch" -c core.hooksPath=/dev/null status >/dev/null
(
  cd "$scratch"
  "$script" >/dev/null
)

[[ $(git -C "$scratch" remote get-url upstream) == "https://github.com/block/buzz.git" ]]
[[ $(git -C "$scratch" remote get-url --push upstream) == "/dev/null" ]]

if git -C "$scratch" push --dry-run upstream main >/dev/null 2>&1; then
  echo "upstream accepted a push after the read-only guard was installed" >&2
  exit 1
fi

git -C "$scratch" remote set-url --push origin https://github.com/block/buzz.git
if (
  cd "$scratch"
  "$script" >/dev/null 2>&1
); then
  echo "configure-namleh-remotes.sh accepted a non-Namleh origin" >&2
  exit 1
fi

git -C "$scratch" remote set-url --push origin https://github.com/Namleh-Studios/buzz.git
git -C "$scratch" remote set-url origin https://github.com/block/buzz.git
if (
  cd "$scratch"
  "$script" >/dev/null 2>&1
); then
  echo "configure-namleh-remotes.sh accepted a non-Namleh origin fetch URL" >&2
  exit 1
fi

echo "Namleh fork remote contract passed."
