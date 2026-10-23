#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN must be set by the workflow}"
: "${REPOSITORY:?REPOSITORY must be set by the workflow}"
: "${MERGE_SHA:?MERGE_SHA must be set by the workflow}"

# A merge can arrive before the main ref is visible through the API. Wait briefly,
# then fail closed rather than dispatching a build against an unpropagated revision.
for attempt in $(seq 1 12); do
  main_sha="$(gh api "repos/${REPOSITORY}/git/ref/heads/main" --jq '.object.sha')"
  if comparison="$(gh api "repos/${REPOSITORY}/compare/${MERGE_SHA}...${main_sha}" --jq '.status' 2>/dev/null)"; then
    if [[ "$comparison" == 'ahead' || "$comparison" == 'identical' ]]; then
      runs="$(gh run list --repo "$REPOSITORY" --workflow ci.yml --branch main --limit 50 --json headSha,status,conclusion)"
      if jq -e --arg sha "$main_sha" 'any(.[]; .headSha == $sha)' <<< "$runs" >/dev/null; then
        echo "Main CI already exists for current main SHA ${main_sha}; no dispatch needed."
        exit 0
      fi
    fi
  else
    comparison=unknown
  fi
  if [[ "$attempt" -lt 12 ]]; then sleep 5; fi
done

main_sha="$(gh api "repos/${REPOSITORY}/git/ref/heads/main" --jq '.object.sha')"
if ! comparison="$(gh api "repos/${REPOSITORY}/compare/${MERGE_SHA}...${main_sha}" --jq '.status' 2>/dev/null)"; then
  comparison=unknown
fi
if [[ "$comparison" != 'ahead' && "$comparison" != 'identical' ]]; then
  echo "Main has not propagated merge ${MERGE_SHA} (current main ${main_sha}, compare=${comparison}); refusing dispatch." >&2
  exit 1
fi

echo "No CI/CD run exists for merged main SHA ${main_sha}; dispatching the gated CI/CD Pipeline."
gh workflow run ci.yml --repo "$REPOSITORY" --ref main
