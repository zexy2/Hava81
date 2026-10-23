# Hava81 autonomous decisions

## Release and branch safety
- Do not experiment on main. Keep each improvement in its own branch/worktree.
- Never edit the pending PR #1358 branch from a second workstream. P1.3 is a dependent branch based on its head and must be rebased only after the parent merges.
- Before merge/deploy/rollback, re-check current head SHA, CI, mergeability, and a fresh observer snapshot.
- If a normal write is blocked by platform safety controls, stop; do not try an alternate write path.
- Keep checkpoints append-only and preserve all prior valid entries.

## API operations
- Keep primary API port 4002; port 4001 is rollback/canary.
- No API deployment without local gates, green CI, blue-green/canary readiness, and public revision verification.
- A missing required deployment credential must fail the job, not silently skip it and leave a green run.
- Keep the fail-closed gate separate until tests and workflow integration pass.

## Weather and AQI integrity
- OpenWeather AQI uses 1–5 categories; Open-Meteo European AQI uses a different numeric scale. Never pass European AQI directly to the 1–5 classifier.
- Preserve provider/source/freshness metadata. Stale optional evidence is unavailable, not a zero.
- Every slot at or beyond 72 hours has low plan confidence.
- Intent weights tune preferences but cannot bypass absolute safety ceilings for extreme temperature, very-poor AQI, severe wind, heavy precipitation, or severe weather.
- A surfaced material risk must not receive the excellent band.
- Do not call interpolated precipitation radar nowcast or present modeled guidance as an official MGM warning.

## Product quality
- Hava81 tells users what to do about the weather; avoid generic dashboard bloat.
- Improve visual hierarchy, first viewport, typography, state clarity, dark mode, and mobile ergonomics only with evidence.
- Measure real production before performance changes and keep Lighthouse artifacts tied to exact SHAs.

## 2026-10-23 — GitHub Actions repository-script prerequisites
If a workflow job invokes a script stored in the repository, that job must check out the exact workflow SHA before running the script. Use `persist-credentials: false` when the job does not need authenticated Git operations, and keep a workflow contract test that asserts checkout precedes the script. A failed gate before SSH/deploy must leave the prior production revision serving and must not be described as a successful deploy.


## 2026-10-23 — optional hourly AQI attribution and plan-duration normalization
- Show Open-Meteo/CAMS hourly AQI attribution only while the optional evidence is fresh and at least one valid sample has an exact timestamp match in the forecast slots the activity planner scores. Do not imply that a source influenced the plan when its samples are stale, invalid, or unmatched. Recompute visible guidance when evidence expires while the panel remains open.
- Never interpolate European AQI timestamps. If no exact hourly match is available, use only the existing fresh current-reading fallback; keep laundry scoring independent of AQI.
- A finite positive custom plan duration that rounds below one minute is clamped to one minute, not zero. Nonpositive/nonfinite durations retain the intent profile default; the upper bound remains 12 hours.
- When a main commit contains only docs/dependency metadata, the API may correctly remain on an older API runtime SHA; verify the actual API health revision and confirm no API runtime files changed before treating that difference as drift.


## 2026-10-23 — optional current AQI fallback freshness
- The activity planner may use a fresh, valid current OpenWeather AQI when a matching exact-hour European AQI sample is absent. It must not reuse stale or out-of-range current AQI for future slots.
- If both hourly AQI and current AQI are stale/unavailable, leave AQI risk unknown for that hour; do not substitute zero or invent/interpolate an AQI value. The UI must disclose the fallback condition in Turkish and English.
- When optional AQI freshness expires while the planner remains mounted, schedule a rerender at expiry so the stale fallback is removed without a manual refresh.
