#!/usr/bin/env bash
set -euo pipefail

dist_dir="${1:-dist}"
previous_dir="$(mktemp -d)"
trap 'rm -rf "$previous_dir"' EXIT

if [[ ! -d "$dist_dir/assets" ]]; then
  echo "Pages deploy artifact is missing $dist_dir/assets" >&2
  exit 1
fi

previous_published_at="$(date --utc +%Y-%m-%dT%H:%M:%SZ)"
if git fetch --no-tags --depth=1 origin +gh-pages:refs/remotes/origin/gh-pages; then
  previous_published_at="$(git show -s --format=%cI origin/gh-pages)"

  if git cat-file -e origin/gh-pages:assets 2>/dev/null; then
    git archive origin/gh-pages assets | tar -x -C "$previous_dir"
  fi

  if git cat-file -e "origin/gh-pages:.hava81-asset-retention.json" 2>/dev/null; then
    git show "origin/gh-pages:.hava81-asset-retention.json" > "$previous_dir/.hava81-asset-retention.json"
  fi
else
  echo "[pages-retention] gh-pages branch unavailable; publishing current assets only" >&2
fi

python3 scripts/prepare-pages-asset-retention.py \
  "$dist_dir" \
  "$previous_dir" \
  --previous-published-at "$previous_published_at"
