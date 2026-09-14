# Hava81 observer runbook

This runbook explains how to interpret the read-only worker signals before any merge, deployment or rollback decision.

## Freshness

Treat `collected_at` as the age of the observation, not as proof that the current host is healthy. Re-read the live host state and production endpoints immediately before a mutation. If observer GitHub fields are stale or unknown, query GitHub directly rather than waiting for the next five-minute cycle.

## Merge and deploy gates

Keep merge/deploy fail-closed when any of the following is true:

- the host reports `healthy=false` or `root_disk_pressure`;
- `api_build_headroom_ok=false`;
- a pending branch head cannot be matched to the expected SHA;
- production readiness, CORS, root, city, boot-assets or nginx-port checks are not green.

Do not weaken disk thresholds to make a PR mergeable. Prefer isolated documentation, tests or UI work from a clean `origin/main` base while host pressure remains.

## Pending work

For every open automation PR, record the exact head SHA, CI/CodeQL run state and whether the base is current. Never mutate a pending branch from a second workstream. If a branch becomes stale, rebuild the change on a fresh branch and preserve the original branch until the replacement passes its gates.

## Production topology

The preferred API port is 4002. Port 4001 is retained for canary/rollback. Any API release must pass local gates, hosted CI, readiness and CORS checks, then a controlled canary observation before switching traffic. Roll back on persistent readiness failures, repeated 5xx responses, CORS breakage, a blank frontend or a broken core mobile flow.

## Data integrity

Keep provider attribution, freshness and unavailable states visible. Do not label interpolated precipitation as radar or nowcast. Do not present scraped or inferred MGM text as an authoritative warning without a verified stable freshness-aware official feed.
