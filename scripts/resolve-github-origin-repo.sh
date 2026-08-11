#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

parse_github_repo() {
  local label=$1
  local url=$2
  local repo

  if [[ -z "$url" || "$url" == *$'\n'* ]]; then
    echo "origin must have exactly one GitHub $label URL" >&2
    return 1
  fi

  case "$url" in
    https://github.com/*) repo=${url#https://github.com/} ;;
    git@github.com:*) repo=${url#git@github.com:} ;;
    ssh://git@github.com/*) repo=${url#ssh://git@github.com/} ;;
    *)
      echo "origin $label URL must point directly to github.com: $url" >&2
      return 1
      ;;
  esac

  repo=${repo%.git}
  if ! [[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    echo "origin $label URL does not contain a valid GitHub owner/repository: $url" >&2
    return 1
  fi

  printf '%s\n' "$repo"
}

origin_fetch_urls=$(git remote get-url --all origin 2>/dev/null || true)
origin_push_urls=$(git remote get-url --push --all origin 2>/dev/null || true)
fetch_repo=$(parse_github_repo fetch "$origin_fetch_urls")
push_repo=$(parse_github_repo push "$origin_push_urls")

if [[ "$fetch_repo" != "$push_repo" ]]; then
  echo "origin fetch and push repositories differ: $fetch_repo != $push_repo" >&2
  exit 1
fi

printf '%s\n' "$push_repo"
