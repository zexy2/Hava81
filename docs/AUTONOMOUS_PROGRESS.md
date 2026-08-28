# Hava81 Autonomous Progress

## 2026-08-28 04:00 checkpoint

- Built Day Plan, Hava81 Score, now-vs-later decisions and explainable reasons.
- Added six activity modes and local personalization.
- Upgraded city comparison to decision-oriented scoring.
- Added real UV/dust/pollen/marine context through server-side Open-Meteo integration.
- Added decision sharing, PWA service worker and opt-in decision alerts with quiet hours/deduplication.
- Added 81 static city entry pages and sitemap generation.
- Added transparent inter-city weather corridor feature.
- Main JS reduced from ~535 KB to 499.69 KB after lazy-loading secondary panels.
- Frontend regression: 78/78; API tests: 9/9; production audits: 0 vulnerabilities.
- Release pipeline is in progress; production v2.0 remains untouched until final canary gates pass.

## 2026-08-28 v2.1 release-candidate gate

- Canary API: port 4002, healthy, provider circuit closed, zero restarts.
- Real context smoke: Open-Meteo UV/dust/pollen plus İzmir marine data succeeded.
- Route corridor smoke: İstanbul → Ankara produced five weather segments and transparent non-navigation disclaimer.
- Decision calibration: 81/81 provinces and 486/486 activity plans passed; average Hava81 Score moved from 86 to 80 after calibration.
- Frontend: 78/78 unit/integration tests; line coverage 71.15%.
- API: 9/9 tests.
- Playwright: 7 active flows passed across mobile/tablet/desktop; 8 intentional project-specific skips.
- Lighthouse gate passed; most recent measured scores before commit were performance >90, accessibility 100, best practices >90, SEO 100.
- Frontend and API production dependency audits: 0 vulnerabilities.
- Main JS: 499.69 kB minified, below the configured 500 kB warning threshold.

## 2026-08-28 autonomous loop: first-load performance

- Production Lighthouse baseline on `/izmir`: performance 80, accessibility 100, best-practices 100, SEO 100; LCP 3.4 s and TBT 370 ms identified as the next highest-value issue.
- Removed eager `framer-motion` dependency from `App.tsx`; secondary Settings animation remains lazy-loaded.
- Main JS fell from 499.69 kB / 152.62 kB gzip to 373.75 kB / 112.07 kB gzip (~26% less main JavaScript).

## 2026-08-28 09:43 TRT run checkpoint

1. Notification reliability: stabilized same-day rain/difficult deduplication signatures and added regression coverage.
2. Route resilience/cost: added 1–2,000 km corridor guard before provider fan-out plus boundary tests.
3. Marine intelligence: added Open-Meteo wave direction/period to the API contract, backed by provider documentation and API tests.
4. SEO/deep links: rejected nested pseudo-city routes and added canonical-route regression coverage.
5. Panel testing: added ContextSignalsPanel attribution/marine rendering coverage.
6. Official warning integrity: researched MGM MeteoUyarı; deferred implementation because this run did not verify a stable official machine-readable feed with freshness semantics.

First local gate: 80 frontend tests passed, 9 API tests passed, type-check/lint/frontend+API builds passed, production dependency audit found 0 vulnerabilities. A second full gate follows before commit/deploy.
Second gate passed: 81/81 frontend tests, 10/10 API tests, type-check, lint, frontend/API builds, dependency audit (0 vulnerabilities), and Playwright smoke (7 passed, 8 intentionally project-skipped). Main JS remains ~373.78 kB minified / 112.07 kB gzip.

## Follow-up autonomous checkpoint

- Loop 1 alerts: added strong-wind and poor-AQI decision notifications with stable same-day dedupe and tests.
- Loop 2 model transparency: context panel now exposes fetch freshness plus modeled wave period/direction.
- Loop 3 route transparency: segment cards now show wind, a variable already used by the route score.
- Loop 4 SEO: root canonical/og:url added and city generator changed to replace them, preventing duplicate canonical metadata.
- Loop 5 operations: blue-green release checklist aligned to active 4002 / rollback 4001 topology.
- MGM MeteoUyarı remains intentionally deferred until a stable official machine-readable freshness-aware feed is verified.
- Quality gates after the five loops: 82/82 frontend tests, 10/10 API tests, frontend/API type-check + lint + builds, production dependency audit 0 vulnerabilities, SEO canonical assertions pass, Playwright 7/7 applicable smoke checks pass (8 intentional project skips).
- Browser false-negative diagnosed: a stale local docs HTTP server occupied Playwright port 4173; after removing the stale process, the real Vite preview passed all applicable browser flows. No product rollback was needed.
- API canary on 4001: readiness/live pass, OpenWeather circuit closed, CORS pass, 81/81 provinces current+forecast pass, Open-Meteo context returns attributed wave height/direction/period, route too-short guard returns 400.
- Production proxy intentionally remains on 4002 per current topology instruction; no traffic switch was made in this run.

- Loop 6 SEO/deep-link: production smoke exposed GitHub Pages 301 from slashless province paths to directory URLs. Canonical route generation, app history, sitemap and tests now consistently use trailing-slash province URLs.

## 2026-08-28 10:44 TRT run checkpoint

- Loop 1 data quality: next-24h Open-Meteo context maxima now exclude elapsed and beyond-window rows.
- Loop 2 API cost resilience: route weather has a stricter 12/minute endpoint budget before five-point fan-out.
- Loop 3 browser reliability: Playwright no longer reuses unrelated listeners on its preview port.
- Loop 4 CI/CD: superseded runs on the same PR/ref are cancelled automatically.
- Loop 5 PWA/SEO: İstanbul/Ankara shortcuts use the same trailing-slash route contract as GitHub Pages.
- Research: MGM remains the authoritative hazard source, but no stable official machine-readable feed was verified; Open-Meteo 15-minute precipitation outside supported high-resolution regions is interpolated and will not be labeled nowcast.

## 2026-08-28 morning cumulative summary (through 10:44 TRT)

- Completed improvement work across decision UX, route resilience, model transparency, alerts, canonical/deep-link SEO, performance, testing and CI reliability.
- Merged PR #4 after green CI; PR #5 also reached green CI and was merged.
- Quality baseline now includes 82 frontend tests and 10 API tests before this run's new data-quality test; prior browser gate passed all 7 applicable flows with 8 intentional project skips; dependency audits reported 0 vulnerabilities.
- API release validation: 4001 canary passed live/ready, CORS, route guards, Open-Meteo context and 81/81 province current+forecast checks. Public production remains deliberately on port 4002, preserving the requested topology.
- Notable decisions: official MGM hazards must remain explicitly attributed and freshness-aware; no scraping-derived pseudo-official warning layer; Open-Meteo 15-minute precipitation in Türkiye is interpolated and must not be called radar nowcast; modeled marine data is decision context, not navigation safety guidance.
- Remaining risks/priorities: verify a stable official MGM machine-readable warning feed; add favorite-city pollen thresholds only with documented source semantics; preserve 4002/4001 rollback topology; continue reducing first-load JS/LCP and expand panel/browser regression coverage.

## 2026-08-28 10:58 TRT polish checkpoint
- Started a dedicated visual-polish branch from synchronized `origin/main`.
- Added shared card elevation/radius tokens with dark-mode equivalents, stronger focus visibility for selects/textareas, and more legible skeleton states.
- Increased the visual hierarchy of city/current temperature, standardized Daily Plan and Activity surfaces, and corrected stale notification copy without changing weather/decision logic.

- 2026-08-28 polish-2: Started five UI polish loops for context freshness/source presentation, route weather scanability, mobile bottom navigation, settings selected states/dark mode, and decision-alert CTA surfaces. Awaiting validation gates.
- 2026-08-28 polish-2 validation: five presentation loops passed 82/82 frontend tests, lint, type-check, production build, Playwright 7/7 applicable flows, and production dependency audit with 0 vulnerabilities. Branch is pushed but intentionally not opened/merged against main until PR #7 CI completes. PR #7 remains blocked only by the GitHub-hosted Browser flows runner spending an unusually long time in `playwright install --with-deps chromium`; all other PR #7 jobs are green.

- 2026-08-28 polish-3: implemented five bounded loops: Forecast mobile scroll/surface polish, Environment Rail card coherence, Compare hierarchy, Search token/touch polish, and CI dist-artifact reuse. Validation pending full local gates. PR #9 production pipeline #59 confirmed success before starting this branch; live root/city/API ready were 200 and nginx remained on 4002.
- 2026-08-28 polish-4: while PR #10 CI ran, prepared an independent five-loop batch covering Settings mobile CSS dedup/safe-area, Weather Map token polish, blocked notification CTA behavior + regression test, and Activity Planner control affordances. Full gates pending.


## 2026-08-28 11:46 TRT performance checkpoint

- PR #11 reached green CI and was merged to `main` as `358f36f`; its production pipeline #63 is running while independent work continues.
- Performance loop: moved Forecast Atlas, Daily Plan and Environment Rail below the initial synchronous bundle boundary. They remain available through React Suspense and load independently; no weather or decision semantics changed.
- Main JS dropped from ~374.8 kB / 112.3 kB gzip on the prior build to 352.1 kB / 106.8 kB gzip (about 6% less minified main JS and 5% less gzip) while extracting their CSS from the main stylesheet as well.
- Full local gates passed: 83/83 frontend tests, lint, type-check, production build, dependency audit with 0 vulnerabilities, Playwright 7/7 applicable flows, Lighthouse assertions all processed successfully.
- Local Lighthouse after the split: performance 94, accessibility 100, best-practices 96, SEO 100; LCP 2.6 s and TBT 60 ms. This is materially better than the earlier production baseline of performance 80 / LCP 3.4 s / TBT 370 ms, though environments differ and production must be re-measured after deploy.
- Next queue: ship this split through PR/CI; then re-measure public production, inspect service-worker caching/versioning and static cache headers, and add browser coverage for lazy forecast rendering if needed.
## 2026-08-28 11:51 TRT parallel font checkpoint
- While PR #12 CI runs, prepared an independent branch from stable `main` to remove an avoidable font-subset fetch.
- Normalized the modeled dust/pollen micro unit for display from Greek small mu (`μ`, U+03BC) to the SI micro sign (`µ`, U+00B5), including provider-returned units. This preserves the visible unit while avoiding activation of IBM Plex Sans's Greek subset solely for that glyph.
- Validation: lint, type-check, 83/83 frontend tests and production build pass. Local Lighthouse reached performance 95 / accessibility 100 / best-practices 96 / SEO 100 and its network trace contained only IBM Plex Latin + Latin Extended fonts; the ~19.5 kB Greek font request disappeared.
- This branch remains independent and will be rebased onto `main` only after PR #12 is green/merged.

## 2026-08-28 11:55 TRT parallel settings checkpoint

- While PR #13 validates, prepared a second independent branch from stable `main`: removed `framer-motion`, which was used only by the lazy Settings drawer.
- Replaced the drawer/backdrop entry animation with lightweight CSS keyframes and an explicit `prefers-reduced-motion` opt-out. Focus trapping, inert background behavior, Escape handling and all settings interactions remain in React.
- Settings lazy chunk fell from ~132.5 kB / 42.5 kB gzip to ~7.3 kB / 1.9 kB gzip, and the runtime dependency was removed from package manifests.
- Validation on the independent branch: lint, type-check, 83/83 frontend tests, production build, dependency audit 0 vulnerabilities and Playwright 7/7 applicable flows all pass.
- Hold this branch until PR #13 is green/merged, then rebase and run combined gates before opening its PR.

## 2026-08-28 cache/lazy-render checkpoint
- Live header measurement: GitHub Pages returns `max-age=600` for HTML, hashed JS and `sw.js`; this is a hosting constraint rather than an app-controlled header.
- Hardened service-worker registration to bypass HTTP cache during update checks and added browser coverage that delays the ForecastAtlas chunk while confirming the decision-first city view remains usable and the lazy forecast renders afterward.
- Validation: lint, type-check, 83/83 frontend tests, production audit 0 vulnerabilities, production build, Playwright 8/8 applicable flows and Lighthouse assertions all passed.

## 2026-08-28 share/growth checkpoint
- Improved decision sharing to include the localized now-vs-later recommendation, avoid duplicate native-share URLs, keep canonical links in clipboard text, and avoid false share analytics when no share transport exists.
- Validation: lint, type-check, 83/83 frontend tests, production audit 0 vulnerabilities, production build and Playwright 7/7 applicable flows passed.

## 2026-08-28 SEO/social-preview checkpoint
- Added complete root Open Graph/Twitter preview metadata using the stable Hava81 mark, converted 81-city generation to replace city title/description/URL metadata, and added build-time single-tag assertions to prevent duplicate canonical/social fields.
- Validation: lint, type-check, 84/84 frontend tests, production audit 0 vulnerabilities, production build, Playwright 7/7 applicable flows, generated city metadata assertions and Lighthouse assertions passed.

- Public `/istanbul/` Lighthouse checkpoint after PR #12/#13/#16: performance 89, accessibility 100, best-practices 100, SEO 100; FCP 1.9 s, LCP 3.5 s, TBT 100 ms, CLS 0.028. TBT improved strongly from the earlier 370 ms baseline while LCP remains data-bound; added API DNS-prefetch/preconnect to the prepared SEO branch for the next deploy measurement.

## 2026-08-28 deploy-race recovery checkpoint
- A live Lighthouse run briefly hit `Failed to fetch dynamically imported module` while GitHub Pages was serving a new deployment; an immediate browser probe was healthy, indicating an asset-version/cache race rather than persistent application failure.
- Added one-shot `vite:preloadError` recovery with cache-busting navigation and clean-URL restoration, plus a Playwright regression that forces the first ForecastAtlas chunk request to 404 and requires the app to recover without a fatal screen. Validation pending.

## 2026-08-28 12:40 TRT — CI runtime maintenance
- GitHub-hosted jobs now warn that Node.js 20-backed JavaScript actions are deprecated and will be removed from runners on 16 September 2026. Updated checkout/setup-node plus artifact upload/download actions from v4 to their current v6 majors so Hava81 CI runs on the supported Node 24 action runtime.

## 2026-08-28 map-CSS split checkpoint
- Lighthouse identified the main stylesheet as render-blocking while WeatherMap is already lazy. Moved Leaflet framework CSS from the app entrypoint into the lazy WeatherMap module so map styles load only with the map. Validation pending.

## 2026-08-28 early-current bootstrap checkpoint
- Prepared generated-HTML bootstrap for the first current-weather request: it runs before the Vite app module, respects saved TR/EN language, skips users with a matching fresh 5-minute weather cache, and exposes one promise consumed by weatherService. Added unit coverage for consume/fallback and browser coverage requiring exactly one current-weather request.
- Validation complete: type-check, lint, 86/86 frontend tests, production audit 0 vulnerabilities, production build, Lighthouse assertions, generated bootstrap-before-module checks, and Playwright 10/10 applicable flows passed. Fresh cache produced 0 current requests; cold city load produced exactly 1.
- Reliability follow-up: bounded early-bootstrap network wait to 10 seconds; unresolved/failed bootstrap now falls back to the normal BFF client rather than waiting indefinitely.

## 2026-08-28 13:13 TRT — branding regression checkpoint

- Visual QA caught a user-visible React scaffold favicon in browser tabs. The root cause was broader than the tab: `favicon.ico`, `logo192.png`, and `logo512.png` were still the original React/CRA cyan assets even though `hava81-mark.svg` had already been introduced.
- Re-rendered the Hava81 atlas mark into 512px/192px PNG assets and multi-size ICOs, added a dedicated 180px Apple touch icon, and changed browser icon URLs to versioned Hava81-specific paths so aggressively cached React favicons are not reused.
- The same correction also fixes PWA install icons and the PNG used by Open Graph/Twitter social previews.
- Added browser regression coverage that verifies the favicon/touch-icon URLs, image dimensions, and the Hava81 amber center sample so the scaffold branding cannot silently return.
- Validation after the asset change: lint and TypeScript pass, 86/86 frontend tests pass, production build plus all 81 generated city pages carry the corrected icon links, full Playwright previously passed 12 applicable flows, and the updated branding-specific desktop Playwright check passes.

## 2026-08-28 13:21 TRT — air-quality trust correction

- Production DOM audit found OpenWeather AQI `3/5` rendered as `Hassas Gruplar İçin Sağlıksız`, which incorrectly mixed OpenWeather's documented 1–5 qualitative scale with a US AQI health category.
- Aligned both API and web labels to the provider scale: `Good / Fair / Moderate / Poor / Very Poor` and `İyi / Makul / Orta / Kötü / Çok kötü`.
- Centralized the frontend 1–5 mapping and made invalid/non-integer indices render unavailable rather than clamping them into a fabricated category.
- Added frontend coverage for the visible `3/5 · Orta` production case plus utility coverage for all five levels and invalid values; API tests now verify level 3 in both English and Turkish.
- Validation: frontend lint/type-check pass, 88/88 frontend tests pass, API type-check and 7/7 API tests pass, frontend production build + 81 city generation pass, API production TypeScript build passes.

## 2026-08-28 13:24 TRT — mobile touch-target audit

- A production 390 px DOM audit measured eight interactive controls below Hava81's 44 px touch-target rule: the daily-plan share action, the activity sensitivity select, and six activity chips were all 40 px tall.
- Raised those controls to a 44 px minimum without widening the layout or changing content hierarchy.
- Added a mobile Playwright regression that scans all visible buttons, links, form controls and button-role elements and fails if either rendered dimension is below 44 px.
- Validation: production build + 81 generated city pages pass and the new 390 px touch-target browser check reports zero undersized controls.
## 2026-08-28 13:27 TRT — scaffold residue cleanup

- Searched the tracked source tree for React/CRA/Vite starter branding after the favicon regression and found one remaining original CRA React logo at `src/logo.svg`; it had no runtime imports and was deleted.
- Updated the API package identity from the pre-Hava81 `@weather-dashboard/api` / “Turkey Weather Dashboard” metadata to `@hava81/api` / Hava81 wording, including its lockfile identity.
- Updated the product roadmap so the already-completed CRA-to-Vite migration is no longer described as future work. The explicitly historical `docs/QUALITY_BASELINE.md` CRA references remain untouched because they document the before-state rather than current product identity.
## 2026-08-28 13:31 TRT — sharing surface upgrade

- Replaced the generic square app-icon social preview with a dedicated 1200×630 Hava81 share card that communicates the product promise without inventing weather data.
- Upgraded Open Graph metadata to publish the PNG type and 1200×630 dimensions and switched Twitter/X metadata from a small summary card to `summary_large_image`, including accessible image alt text.
- The generated city-page pipeline inherits the same share surface; verified all 82 generated HTML entry pages (root + 81 cities) point to the large Hava81 card.
- Extended the existing browser brand regression to decode the social image and verify its dimensions alongside favicon/install assets.
- Validation: browser-suite lint passes, production build and 81-city generation pass, all 82 generated HTML entry pages carry the expected metadata, and the targeted desktop branding browser test passes.

## 2026-08-28 13:50 TRT — service-worker cache reliability

- Audited the production nginx template and found `/sw.js` was accidentally captured by the generic `.js` rule, giving the service worker a one-year immutable cache lifetime.
- Added an exact-match `/sw.js` location with `no-cache, no-store, must-revalidate` while preserving one-year immutable caching for ordinary static assets.
- Validated the updated nginx configuration inside the project’s nginx runtime image with `nginx -t` successfully.
## 2026-08-28 13:53 TRT — lazy integration-test stability

- A rebased social-preview CI run exposed a real test flake: the app integration test used Testing Library's default 1 s async timeout for two deliberately code-split panels, and the forecast heading missed that window once under coverage load while the same unchanged branch passed on rerun.
- Raised only those two lazy-panel waits to 3 s; synchronous city rendering and the rest of the assertions keep their existing timing, so a broken forecast/day-plan render still fails instead of being globally masked.
## 2026-08-28 13:58 TRT — alert delivery retry safety

- Found that decision alerts were marked as sent before `showNotification` / `Notification` actually succeeded. A transient browser/service-worker delivery failure therefore suppressed that same alert for the rest of the day.
- Moved same-day dedupe persistence to after successful notification delivery; failed delivery remains non-blocking but can be retried on a later render.
- Added a regression test proving a thrown notification delivery does not create a `hava81-alert-sent:*` key. Targeted Docker/Vitest validation passes 2/2 tests.

## 2026-08-28 14:08 TRT — production-plan truth cleanup

- Removed two stale planning statements that no longer matched the running product: Hava81 is no longer a provisional name, and the old 31 August release window is superseded because production is already live on 28 August.
- Kept the release checklist itself intact as a continuous hardening gate rather than weakening any quality, smoke, blue/green, rollback, or post-release requirement.

## 2026-08-28 14:18 TRT — PWA regression coverage

- Added browser-level contract coverage for the production manifest, service-worker endpoint, and active service-worker registration. This protects installability and decision-alert delivery infrastructure from silent regressions.
- Local gates passed: lint, type-check, 89/89 frontend tests, production build, and production dependency audit with 0 vulnerabilities. Browser execution remains a CI gate because the host uses containerized Node without a local Playwright browser runtime.

## 2026-08-28 14:21 TRT — font payload reduction

- Replaced all-subset Fontsource imports with explicit Latin + Latin Extended variable-font faces, retaining Turkish/English glyph coverage while removing Vietnamese, Cyrillic and Greek font payloads.
- Production build font artifacts fell from 11 files (~310 kB total) to 4 files (~170 kB total), and main CSS fell from ~32.6 kB to ~30.4 kB minified.
- Gates passed: lint, type-check, 89/89 frontend tests, production build, and production dependency audit with 0 vulnerabilities.

## 2026-08-28 14:52 TRT — post-deploy static smoke gate

- Added a retry-aware public-shell verifier for root, canonical İstanbul, the PWA manifest and service worker; checks only deployment artifacts and never infers weather or safety data.
- Wired the verifier immediately after the GitHub Pages publish step so a completed deploy is not treated as healthy until the public custom domain serves the expected Hava81 shell.

## 2026-08-28 14:58 TRT — startup bundle dependency trim

- Production Lighthouse measured performance 85, accessibility 100, best-practices 100 and SEO 100; TBT was 0 ms, while unused-JS analysis attributed about 10 kB of wasted source to frontend-only Zod config parsing.
- Replaced the single browser-side Zod schema with small typed parsers for mode, positive numeric settings, analytics and API URL normalization; invalid/negative numeric values now safely fall back instead of leaking into runtime config.
- Removed the now-unused frontend Zod dependency so environment validation no longer loads a general-purpose schema library on every visit.
- Local gates before rebase passed lint, type-check, 89/89 tests, production build, dependency audit with 0 vulnerabilities and Lighthouse CI assertions. Main JS fell from ~352.8 kB / 107.2 kB gzip to ~295.8 kB / 94.1 kB gzip.

## 2026-08-28 15:05 TRT — production source-map exposure

- Production probing found hashed JavaScript source maps publicly reachable from GitHub Pages; after the startup-config deploy, the current main map remained HTTP 200 at roughly 1.13 MB.
- Changed normal production builds to omit source maps, while the explicit developer `npm run analyze` path opts back into maps for local bundle analysis.
- This reduces public artifact weight and avoids exposing reconstructed application/source structure without sacrificing intentional diagnostics.
- Added a CI artifact gate that rejects any production `dist/**/*.map`, preventing a future Vite config change from silently re-exposing maps.

## 2026-08-28 15:27 TRT — production accessibility semantics

- Re-measured the public İstanbul page with Lighthouse after the source-map release: performance 86, accessibility 100, best-practices 100 and SEO 100; FCP ~2.48 s, LCP ~3.41 s, TBT 0 ms and CLS 0.
- Inspected individual accessibility audits rather than relying on the rounded category score and found invalid `listitem` host semantics in Daily Plan plus visible-label/accessibility-name mismatches on the brand link and environment map action.
- Replaced the Daily Plan `article role=listitem` hosts with supported neutral listitem hosts, removed unnecessary overriding labels so visible map action text becomes its accessible name, and let the Hava81 brand link derive its name from its visible product name.
- Added integration regression coverage for all three contracts. Final gates: lint, type-check, 91/91 frontend tests, production build, production dependency audit 0 vulnerabilities. Local Lighthouse confirms accessibility 100, `aria-allowed-role` passes and the label-content-name-mismatch audit is no longer emitted.

## 2026-08-28 15:46 TRT — host headroom and canonical city heading

- Production/server inspection found the root filesystem at 93% used with about 3.3 GB free. Removed only unused Docker cache images with zero attached containers: two old Playwright browser images and unused Node bookworm images. Active Hava81 production on 4002, the 4001 rollback/canary image, running containers, volumes and unrelated user files were preserved. Disk usage improved to 74% with about 12 GB free.
- A fresh production DOM audit at 390, 768 and 1280 px found no page-level horizontal overflow, console/page errors, duplicate IDs or sub-44 px interactive controls, but the populated canonical city view had no level-1 heading because the visible city identity started at h2.
- Promoted the visible city name in WeatherDecisionField to the single page h1 and added integration plus Playwright regression assertions that a populated canonical city view has exactly one level-1 heading.
- Validation: lint and type-check pass, 91/91 frontend tests pass, production dependency audit reports 0 vulnerabilities, and the production build plus all 81 generated city pages succeeds. The browser heading assertion remains covered by CI where the normal intercepted API fixtures are available.

## 2026-08-28 structured-data SEO checkpoint

- Added one stable WebSite JSON-LD block on the root shell and generated per-province WebPage + City identity with canonical URL/site relationship. Static structured data deliberately excludes live weather values so deploy-time markup cannot become stale or fabricate current conditions.
- Validation: lint, type-check, 91/91 frontend tests, production dependency audit 0 vulnerabilities, production build and all 81 generated province pages pass.

## 2026-08-28 CI action runtime checkpoint

- GitHub runner annotations showed Node 20 deprecation warnings from Codecov and artifact download actions even though project jobs already run Node 22. Upstream releases checked on 2026-08-28: codecov-action v7.0.0, upload-artifact v7.0.1 and download-artifact v8.0.1.
- Updated only actions exercised by pull-request CI. Main-only Docker publishing action majors remain unchanged because PR CI skips that job and cannot validate them safely.

## 2026-08-28 15:59 TRT — development dependency audit cleanup

- A full dependency audit (including dev tooling) found 10 advisories isolated to the legacy `@lhci/cli` dependency chain: 7 high, 1 moderate and 2 low. Production dependencies remained at 0 vulnerabilities.
- Replaced the unmaintained LHCI wrapper with current Lighthouse 13.4.1 and a small repository-owned runner that preserves Hava81 category thresholds, starts the existing production preview, refuses to reuse an occupied preview port, and keeps Lighthouse reports local instead of uploading them to temporary public storage.
- The replacement dependency graph audits at 0 vulnerabilities for the full frontend tree, not only production dependencies.
- Validation before final PR: lint, type-check, 91/91 frontend tests, production build and full `npm audit` passed. The new runner was exercised with Chromium and produced performance 95, accessibility 100, best-practices 96 and SEO 100 on a local production build.

## 2026-08-28 offline resilience checkpoint

- Upgraded the minimal notification-only service worker into a bounded same-origin navigation cache. Visited navigations use network-first with cached-page/root fallback. Cross-origin API/weather requests are never cached.
- Core boot scripts plus styles/fonts/images may be cached for a visited offline shell; lazy feature chunks remain network-served so deploy-time chunk recovery stays observable and is not masked by the worker.
- Extended desktop PWA browser coverage to reload a visited İstanbul page offline after service-worker control is established. Local non-browser gates pass; browser CI is the release gate.

## 2026-08-28 Docker action runtime checkpoint

- After the artifact/Codecov action refresh, the next successful main pipeline isolated the remaining Node 20 deprecation warning to Docker setup/login/metadata/build-push actions.
- Checked current upstream action contracts before editing: setup-buildx v4, login v4, metadata v6 and build-push v7 all declare Node 24; the exact inputs Hava81 uses remain present. Updated those four majors without changing Docker publish semantics.

## 2026-08-28 device-aligned theme checkpoint

- Production review found that the visible `Auto` theme was actually tied to weather day/night icons, so daytime weather could force a light UI even when the device/browser preferred dark mode. Replaced that product-level ambiguity with one resolved-color-mode hook backed by `prefers-color-scheme` change events.
- App chrome, Weather Map tile style and both browser `theme-color` meta tags now consume the same resolved light/dark state. Explicit light/dark user choices still override the device preference; settings copy now describes Auto as the device/system setting.
- Added hook tests for initial/system-change behavior, integration coverage for explicit dark metadata sync, and a desktop browser regression that verifies visible theme choice updates browser chrome metadata. Validation after rebasing onto the offline-navigation main: lint, type-check, 94/94 frontend tests, production dependency audit 0 vulnerabilities, and production build/81 generated city pages pass. Browser CI remains the release gate for the new Playwright assertion.

## 2026-08-28 exact production artifact smoke checkpoint

- Audited the existing GitHub Pages smoke and found two blind spots: its temporary-file `RETURN` trap did not actually reference the created file, and a stale CDN page containing the word `Hava81` could satisfy the deploy gate before the new release propagated.
- Reworked the smoke helper to clean temporary bodies deterministically, cache-bust each retry, and—when the downloaded CI `dist/` artifact is present—require SHA-256 equality for the root shell, İstanbul entry page, manifest, service worker, Hava81 mark, favicon and social card. Root/manifest checks also reject legacy React branding tokens.
- Validation: `bash -n` passes; the content-only smoke passes against current production; exact-hash mode passes when supplied files from the currently deployed `gh-pages` commit and correctly fails against a locally built artifact that is not the deployed CI artifact. This makes propagation part of the release gate rather than an observation-only concern.

## 2026-08-28 replace-in-place asset cache checkpoint

- Reviewed the newly deployed offline worker specifically for the stale-branding failure mode. It was cache-first for every same-origin image, which could pin a replace-in-place root logo/icon URL in CacheStorage until the service-worker cache name changed.
- Narrowed static cache-first behavior to fingerprinted `/assets/` resources only. Visited navigation HTML remains network-first with offline fallback, core hashed boot assets remain available offline, and cross-origin weather/API requests remain excluded.
- Extended the PWA browser regression to explicitly request `hava81-mark.svg`, prove that root branding is absent from CacheStorage, and simultaneously prove fingerprinted `/assets/` resources are still cached before the offline reload assertion.
- Validation before browser CI: lint, type-check, 94/94 frontend tests, production dependency audit 0 vulnerabilities, production build and all 81 generated city pages pass.

## 2026-08-28 provider resilience regression checkpoint

- Audited the existing API circuit-breaker/fallback wrapper and found its critical retry, non-retryable error and open-circuit fallback semantics were not directly unit-tested even though production readiness exposes provider state.
- Added focused API regression coverage proving retryable 5xx failures get one bounded retry, 4xx provider errors do not consume circuit-failure budget, and an open primary circuit serves the configured fallback without continuing to probe the failing primary.
- Validation: API test suite passes 14/14, API type-check passes, API production build passes, and the API dependency tree audits at 0 vulnerabilities during install.

## 2026-08-28 health endpoint cache-safety checkpoint

- Audited API liveness/readiness responses used by the observer and deployment checks. They did not explicitly prohibit caching, so an intermediary proxy could theoretically replay stale health state during an incident or recovery.
- Added `Cache-Control: no-store` to both `/health/live` and `/health/ready` without changing payload shape, rate-limit exemptions or weather behavior.
- Added endpoint regression assertions for both headers. Validation: 11/11 API tests pass, API type-check passes, and API production build passes.

## 2026-08-28 context rolling-window timezone checkpoint

- Audited the Open-Meteo next-24-hour maximum implementation after the UI trust review. The API requested `timezone=auto`, which returns local wall-clock timestamps without an offset, then compared them with UTC `Date.now()` through `Date.parse`. On the production UTC host this can shift İstanbul's rolling window by three hours: include already elapsed slots and end the intended window early.
- Changed only the air-quality/context request to `timezone=GMT` and `forecast_hours=25`; marine current-time presentation remains local and unchanged. Added an explicit GMT model-time parser so offset-less provider timestamps are treated as UTC even if the host timezone changes.
- Strengthened API tests to assert the provider request contract, offset-less GMT parsing, and exclusion of past/beyond-window points. Direct provider probing for İstanbul returned the same physical UV sequence at `14:00 GMT` and `17:00 Europe/Istanbul`, confirming the three-hour wall-clock offset the old comparison could misinterpret.
- Local API gate: 15/15 tests, type-check, production build and production dependency audit all pass with 0 vulnerabilities. This API branch requires the normal 4001 canary validation before any production traffic consideration; 4002 remains production.

## 2026-08-28 17:18 TRT — reduced-motion navigation hardening

- Audited programmatic navigation and found four `scrollIntoView({ behavior: 'smooth' })` calls that could bypass the existing CSS `prefers-reduced-motion` override.
- Added one motion-aware scroll helper and routed map, saved-city and overview jumps through it; normal users keep smooth scrolling while reduced-motion users get instant scrolling.
- Added focused unit coverage for both media-query states.
- Validation: lint, type-check, 96/96 frontend tests, production build and all 81 generated city pages pass.

## 2026-08-28 17:21 TRT — document language synchronization

- Found that switching Hava81 to English updated visible copy and weather request language but left the root document at `<html lang="tr">`, giving assistive technology the wrong page language.
- Synchronized `document.documentElement.lang` with the persisted UI language and strengthened the existing language-switch integration test to assert the DOM contract.
- Validation: targeted App integration 5/5, type-check, lint, production build and all 81 generated city pages pass.

## 2026-08-28 17:25 TRT — fatal error privacy hardening

- Reviewed the top-level render failure surface and found raw JavaScript error messages were exposed directly in the production UI. Lazy-chunk, browser, or implementation errors can contain technical internals that do not help end users.
- Kept errors available to the existing ErrorBoundary logging path but replaced the user-visible fatal copy with the localized generic recovery message.
- Validation: lint, type-check, 96/96 frontend tests, production build and all 81 generated city pages pass.


## 2026-08-28 17:38 TRT — activity selector accessibility

- Audited the Activity Planner toggle cluster and found its localized `aria-label` attached to a generic `div` without an accessibility role, so the group name was not reliably represented in the accessibility tree.
- Added `role="group"` while preserving the existing localized group label and individual `aria-pressed` toggle states.
- Validation after rebasing onto current main: lint, type-check and 96/96 frontend tests pass. Production build also passes with all 81 generated city pages.


## 2026-08-28 17:40 TRT — quick guidance accessibility

- Found the Daily Plan umbrella/wind/air quick-guidance cluster had a localized `aria-label` on a generic container without a semantic role.
- Added an explicit accessibility grouping role without changing decision data or visual presentation.
- Validation: lint, type-check and 96/96 frontend tests pass.


## 2026-08-28 17:46 TRT — default error-boundary privacy hardening

- Found the reusable ErrorBoundary default fallback still exposed `error.message`, even though App's custom fatal fallback had already been hardened.
- Removed technical details from the default visible surface, added an alert role, and added regression coverage proving raw error text is absent while component diagnostics remain available through `componentDidCatch` / `onError`.
- Validation: lint, type-check, 97/97 frontend tests, production build with all 81 generated city pages, dependency audit 0 vulnerabilities, and `git diff --check` pass.


## 2026-08-28 modeled UV/window semantics checkpoint

- Production review at ~16:50 TRT exposed a trust problem: the primary decision surface rendered `UV indeksi 6.3` like a current reading even though the backend field is the modeled maximum over a future window. The same section was titled `Sıradaki değişim` while mixing timed forecast changes, UV maxima and an outdoor-window suggestion.
- Renamed the frontend contract to `uvIndexMax`, labeled UV and pollen as next-24-hour modeled maxima, renamed the mixed action section to `Plan için öne çıkanlar` / `Planning signals`, and added complete Turkish/English action translations so English mode no longer falls back to Turkish defaults.
- Aligned UV categories with WHO guidance: added the missing Extreme 11+ band and applies sun-protection guidance from the Moderate band (UVI 3) upward without calling Moderate values “high”. Added boundary/component/i18n regression coverage.
- Local gates after rebasing onto main with provider-resilience tests: lint, type-check and targeted decision/context/app integration tests pass. The branch is intentionally held from release until the API next-24-hour timestamp window is made timezone-safe; labeling an imprecise window as exact would undermine the trust correction.


## 2026-08-28 17:34 TRT — timezone-safe API blue-green promotion

- Built the API candidate containing the timezone-safe Open-Meteo rolling-window fix and validated it on port 4001 before production traffic: live/ready 200 with `Cache-Control: no-store`, provider circuit closed, production-origin CORS allowed, zero restarts, five geographically varied city current-weather checks passed, İzmir marine context returned attributed modeled data, İstanbul→Ankara route returned five corridor segments, and the too-short route guard still returned 400.
- The correctness probe was decisive: the old 4002 API reported İstanbul `uvIndexMax=6.3`, while the GMT-safe 4001 canary reported `5.95` for the same rolling next-24-hour request, matching a direct GMT provider-window check.
- Promoted the exact validated image `sha256:90792e2a1dcb1ef0379aa26c6ce8432c569ab6039470323e44428457540365e1` without rebuilding: public API traffic moved briefly to healthy 4001, the same image was recreated on 4002 and revalidated, then Nginx returned to 4002. Public readiness/CORS/context checks pass and 4002 has zero restarts.
- Restored the previous production image `sha256:984505bc7f11d156b2beda4c7f7b9c626c1e9921d17ca8e15249349822a39a1c` on port 4001 after promotion so the normal topology is preserved: production 4002, immediate rollback 4001. `/var/lib/hava81/current-api-port` is 4002 and `previous-api-port` is 4001.

## 2026-08-28 17:39 TRT — modeled-context frontend release gate

- After the timezone-safe API was promoted and document-language synchronization landed on main, rebased the modeled-context UI correction onto the combined baseline.
- Final local gates pass: lint, type-check, 99/99 frontend tests, production dependency audit 0 vulnerabilities, production build with all 81 city pages, plus a desktop browser regression proving a persisted English session declares `html[lang=en]`, renders `Planning signals`, and contains no Turkish fallback phrases in the decision list.

## 2026-08-28 17:52 TRT — service-worker update freshness

- Measured public production and confirmed `sw.js` is served with `Cache-Control: max-age=600`.
- Updated production service-worker registration to bypass the HTTP cache for worker update checks via `updateViaCache: 'none'`; this does not change weather/PWA data semantics and reduces stale worker risk after deploys.
- Validation: lint, type-check, 96/96 frontend tests, production build with all 81 generated city pages, targeted desktop browser PWA regression, dependency audit 0 vulnerabilities, and `git diff --check` pass.

## 2026-08-28 18:01 TRT — comparison collection semantics

- Audited the saved-city comparison surface and found it declared role=table / role=row despite rendering independent metric cards without table cells or column headers.
- Replaced the incomplete ARIA table contract with a named list/listitem structure that matches the visual/card information model, and added regression coverage.
- Validation: focused Compare/App integration 7/7, lint, type-check, full 97/97 frontend tests, production build with all 81 generated city pages, dependency audit 0 vulnerabilities, and git diff --check pass.


## 2026-08-28 18:22 TRT — error recovery form safety

- Audited reusable buttons for implicit form submission and found the ErrorBoundary retry control omitted an explicit button type.
- Set the recovery control to type=button so embedding the boundary inside a form cannot accidentally submit user data when retrying a render failure.
- Added a regression assertion for the button contract.


## 2026-08-28 17:55 TRT — PWA brand URL hardening

- Verified public production logo192.png, logo512.png, Apple touch icon and Hava81 favicon byte-match the branded assets on origin/main; the React icon observed in the old primary worktree was stale local state, not production.
- Renamed the installable raster icon URLs to Hava81-specific names while preserving the exact branded image bytes, eliminating scaffold-generic PWA asset URLs that can retain old cached identities.
- Added a manifest regression test that requires the branded PNG paths to exist and rejects legacy generic logo names. Validation after rebasing onto current main: lint, type-check, 98/98 frontend tests, production build with all 81 city pages, and git diff --check pass.
- CI browser coverage exposed one stale test fixture that still decoded the retired generic raster URLs. Updated the browser brand smoke to load the new Hava81-specific icon URLs; this was a test-contract failure, not a product image corruption. Targeted desktop Playwright branding coverage now passes.

## 2026-08-28 — maskable PWA icon safe-zone hardening

- Audited the newly branded install icons against the current Web App Manifest maskable-icon contract. The ordinary 512px artwork was still declared `any maskable`, but pixel measurement put non-background artwork at a maximum radius of 207.9px while the guaranteed 40% safe-zone radius is 204.8px; platforms were therefore allowed to clip meaningful outer artwork.
- Added a dedicated padded `hava81-maskable-512.png` plus editable SVG source, changed ordinary SVG/192/512 icons to purpose `any`, and reserved purpose `maskable` for the padded 512px asset. The new icon's measured content radius is 145.75px, safely inside the 204.8px boundary.
- Strengthened unit manifest coverage so only the dedicated asset may claim `maskable`, and extended the existing desktop branding browser regression to decode the new PNG and calculate its content radius from canvas pixels against the 40% safe-zone limit.
- Validation so far: targeted branding tests 2/2, lint, type-check, full frontend suite 102/102 with bounded workers, production build with all 81 city pages, production dependency audit 0 vulnerabilities, and git diff --check. Browser CI remains the final release gate.

## 2026-08-28 — runtime title language synchronization

- Audited the persisted English path after fixing `html[lang]` and found the browser tab still rendered the hard-coded Turkish `${city} hava durumu — Hava81` title.
- Added localized city document-title strings and made the runtime title react to the active language, while leaving deterministic static province SEO metadata unchanged. Extended both App integration coverage and the existing desktop English Playwright flow to require `İstanbul weather — Hava81` in English mode.
- Validation: targeted App integration 5/5, lint and type-check pass. Under current host contention the default fully parallel full suite hit one unrelated 5s timeout; rerunning the complete suite with bounded workers passed 101/101, followed by production build with all 81 generated city pages and production dependency audit with 0 vulnerabilities. Browser CI remains the final release gate.
