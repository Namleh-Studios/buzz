#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
checker="$repo_root/scripts/check-dco.sh"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

git -C "$scratch" init -q
git -C "$scratch" -c core.hooksPath=/dev/null -c user.name=ci -c user.email=ci@example.com commit -q --allow-empty -m baseline
git -C "$scratch" -c core.hooksPath=/dev/null -c user.name=ci -c user.email=ci@example.com commit -q --allow-empty -s -m signed
(cd "$scratch" && "$checker" HEAD^..HEAD)

git -C "$scratch" -c core.hooksPath=/dev/null -c user.name=Integrator -c user.email=integrator@example.com commit -q --allow-empty -s --author="Upstream Author <upstream@example.com>" -m cherry-picked
(cd "$scratch" && "$checker" HEAD^..HEAD)

git -C "$scratch" -c core.hooksPath=/dev/null -c user.name=ci -c user.email=ci@example.com commit -q --allow-empty -m unsigned
if (cd "$scratch" && "$checker" HEAD^..HEAD >/dev/null 2>&1); then
  echo "DCO checker accepted an unsigned commit" >&2
  exit 1
fi

git -C "$scratch" -c core.hooksPath=/dev/null -c user.name=ci -c user.email=ci@example.com commit -q --allow-empty -m wrong-signoff -m "Signed-off-by: Other <other@example.com>"
if (cd "$scratch" && "$checker" HEAD^..HEAD >/dev/null 2>&1); then
  echo "DCO checker accepted an unrelated sign-off" >&2
  exit 1
fi

echo "DCO contract passed."
