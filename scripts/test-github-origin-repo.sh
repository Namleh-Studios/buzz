#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
resolver="$repo_root/scripts/resolve-github-origin-repo.sh"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

git -C "$scratch" init -q
git -C "$scratch" remote add origin https://github.com/Namleh-Studios/buzz.git

for url in \
  https://github.com/Namleh-Studios/buzz \
  https://github.com/Namleh-Studios/buzz.git \
  git@github.com:Namleh-Studios/buzz \
  git@github.com:Namleh-Studios/buzz.git \
  ssh://git@github.com/Namleh-Studios/buzz \
  ssh://git@github.com/Namleh-Studios/buzz.git; do
  git -C "$scratch" remote set-url origin "$url"
  [[ $(cd "$scratch" && "$resolver") == "Namleh-Studios/buzz" ]]
done

git -C "$scratch" remote set-url origin https://github.com/Namleh-Studios/buzz.git
git -C "$scratch" config --add remote.origin.pushurl git@github.com:Namleh-Studios/buzz.git
[[ $(cd "$scratch" && "$resolver") == "Namleh-Studios/buzz" ]]
git -C "$scratch" config --unset-all remote.origin.pushurl

git -C "$scratch" remote set-url origin https://example.com/Namleh-Studios/buzz.git
if (cd "$scratch" && "$resolver" >/dev/null 2>&1); then
  echo "resolver accepted a non-GitHub origin" >&2
  exit 1
fi

git -C "$scratch" remote set-url origin https://github.com/Namleh-Studios/buzz.git
git -C "$scratch" config --add remote.origin.pushurl https://github.com/Namleh-Studios/buzz.git
git -C "$scratch" config --add remote.origin.pushurl https://github.com/block/buzz.git
if (cd "$scratch" && "$resolver" >/dev/null 2>&1); then
  echo "resolver accepted multiple origin push URLs" >&2
  exit 1
fi

git -C "$scratch" config --unset-all remote.origin.pushurl
git -C "$scratch" config --add remote.origin.pushurl https://github.com/Namleh-Studios/buzz.git
git -C "$scratch" remote set-url origin https://github.com/block/buzz.git
if (cd "$scratch" && "$resolver" >/dev/null 2>&1); then
  echo "resolver accepted different origin fetch and push repositories" >&2
  exit 1
fi

git -C "$scratch" remote set-url origin https://github.com/Namleh-Studios/buzz.git
git -C "$scratch" remote set-url --add origin https://github.com/block/buzz.git
if (cd "$scratch" && "$resolver" >/dev/null 2>&1); then
  echo "resolver accepted multiple origin fetch URLs" >&2
  exit 1
fi

echo "GitHub origin repository resolver passed."
