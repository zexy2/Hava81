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

## 2026-10-24 — Preserve the HTTP 429 release-gate decision during PR #1398 rebase

- Original decision timestamp: 2026-10-23 23:56 TRT; preserved from PR #1398 head `7ee5e9867df5246191b02e949bfe21cc157dc365` during rebase.
- HTTP 429 means the API/provider is rate limiting. A sequential 81-city gate must not continue into more current/forecast requests after the first 429, because doing so amplifies pressure and can obscure the original failure.
- Preserve the raw `Retry-After` response header for operator diagnostics, but do not retry or sleep inside this release gate. Exit with a distinct code 2 and explicit `BLOCKED` result; keep ordinary aggregated failures on exit code 1 and full 81/81 success on exit code 0.
- Regression coverage injects a mocked first-response 429 and proves there is exactly one fetch, no second city request, and a visible Retry-After hint. No production weather values, scoring, provider fallback, or safety semantics change.
- The live gate was unintentionally invoked twice during checkpoint shell expansion; both attempts stopped at the first 429. Readiness on both local slots remained healthy afterward. Do not repeat a live sweep until the provider rate-limit window has cleared and a deliberate release-gate run is justified.

## 2026-10-24 00:59 TRT — Compare Lighthouse scores with runner benchmark index

After the lockfile-only security PR, one hosted Lighthouse artifact scored performance 84 with benchmark index 1975; a subsequent main run scored 96 with benchmark index 4482. The script-only HTTP 429 PR scored 83 with benchmark index 1946. Chrome version and generated application bundle were unchanged, and Lighthouse budgets passed. Treat this pattern as runner variance unless repeated comparable runs or production measurements show a regression; retain the raw artifacts and compare benchmark index, LCP, TBT, and bundle hashes rather than using one score in isolation.

## 2026-10-24 01:02 TRT — Defer stale UI and major dependency PRs until rebased and tested

Reviewing an open PR is not a reason to merge it when its base is several commits old or GitHub reports it as non-mergeable. Keep Hava81 on Node 24 LTS; do not merge Node 25 container bumps as a routine Dependabot change. Major TypeScript/Vitest dependency groups require an isolated worktree, full type/unit/browser/build checks, and a clear compatibility result. Old UI PRs (rain-peak and notification contrast) should be compared with current main and rebased in dedicated worktrees before any decision; do not close them automatically.

## 2026-10-24 — omit finite-but-impossible hourly weather measurements

- Keep generous upper sanity bounds at the Open-Meteo adapter boundary so finite outliers cannot become displayed values or decision-score evidence: hourly precipitation <=500 mm, daily precipitation <=2,000 mm, sustained wind/gust <=150 m/s, UV index <=50, and visibility <=100,000 m. These ceilings deliberately leave room for extraordinary real events while excluding values far outside a physically credible range.
- Optional out-of-range values become unavailable (`undefined`) instead of zero or a fabricated normal reading. Core sustained wind above the bound rejects the provider response so the fallback/error path can handle the bad payload. Keep the published hourly response schema aligned with the adapter's accepted range.
- Regression tests cover all upper bounds and verify that optional fields are omitted while valid core forecast values remain usable. Do not infer missing UV/visibility/gust/precipitation measurements as zero.

## 2026-10-24 02:54 TRT — whole-worktree cleanup must preserve ignored local-only data

- A clean Git status does not prove a worktree contains no local-only data: ignored `.env` files, private fixtures, and tool state are invisible to ordinary `git status --porcelain --untracked-files=all`. Before whole-worktree removal, inspect ignored paths as well. Permit only explicit rebuildable artifact roots (`node_modules`, `dist`, `coverage`, `test-results`, `playwright-report`, and their `apps/api` equivalents) plus generated `.husky/_` hooks; skip the entire checkout if any other ignored path exists or ignored-status inspection fails.
- Use `git status --porcelain=v1 --ignored --untracked-files=normal` for this guard. `--untracked-files=all` descends into ignored dependency fixtures (including paths with spaces/Unicode) and incorrectly treats nested files inside rebuildable `node_modules` as user data. Keep a regression test for both the protected ignored `.env.local` case and a nested generated dependency fixture.
- Prefer artifact-only cleanup (`scripts/cleanup-merged-worktree-artifacts.sh --apply`, without `--remove-worktrees`) for disk recovery when that suffices: it deletes only the explicit generated artifact allowlist from clean merged worktrees and preserves source trees, local branch refs, pending PR refs, and ignored data outside the allowlist. Re-run the owner/metadata writability guard and record exact paths/bytes before and after; never use broad `rm -rf` or remove worktrees merely to reclaim space.

## 2026-10-24 — Reject impossible OpenWeather surface-pressure values

**Decision:** Treat OpenWeather `main.pressure` as hPa and accept a deliberately broad 100–1,200 hPa envelope for both current observations and forecast entries. Values outside this envelope fail provider schema validation; they are not converted to zero or displayed as a plausible reading.

**Why:** A positive-only schema allows extreme finite values (for example, 1,000,000 hPa) through to the client. The broad range covers ordinary terrestrial surface pressure and high-altitude observations while blocking malformed payloads. Current and forecast share the same main-weather schema, so one bound and paired regressions keep their behavior aligned.

## 2026-10-24 04:22 TRT — Keep alert delivery active; defer the rest of Planla

**Decision:** On the initial Today view, keep `DecisionAlertsPanel` mounted so opted-in notification delivery continues, but do not mount the larger Planla-only panels until the user first opens Planla. After the first visit, leave those panels mounted while hidden so user selections and route form state persist across view changes.

**Why:** Production mobile Lighthouse measured 520 ms TBT and 3.3 s LCP, and its critical request chain loaded five Planla-only chunks while the Today view was visible. The local build after gating those chunks loaded none of them on the initial city view and measured 60 ms TBT / 2.7 s LCP with a Lighthouse performance score of 95. These local results are directional evidence only; production improvement must be confirmed after a green merge/deploy.

**Guardrails:** Do not defer the alert engine or change notification semantics. Direct `?view=plan` entry and score-explanation navigation must load Planla immediately. Once opened, activity choices and route-form state must survive switching back to Today. Regression tests cover those contracts.

## 2026-10-24 — Bound OpenWeather pollutant concentrations at the provider boundary

- OpenWeather documents all Air Pollution API component concentrations (CO, NO, NO₂, O₃, SO₂, NH₃, PM2.5 and PM10) in μg/m³. Accept only finite non-negative values up to a deliberately broad 100,000 μg/m³ ceiling; reject higher values rather than formatting impossible finite outliers as measurements.
- This is a provider-payload sanity ceiling only, not an AQI category boundary, health threshold, or medical recommendation. Preserve the provider's categorical AQI (1–5) contract and never infer a cleaner/safer category from a rejected component value.
- Cover the inclusive ceiling and just-over-ceiling regressions for all eight fields at both schema and provider-adapter levels. Keep the change isolated from the pending OpenWeather wind-bound PR and rebase only after re-reading both remote heads.

## 2026-10-24 — Validate the 81-province current-observation boundary

- The Open-Meteo multi-location province feed must emit a current tile only when its temperature is finite and within the existing broad -100–100 °C envelope, its weather code is one of the supported WMO codes, its `is_day` flag is exactly 0 or 1, and its Unix timestamp can be represented as a valid JavaScript date. A malformed location becomes `null` without discarding otherwise valid provinces.
- Optional province wind speed is published only in the inclusive 0–150 m/s sanity envelope. Values outside it are omitted instead of clamped or rendered as plausible readings.
- Keep the `/weather/provinces` OpenAPI schema aligned with the provider contract: temperature bounds, the supported WMO code enum, and the optional wind ceiling must be explicit. These are provider-data integrity limits, not official warnings or medical/safety guarantees.


## 2026-10-24 — Bound provider Unix timestamps to the JavaScript Date range

- OpenWeather and Open-Meteo timestamps arrive as Unix seconds and are converted to ISO strings in service/provider code. A nonnegative integer alone permits values outside ECMAScript `Date`'s ±8.64e15 ms range, which can make `toISOString()` throw and fail a weather response on malformed provider data.
- OpenWeather now uses a shared provider timestamp schema (maximum 8,640,000,000,000 seconds) for current, forecast, sunrise/sunset and air-quality epochs; existing current/AQI future-skew checks remain. Open-Meteo's hourly/daily timestamps and sunrise/sunset arrays use the same representability ceiling already used by its hourly air-quality adapter.
- This is a payload-sanity guard only. It does not clamp or synthesize weather, assert that an extreme-but-representable timestamp is a plausible forecast, or change weather scoring. API runtime changes remain gated by exact-head CI and the normal blue-green/canary process.

## 2026-10-24 — Normalize forecast order at the service boundary

The public three-hour forecast series and daily-group insertion order must be chronological even if a provider returns otherwise valid samples out of order. Sort a shallow copy of the validated samples by Unix timestamp before building hourly output or local-day groups. Do not mutate the provider-owned array, synthesize samples, change timestamps, or alter weather values. Keep the original numeric `dt` as the ordering authority; `dt_txt` is a redundant display field and must not override it.

## 2026-10-24 — Keep live browser audits usable on locked-down hosts

The live responsive audit should support an explicitly configured loopback Chrome DevTools Protocol endpoint when the host cannot launch a new browser because of Snap/cgroup confinement. `HAVA81_CHROMIUM_CDP_URL` is opt-in, must use HTTP with an explicit port and a loopback hostname only, and must reject credentials, paths, queries, fragments, and remote hosts. Preserve the existing isolated-launch path when unset. This lets a read-only audit reuse the host's already-running browser without exposing a remote debugging endpoint.

## 2026-10-24 — Apply unit-aware physical ceilings to OpenWeather wind

**Decision:** Validate OpenWeather sustained wind and optional gust values after unit selection, using a deliberately generous ceiling of 150 m/s for `metric`/`standard` and 300 mph for `imperial`. Reject a provider payload with a finite value above its unit-specific ceiling as `INVALID_PROVIDER_RESPONSE`; do not clamp an impossible value into a believable-looking safety signal.

**Why:** The shared OpenWeather Zod schema can validate non-negativity but cannot infer the requested output unit. Unit-aware validation at the adapter boundary keeps impossible finite wind values out of current and forecast responses while preserving the provider's actual units and the existing fallback/error path. The Open-Meteo hourly adapter has its own unit contract and remains unchanged.

## 2026-10-24 07:48 TRT — Keep missing OpenWeather precipitation probability unknown

- OpenWeather forecast `pop` is a required probability ratio in the inclusive 0–1 range. Do not default a missing value to `0`: downstream rain scoring interprets zero as an explicit no-probability forecast, so a missing field would silently understate rain risk. Reject the malformed provider payload instead of fabricating dry conditions.
- Require every forecast sample's `main.temp_min` to be less than or equal to `main.temp_max`, matching the current-observation invariant. Do not swap, clamp, or otherwise rewrite the provider's temperature fields; reject an internally inconsistent forecast.
- Regression coverage proves that missing `pop` and inverted temperature ranges fail validation, while explicit `pop` values of exactly 0 and 1 remain valid. This is provider-data integrity validation, not a new weather forecast or safety threshold.

## 2026-10-24 08:22 TRT — Keep current AQI source age separate from fetch freshness
- OpenWeather Air Pollution `list[].dt` is the provider sample's Unix-UTC timestamp (official contract: https://openweathermap.org/api/air-pollution). Preserve it as `meta.observedAt`; `meta.fetchedAt` continues to mean when Hava81 fetched the response.
- When a response contains multiple current-AQI samples, use the newest timestamp rather than assuming the first array element is newest.
- Current AQI evidence must satisfy both the existing fetch/cache TTL and a two-hour source-age ceiling. A malformed/materially future observation is unknown; an over-age observation is stale. Both are unavailable to UI risk labels and activity/day plans; do not replace them with zero or infer a low-risk AQI.
- The two-hour limit is Hava81's conservative evidence-freshness policy, not an official health threshold or MGM warning. Hourly European AQI remains exact-timestamp-only and is not interpolated. Older API payloads without `observedAt` retain the existing compatibility path during rolling deployments.

## 2026-10-24 08:43 TRT — Expire AQI display on source age, not only BFF cache age

- The environment rail may show current AQI/PM2.5 only while the source observation timestamp is within the same two-hour evidence-freshness policy used by decision logic. A fresh BFF fetch must not make an old provider sample look current.
- Schedule a UI freshness refresh at the earlier of cache expiry and source-observation expiry; hide AQI and PM2.5 when that boundary passes without requiring a new provider response. Keep this behavior explicit in a component regression using a recent fetch and an observation exactly at the two-hour boundary.
- This is an internal data-freshness policy, not an official health threshold, medical claim, or authoritative air-quality warning. Missing source timestamps remain compatible with older API responses under the existing policy; invalid or materially future timestamps fail closed.


## 2026-10-24 08:56 TRT — Show the provider observation time for current AQI

- Distinguish the provider sample time from the BFF fetch time in the environment rail. When a fresh AQI sample has a valid `observedAt`, show a compact localized `<time datetime>` label in the city's timezone (Turkish `Gözlem HH:mm`, English `Observed HH:mm AM/PM`).
- Keep the timestamp within the existing AQI detail line to avoid adding another card/row or decorative UI. Older payloads without a source timestamp keep the existing detail layout; invalid/stale evidence remains hidden by the shared freshness policy.
- This is provenance/transparency, not an official health warning or a claim about medical safety. Verify at 320px and 200% text scaling, both locales and themes, before shipping.

## 2026-10-24 09:30 TRT — MGM MeteoUyarı service is official but not yet integration-ready

- Fresh review of MGM's official public MeteoUyarı explanation says the public interface displays two days of warning status and explains the yellow/orange/red levels. It does not publish a machine-readable schema, authentication contract, per-record issued/valid-until timestamps, or a freshness/withdrawal contract in the reviewed public documentation.
- MGM's official 2026 Meteorological Data Processing tariff lists `MY-57 — Meteo Uyarı Servisi (Web Servis)` at 12,500 TL/month per item. This confirms that a distinct official web-service product exists, but does not by itself establish public access, response format, update cadence, or freshness semantics for Hava81.
- Keep the current decision: do not scrape the public HTML or reverse-engineer an undocumented endpoint and then label the result authoritative. Revisit only after an official service specification/access path and timestamp/expiry semantics are verified; then implement a server-side, attributed adapter that fails closed on stale/unknown warning state and keeps MGM warnings distinct from Hava81 modeled guidance.
- Official sources reviewed: https://www.mgm.gov.tr/meteouyari/turkiye.aspx ; https://www.mgm.gov.tr/meteouyari/meteouyari-nedir.aspx ; https://www.mgm.gov.tr/site/urunler.aspx?u=veriislem ; 2026 tariff PDF: https://www.mgm.gov.tr/site/urunler/veri-islem-fiyatlar-2026.pdf .

## 2026-10-24 09:33 TRT — Respect provider Retry-After without retry amplification

- When OpenWeather returns HTTP 429, parse a positive delay-seconds value or a future HTTP-date `Retry-After` into a positive integer number of seconds. Ignore missing, malformed, zero, negative, past-date, or unsafe values; never copy an upstream header verbatim.
- Carry the validated delay on `AppError` and emit a `Retry-After` response header only for a 503 error with a positive safe integer delay. Keep error responses `Cache-Control: no-store` and do not expose the upstream body.
- Treat `PROVIDER_RATE_LIMITED` as non-retryable in `ResilientWeatherProvider`: make exactly one primary request, do not sleep/retry or open the outage circuit for a quota signal, and let the client decide when to retry from the response header. No automatic retry or fallback request is issued on this rate-limit path.
- Regression tests cover delta-seconds, HTTP-date conversion, invalid values, one upstream attempt, response-header propagation, and absence of the header on unrelated 503 errors. This changes backoff metadata only; it does not alter weather data or provider quotas.

## 2026-10-24 09:52 TRT — Do not automatically retry normalized provider rate limits in the browser

- OpenWeather HTTP 429 is normalized by the BFF to a non-cacheable 503 with `error.code=PROVIDER_RATE_LIMITED` and, when valid, a normalized `Retry-After` header. The server makes one upstream attempt and does not open the outage circuit for this quota signal.
- The browser HTTP client must inspect the structured error code before applying its generic retryable-status policy. `PROVIDER_RATE_LIMITED` is not automatically retried, even though its HTTP status is 503; otherwise the browser's generic 30-second delay cap could retry before a provider's longer `Retry-After` interval.
- Keep bounded retries for other transient 503 responses, preserve the existing 429 non-retry rule, and keep error responses uncached. Manual refresh remains available to the user; no timer, provider fallback, weather value, or safety interpretation is synthesized.
- Regression coverage asserts exactly one browser fetch for `PROVIDER_RATE_LIMITED` even after the fake clock advances beyond the generic retry cap, while existing generic 503/Retry-After tests continue to pass.

## 2026-10-24 10:05 TRT — Skip automatic retries for deterministic 503 states

- Treat structured `PROVIDER_RATE_LIMITED`, `PROVIDER_CIRCUIT_OPEN`, `UPSTREAM_BUDGET_EXHAUSTED`, and `AIR_QUALITY_HOURLY_UNAVAILABLE` responses as non-retryable by the browser transport, even when their HTTP status is 503. A provider quota, open circuit, depleted process-wide budget, or unavailable provider configuration will not recover from an immediate generic retry, and retries can add load without producing new evidence.
- Keep the existing bounded retry behavior for generic transient 503 responses and retryable provider transport failures. Preserve the original server message/status for the caller and do not fabricate a retry timer or a weather value. The `Retry-After` behavior for provider quota errors remains as documented in the 09:33/09:52 checkpoints.
- Regression tests advance the fake clock beyond the 30-second retry cap and prove each deterministic service state makes exactly one fetch. No API route, provider configuration, forecast, cache policy, or deployment behavior changes in this frontend-only follow-up.

## 2026-10-24 — Preserve structured provider-state errors in the browser

- When the BFF returns a recognized deterministic 503 code (`PROVIDER_RATE_LIMITED`, `PROVIDER_CIRCUIT_OPEN`, `UPSTREAM_BUDGET_EXHAUSTED`, or `AIR_QUALITY_HOURLY_UNAVAILABLE`), preserve that code in the browser `ApiError` instead of collapsing it to a generic status-derived `UNKNOWN` error.
- Automatic retries remain suppressed for these service-state responses. Keep the existing explicit manual-retry affordance for HTTP 503 responses, but localize the main weather error copy for provider rate limiting, circuit recovery, and upstream request-budget exhaustion so the user knows to wait rather than interpreting the message as a forecast fact.
- Never expose raw provider/internal error details in the UI, and never turn a service failure into a fabricated weather value. The current/last-known data and its freshness rules remain unchanged.

## 2026-10-24 14:15 TRT — Structured service-state codes must agree with HTTP 503

- The browser transport may treat `PROVIDER_RATE_LIMITED`, `PROVIDER_CIRCUIT_OPEN`, `UPSTREAM_BUDGET_EXHAUSTED`, and `AIR_QUALITY_HOURLY_UNAVAILABLE` as deterministic service states only when the HTTP status is 503, matching the API's producer contract.
- If one of these codes appears with another status, do not let its body override the HTTP status semantics: preserve the normal status-derived error code and bounded retry policy. This protects against malformed or mismatched envelopes without changing valid 503 behavior or introducing retries for valid provider quota/circuit/budget states.
- Regression tests cover a mismatched HTTP 500 (normal bounded retry remains active) and HTTP 404 (`NOT_FOUND`, no retry). No weather value, provider policy, scoring, or API deployment behavior changes.

## 2026-10-24 14:30 TRT — Lighthouse browser selection is environment-aware

- Respect an explicit `CHROME_PATH` operator override. If none is configured, use the Playwright-managed Chromium executable only when it is installed and accessible; otherwise leave `CHROME_PATH` unset so `chrome-launcher` retains its normal system-browser discovery. Do not install/download browsers as a side effect of the Lighthouse runner.
- This handles Oracle/local hosts where `/usr/bin/chromium-browser` is a Snap wrapper that cannot be controlled by Lighthouse, while preserving the existing GitHub Actions setup (the Lighthouse job has no Playwright browser install step). Keep the selection logic covered by a focused Node contract test in CI.
- Lighthouse score movement between 89 and 96 on the same source/build is treated as measurement variance; do not claim product performance gains without repeated controlled runs. The latest measured accessibility, best-practices, and SEO scores remain 100, and performance remains above the 80 target.


## 2026-10-24 15:00 TRT — Give the decision-hero date a machine-readable value

- The first-screen `DecisionGlance` date is a city-local calendar date, so expose it as `<time datetime="YYYY-MM-DD">` while preserving the existing localized visible label.
- Derive the date-only value from the same city UTC offset already used for display. Do not use the server/browser's local timezone, and do not serialize the shifted date as a UTC instant; the date-only value describes the city's displayed calendar day.
- Add a regression that crosses UTC midnight and verifies the displayed city date is the following local day for a UTC+03:00 city. This is semantic metadata only: no forecast values, scoring, refresh behavior, layout, or weather/safety claims change.

## 2026-10-24 — Missing precipitation evidence cannot imply an excellent hour

- Treat precipitation probability and measured amount as one evidence family: either valid signal is enough to evaluate rain, but when both are missing the state is unknown, never implicitly dry.
- Cap that individual hour at 89 so it cannot receive the 97–100 excellent label; apply the same cap after activity-specific comfort adjustments so a benefit cannot undo the evidence guard. Keep the displayed precipitation state unknown and do not add a fabricated rain-risk reason.
- Daily-plan confidence requires precipitation evidence for a slot to contribute to the rich/useful coverage shares. A payload may be structurally rich in temperature, UV and visibility yet still be insufficient for a high-confidence outdoor decision when every slot lacks rain evidence.
- This is a conservative data-completeness rule, not a precipitation forecast or hazard threshold. Probability-only and amount-only observations remain valid evidence.


## 2026-10-24 16:30 TRT — Distinguish unknown rain evidence from an explicit dry hour in the daily plan

- In the hourly decision timeline, do not render an empty precipitation field when both probability and amount are missing. Show a localized unknown-data label in the visible slot and its accessible name. This keeps missing evidence separate from an explicit zero-probability forecast.
- If at least one of the two precipitation signals is finite but no positive probability/amount needs display, use the localized dry state. In particular, a valid probability of zero with no amount is evidence of no precipitation expected; it is not the same as both signals missing.
- When any displayed hour lacks both signals, show one compact note that its score is capped at 89 and that missing data does not mean rain is expected. Reuse the existing safety-note visual treatment rather than adding a card. Keep the underlying conservative scoring guard from the 15:52 checkpoint and do not add a fabricated rain-risk reason.
- This is an evidence-display and scoring-methodology clarification, not a weather forecast or hazard assertion. Probability-only and amount-only evidence remain valid; no API behavior, provider configuration, cache policy, or deployment target changes.

## 2026-10-24 16:50 TRT — Preserve unknown precipitation in city comparison

- A precipitation row is evidence-backed only when at least one signal is valid: probability in the frontend's 0–1 ratio range, or a finite non-negative precipitation amount. Do not let an invalid/missing probability and missing/invalid amount become the top-ranked slot merely because its fallback severity is zero.
- If no near-term slot has valid precipitation evidence, city comparison must say `Yağış verisi yok` / `Precipitation data unavailable`, not `Beklenmiyor` / `Not expected`. A valid explicit zero probability or zero amount remains evidence for a dry label; a valid amount remains usable even when probability is unavailable.
- This is a UI evidence/provenance guard. It does not alter weather values, scoring, ranking of cities, thresholds, provider behavior, or API deployment.

## 2026-10-24 — Missing precipitation is unknown in Forecast Atlas

- Preserve the existing strict BFF/API forecast validation and legacy `normalizePrecipitationProbability` contract. Add a separate optional normalizer at the Forecast Atlas presentation boundary so non-finite, negative, over-range, or absent probability cannot silently become a dry reading.
- A valid probability of zero or a valid amount of zero is evidence for a dry reading. If both probability and amount are absent/invalid, label the state as unknown in summary, hourly and daily presentation, including chart tooltips. A valid positive amount remains useful even when probability is unavailable.
- When choosing the hourly summary peak, rank evidence-bearing hours before unknown-only hours. This prevents an early unknown slot from masking a later explicit dry or wet observation; if all slots are unknown, keep the summary unknown. Do not infer rain or dryness from the absence of a signal.
- This is a frontend presentation/data-integrity guard only. It does not alter provider values, score calibration, official MGM warning semantics, or production API routing. Validate focused and full frontend tests, type-check, lint, build, then require exact-head hosted gates before merge.

## 2026-10-24 — Unknown precipitation must not produce dry commute/route advice

- A commute window or route segment with neither a finite in-range probability nor a finite non-negative precipitation amount has unknown rain evidence, not a zero-rain forecast. Keep the UI and domain model aligned: unknown umbrella advice is distinct from “no umbrella needed”, and missing evidence in either commute window prevents a false rain-change comparison.
- Preserve valid probability zero, valid amount zero, and amount-only observations. Do not invent rain, do not infer dryness from missing fields, and do not change calibrated score thresholds as part of a presentation/data-integrity fix.
- Validate both domain decisions and visible/localized route/commute states. Frontend-only changes may proceed through frontend CI; do not build/deploy the API while host disk headroom is low.
- The Oracle worker host is offline and the SSH gateway has no configured Oracle target. Treat server-side state inspection, disk cleanup, deploy and rollback as blocked rather than silently using the gateway host; continue safe GitHub/local work and record this blocker for the next run.

## 2026-10-24 18:25 TRT — Keep normalized probability ratios separate from BFF percentages

- The frontend weather service validates the BFF's integer percentage and converts it to a 0–1 domain ratio before exposing `HourlyForecast.pop` and `DailyForecast.pop`. A component consuming those domain types must not run the raw-percent normalizer again: its deliberate `1 => 1%` compatibility rule would turn a valid ratio of `1` (100%) into `0.01` (1%).
- Use a ratio-specific validator at the Forecast Atlas presentation boundary. Preserve exact 0 and 1; keep missing, non-finite, negative and greater-than-one domain values unknown. Leave the legacy raw-percent normalizer unchanged for callers that still receive BFF percentages.
- This is a frontend data-integrity fix only. It does not alter provider data, scoring, weather interpretation, API contracts, or production routing. Keep the hourly and daily component regression that asserts a 100% input remains 100% after parsing.

## 2026-10-24 19:02 TRT — Invalid finite precipitation is unknown evidence

- A forecast-domain precipitation probability is a 0–1 ratio; an amount is finite, non-negative millimetres. Finite but out-of-range values are not valid evidence and must not be clamped into a believable dry/wet observation. Normalize invalid probability/amount to unknown before scoring and return the sanitized values to downstream presentation.
- Daily, activity, commute and Plan v3 scoring must share this evidence contract. An hour with neither valid signal remains capped at 89; confidence/coverage, umbrella advice, reasons, eligibility and displayed values must not count invalid fields as known. Explicit zero probability, zero amount and amount-only evidence remain valid.
- This is defensive data-integrity handling, not a forecast, threshold recalibration, provider/API contract change, or new safety claim. Do not build/deploy the API for this frontend/domain-only change.

## 2026-10-24 19:10 TRT — Use valid amount-only evidence in the next-change summary

- The first-screen next-change sentence previously considered only precipitation probability, even though the weather domain also carries an hourly precipitation amount. When probability was missing/invalid but a valid amount showed precipitation, the summary could skip a rain transition and jump to a temperature change or say conditions were steady.
- Determine each forecast hour's rain state from either valid signal: a 0–1 probability ratio uses the existing 0.4 threshold; a finite non-negative amount is also evidence, with `> 0 mm` meaning precipitation and exactly `0 mm` meaning dry. If neither signal is valid, keep the state unknown and do not infer dryness. If both valid signals conflict, retain a positive wet signal rather than suppressing it with the other field.
- This updates only the next-change explanation. It does not alter forecast data, source attribution, scoring thresholds, route/commute decisions, or official warning semantics. Regressions cover amount-only start/stop, explicit zero, invalid amount, and positive amount alongside a below-threshold probability.

## 2026-10-24 19:20 TRT — Measure responsive containment in one browser frame

- The mobile chip-containment gate must compare child and container rectangles from the same synchronous browser evaluation. Two separate Playwright `boundingBox()` calls can straddle resize/text reflow and scroll anchoring, creating contradictory coordinates that look like a layout regression.
- Keep strict containment and overflow assertions; include both rectangles and the affected chip label in failure diagnostics. Do not relax 320px/200% or 390px mobile checks to hide genuine overflow.
- This is test-harness reliability only. It does not change production CSS, weather data, scoring, API behavior, or safety guidance.


## 2026-10-24 20:28 TRT — Assert activity-planner header reflow at 320px / 200% text

- Current `ActivityPlanner.css` already contains the mobile `flex-basis: auto` fix; the old dirty-worktree patch is superseded and should not be copied verbatim. The current `e2e/plan.spec.ts` checks expanded cards at 320px / 200% but did not explicitly assert that the sensitivity control retains the auto basis and stays inside the header.
- Extend the existing real-browser regression to check header readability, containment of the header within the planner, containment of the sensitivity panel within the header, and the computed auto flex basis. This catches a future flex sizing regression without arbitrary pixel-height ceilings or changes to production CSS.

## 2026-10-24 20:22 TRT — Require the separate Ops contract workflow for green automation PRs

- Product CI/CD and CodeQL are not the complete automation-PR gate set. The repository also runs `Ops script contracts`, with independent CI/agent and deploy-script jobs that validate the observer and production/deploy shell contracts.
- Treat an automation PR as green only when exact-head CI/CD, Ops script contracts, and CodeQL have all completed successfully. A missing Ops run is unknown; an in-progress Ops run is running; a failed Ops run is failed. This prevents the read-only observer from reporting a false-green PR while deploy-script contracts remain pending.
- This changes observer diagnostics/gating only. The Oracle SentinelX agent is offline and the SSH gateway has no configured Oracle target, so this source change must not be represented as already installed on the live host. Deploy/update the observer only after Oracle connectivity is restored and its local release gates pass.

## 2026-10-24 20:42 TRT — Bound European AQI payload sanity at ingestion and adaptation (historical checkpoint preserved)

- Keep the European AQI 80+ category open-ended, but enforce one defensive payload-sanity ceiling (`MAX_EUROPEAN_AQI = 1000`) at both the serialized hourly-AQI parser and the downstream European-to-OpenWeather risk-index adapter. Values above the ceiling are invalid/unknown even if they bypass one validation layer; exactly 1,000 remains accepted.
- Preserve source provenance and scale semantics: European AQI is not numerically interchangeable with OpenWeather's 1–5 index. The adapter is an explicit risk-band mapping, not a source equivalence claim. Do not change provider values, calibrated category thresholds, or current OpenWeather AQI behavior.
- Validate the exact boundary, parser behavior, and consumer fallback. This is defensive data-integrity validation only and does not add health claims or alter official MGM warning semantics.

## 2026-10-24 21:47 TRT — A green PR does not override the live host hard gate

- Rebased PR #1441 (invalid precipitation evidence) and PR #1443 (European AQI bounds) onto exact current `origin/main=e28ad60f3ef5f93395f87124a6c01bf78a546bb6` in their existing isolated worktrees. Their source patch IDs match the already-validated remote PR diffs; focused tests passed 78/78 and 38/38 respectively, and type-check, lint/CSS lint, and `git diff --check` passed.
- The observer's `merge_deploy_readiness` contract intentionally blocks when `host.healthy` or `disk.ok` is false. Current state has `host_unhealthy` due root disk usage 92.8%; the enrolled Oracle SentinelX host is offline and the SSH gateway does not identify a configured Oracle target. Do not bypass this hard gate, attempt speculative cleanup, or run API build/deploy/rollback. Continue safe GitHub/local validation and publish rebased PRs only after explicit remote-SHA lease checks.
- After rebasing, old-head CI/CD/Ops/CodeQL successes are not valid for the new head. Re-query exact-head workflows after publishing and keep the PR branches immutable while those checks are running. A successful main Pages deploy and healthy public smoke do not prove the Oracle host gate has cleared.

## 2026-10-24 21:57 TRT — Separate GitHub merge safety from Oracle deployment safety

- Supersedes the blanket merge portion of the 21:47 host-gate decision: `host_unhealthy` remains a hard stop for Oracle-side API builds, deploys, and rollbacks, but does not by itself forbid merging a fully validated frontend-only PR. PR #1441 and #1443 change only `src/**` and append-only docs; their exact-head CI/CD, Ops contracts, CodeQL, and GitHub mergeability are green. The hosted main workflow deploys the frontend to GitHub Pages; it does not need Oracle disk headroom for these source-only merges.
- Do not globally force `can_merge_or_deploy=true`. Instead, implement a separate `can_merge` signal based on exact-head required checks/mergeability and a separate `can_deploy` signal that retains production health, disk headroom, API-port, and canary requirements. Until that observer contract is deployed, the run itself must classify file scope and still obey the hard host gate for all server operations.

## 2026-10-24 22:15 TRT — Separate merge-candidate readiness from deployment readiness

- `can_merge` is a candidate signal, not permission to write: require current exact-head CI/CD + Ops script contracts + CodeQL success, an open non-draft automation PR targeting `main`, and known GitHub state. It must not be vetoed merely by Oracle disk pressure or a deployment/production observation, because a frontend-only PR can be safely reviewed while server-side operations are blocked. The runner must still directly re-read the PR head/base, mergeability, review state and changed-file scope immediately before merging.
- Keep deployment readiness separate. `can_deploy_frontend` retains production health, current-main CI/Pages propagation, API-port and GitHub-state checks without requiring Oracle build disk. `can_deploy_api` adds confirmed healthy host, disk health and explicit API build headroom. `can_merge_or_deploy` remains a conservative API-deploy alias for older consumers until every consumer migrates.
- Include scoped readiness values, blocker reasons and merge-candidate transitions in the observer state signature so events fire when the reason changes even if a broad readiness boolean stays false. The observer remains read-only; do not install/update it on Oracle while the enrolled host is offline.

## 2026-10-24 22:22 TRT — Unknown API port state blocks deployments

- Deployment readiness must fail closed if the preferred API target is explicitly false **or unknown**. A missing `preferred_ok` value is not evidence that the expected 4002 primary is active. Report `api_primary_port_drift` for a known mismatch and `api_primary_port_unknown` for an unavailable signal; keep both separate from GitHub merge-candidate readiness.
- Readiness events must include blocker reasons and merge-candidate changes, not only booleans. Otherwise transitions such as `main_pipeline_pending` to `github_state_unknown` can be invisible while `can_deploy_*` remains false.

## 2026-10-24 23:44 TRT — Confidence coverage counts independent evidence, not derived temperature

- In the daily-plan confidence calculation, do not count apparent/feels-like temperature as a separate richness signal: it is derived from other weather inputs. Keep it available for thermal scoring and user-facing comfort, but not for independent evidence coverage.
- Regression boundary: five independent finite signals plus a derived apparent-temperature value must not qualify for the six-signal high-confidence threshold. Precipitation still requires at least one valid probability/amount signal for useful/high coverage; missing rain evidence is unknown, not dry.
- This is a confidence-classification/data-integrity change only. It does not alter weather-provider values, temperature scoring, thresholds, forecast claims, official MGM warning semantics, API contracts, or deployment routing. Frontend gates passed locally; hosted exact-head gates and a fresh pre-merge GitHub review are still required.

## 2026-10-24 22:05 TRT — Current-weather freshness must use the provider sample timestamp

- `timestamp` in the current-weather payload is the source sample time; `meta.fetchedAt` is a retrieval/cache time and is not evidence that the sample itself is fresh. Because the current BFF omits `meta.observedAt`, normalize it from `timestamp` at the frontend boundary and do the same for persisted-cache restoration. Otherwise a three-hour-old provider sample with a newly fetched envelope can be presented as current.
- Reject malformed/future source timestamps and metadata that disagrees materially with the payload timestamp. Keep stale samples explicitly stale rather than inventing freshness, and do not change the API response contract or run an API production build for this frontend-only fix.

## 2026-10-24 23:50 TRT — Source observation time outranks fresh retrieval metadata

- For current weather, use the provider payload `timestamp` as the observation-time fallback when the BFF omits `meta.observedAt`. `meta.fetchedAt` is retrieval/cache metadata and must not make an older sample look current.
- Reject malformed explicit observation times, materially future values, or values that disagree with the payload sample time by more than the one-minute contract tolerance. Apply the same rule to persisted-cache restoration so cached and network paths agree.
- This is a frontend/client data-integrity fix; it does not alter provider output, the API response contract, scoring, hazard thresholds, official MGM warning semantics, or server deployment. Re-run all frontend gates on the exact rebased tree before opening a PR.

## 2026-10-24 23:58 TRT — Combined validation is required after rebasing source-time freshness

- Re-ran the complete frontend suite, type-check, lint/CSS lint, build and diff checks after rebasing the source-observation timestamp fix onto `d06e30cf`, which includes the confidence-evidence change. The combined tree passed **1,089 tests across 106 files**.
- Keep source sample time (`timestamp`/`observedAt`) authoritative for observation freshness; `fetchedAt` remains a separate retrieval/cache TTL signal. Preserve this distinction in network and persisted-cache paths. No API server deployment is needed or authorized by this client-side change.

## 2026-10-24 23:58 TRT — Cached-weather E2E fixtures must be source-time fresh

- A cache-suppression test must use a provider sample timestamp inside the freshness window. A fresh `fetchedAt` cannot make an old `timestamp` fresh; the observed Browser-flow failure correctly demonstrated this distinction.
- Generate the cached fixture's sample time at test execution and keep `observedAt` fallback/sample time aligned. Preserve the test's actual assertion: a fresh localized cache suppresses the static bootstrap request. Do not weaken source-time validation or reintroduce stale-data acceptance to satisfy a stale fixture.

## 2026-10-24 22:24 TRT — Freshness-gate optional AQI in the headline score

- Every consumer that feeds current AQI into the shared decision snapshot must use the same freshness boundary. A stale current AQI sample must not continue to affect `DecisionGlance` while weather/forecast evidence remains fresh; exclude only the stale optional AQI rather than blanking otherwise valid weather guidance.
- Schedule the component's next refresh at the earliest current-weather, AQI, forecast expiry or short safety refresh, and ensure the memoized snapshot recomputes when AQI transitions from fresh to stale. Keep the change local to the UI evidence selection; do not alter provider data, AQI thresholds, or API behavior.

## 2026-10-25 00:17 TRT — Refresh DecisionGlance when optional AQI evidence expires

- `DecisionGlance` memoized its decision snapshot by weather, forecast, hourly and raw AQI object identity, so the component's clock refresh alone could not invalidate the memo when the same AQI sample crossed its freshness boundary. The shared domain builder checks AQI freshness when called, but the memo could prevent that call from happening again.
- Treat current AQI as optional evidence at the component boundary: pass it only while `getCurrentWeatherFreshness` says it is fresh, schedule the next refresh at the earliest current-weather/AQI/forecast expiry (with the existing short safety refresh), and make the memo depend on the freshness-filtered AQI. Expired AQI is removed from the next decision snapshot without discarding otherwise fresh weather/forecast guidance.
- Keep this a frontend freshness/cache invalidation fix. Do not change provider values, AQI scale/categories, health interpretation, scoring thresholds, API contract, or deployment behavior. Validate both initially stale AQI and a fresh sample expiring under fake timers, then run the full frontend suite, build, lint/type-check, security audit and focused browser flows.

## 2026-10-25 00:24 TRT — Cover current-weather source-time freshness end to end

- Add a focused Playwright regression for the merged current-weather source timestamp contract: a provider sample three hours old must remain stale even when the BFF `fetchedAt` is only moments old and `freshForSeconds` is 300. This verifies the serialized payload → client normalization → freshness gate → visible UI path, not only the helper in isolation.
- Assert Turkish mobile and English desktop surfaces show their localized stale labels, explain that the current observation is not fresh, and do not render the stale temperature. The test changes no product code, API behavior, forecast values, or provider metadata; it uses deterministic fixtures only.

## 2026-10-25 00:30 TRT — Verify the merged source-time fix in a browser contract

- The source-time E2E regression was rebased onto the now-deployed main commit `78afbf293dc8b928c9f2a1348d800d624fe3e8d8` after PR #1450 passed all exact-head gates and its production rollout completed. The test remains isolated to `e2e/` and autonomous append-only documentation.
- Live API sampling confirms current weather still returns its source sample in `timestamp` while `meta.observedAt` is omitted on the deployed API; AQI returns both `fetchedAt` and `observedAt`. Keep the client fallback from current payload `timestamp` to `meta.observedAt` so a fresh BFF envelope cannot disguise an old provider observation.

## 2026-10-25 00:50 TRT — Hourly AQI source attribution must match the scorer's resolver

- Source attribution is a claim about evidence actually accepted by the decision engine, not merely a provider sample that happens to share a timestamp. For hourly AQI, use `getDailyPlanAirQualityEvidence(...).usesHourlyAqi` rather than an independent `.some()` check so conflicting duplicate samples remain unavailable consistently in both scoring and explanatory UI.
- Keep exact forecast timestamps, provider freshness, and duplicate-conflict handling aligned. This is a frontend evidence-integrity fix only; it does not alter provider values, AQI categories, health interpretation, thresholds, the API contract, or deployment behavior.

## 2026-10-25 01:18 TRT — Marine current values require their own source-age gate

- Open-Meteo Marine is requested with `timezone=auto`; its `current.time` may therefore be a timezone-less location-local wall-clock value. Do not parse that string in the browser's own timezone or treat a recent BFF `fetchedAt` as proof that the marine sample itself is recent.
- Normalize timezone-less marine timestamps with the forecast location's UTC offset, but honor explicit `Z`/offset timestamps as absolute instants. Fail closed when the timestamp/offset is missing or invalid, the sample is materially future-dated, or source age exceeds the shared two-hour limit.
- Expire/hide only the marine card when its source-age deadline passes; keep independently fresh UV, dust and pollen context visible. Schedule a rerender at the earlier of context-cache expiry and marine source expiry, and suppress an otherwise empty context panel.
- Prefer a future API contract that emits an explicit UTC ISO timestamp from the provider's own timezone metadata. Until then, the frontend compatibility parser must remain deterministic across browser timezones.

## 2026-10-25 01:49 TRT — Gate the no-hourly daily-plan fallback on current-observation freshness

- `buildDailyPlan` scores actual hourly forecast points when any are available, but deliberately falls back to a single slot built from current temperature, feels-like temperature, humidity, wind and visibility when the hourly list is empty. `DailyPlanPanel` previously gated only on `forecastMeta`; a fresh forecast envelope with no hourly points could therefore keep scoring a stale current observation.
- Preserve the useful forecast-only path: when hourly forecast points exist, a stale current observation alone must not hide an otherwise fresh forecast-driven day plan. When there are no hourly points, require `getCurrentWeatherFreshness(weather.meta).fresh`, schedule a rerender at its expiry boundary, and refresh on tab visibility. Show a distinct localized current-observation freshness message rather than incorrectly claiming the forecast is stale.
- This is a frontend evidence-selection/freshness guard only. Do not change weather-provider values, scoring weights/thresholds, AQI resolution, forecast contract, API behavior, or deployment routing. Keep current weather source observation time authoritative over retrieval metadata.


## 2026-10-25 02:15 TRT — Province-map source freshness is time-bounded, not fetch-bounded

- Filtering province observations during API parsing is insufficient for a long-lived map: a sample can be fresh when fetched and stale hours later without another network response. The map must re-check each `observedAt` at render time and schedule a refresh at the earliest source-age expiry.
- Re-evaluate the expiry timer whenever the refresh revision changes. If a refresh fails, remaining province samples must still expire on their own timestamps; a failed request or fresh retrieval metadata must never extend the old observation's lifetime.
- Refresh the optional province layer every 30 minutes and when the tab becomes visible, while retaining the existing three-hour source-age ceiling and one-minute future-skew guard. Hide only stale province temperatures/attribution; do not blank unrelated city weather or fabricate replacements.
- This is a frontend data-integrity change. It does not alter provider values, forecast data, map tile routing, scoring, official MGM warning semantics, API contracts, or production deployment. Require exact-head hosted build, browser-flow and Lighthouse gates before merge.


## 2026-10-25 02:23 TRT — Validate static SEO contracts across the whole province catalogue

- The production static site is generated for 81 Turkish and 81 English province URLs. Testing only Istanbul can miss a duplicate title, bad slug/canonical, malformed alternate link or missing per-province OG path elsewhere in the catalogue.
- Keep a builder-level regression that iterates every province in both languages and checks uniqueness, self-canonical metadata, social URL parity, hreflang pairs and structured-data presence. This complements the sitemap parser test and the generator's existing fail-closed checks for missing OG assets.
- Generate robots.txt through a pure builder so its separate directive lines and absolute sitemap URL are unit-testable. Preserve the current emitted format; this is a regression guard, not a change to crawl policy.
- Production crawl results are an observation, not a substitute for tests: all 164 sitemap URLs returned 200 and had matching canonical/OG URLs, language and hreflang in the baseline audit. Hosted CI remains the authority for production build, browser and Lighthouse gates.

## 2026-10-25 02:50 TRT — Live responsive audit must surface failed weather responses

- A visible/ready forecast is not proof that the current live weather request succeeded: cached or previously rendered content can survive a failed request. After the audit's existing single retry, include any failed core `/api/v1/weather/` response in the case result even when layout metrics are available; deduplicate repeated status/path pairs so diagnostics stay concise.
- Keep API availability failures distinct from CSS/layout regressions. This is an observability/test-contract change only: it must not invent fallback weather, alter provider values, change freshness rules, or make public provider availability a mandatory CI dependency.
- Keep frontend merge readiness separate from Oracle API deployment readiness. A healthy GitHub Pages deploy does not override a false host/disk/API-build-headroom gate.

## 2026-10-25 03:03 TRT — Distinguish weather network failures from browser teardown

- A failed browser request may have no HTTP response event, so the live responsive audit should also observe `requestfailed` for core `/api/v1/weather/` routes. Record non-cancellation failures in the same per-case diagnostics, strip query strings, and ignore `ERR_ABORTED`/cancelled requests caused by expected navigation or page teardown; otherwise a test harness cleanup could masquerade as an upstream outage.
- Keep this diagnostic path read-only and bounded to core weather endpoints. Do not treat unrelated optional API failures as current-weather failures, retry provider requests aggressively, or convert network errors into fabricated weather values.

## 2026-10-25 03:22 TRT — Explain expired AQI separately from unavailable AQI

- `EnvironmentRail` already removes AQI values and PM2.5 details when provider TTL or source-observation age expires, but the detail line then said only “No data.” Keep the numeric sample hidden, but distinguish a previously received sample that is now stale from data that was never available or whose freshness is unknown.
- Reuse the existing localized stale-current-observation copy and expose the changed state with `role="status"` so the transition is announced without adding a new health interpretation or provider claim.
- This is presentation/accessibility only. Do not change AQI values/categories, source timestamps, freshness thresholds, scoring, API contracts, or weather guidance.

## 2026-10-25 03:26 TRT — Make alert suppression visible when required evidence is stale

- Browser alerts already fail closed when current weather, the forecast, or required AQI evidence is missing/stale. When the user has enabled alerts and browser permission is granted, surface a localized status explaining that new alerts are temporarily paused until the evidence is fresh enough.
- Keep the opt-in setting enabled so a temporary data-quality issue does not silently revoke the user's preference; keep the disable control available. Do not change alert candidate rules, quiet hours, deduplication, notification delivery, modeled-guidance disclosure, or any weather value/score.

## 2026-10-25 03:55 TRT — Explain stale marine model data as an unavailable context state

- When a marine source timestamp expires, keep its wave and sea-surface values hidden. If those were the only context signals, retain the panel's explanatory state rather than silently dropping the entire panel; when other signals remain, explain the missing marine values without hiding fresh UV, dust or pollen.
- Show the note only for a previously received marine sample explicitly classified as stale, using localized `role="status"` copy. Missing/invalid timestamp states remain fail-closed and must not be relabeled as confirmed stale unless the freshness helper says so.
- This is presentation/accessibility only. Do not change marine timestamps, freshness limits, provider attribution, modeled-vs-observed claims, weather scores, API contracts, or production routing.

## 2026-10-25 04:09 TRT — Persist live audit diagnostics independently of screenshots

- Every completed live responsive audit must persist a structured `results.json`, including failed cases and screenshot-free runs. The report is operational evidence needed to inspect viewport, locale/theme, layout metrics and weather-request failures; screenshots remain opt-in to avoid unnecessary disk usage.
- Write the artifact after browser cleanup and after the case result array is complete. Preserve nonzero exit status when any case fails: artifact persistence improves diagnosis and must never convert an audit failure into success.
- This is a local diagnostics/test-contract change only. Do not retry provider requests aggressively, alter weather data, make live public API availability a mandatory CI dependency, or change production routing.

## 2026-10-25 — City route metadata must not wait for live weather

A canonical province slug is sufficient to derive the localized city route, title, description, canonical URL and hreflang alternates. Apply those from the route while the current-weather request is pending or failed; a provider response must not be a prerequisite for correct URL/head metadata. Preserve the user's view query/hash during the early locale path correction. Keep the fallback weather state honest: this change changes routing/metadata only and must never invent weather observations. Regression coverage must include both locales with the API blocked, and a clean-context production Lighthouse run must confirm canonical SEO no longer races the client-side locale change. This is frontend-only; it does not authorize an API deployment while the Oracle host/headroom gate is red.

## 2026-10-25 — README screenshots must be real, fresh and time-labelled

Refresh product screenshots from the public production UI only after confirming successful live weather API responses, the visible provider/freshness label, the intended locale/theme and no horizontal overflow at the target viewport. Never seed or mock weather for documentation screenshots. Because weather values are time-sensitive, keep the README captions explicit that the image is a dated UI snapshot and that values may change; keep English and Turkish README captions aligned.

## 2026-10-25 — Map tile failure announcements are assertive; loading remains polite

Keep the map's initial tile-loading message as a polite status. When both tile providers fail, expose the visible failure and retry action as an assertive alert, with an explicit `aria-live="assertive"` that agrees with the `alert` role rather than inheriting the loading state's polite setting. This is an accessibility announcement change only; do not alter tile sources, fallback/retry behavior, map state, weather evidence or safety guidance.

## 2026-10-25 — Test map tile alert semantics in the browser, not only in unit tests

The dual-provider map tile failure/retry browser flow should assert that the visible failure has both `role="alert"` and `aria-live="assertive"`. Keep the loading state polite, preserve the enabled retry control and successful recovery behavior, and do not change tile providers, weather data, or safety messaging. This browser regression complements the component unit test because it exercises the built app and real focus/touch flow.

## 2026-10-25 — Include worker implementation in the offline-shell cache identity

The generated shell-cache namespace must change when `public/sw.js` behavior changes, even if the HTML, manifest, and asset filenames remain identical. Hash the worker template before replacing its build-ID placeholder to avoid a self-referential cache name. If installation fails after opening the new versioned cache, delete that partial cache best-effort and rethrow the original failure; cleanup failure must not replace the install error. Required root/boot assets remain fail-closed, optional manifest caching remains non-blocking, and the previously active worker/cache must remain authoritative when the new install fails. Validate cache-ID determinism and worker-code invalidation with unit tests; do not change weather provenance, forecast/scoring behavior, API contracts, or production routing.


## 2026-10-25 07:46 TRT — Make observer snapshot age explicit in the status command

- The five-minute observer writes `collected_at`, but the compact status command previously printed only the timestamp. Add a directly testable freshness classification and age so an old snapshot cannot look current just because its production fields say healthy.
- Treat snapshots older than ten minutes (two expected collection intervals) or more than 60 seconds in the future as not fresh. Missing or malformed timestamps are unknown/not fresh. Keep this informational: it must not mutate observer state, alter merge/deploy gates, or imply that a fresh snapshot alone authorizes a production operation.
- Preserve the existing status fields and installer flow. Validate stale, future, invalid and recent timestamps through the same status helper used by the deployed script.

## 2026-10-25 07:56 TRT — Verify the English city shell in production observer parity

- The production observer checked only `/` and `/istanbul/`; a stale or broken `/en/istanbul/` static shell could therefore escape its revision and boot-asset checks even though the English route is a first-class production entry point. Fetch the English city shell as well and include its referenced assets in the same bounded verification.
- Treat a missing build-revision marker or any mismatch among root, Turkish city and English city as production unhealthy. Keep a consistent revision that is merely behind the current `main` SHA classified as deploy-pending, not as a shell-integrity failure.
- This is a read-only observer contract change. It does not deploy the observer, change API behavior, modify weather data, or switch traffic; Oracle observer installation remains blocked while the enrolled host is offline.

## 2026-10-25 — Sunrise and sunset values are scoped to the location's current day

- A fetched weather object can remain in memory after its sunrise/sunset timestamps belong to yesterday. Do not keep presenting those timestamps or the derived day length as today's values merely because the current-weather cache TTL has not expired.
- Validate both instants against the current calendar date in the weather location's timezone and require sunset to follow sunrise. If valid timestamps no longer match the local day, hide both times and the derived day length, and announce a localized stale-daylight status. Missing/invalid timestamps remain “no data”; do not calculate or invent replacement sun times.
- Schedule a lightweight re-evaluation at the next location-local midnight even when the weather sample remains otherwise fresh, and keep the existing freshness-expiry/visibility refresh behavior. This is presentation freshness only; do not alter provider timestamps, forecast values, scoring, alerts or API behavior.


## 2026-10-25 08:51 TRT — Browser history changes must not display another province's retained weather payload

`useAsync` should continue preserving the last successful payload for ordinary searches and refreshes, but a browser `popstate` to a different canonical province is an explicit navigation boundary. If the retained weather payload maps to a different province than the target route, clear that mismatched payload before starting the route fetch; this prevents the URL and document metadata from pointing at İzmir while Istanbul observations remain presented as current. Only clear on a different province identity so same-city view/query history remains fast. Keep provider data, source timestamps, freshness rules, forecast scoring and API behavior unchanged. Cover delayed target responses in the app integration suite and require the hosted browser/build gates before merge.
## 2026-10-25 08:56 TRT — Query old PR checks by exact head SHA with bounded caching and rate-limit guard

A single `actions/runs?per_page=100` page is not a complete source for open-PR checks when CI/CD, Ops contracts and CodeQL each create separate workflow runs. When an automation PR is missing any required run, use one `actions/runs?head_sha=<exact-sha>&per_page=100` lookup per observer cycle if the known GitHub rate-limit remainder is above five. Cache only complete, concluded gate snapshots for the same head SHA for at most 15 minutes, then refresh; do not cache in-progress or unknown checks. If lookup fails or rate budget is low, leave the PR unknown and keep merge readiness fail-closed. Direct exact-head checks remain mandatory immediately before merge; the observer is advisory/read-only and cannot grant merge or deploy permission by itself.


## 2026-10-25 09:06 TRT — Reclaim only unused private Docker build cache when disk pressure blocks future builds

Before freeing disk, verify API ready/live, green/canary container health, no active build/deploy process, and `docker builder du` marks the target cache reclaimable and older than 24 hours. Use `docker builder prune --filter until=24h --force` for private cache and regenerable package-manager cache cleanup only when needed. Do not use `docker system prune`, delete images/containers/volumes, remove shared cache, or clean unrelated worktrees. Recheck API ready/live and free space afterward. If API build headroom remains false, do not build/deploy the API; leave rollback/canary images intact.


## 2026-10-25 — Localized homepage WebSite structured data must match the canonical locale

Both Turkish `/` and English `/en/` are first-class static entry points. Each should emit exactly one `schema.org/WebSite` JSON-LD block whose URL, `inLanguage`, and description match that locale's canonical HTML metadata. The published-SEO verifier must check both live homepages independently, including canonical/title/language, social metadata and all `tr`/`en`/`x-default` alternate links. Treat a cross-locale JSON-LD URL or language as a release failure. This is static descriptive metadata only: do not embed modeled/current weather claims, depend on weather API availability, or alter forecast, provider, scoring, MGM, UV/AQI or safety behavior.


## 2026-10-25 — first-visit browser locale SEO contract
- The default Playwright locale is Turkish, so a test that pre-seeds English in localStorage does not cover a first-visit English browser. Add a fresh-context `en-US` E2E case for a Turkish city URL, with weather API requests aborted, and assert the client-selected English path plus canonical, Open Graph URL and all language alternates before weather is available.
- Keep this a frontend test/metadata change only. Do not infer weather availability from successful route rendering; do not merge/deploy API-runtime work until the real Oracle host is reachable and host-specific disk/build-headroom plus blue-green/canary gates pass.


## 2026-10-25 10:27 TRT — Observer disk metrics must identify their measured host
- `host.disk` is collected locally by the observer process. Every snapshot must include that host's hostname, and the human-readable status must show both the snapshot hostname and the status process hostname. Label disk scope as observer-host-local; do not treat a gateway-local snapshot as Oracle disk evidence unless the measured hostname is confirmed to be the Oracle host. Keep all existing fail-closed disk and deployment gates intact.


## 2026-10-25 — Last-known weather fallback must match the requested city and locale

The one-slot persisted weather cache is a resilience fallback, not evidence for whichever route happens to be open. When there is no active payload and an infrastructure request fails, show the cache only if its canonical province identity matches the explicit city request and its stored locale matches the current interface locale. Set the expected identity from the initial city and each explicit city fetch; clear it when switching to location mode or clearing weather because the target is then unknown. Preserve same-city stale-cache fallback with its visible last-known timestamp. Do not silently present another province's observation as the requested city's weather, and do not fabricate a replacement observation.

## 2026-10-25 — Worker status must identify legacy readiness snapshots

- The status command must not silently present missing scoped readiness fields as ordinary `None` values. Require `can_merge`, `can_deploy_frontend`, `can_deploy_api` and their blocker arrays to identify the current readiness contract; report `legacy_or_incomplete` and list missing fields when the snapshot predates or omits that contract.
- This is diagnostic-only. Never infer merge/deploy permission from the schema warning, and keep Oracle host health, API build headroom, production health, and exact-head GitHub checks as independent gates. Do not install the observer or run API build/deploy/rollback while the enrolled Oracle host is offline.
