#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <git-revision-range>" >&2
  exit 1
fi

count=0
failed=0
while IFS= read -r commit; do
  count=$((count + 1))
  author_email=$(git show -s --format='%ae' "$commit" | tr '[:upper:]' '[:lower:]')
  committer_email=$(git show -s --format='%ce' "$commit" | tr '[:upper:]' '[:lower:]')
  signed=0
  while IFS= read -r signoff; do
    signoff_email=$(printf '%s\n' "$signoff" | sed -n 's/.*<\([^<>]*\)>.*/\1/p' | tr '[:upper:]' '[:lower:]')
    if [[ -n "$signoff_email" && ("$signoff_email" == "$author_email" || "$signoff_email" == "$committer_email") ]]; then
      signed=1
      break
    fi
  done < <(git show -s --format=%B "$commit" | git interpret-trailers --parse | sed -n 's/^[Ss][Ii][Gg][Nn][Ee][Dd]-[Oo][Ff][Ff]-[Bb][Yy]:[[:space:]]*//p')

  if [[ $signed -ne 1 ]]; then
    echo "$commit is missing a Signed-off-by trailer matching author or committer email" >&2
    failed=1
  fi
done < <(git rev-list --reverse "$1")

if [[ $count -eq 0 ]]; then
  echo "DCO range contains no commits: $1" >&2
  exit 1
fi

exit "$failed"
