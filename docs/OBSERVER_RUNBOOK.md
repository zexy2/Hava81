# Hava81 observer runbook

This runbook explains how to interpret the read-only worker signals before any merge, deployment or rollback decision.

## Freshness

Treat `collected_at` as the age of the observation, not as proof that the current host is healthy. The compact `hava81-worker-status` output reports `snapshot_freshness` using a ten-minute maximum age (two five-minute observer intervals) and a 60-second future-clock tolerance; missing, malformed, stale or materially future timestamps are not fresh. It also prints root/TR/EN build revisions and boot-asset counts so a shell-parity incident can be localized without dumping the full state file. This is an operator warning, not a substitute for checking the readiness gates. Re-read the live host state and production endpoints immediately before a mutation. If the snapshot or observer GitHub fields are stale or unknown, query GitHub directly rather than waiting for the next five-minute cycle.

## Merge and deploy gates

Keep merge/deploy fail-closed when any of the following is true:

- the host reports `healthy=false` or `root_disk_pressure`;
- `api_build_headroom_ok=false`;
- a pending branch head cannot be matched to the expected SHA;
- production readiness, CORS, root/TR/EN city shells, their shared build revision, boot assets or nginx-port checks are not green.

Do not weaken disk thresholds to make a PR mergeable. Prefer isolated documentation, tests or UI work from a clean `origin/main` base while host pressure remains.

## Pending work

For every open automation PR, record the exact head SHA, CI/CodeQL run state and whether the base is current. Never mutate a pending branch from a second workstream. If a branch becomes stale, rebuild the change on a fresh branch and preserve the original branch until the replacement passes its gates.

## Production topology

The preferred API port is 4002. Port 4001 is retained for canary/rollback. Any API release must pass local gates, hosted CI, readiness and CORS checks, then a controlled canary observation before switching traffic. Roll back on persistent readiness failures, repeated 5xx responses, CORS breakage, a blank frontend or a broken core mobile flow.

## Data integrity

Keep provider attribution, freshness and unavailable states visible. Do not label interpolated precipitation as radar or nowcast. Do not present scraped or inferred MGM text as an authoritative warning without a verified stable freshness-aware official feed.

## GitHub REST authentication

The observer runs every five minutes, which can exhaust GitHub's shared 60-requests/hour anonymous REST quota. For stable CI/PR observation, provision a fine-grained token restricted to repository `zexy2/Hava81` with **Contents: read-only**, **Actions: read-only**, and **Pull requests: read-only** permissions. Store it in `/etc/hava81-worker/github.env` as `HAVA81_GITHUB_TOKEN=...`, with the file owned by `root:root` and mode `0600`. Do not commit the file, put the token on a command line, reuse a broad interactive token, or use the OpenWeather credential. The observer sends it only to `https://api.github.com`, and urllib is prevented from forwarding the Authorization header to redirect targets; production weather/API requests never receive it.

If no credential is provisioned, the observer stays anonymous and reports `auth_mode=anonymous`; a 403 with `rate_limit_remaining=0` means GitHub state is unknown and all merge/deploy gates must remain fail-closed. After provisioning, start one collector run and verify `auth_mode=token`, nonzero rate-limit headroom, current `main` SHA, exact PR-head checks, and fresh production state. Never stop or disable `hava81-observer.timer` during this change.
