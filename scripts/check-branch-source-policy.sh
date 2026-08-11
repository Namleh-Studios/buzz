#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 5 ]]; then
  echo "Usage: $0 <event> <base-ref> <head-ref> <head-repository> <repository>" >&2
  exit 1
fi

event_name=$1
base_ref=$2
head_ref=$3
head_repository=$4
repository=$5

if [[ "$event_name" == "pull_request" && "$base_ref" == "main" ]]; then
  if [[ "$head_ref" != "dev" || "$head_repository" != "$repository" ]]; then
    echo "Pull requests to main must come from ${repository}:dev; found: ${head_repository:-missing}:${head_ref:-missing}" >&2
    exit 1
  fi
fi
