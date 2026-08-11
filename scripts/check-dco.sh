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
  author=$(git show -s --format='%an <%ae>' "$commit")
  if ! git show -s --format=%B "$commit" |
    git interpret-trailers --parse |
    grep -Fxiq "Signed-off-by: $author"; then
    echo "$commit is missing Signed-off-by: $author" >&2
    failed=1
  fi
done < <(git rev-list --reverse "$1")

if [[ $count -eq 0 ]]; then
  echo "DCO range contains no commits: $1" >&2
  exit 1
fi

exit "$failed"
