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


## 2026-10-23 — Dependabot ecosystem compatibility
- Dependabot cooldown fields (`semver-major-days`, `semver-minor-days`, `semver-patch-days`) are not valid for `github-actions` or `docker` entries in this repository's configuration. Keep cooldown only on supported npm entries; retain separate major groups for manual review where cooldown is unsupported.
- Keep a repository-script contract test for the supported ecosystem/cooldown matrix so the GitHub Dependabot validation check cannot silently regress. Do not weaken required CI gates to work around the failing config check.


## 2026-10-23 — authoritative main-head and observer-only deployment rules
- The current main revision comes from GitHub's branch ref (`/branches/main`), not from the newest successful Actions run. Actions describe validation of a specific SHA and can lag immediately after a merge or when a push-triggered run is missing.
- A merge/deploy readiness snapshot must require a CI/CD Pipeline run for the exact current main SHA. Missing/currently running CI is pending; a failed/cancelled current-main pipeline blocks readiness; an unavailable branch SHA fails closed. Keep the latest run for diagnostics but do not substitute it for the current branch ref.
- Frontend parity and API runtime-file comparisons use the actual current main SHA. API deploy freshness metadata must come from a CI run on that same SHA; do not reuse an older run's success timestamp.
- Observer code, its installer, and Oracle documentation are not API runtime changes. Exclude observer-only paths from the API deploy push trigger so observer PRs do not trigger needless production API rollouts. Validate the filter with the API deploy entry contract; keep `workflow_dispatch` available for an explicitly authorized, green-CI API deployment.


## 2026-10-23 — first-viewport DecisionGlance code split
- Use the exact main/PR Lighthouse artifact when measuring changes. Main's two recent reports differ materially (performance 0.67 / TBT 2.1 s versus 0.85 / TBT 424 ms), so runner contention/variance must be considered before inferring a regression.
- `DecisionGlance` is below the primary weather hero and only rendered for non-Plan, non-Compare views. Splitting its JS and CSS reduces initial critical resources while a post-render prefetch overlaps the current-weather request. Keep the hero itself eager in this change; if it is split later, provide a layout-matched loading skeleton and validate cold mobile browser flows first.
- If local Lighthouse cannot connect to the managed Chrome executable, use hosted exact-SHA Lighthouse/Browser-flow gates; don't substitute the host's Snap/system browser.


## 2026-10-23 — current-time anchoring for near-term weather decisions
- The Open-Meteo hourly endpoint can start with the current UTC hour even when that timestamp is already in the past. A “next 12 hours” decision window must be anchored to the injected evaluation time, not the earliest array item: include only timestamps strictly after `now` and strictly before `now + 12h`.
- Pass the same visible clock into near-term decision derivation so freshness and time-window boundaries agree. Tests must use deterministic current/future forecast timestamps rather than fixed dates that silently become historical.
- Do not ship a decision-window change until the full suite, type-check, lint and production build pass; preserve an isolated uncommitted experiment if test-fixture edits are blocked, and do not bypass platform write controls.

## 2026-10-23 — plan-engine hazard caps must also gate eligibility
- A low `minWindowScore` override must never turn an extreme-temperature, very-poor-AQI or severe-wind hour into a recommendation merely because the visible score is capped. Absolute hazard limits require explicit ineligibility gate reasons plus regression tests under low score thresholds; score caps alone are insufficient.

## 2026-10-23 — plan-engine hard eligibility gates
- A visible score ceiling is not a safety gate. Any absolute hazard that caps the shared Hava81 score must also make a plan hour ineligible, so `findWindows` cannot recommend it even if an intent assigns a zero/low weight to the factor.
- Keep score caps and plan eligibility thresholds sourced from the same `HAVA81_ABSOLUTE_SAFETY_LIMITS` object: apparent temperature >=43°C or <=-20°C; hourly precipitation >=7.5 mm; sustained wind >=20 m/s or gust >=25 m/s; OpenWeather AQI 5 only when its evidence is fresh. Do not infer an AQI gate from stale/missing optional evidence.
- Independently gate finite visibility below 1,000 m and high-impact WMO codes 65, 66, 67, 75, 82, 85, 86, 95, 96 and 99. Missing visibility remains unknown rather than being treated as zero.
- Preserve the distinction between modeled decision guidance and official warnings; these gates are conservative product eligibility rules, not an MGM alert feed or a safety guarantee.


## 2026-10-23 — near-term decision windows must use the visible evaluation clock
- The “next 12 hours” decision window is anchored to the evaluation time supplied by the visible decision-field clock, not the first hourly sample. Include only finite forecast timestamps strictly after `now` and strictly before `now + 12 hours`; the current instant and exact end boundary are excluded.
- Sort eligible samples chronologically after filtering. Invalid `Date` values are unavailable evidence and must not participate in risk selection. Current-condition risks are evaluated independently so filtering expired forecast points does not suppress a real current observation.
- Keep tests deterministic by injecting `now` for domain assertions and generating App integration hourly samples relative to the test run rather than pinning them to a date that eventually becomes historical.

## 2026-10-23 — hourly rain peak uses the shared probability-plus-amount severity
- Forecast Atlas must select one real hourly sample with `precipitationSignalSeverity(normalizedProbability, amountMm)`, matching the shared rain-decision policy. Do not let maximum probability always win before comparing amount: e.g. a 20% / 6 mm hour can be more actionable than an 80% / 0 mm drizzle.
- Keep the displayed probability, amount and timestamp tied to that same sample; never combine maxima from different hours. Preserve stable first-sample tie behavior, provider values, forecast freshness, and the distinction between modeled precipitation and official warnings.


## 2026-10-23 — plan confidence must match the scored horizon
- Derive a plan's confidence only from the same time-window slots that contribute to its score. Richer weather fields outside the scored horizon must not upgrade the confidence label for near-term advice.
- Keep the regression test deliberately asymmetric (sparse scored hours, richer later hours) so a future refactor cannot silently broaden the confidence sample again.


## 2026-10-23 — next-change summaries use chronological, elapsed-time-bounded samples
- `getNextChange` must validate `Date` timestamps, discard invalid/past points, sort chronologically, and inspect only timestamps strictly inside the next 24 elapsed hours (`now < time < now + 24h`) before limiting to 24 samples. A record-count slice alone is not a 24-hour horizon when data is sparse, and caller order must not change the earliest announced transition.

## 2026-10-23 — production Node images must use a supported LTS line
- Do not merge Node 25 image upgrades: Node 25 reached EOL on 2026-06-01 and is not an LTS line. Prefer Node 24 Alpine (maintenance LTS through 2028-04-30) for builder/runtime/dev images, or retain Node 22 where compatibility requires it (supported through 2027-04-30). Node 20 is also EOL and should not remain in the development image. Revalidate Docker builds, API tests, browser flows and exact-head CI after changing the base image.

## 2026-10-23 21:52 TRT — Plan v3 AQI uses the shared hourly evidence resolver
- When Plan v3 receives `airQualityHourly`, prefer only fresh European AQI samples whose timestamp exactly matches the scored forecast slot. Normalize them with the shared `europeanAqiToOpenWeatherIndex` mapping before passing them into the OpenWeather 1–5 score contract.
- Never interpolate or carry an hourly AQI value to neighboring timestamps. Stale hourly data and conflicting/invalid samples remain unavailable; current OpenWeather AQI retains its existing freshness-checked fallback behavior.
- Keep the AQI source's freshness clock aligned with the plan evaluation `now`, so deterministic snapshots do not mix injected test time with the wall clock. This is evidence routing only; scoring thresholds and official-warning semantics remain unchanged.

## 2026-10-23 — similar weather must not be forced into a best-window claim
- The city decision field receives the shared snapshot's `bestWindow` only when `nowOrLater.kind !== 'similar'`. When the snapshot reports similar near-term conditions, do not restore a separate locally selected outdoor-window message just to satisfy a presentation test.
- Language-switch integration fixtures must use future-relative forecast timestamps when asserting near-term guidance; fixed August 2026 samples silently became historical by October 2026. Assert the stable-state translation for identical low-risk samples, and keep distinct-best-window behavior covered by decision snapshot/domain tests.
- Reserve the decision-field trend's rendered height while forecast metadata is unavailable so loading-to-loaded transitions do not move the first-screen content. Small hour labels on tinted current/day-boundary columns must be tested against both light and dark backgrounds at >=4.5:1 contrast.

## 2026-10-23 — development container runtime support
- Keep development container runtimes on a supported Node.js LTS line. Node 20 is EOL; Node 24 is LTS per the official Node.js release table. The dev-only base-image change must not implicitly upgrade production API/frontend images.
- If the Docker daemon socket is unavailable, validate package install and the complete app gates under the matching Node/npm major, but explicitly leave the image build as unverified and require CI image construction before merge. Never infer successful Docker build from host-only tests.
- A dev Dockerfile change is not fully validated by host-side Node tests alone. The CI workflow now includes a build-only `dev-image` job (`docker build --pull --file Dockerfile.dev`); never push the image from this job. Require that exact PR check to pass before merge.

## 2026-10-23 — development container must start, not just build
- A successful Docker build does not prove `npm start` binds to the container interface or serves a page. The dev-image CI job now gets a loopback-only HTTP smoke after build, with bounded retries, failure logs and guaranteed container cleanup. Keep the job build-only: never publish a development image from CI.

## 2026-10-23 22:42 TRT — development-image runtime smoke validation
- The Node 24 development-image follow-up adds a loopback-only container port binding and a bounded HTTP readiness loop. Keep container names unique per GitHub run, print logs only on failure, and always remove the test container via an EXIT trap. Never publish the dev image.
- Local YAML parse, extracted shell syntax, full frontend tests (993/993), type-check, lint, production build, focused browser flows (24/24), and whitespace checks passed. Local Docker is unavailable, so only the hosted exact-PR job can prove that the image starts and serves HTTP.

## 2026-10-23 22:46 TRT — next-change rain state and stale-evidence rules
- A forecast hour is not a current observation. When current weather is fresh, compare the first future precipitation probability against the current observed wet/dry condition derived from the current condition icon. When the current observation is stale, do not infer its state from a future sample.
- Treat non-finite/out-of-range precipitation probabilities as unknown; never convert missing rain evidence into a dry baseline. When no hourly samples exist or current/forecast evidence expires, do not claim “steady/no notable change”; show the localized unavailable state.
- The first-screen next-change sentence must follow the same current/forecast freshness gate as the other decision guidance. This is modeled forecast guidance, not an official MGM warning.

## 2026-10-23 22:48 TRT — development-image port contract
- `Dockerfile.dev` must keep the Vite listener, `EXPOSE` value, and CI runtime-smoke container port aligned. Vite defaults to 5173; if the image contract is port 3000, pass `--port 3000 --strictPort` to the start script rather than changing only the smoke mapping and leaving `EXPOSE 3000` inaccurate.
- The CI runtime smoke's failed exact-head run is actionable evidence, not a flaky check: the image built, Vite started, but the port published to the host had no listener. Keep the test and fix the image contract.

## 2026-10-23 23:33 TRT — critical font discovery and final-shell cache identity
- Preload only the hashed IBM Plex Sans Latin and Latin-Ext font files verified in the exact-main Lighthouse network trace and local browser smoke. Resolve asset names from `dist/assets`; fail the build if either expected font is missing or ambiguous, and keep the links before the module entry so the requests can overlap app boot.
- The service-worker cache stamp must run after city-page generation and CSP application. Its build identifier must hash the final root HTML, manifest and sorted hashed asset names; otherwise a generator-only change can alter published HTML without changing the shell cache namespace.
- Local Lighthouse cannot connect to the managed Chrome executable in this environment. Do not substitute a host browser; require hosted exact-head Lighthouse and compare its artifact against the exact-main baseline (performance 90, LCP 2.3 s, TBT 280 ms) before merging the font-preload experiment.
- When the 81-city live release gate receives HTTP 429, stop the sweep immediately, report the server's Retry-After if present, and return a distinct blocked exit code. Do not continue querying remaining cities after a provider rate limit; the autonomous session itself should continue on independent work without amplifying the limited endpoint.

## 2026-10-24 — Patch the audited Puppeteer/BiDi dependency path through the lockfile

When the root npm audit returned three high-severity findings, keep the fix narrow: refresh the existing lockfile transitive Lighthouse/Puppeteer dependency graph rather than adding a direct Zod override or changing application runtime code. The refreshed graph selects `puppeteer-core 25.16.0`, `chromium-bidi 157.0.8090-0`, and `zod 4.6.7`, which satisfy the declared dependency ranges and eliminate the reported advisory. Keep `package.json` unchanged, verify a clean `npm ci`, and require both root and API audits to pass. Because the development-image build also saw a registry connection reset, address bounded fetch retries separately in `Dockerfile.dev`; do not mix that CI reliability change into the security lockfile PR.

## 2026-10-24 — Retry transient registry fetches in the development image

A real dev-image CI attempt failed during `npm ci` with `ECONNRESET` from the package registry. Keep the image on Node 24 LTS and preserve the existing port-3000/`--strictPort` runtime contract, but make npm fetch retries explicit and bounded: five retries, factor 2, minimum 10 seconds, maximum 60 seconds. This changes only the development image; do not change production images or ports. Keep a static contract test in the Ops workflow so the retry flags cannot disappear silently, and require the hosted Docker build/runtime gate before merge.
