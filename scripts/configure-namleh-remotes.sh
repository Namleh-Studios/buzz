#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

is_namleh_url() {
  case "$1" in
    https://github.com/Namleh-Studios/buzz | https://github.com/Namleh-Studios/buzz.git | git@github.com:Namleh-Studios/buzz | git@github.com:Namleh-Studios/buzz.git | ssh://git@github.com/Namleh-Studios/buzz | ssh://git@github.com/Namleh-Studios/buzz.git) return 0 ;;
    *) return 1 ;;
  esac
}

validate_origin_urls() {
  local label=$1
  shift
  local count=0
  local url

  while IFS= read -r url; do
    count=$((count + 1))
    if ! is_namleh_url "$url"; then
      echo "$label must contain only Namleh-Studios/buzz URLs; found: $url" >&2
      exit 1
    fi
  done < <("$@" 2>/dev/null || true)

  if [[ $count -ne 1 ]]; then
    echo "$label must contain exactly one Namleh-Studios/buzz URL; found: $count" >&2
    exit 1
  fi
}

validate_origin_urls "origin fetch" git remote get-url --all origin
validate_origin_urls "origin push" git remote get-url --push --all origin

git config --replace-all remote.upstream.pushurl /dev/null
git config --replace-all remote.upstream.url https://github.com/block/buzz.git
git config --replace-all remote.upstream.fetch '+refs/heads/*:refs/remotes/upstream/*'

[[ $(git remote get-url --all upstream) == "https://github.com/block/buzz.git" ]]
[[ $(git remote get-url --push --all upstream) == "/dev/null" ]]
[[ $(git config --get-all remote.upstream.fetch) == '+refs/heads/*:refs/remotes/upstream/*' ]]

echo "Namleh fork remotes configured: origin is writable; upstream push is disabled."
