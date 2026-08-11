#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
checker="$repo_root/scripts/check-branch-source-policy.sh"

"$checker" pull_request main dev Namleh-Studios/buzz Namleh-Studios/buzz
"$checker" pull_request dev feature/example Namleh-Studios/buzz Namleh-Studios/buzz
"$checker" push '' '' '' Namleh-Studios/buzz

if "$checker" pull_request main feature/example Namleh-Studios/buzz Namleh-Studios/buzz >/dev/null 2>&1; then
  echo "source policy accepted a feature branch targeting main" >&2
  exit 1
fi

if "$checker" pull_request main dev external/buzz Namleh-Studios/buzz >/dev/null 2>&1; then
  echo "source policy accepted an external fork branch named dev" >&2
  exit 1
fi

echo "Branch source policy passed."
