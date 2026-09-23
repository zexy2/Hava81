# Browser-flow follow-up — 2026-09-23

## Verified state

- Production frontend is healthy on `cff25214f51f8061ed8edf99f3760e695c90b043`.
- Stable API remains on port `4002`; rollback/canary remains `4001`.
- API promotion is fail-closed until deployed revision `d8445e8af156a147d888bf64efbeabb3dc8c66c5` matches current `main`.
- PR #1202 is mergeable, but Browser flows still fail on stale `aria-current="location"` expectations.

## Exact blocker

The remaining assertions are in `e2e/smoke.spec.ts` and must use `aria-current="page"` for the bottom navigation and comparison destination:

- forced-colors bottom navigation assertion
- map-to-city navigation assertion
- saved-navigation assertion

The implementation side is already correct in PR #1202. A clean current-main follow-up was prepared locally as commit `e5df9631e405989e9fcf58bd575ad0fde1959a29` in worktree `/home/ubuntu/hava81-run11-e2e-fix-2344`.

## Safety / next action

- Do not mutate PR #1202 while the follow-up is unpublished.
- Publish the isolated E2E test fix through an authenticated GitHub write path, then rerun Browser flows at the exact head.
- Merge only after fresh exact-head CI and SentinelX production checks are green.
- Keep API promotion fail-closed and preserve the `4002`/`4001` blue-green topology.
