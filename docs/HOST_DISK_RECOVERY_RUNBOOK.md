# Hava81 Host Disk Recovery Runbook

This runbook is for recovering a fail-closed Oracle host without changing weather semantics or production traffic.

## Gate meaning

- `host.healthy=false` or `host.disk.usage_ok=false`: treat the host as incident state.
- `api_build_headroom_ok=false`: do not install API dependencies, build, restart, switch ports, merge runtime PRs, or deploy.
- Keep production on **4002** and preserve **4001** for canary/rollback.

## Safe inspection order

1. Read a fresh observer sample and compare `collected_at` with current UTC.
2. Re-check directly with SentinelX immediately before any mutation.
3. Inspect only: filesystem usage, package caches, rotated logs, build artifacts, core dumps, browser caches, and abandoned temporary files.
4. Never delete application data, databases, secrets, active release artifacts, or files belonging to the dirty primary worktree.

## Cleanup order

Use the least risky source first and re-measure after each step:

1. Package-manager cache after confirming no package install is running.
2. Old rotated logs and stale temporary files with known ownership and age.
3. Unused build caches/artifacts only when their producing workflow is complete and a recovery path exists.
4. Old container/image layers only with an explicit inventory and rollback check.

Every deletion must be backed up or otherwise reversible where the host tooling requires it. Stop immediately if ownership, active processes, or provenance are ambiguous.

## Exit criteria

Resume runtime work only after a fresh sample confirms:

- root usage is below the configured limit,
- free space exceeds the API build reserve,
- `api_build_headroom_ok=true`,
- `worker.can_merge_or_deploy=true`,
- production probes remain healthy.

Then rebase pending runtime PRs onto the current `main`, rerun exact-head CI/CodeQL, and use the validated **4001 canary → 4002 stable** rollout.

## Data-truth reminders

- Do not fabricate weather, UV, health, or safety information.
- Keep MGM warnings explicitly attributed unless a stable official freshness-aware machine-readable source is verified.
- Do not label interpolated precipitation as radar nowcast.
- Modeled marine context is decision support, not navigation safety guidance.
