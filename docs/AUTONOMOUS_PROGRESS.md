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


## 2026-08-28 20:00 TRT — privacy branch rebased cleanly after transfer repair

- Rebuilt PR #70 from its final intended diff on current main `577b73f9`, discarding the corrupted intermediate Git-object transfer history from the working branch rather than replaying it. Current-weather raw errors are sanitized at `useWeather`; route provider failures use localized recovery copy; App integration coverage injects a secret upstream string and requires it to stay out of the DOM.
- The prior CI transfer failure was traced to misuse of GitHub blob encoding, not product code. HTTPS repo-owner push authentication is now verified and is the preferred path for future branch publication.
- Combined validation on current main: lint/type-check passed; complete serial frontend suite 108/108; production build generated all 81 city pages; production dependency audit found 0 vulnerabilities; `git diff --check` clean.

## 2026-08-28 19:54 TRT — commute target-window clarity

- Audited the newly merged Çıkış planı after-hours semantics. `buildCommutePlan` intentionally selects the next leave/return pair, so a morning routine opened in the evening targets tomorrow; the verdict previously omitted the target weekday and could be misread as today's guidance.
- Added a localized planned-window line directly above the preparation verdict using the city's provider timezone offset. The component regression now freezes an evening Friday case and requires `Cmt 08:30 → Cmt 18:00`, proving the rollover is visible rather than implicit.
- Validation: commute component/domain focused coverage passes; lint and type-check pass; production build generated all 81 city pages; production dependency audit found 0 vulnerabilities; `git diff --check` clean. Full CI/browser gates remain required before merge.

## 2026-08-28 20:04 TRT — alert opt-out recovery on current main

- Rebuilt the alert recovery change on current main `577b73f9`: a user whose Hava81 alert preference is already enabled can still clear it after browser notification permission becomes denied; blocked browsers remain non-clickable for new opt-ins.
- Regression coverage requires local opt-out to clear `hava81-alerts-v1` without calling `requestPermission`, then disables the control once the local preference is off and permission remains blocked.
- Combined validation: lint/type-check passed; complete serial frontend suite 107/107; production build generated all 81 city pages; production dependency audit found 0 vulnerabilities; `git diff --check` clean.

## 2026-08-28 20:28 TRT — commute verdict live-region accessibility

- Audited the interactive Çıkış planı with assistive-technology semantics. Changing leave/return times updates the preparation verdict immediately, but the result container was not a live region, so screen-reader users could miss the newly computed umbrella/risk decision.
- Exposed the bounded verdict as an atomic polite status region while leaving inputs, forecast semantics, thresholds, weather data, and visual styling unchanged. Added component regression coverage for the status/live/atomic contract and decision copy.
- Validation on main `a8863a7e`: focused commute component 1/1; lint and type-check pass; complete serial frontend suite 108/108; production build generated all 81 city pages; production dependency audit found 0 vulnerabilities; `git diff --check` clean.

## 2026-08-28 20:46 TRT — commute forecast-coverage clarity

- Found a misleading empty state in the routine-first Çıkış planı: after both leave/return times were selected, `buildCommutePlan` could still return no plan when forecast windows were too far away, but the UI continued telling the user to select both times.
- Split the state so incomplete input still asks for both times, while complete input with insufficient forecast coverage explicitly says that no sufficiently close forecast is available yet and that the plan will calculate as coverage expands. Added Turkish/English copy and regression coverage.
- Validation on `origin/main` 9bf06a4: focused commute tests 2/2; lint; type-check; full frontend suite 110/110 with bounded workers; production build with all 81 city pages; production dependency audit 0 vulnerabilities; `git diff --check` clean.
- Operational maintenance in the same run: production observer was healthy on API port 4002 and latest main CI was green; root disk pressure was reduced from 93% to 91% by removing only rebuildable `node_modules` caches from two already-merged Hava81 worktrees. Running containers, volumes, production image and rollback image were untouched.

## 2026-08-28 20:50 TRT — map disclosure relationship

- Audited the lower Environment Rail map control and found it exposed `aria-expanded` but did not identify the region it expands, unlike the primary header map control.
- Added `aria-controls="weather-map-region"` so assistive technology can associate the disclosure button with the lazy map panel, plus a focused component regression.
- Validation on `origin/main` 9bf06a4: focused Environment Rail test 1/1; lint; type-check; full frontend suite 110/110 with bounded workers; production build with all 81 city pages; `git diff --check` clean.

## 2026-08-28 20:58 TRT — route decision live announcement

- Audited the asynchronous Rota havası result flow and found that a completed corridor decision appeared visually after the check button resolved but was not announced as a result to screen-reader users.
- Exposed the completed route result as one atomic polite status region so the score, corridor summary and guidance are announced without moving focus. Existing provider-error alert behavior remains unchanged.
- Validation on main `bc2b296`: focused route tests 2/2; lint; type-check; full frontend suite 111/111 with bounded workers; production build with all 81 city pages; production dependency audit 0 vulnerabilities; `git diff --check` clean.

## 2026-08-28 21:44 TRT — real hourly forecast display ready for PR

- Added a dedicated Open-Meteo hourly provider and `/api/v1/weather/hourly` endpoint with one-hour cadence metadata, 48-hour normalized backend coverage, cache reuse, attribution/source metadata, and provider-level tests.
- The Forecast Atlas now upgrades to the next 24 true hourly slots when that source is available, while the existing OpenWeather three-hour forecast remains the decision-engine baseline and immediate UI fallback. A slow or failing optional hourly request no longer blocks the baseline forecast; the Atlas upgrades asynchronously if/when hourly data arrives.
- Added Turkish/English hourly copy and source attribution, plus API/frontend integration and browser coverage for the 24-hour display and provider-failure fallback.
- Rebased cleanly onto main `12595290` after PR #76 merged. Final combined gates: lint, frontend type-check, full serial frontend suite, API type-check/test/build, production build with 81 city pages, production dependency audits, `git diff --check`, and full Playwright smoke (21 applicable passed, 30 viewport-intentional skips) all pass.

## 2026-08-28 21:55 TRT — real-hourly production promotion and live verification

- Merged PR #77 at exact head `d366bf34777353257d025c08cc6270842039d71f`; main merge commit `79004827e54dc60261a7c7f44aee9d1964dc895b` passed CI/CD run #251 including frontend/API quality, production build, browser flows, Lighthouse, Docker and Pages deployment.
- Built the API candidate once from exact main and validated image `sha256:8466ebd90f686bc2ec202810331f2f44e36c2fce10472fe9182e47b24f654ed8` on 4001: readiness/CORS/current/forecast/context/route probes passed, route returned five corridor segments, restart count stayed zero, and the hourly endpoint returned 48 one-hour Open-Meteo slots with explicit attribution.
- Public traffic was briefly switched to the healthy canary for external verification, then the exact same validated image was promoted to 4002 without rebuilding. Production is back on normal port 4002; direct/public hourly checks return 48 Open-Meteo points and readiness is healthy with zero restarts.
- Restored previous production image `sha256:90792e2a1dcb1ef0379aa26c6ce8432c569ab6039470323e44428457540365e1` on 4001 as immediate rollback. Observer subsequently reports production healthy, Nginx 4002 and no issues.
- Live 390×844 production browser smoke on `/istanbul/` verified the visible `Saatlik tahmin · sonraki 24 saat` heading, exactly 24 hourly columns, the Open-Meteo attribution link, İstanbul as the sole H1, and zero page errors.

## 2026-08-28 22:01 TRT — share-copy live announcement

- The Gün planı share control already changed its visible label to `Kopyalandı` after clipboard fallback, but screen-reader users received no explicit asynchronous status announcement.
- Added a visually hidden atomic polite status that announces successful copy while leaving focus on the share button. No weather/share payload semantics or visual layout changed.
- Validation on main `79004827`: focused DailyPlanPanel coverage 1/1, lint, type-check, complete serial frontend suite, production build with all 81 city pages, production dependency audit 0 vulnerabilities and `git diff --check` all pass.

## 2026-08-28 23:34 TRT — Hava81 Score v2 explainable decision model

- Replaced the old cliff-based Hava81 deductions with continuous suitability curves. Thermal risk now prefers apparent temperature and humidity-aware heat/cold behavior; precipitation probability is separated from precipitation amount; sustained wind and gusts are distinct; AQI, UV, visibility, WMO severe-weather codes, and bounded compound-risk penalties can contribute independently.
- Expanded the true-hourly Open-Meteo adapter to request and normalize apparent temperature, relative humidity, precipitation amount, wind gusts, visibility, UV index, and WMO weather code while keeping optional enrichment nullable so missing fields never make the core forecast unusable. A live İstanbul provider probe confirmed all requested hourly fields are currently returned together.
- Changed daily aggregation from a fixed number of forecast rows to an elapsed-time weighted next-12-hour window with downside weighting. One-hour and three-hour representations of the same scenario are regression-tested to remain materially aligned. Score bands are intentionally stricter: 90+ excellent, 75–89 good, 55–74 caution, below 55 difficult.
- Upgraded the decision engine to the richer one-hour series when available while preserving OpenWeather three-hour data as the immediate/failure fallback. Decision/routine data now retains 48 hourly slots; the visual Forecast Atlas remains capped at 24 columns. This fixes next-day commute windows that could previously fall outside the frontend's truncated 24-hour decision coverage.
- Aligned activity scoring, commute scoring, city comparison, decision copy, and API route-weather scoring with the same continuous-risk philosophy. The Gün planı now exposes dominant approximate factor impacts plus data-coverage confidence instead of presenting a bare opaque number.
- Calibration probes on live provider data produced plausible current bands across İstanbul, Ankara, İzmir, Şanlıurfa and Erzurum; synthetic probes separately exercised humid heat, drizzle-vs-material rain, gusts, UV, low visibility, poor air and hail/thunderstorm combinations.
- Final local gates before rebase: frontend lint/type-check pass; full frontend suite 126/126; API type-check/build and 22/22 API tests pass; production frontend build generated all 81 city pages; frontend/API production dependency audits report 0 vulnerabilities; git diff --check clean; full Playwright smoke on isolated port 4192 passed 21 applicable tests with 30 intentional viewport skips and 0 failures. The isolated port avoids an unrelated Postify preview already using 4173.


## 2026-08-29 00:18 TRT — Open-Meteo commercial-endpoint readiness

- Re-verified Open-Meteo's current terms before changing provider wiring: the free hosted API is limited to non-commercial use, while paid plans use customer-prefixed hosts plus an `apikey` with otherwise compatible request semantics.
- Added server-only configuration for forecast, air-quality and marine Open-Meteo base URLs plus an optional API key. Defaults remain the existing free endpoints, so current non-commercial production behavior does not change.
- Added regression coverage proving both hourly forecast and context services preserve their request semantics when switched to paid customer hosts and attach the key only server-side.
- Updated the Oracle environment template with an explicit monetization gate: before subscriptions, advertising or other commercial use, configure the paid customer hosts and secret key. No credential was added to the repository or frontend.
- Validation: API type-check passed; API suite 24/24; API build passed; production API dependency audit found 0 vulnerabilities; `git diff --check` clean.

## 2026-08-29 — decision clarity and personal time-window pass

- Replaced the misleading current-provider `temp_min/temp_max` rail with the actual daily-forecast high/low. Until daily forecast data is available the rail shows no invented daily range.
- Removed repeated visible `0%` precipitation noise from hourly, daily, and decision timeline rows while preserving accessible zero-precipitation meaning.
- Added a persisted activity time range. When both bounds are selected, activity score and best-time selection are recomputed only inside that local-clock window; unfiltered plans retain the 12-hour horizon. Activity cards now state whether the score is 12-hour or range-specific, show the best window's feels-like/rain/wind conditions, and disclose concise activity-specific scoring criteria.
- Expanded Çıkış planı from umbrella-first copy into multi-factor preparation guidance. Rain, feels-like heat/cold, effective wind/gust and air quality can become the primary advice, and temperature sensitivity changes heat/cold thresholds.
- New regressions cover daily-range source semantics, zero-rain visual suppression, selected activity-window scoring/coverage, persisted range UI, and non-rain commute preparation. Full frontend suite passes 133/133; API suite passes 22/22; lint/type-check, production build, production dependency audits, diff-check, and full Playwright smoke (21 applicable passed / 30 intentional viewport skips) are green before rebase.

## 2026-08-29 00:28 TRT — route departures use Türkiye wall-clock time

- Audited the Türkiye-only route-weather workflow from a non-Türkiye-browser perspective and found `datetime-local` departures were previously interpreted in the visitor device timezone. The same visible `09:00` could therefore be sent as a different UTC instant for users abroad, and segment ETAs were also rendered in device time.
- Added explicit `Europe/Istanbul` wall-clock conversion helpers. Route departure defaults/min/max, submitted departure instants, better-departure guidance and segment ETAs now consistently refer to Türkiye time regardless of browser timezone.
- Updated the departure label in Turkish and English to disclose `Türkiye saati` / `Türkiye time` so the fixed timezone is visible rather than implicit.
- Added conversion regression coverage, including midnight rollover (`2026-08-28T21:30Z` → `2026-08-29T00:30` Türkiye time), strict wall-clock parsing, and malformed-input rejection.
- Pre-rebase validation: lint/type-check passed; complete frontend suite 130/130; production dependency audit 0 vulnerabilities; production build generated all 81 city pages; targeted desktop route browser smoke passed; `git diff --check` clean. A combined rerun follows after rebasing onto latest main.

## 2026-08-29 00:33 TRT — Open-Meteo endpoint-readiness API production promotion

- Main CI for merge `bc3415a55cb820317e900cbb7221519615973e2b` completed successfully before production changes.
- Built the exact main API candidate on 4001 and validated readiness/no-store, production-origin CORS, five geographically varied current-weather requests, Open-Meteo context + marine data, 48-hour hourly forecast, route-weather output, zero restarts and clean error logs.
- Public traffic was moved briefly to the healthy 4001 canary, then the exact validated image `sha256:e705ad2a9f6591425fd8fe0cd43df18acffc4fd3d9edd99fe1721459fbf7fb48` was promoted to 4002 without rebuilding. Direct 4002 and public readiness/CORS/hourly checks passed; container health is healthy and restart count is zero.
- Nginx is back on 4002. The immediately previous production image `sha256:12f4187631d3d268958c1e597f12c112126d98072b74bb46050fbb34949c216d` is restored and ready on 4001 for one-switch rollback. `/var/lib/hava81/current-api-port` is 4002 and `previous-api-port` is 4001.

## 2026-08-29 00:34 TRT — route Türkiye-time combined gate

- Rebased the route wall-clock correction onto main `bc3415a5`, preserving both append-only autonomous-document checkpoints.
- Combined post-rebase validation passed: lint, type-check, complete frontend suite 130/130, production dependency audit 0 vulnerabilities, production build with all 81 city pages, targeted desktop route browser smoke, and `git diff --check`.


## 2026-08-29 00:57 TRT — activity time-range boundary correctness

- Audited the newly persisted activity clock filter for boundary cases. Overnight ranges were already modeled as wrap-around local-clock windows, but equal start/end values incorrectly matched every hour while the UI claimed the score was limited to that selected range.
- Changed equal start/end semantics to evaluate only that clock instant and added regression coverage for both `22:00–02:00` overnight wrapping and `18:00–18:00` single-clock filtering.
- Clarified Turkish/English helper copy so users know an earlier end crosses midnight and matching clocks target one time rather than a hidden full-day evaluation.
- Validation on main `806dac0a`: focused activity-plan 8/8, lint, type-check, full frontend suite 139/139, production build generated all 81 city pages, production dependency audit 0 vulnerabilities. Browser/CI remain release gates before merge.


## 2026-08-29 01:20 TRT — notification quiet-hours CI determinism and host recovery

- Main CI run #275 failed only in `DecisionAlertsPanel` coverage: the test expected notification delivery while the hosted runner happened to execute during Hava81’s real 22:00–07:00 local quiet-hours gate. Product behavior was correct; the test was wall-clock dependent.
- Decision Alerts coverage now freezes only `Date` at local noon by default, restores browser/global state after every case, and explicitly verifies that 23:00 suppresses delivery. This preserves the quiet-hours contract instead of weakening it for CI.
- Focused alert coverage passes 4/4. Bounded full validation on the same main base passes lint, type-check, complete frontend coverage with one worker, production build with all 81 city pages, dependency audit with 0 vulnerabilities, and `git diff --check`.
- Root disk pressure was reduced from 95% used / ~2.4 GiB free to 83% used / ~7.9 GiB free by removing only Docker images unused by every container plus rebuildable build cache. Active Hava81 production and rollback/canary containers/images remained healthy and untouched.
- Pending after this checkpoint: publish the CI-determinism hotfix PR; once its exact head is green, merge and verify main. Then rebase open PR #87 onto the recovered main and rerun combined gates before merge.


## 2026-08-29 00:49 TRT — Daily Plan explanation accessibility

- Audited generic elements carrying accessibility names and found the Daily Plan score-explanation cluster had `aria-label` on a plain `div`, so assistive technology was not guaranteed to receive that name as a group.
- Added `role="group"` and regression coverage requiring the localized explanation label to be exposed as the group's accessible name. Weather data, scoring, copy and visual styling are unchanged.
- Validation on main `4663ee5e`: focused DailyPlanPanel 2/2, lint, type-check, full frontend suite 134/134, production build with all 81 city pages, production dependency audit 0 vulnerabilities, full Playwright smoke 21 applicable passed / 30 intentional viewport skips, and `git diff --check` clean.
- Operationally, production readiness was rechecked directly and remained ready with the OpenWeather circuit closed on the intended 4002 topology. Root disk remained under pressure at that checkpoint; the later CI-determinism checkpoint records the subsequent safe disk recovery.

## 2026-08-29 02:55 TRT — slow-loading copy reflects observable state

- Audited the initial city loading state and found that a request lasting only three seconds was labeled as a server wake-up that could take 30–60 seconds.
- The production Oracle API is operated as an always-on service, and a slow request can also come from network or upstream-provider latency; the UI cannot truthfully diagnose a wake-up from elapsed time alone.
- Renamed the translation contract from `serverWaking` to `slowLoading` and replaced the claim with neutral Turkish/English copy stating only that weather data is taking longer than usual and that connection/provider delay may be involved.
- No timeout, retry, provider, score, or weather semantics changed. Validation: lint, type-check, App integration 6/6, production build with all 81 city pages, production dependency audit 0 vulnerabilities, and `git diff --check`.


## 2026-08-29 03:16 TRT — map label rebuilt on current main

- Rebuilt the stale map-label correction on current main `e196bfd4` rather than force-updating the older conflicted PR branch.
- The map eyebrow now says `Türkiye · İl haritası` / `Türkiye · Province map`, matching the province/city marker surface instead of implying meteorological station entities that are not rendered.
- Combined local validation on the current baseline passed: lint, type-check, complete frontend suite 141/141, production dependency audit 0 vulnerabilities, production build generated all 81 city pages, and host-side `git diff --check` was clean. Map tiles, coordinates, weather values and interactions are unchanged.

## 2026-08-29 03:17 TRT — comparison partial-failure state clarity

- Audited saved-city comparison failure behavior. `Promise.allSettled` correctly preserved successful cities, but failed cities disappeared silently; if every city failed, users received an empty comparison list with no explanation.
- Added bounded state tracking: partial failures keep successful city cards visible with a generic localized notice, while total failures show a localized comparison-unavailable state. Raw provider/internal exception text is never rendered.
- Added regressions for one-city failure and all-city failure, including injected secret upstream strings that must stay out of the DOM.
- Rebuilt onto current main after the map-label merge; combined validation is rerun before publication.

## 2026-08-29 03:32 TRT — local preference removals synchronize correctly

- Audited the shared `useLocalStorage` hook used by Hava81 preferences and found two removal-state gaps: `removeValue()` reset React state but left the functional-update ref stale, and `storage` events with `newValue: null` were ignored, so a removal from another consumer/tab could leave stale UI state.
- Removal now resets both React state and the in-memory ref, emits the same synthetic storage synchronization event as writes, and treats a native cross-tab removal event as a reset to the configured initial value.
- Added regressions for cross-consumer removal, immediate functional update after removal, and native cross-tab deletion. No persisted key names or product defaults changed.
- Validation on main `4bdbcb6`: lint, type-check, focused hook coverage 3/3 and production build with all 81 city pages pass; full CI remains the publication gate.

## 2026-08-29 03:30 TRT — modeled-context attribution rebuilt on current main

- Rebuilt the modeled UV/dust/pollen/marine attribution improvement on current main after the map-label merge rather than mutating the stale green branch.
- The source line links Open-Meteo and CC BY 4.0 separately and states that Hava81 summarizes the provider output; non-Open-Meteo attribution remains unchanged.
- Weather/model values, 24-hour windows, marine data, health wording and decision logic are unchanged. Combined validation is rerun before publication.

## 2026-08-29 04:54 TRT — comparison refresh clears stale cards

- Audited comparison refresh state and found that changing language/profile/selected cities could leave the previous rows visible while the replacement request was still loading.
- New comparison loads now clear old rows before entering the loading state, preventing stale city cards from being presented as if they belonged to the new selection. Partial-success and total-failure behavior remain unchanged.
- Added regression coverage that loads two cities, changes the comparison context, holds the replacement request pending, and requires the old city headings to disappear while the loading status is visible.

## 2026-08-29 05:05 TRT — async reset invalidates late weather responses

- Audited the city-to-current-location handoff and found that `useAsync.reset()` cleared visible state without invalidating an already-running call. A slow city request could therefore resolve after a successful location request and repopulate the higher-priority city slot with stale data.
- `useAsync.reset()` now advances the call generation before clearing state. The underlying request may still finish, but its result/error/success callback can no longer mutate state after reset.
- Added a product regression that starts a delayed İzmir request, switches to current-location Ankara, then resolves İzmir late and requires Ankara to remain authoritative.

## 2026-08-29 04:59 TRT — route refresh invalidates stale departure results

- Audited the route-weather interaction after a successful corridor check and found that changing the departure time left the old result visible; starting a replacement request also kept the prior corridor on screen until the new request completed.
- Departure/origin/destination edits now invalidate the old result immediately and advance a request generation; every new route request clears the previous result before entering the loading state. Late responses from an invalidated request are ignored, so guidance for an old departure instant cannot reappear under new inputs.
- Route calculation, Türkiye-time parsing, provider data, scores and error semantics are unchanged. Added regressions for input invalidation, in-flight refresh clearing, and a late stale response.

## 2026-08-29 05:18 TRT — daylight rail uses location timezone

- Audited the Environment Rail from a visitor outside Türkiye and found sunset was formatted in the browser/device timezone even though the weather payload carries the city timezone offset. The primary decision field already formats provider timestamps in the location timezone, so the two surfaces could disagree.
- Sunset display now applies `weather.meta.timezoneOffsetSeconds` and formats the shifted instant in UTC, matching the established location-time contract without changing the underlying sunrise/sunset instants or daylight-duration calculation.
- Added regression coverage for İstanbul: provider sunset `16:30Z` with `+03:00` offset must render as `19:30`, not the runner/device `16:30`. Focused Environment Rail coverage 2/2, lint, type-check and `git diff --check` pass.

## 2026-08-29 06:52 TRT — notification quiet hours follow the weather location

- Audited Decision Alerts after earlier timezone fixes and found quiet hours still used the visitor device clock. A user abroad could therefore receive a Hava81 alert during 22:00–07:00 in the active Turkish province, or have a daytime alert suppressed by their own local night.
- Quiet-hour evaluation now shifts the current instant by `weather.meta.timezoneOffsetSeconds` and reads the resulting location hour in UTC, matching the established provider-location time contract without changing alert thresholds, candidates, permission behavior or delivery transport.
- Added a deterministic regression proving `19:30Z` is treated as `22:30` for İstanbul (+03:00) and suppresses delivery.


## 2026-08-29 07:46 TRT — localized static bootstrap cache identity rebuilt on current main

- Rebuilt the stale PR #125 behavior on current main `ec20a287` instead of mutating its outdated non-mergeable branch.
- Static city pages now compare a fresh cached provider city label through the same ASCII/slug identity used by generated province routes, so an English cache such as `Istanbul` matches the canonical `/istanbul/` page for `İstanbul` and suppresses the otherwise duplicate pre-app current-weather request.
- Added a desktop production-page browser regression that persists English settings plus a fresh `Istanbul` cache and requires zero `/weather/current` bootstrap requests while the city view still renders.
- Targeted validation passed: production build with all 81 generated city pages, the new desktop Playwright regression, lint, type-check, and `git diff --check`.
- The first combined browser run exposed an unrelated nondeterministic existing smoke selector: two independently attributed Open-Meteo surfaces can both be present by the time the assertion runs, making a page-global provider-link lookup ambiguous. Scoped the assertion to the hourly forecast section rather than weakening attribution coverage; the previously failing tablet case now passes. Complete frontend/API suites, audits and build had already passed; full browser coverage is rerun before publication.


## 2026-08-29 08:55 TRT — province SEO copy matches current forecast capability

- Re-applied the small province metadata correction on current main after the original green PR became non-mergeable due to concurrent main progress.
- Generated city meta description, Open Graph/Twitter description and structured WebPage description now use capability-level `saatlik ve günlük tahmin` instead of stale provider-cadence wording `3 saatlik tahmin`. Runtime weather, scoring, providers and UI behavior are unchanged.
- Release gate: regenerate all 81 city pages and require Istanbul metadata to contain the new wording with no stale phrase, then lint, type-check, diff-check and exact-head CI before merge.


## 2026-08-29 09:22 TRT — alert storage failures are non-fatal and fail closed

- Re-applied the Decision Alerts storage hardening on current main while the context-provenance branch validates independently.
- Alert storage access is now best-effort throughout: unreadable dedupe storage suppresses delivery rather than risking duplicate spam; opt-in becomes active only after its preference is persisted; opt-out still disables the current session if removal is blocked.
- Added regressions for dedupe read SecurityError and opt-in persistence failure, plus explicit mock restoration so storage spies cannot leak between tests. Weather data, candidate thresholds, quiet hours and permission behavior are unchanged.

## 2026-08-29 09:43 TRT — decision live-region noise reduction

- Audited the primary WeatherDecisionField live-region semantics and found the entire decision/current-conditions surface was `aria-live="polite"` even though its freshness label updates every minute.
- Removed the broad live-region contract so a minute-by-minute freshness tick cannot cause the whole weather/decision surface to be re-announced. Existing bounded interaction-result status regions (commute, route, share feedback) remain unchanged.
- Added a focused regression requiring the primary decision section to retain its heading relationship without becoming a live region. Focused test 2/2, type-check, lint and `git diff --check` pass; full gates run before publication.

## 2026-08-29 10:46 TRT — per-activity score impact transparency

- Audited the Activity Planner after its general “Skorlar neden farklı?” explanation and found the remaining trust gap: each card still exposed only the final score, so users could not see how much that activity's own criteria changed the same underlying weather suitability.
- Preserved the existing weather score and activity thresholds, but now retain the weather-only baseline for each evaluated slot and aggregate it with the exact same cadence/downside weighting as the final activity score. Each plan exposes `baselineScore` and the exact bounded `activityImpact = final - baseline`.
- Activity cards now show the activity-criteria impact as a signed point value in Turkish/English, directly explaining why walking, running, picnic, motorcycle, children and laundry can differ for the same hours. No provider data, thresholds, safety language or recommendation bands changed.
- Focused domain/component coverage 9/9, type-check and `git diff --check` pass. Full release gates remain required before publication.

## 2026-08-29 09:46 TRT — persisted settings normalization

- Audited `user-settings` recovery and found syntactically valid but partial/invalid JSON objects were trusted as a complete `UserSettings` value by the generic local-storage hook.
- Added a SettingsProvider-specific deserializer that allowlists supported temperature, wind, theme and language values, preserves valid persisted fields, fills missing/invalid fields from defaults, and ignores unexpected fields.
- Added regressions for mixed-invalid legacy/corrupt settings and a complete valid English/dark/imperial profile. Focused tests 2/2, type-check, lint and `git diff --check` pass; full gates run before publication.
- Follow-up in the same settings branch: aligned the provider's initial language with the already-initialized i18n language. This preserves the read-only legacy `app-language` migration path for old installs when canonical `user-settings` is absent or has an invalid language, preventing UI/API/document-language divergence. Added 2 focused migration regressions; combined settings coverage 4/4 passes.
- Post-rebase combined validation exposed a narrow code-split timing assumption in the saved-city navigation integration test: the lazy ComparePanel can resolve after Testing Library's default 1 s query window even though the panel renders correctly. Current `main` reproduces the same flow faster; the rebased settings module graph made the implicit timing dependency visible. The existing project decision permits a 3 s wait only for lazy UI boundaries, so this single assertion now uses that bounded window; no global timeout or product behavior changed.


## 2026-08-29 11:15 TRT — persisted settings normalization rebuilt on current main

- Open PR #140 was green but no longer mergeable after concurrent main progress, so its single intended commit was replayed onto isolated branch `automation/hava81-run8-1107` from current main `21ee3e55`; only append-only progress/decision logs conflicted, and both the current Activity Planner checkpoint and the settings checkpoints were preserved.
- Persisted `user-settings` remains treated as untrusted input: supported enum fields are allowlisted, invalid/missing fields fall back safely, unexpected fields are ignored, and legacy language startup follows i18n's already-validated language without writing the legacy key.
- Local gates on the rebuilt branch: focused Settings/App coverage 10/10, lint, type-check, complete frontend suite 177/177, production build generated all 81 city pages, production dependency audit found 0 vulnerabilities, and `git diff --check` passed. Exact-head PR CI remains the merge gate.

### 2026-08-29 13:26 TRT — Hourly horizon truth + continuity hardening
- Merged PR #151 at `2c6ffeb0b7d5f00556c9d33951ec11ac41c99b95`: users can choose 6/12/24-hour real-hourly display windows; main run #397 completed successfully and production root/city/API smoke checks returned HTTP 200 with API on port 4002.
- Merged PR #153 at `df73628c25b761b2826524c696f89bbc27bb3885`: partial Open-Meteo responses now label the actual available horizon and do not offer unavailable range controls. Exact PR head `5d6eeed85260cd32ca199babbb09375dab80a1e7` passed CI run #399; local validation passed 197/197 frontend tests, 22 applicable Playwright flows, 25 API tests after the follow-up continuity test, lint/type-check, and 81-city production build.
- Current independent branch/worktree: `automation/hava81-hourly-contiguity` at `/home/ubuntu/hava81-hourly-contiguity`, based on main merge `df73628c...`.
- Current change: reject optional one-hour enrichment if normalization would create a gap between required hourly rows; the existing three-hour baseline remains the safe fallback. API type-check and 25/25 API tests pass.
- Main run #400 for `df73628c...` is still in progress at this checkpoint; frontend quality, API test/build, production build and Lighthouse jobs are already green, browser-flow job is the remaining gate.
- Next action: push/open the continuity PR, verify exact-head CI, then merge only after run #400 remains green/production smoke is healthy. After deploy, prioritize measured first-viewport/mobile polish or another bounded data-truth/reliability issue.

### 2026-08-29 13:36 TRT — freshness contract audit
- Live production inspection found server cache TTLs of 300s current / 1800s forecast+hourly / 900s AQI while response metadata advertised 60s / 300s / 120s. This could make UI freshness state disagree with the cache actually serving the payload.
- Branch `automation/hava81-hourly-stale-guard` now carries the configured cache TTL through `CacheResult.freshForSeconds` and uses it in weather/context metadata; HTTP Cache-Control remains independently bounded.
- Added regression coverage with deliberately non-default TTLs. API type-check, 26/26 API tests, dependency audit (0 vulnerabilities), and diff-check pass.
- Exact main `1b0bd1484530791979df1020e8719685960272f1` passed main CI #402. Its API candidate is being built independently on the inactive 4001 canary before any production traffic change.

## 2026-08-29 15:49 TRT — CI bound, storage-loop fix, disk recovery, cache hardening

- Observer state file remains outside the SentinelX read allowlist, so this run used the freshness-updated /var/log/hava81-worker/events.jsonl plus direct GitHub verification before release actions. The observer reported production healthy on API port 4002.
- PR #168 (38628b51b44d5e22c7d6cd3aa8a58b8625998962) passed exact-head CI and merged as main 406693240fea47a3891c95868c1a4912c6be0db6; main run #428 completed successfully. The frontend quality job now has a 15-minute timeout so a genuine runner/test loop cannot consume a hosted runner indefinitely.
- Rebuilt the no-op localStorage synchronization guard on current main rather than mutating its stale branch. Replacement PR #169 head c32f9206c3cce7e19b0be44aa99593e763d46986 passed exact-head CI run #429 and merged as main f9db24cff13fad7dd85a2797dde25b5c3d7a4ab5. Referentially unchanged functional updates no longer write or broadcast synthetic storage events; actual changes/removals retain their existing synchronization behavior.
- Production smoke after #168 was healthy: root 200, /istanbul/ 200, API readiness 200. Main run #430 for f9db24c... is currently in progress and must remain green before treating #169 as fully deployed.
- Operations: root filesystem was at 94% (3.0 GB free), matching observer host_disk_ok=false. Removed only reproducible node_modules directories from five stale Hava81 worktrees, preserving every worktree, branch and source change. Root usage fell to 90% with 5.0 GB free; the next observer sample switched host_disk_ok=true.
- Current independent worktree: /home/ubuntu/hava81-auto-run10-1538, branch automation/hava81-run10-1538, head a05eab4f99e278c02b34e3355a386b23392e2206, rebased onto main f9db24c.... It rejects impossible persisted current-weather values (percentage bounds, non-negative physical fields, wind direction and coordinate ranges) instead of restoring corrupt cache data.
- Combined local gates on the rebased branch pass: frontend type-check, lint, 218/218 tests, 81-city production build, git diff --check, and production dependency audit with 0 vulnerabilities. Next action: push/open the replacement cache-domain PR, close stale #166 only after replacement exists, verify exact-head CI, merge when green, then verify its main pipeline and production smoke.
- Prioritized next queue after cache-domain hardening: continue disk/worktree hygiene without deleting unmerged source; inspect first-viewport/mobile evidence for a bounded UX improvement; expand persisted-data boundary validation where finite-but-impossible values can still cross cache/storage boundaries; keep MGM warning integration deferred until an official freshness-aware machine-readable source is verified.

## 2026-08-29 15:59 TRT — cache release healthy; parallel test and observer hardening queued

- PR #170 merged as main 27f23ab01e9ec32f2e1fade95a14e7498cce8370 after exact-head CI #431 passed. Main pipeline #433 completed successfully, including API, frontend quality, production build, Lighthouse and browser gates; post-deploy production smoke returned 200 for root, /istanbul/ and API readiness. Observer collected at 12:58:50Z reports production healthy on port 4002 and root disk healthy at 89.1% used / 4.9 GiB free.
- PR #171 adds a validated HAVA81_PLAYWRIGHT_PORT override while retaining 4173 as the default, so concurrent worktrees can run browser gates without killing or patching another preview server. Its original head 4c19baf... passed CI #432; after #170 became production-green it was rebased onto current main, full type-check/lint/build and Playwright gates were rerun on isolated port 4196 (22 applicable passed, 32 intentional project skips), and it was force-updated with an explicit lease to head b62c3dd23097a841b0eb19ff63bb3bede5d90314. Re-verify exact-head CI before merge.
- Observer status hardening is prepared on branch automation/hava81-run10-observer-disk. The status helper now prints host disk ok/used-percent/free-GiB directly; the modified helper successfully read live state and reported ok=True, used_pct=89.1, free_gib=4.9. Python compile, observer unit tests (4/4) and diff check pass. Current branch head before this checkpoint commit: 9b95eb6e93ff2eef6e90c5d582585c512d88e170.
- Next actions: open the observer-status PR; merge #171 only after its rebased exact-head CI is green; verify the resulting main pipeline and production smoke; then rebase the observer-status PR onto that production-green main and repeat its small gates before merge. Continue safe disk hygiene and do not delete source/worktrees with unmerged changes.

## 2026-08-29 16:49 TRT — chunk recovery loop guard in storage-restricted browsers

- Audited deploy-time lazy-chunk recovery and found the URL recovery marker was removed during boot before the `vite:preloadError` handler could use it. When `sessionStorage` is blocked (privacy/sandbox policy), a second missing chunk could therefore trigger another reload instead of honoring the intended one-minute recovery bound.
- Boot now captures the recovery timestamp before cleaning the public URL and uses that timestamp as the fallback previous-attempt guard whenever session storage is unavailable. Normal browsers still use the existing sessionStorage marker; clean canonical URLs are preserved after boot.
- Added desktop browser coverage that blocks sessionStorage, forces the ForecastAtlas chunk to remain unavailable, and requires exactly one recovery navigation rather than a reload loop.
- Rebased onto main `29fb98f3` after the isolated-Playwright-port merge. Combined gates pass: frontend type-check, lint, complete frontend suite 218/218, 81-city production build, production dependency audit 0 vulnerabilities, git diff check, targeted storage-restricted recovery browser regression, and full Playwright suite on isolated port 4197 (23 applicable passed / 34 intentional project skips).

## 2026-08-29 17:00 TRT — in-memory weather request cache rejects future timestamps

- Audited the frontend HTTP cache under client clock corrections. Cache validity previously accepted every negative age because `Date.now() - timestamp < ttl`, so if the device clock moved backward after a response was cached, that response could remain reusable longer than the configured TTL.
- Cache validity now requires a non-negative age as well as age below TTL. A backward clock jump therefore fails closed to a fresh BFF request instead of extending stale weather data.
- Added deterministic transport coverage that caches a response, moves the client clock backward one minute, and requires a second network request. Provider data, API cache TTLs and normal cache-hit behavior are unchanged.

## 2026-08-29 17:05 TRT — future provider timestamps no longer claim fresh data

- Audited the visible freshness label separately from cache validity. A provider/server `fetchedAt` more than one minute ahead of the client clock was previously clamped to age zero and rendered as “şimdi güncellendi,” even though that freshness claim could not be established.
- Reused the existing one-minute clock-skew tolerance already applied to persisted weather timestamps: beyond that tolerance, visible freshness becomes `Güncellik bilinmiyor` / its localized equivalent rather than pretending the payload was just refreshed. Small normal clock skew still renders as current; real old data keeps the existing stale treatment.
- Added deterministic component coverage for a two-minute future timestamp. No weather values, provider semantics, TTLs or safety guidance changed.

## 2026-08-29 17:14 TRT — modeled-context future timestamp guard

- After merging PR #176, audited the secondary Open-Meteo context provenance surface for the same clock-skew truthfulness class. It could display a provider fetch clock time materially in the future even though the primary weather surface now treats that condition as unknown freshness.
- ContextSignalsPanel now suppresses only fetch times more than one minute ahead of the client clock, while preserving Open-Meteo, CC BY 4.0 and Hava81-transformation attribution. Small clock skew and normal past timestamps remain visible.
- Local gates: focused ContextSignalsPanel 5/5, frontend type-check, lint, full frontend suite 221/221, 81-city production build, production dependency audit 0 vulnerabilities, and diff-check all pass.
- Main merge b4969a719bd4cc5ca86ea5f1292e2df936efa264 entered pipeline #444 while this independent branch was prepared; re-verify current observer/GitHub state immediately before merge.

## 2026-08-29 17:21 TRT — isolated Lighthouse port

- A local Lighthouse run correctly refused to reuse occupied port 4173 while another Hava81 workstream owned that listener. Rather than terminating the unrelated preview, added `HAVA81_LIGHTHOUSE_PORT` using the same bounded 1024–65535 override pattern as Playwright; default behavior remains 4173.
- This keeps concurrent autonomous worktrees independent and preserves the existing fail-closed occupied-port check. Validation uses an isolated port plus the normal frontend quality gates before publication.
- Follow-up validation exposed an orphaned Vite preview after a successful Lighthouse audit because terminating the npm wrapper did not reliably terminate its child preview. The runner now spawns Vite directly with Node, so the existing `finally` termination targets the actual preview process and releases the isolated port after every audit.
- Validation on the isolated branch: Lighthouse on port 4199 scored performance 96 / accessibility 100 / best-practices 100 / SEO 100 and the port was confirmed released after completion; `node --check`, type-check, lint, 223/223 frontend tests, production build, production dependency audit 0 vulnerabilities, and diff-check pass.

## 2026-08-29 18:52 TRT — persisted temperature cache bounds

- Continued the persisted-data boundary audit on current main `52e37c83` in an isolated worktree after merging green route-departure PR #183.
- The weather-cache deserializer already rejected non-finite temperature values, but finite values such as `999°C` or `-999°C` could still cross the localStorage trust boundary and be rendered/scored until cache expiry.
- Cached current, feels-like, minimum and maximum temperatures must now remain within a deliberately broad `-100..100°C` sanity envelope; values outside it invalidate only the persisted cache and trigger the normal fresh BFF request. Live provider/API contracts are unchanged.
- Added table-driven regressions for impossible finite values in all four temperature fields. After locating the server's managed Node runtime outside the default SSH PATH, focused `useWeather` coverage passes 29/29, frontend type-check and lint pass, and `git diff --check` is clean. Exact-head GitHub CI remains the full build/browser release gate.
## 2026-08-29 18:57 TRT — upstream OpenWeather domain validation

- While persisted-temperature PR #187 validates independently, audited the server-side OpenWeather trust boundary on a separate worktree from stable main `52e37c83`.
- The adapter already rejected malformed shapes and invalid precipitation probability, but several finite-yet-impossible domain values could pass schema parsing. Added unit-independent bounds for latitude/longitude, humidity, positive pressure, non-negative wind speed/gust and visibility, 0–360° wind direction, 0–100% cloud cover, and the existing globally valid timezone-offset envelope.
- These checks reject impossible upstream payloads as `INVALID_PROVIDER_RESPONSE`; no weather value is synthesized and no temperature-unit assumptions were added to the provider schema.
- Added adapter regressions across eight invalid domains. API 27/27 tests, API type-check/build, production dependency audit (0 vulnerabilities), and `git diff --check` pass. Exact-head CI plus blue-green canary validation remain required before any production API promotion.

## 2026-08-29 19:23 TRT — current-weather timestamp fail-closed boundary

- PR #190 was rebuilt on current main after #188 moved the base, passed exact-head CI run #473, and merged as main `56c9b175433aa7ab05740b2d0bb15be41e14ad8f`. Main run #474 has API, frontend quality, production build and Lighthouse green; browser flows remain the final deployment gate at this checkpoint.
- PR #189 was independently rebuilt on #188's production-green main as exact head `7beefa8730f26fb5be1180813b57a5e01bf7526e`; local API validation passes 29/29 plus type-check/build and production audit with 0 vulnerabilities. Its exact-head CI #475 is in progress and it must be rebased again after #190 production is verified healthy before merge/canary promotion.
- Audited browser-side current-weather revival while those pipelines run. Invalid serialized sunrise, sunset, observation timestamp or provider `fetchedAt` previously became `Invalid Date` objects and could reach UI/decision/persistence code even though forecast revival now fails closed.
- Current-weather revival now rejects those malformed BFF timestamps with the same retryable API-data failure semantics used at other browser trust boundaries. Focused weather-service coverage is 38/38; type-check, lint, complete frontend suite 249/249, 81-city production build, production dependency audit (0 vulnerabilities), and diff-check pass.
- Current worktree/branch: `/home/ubuntu/hava81-auto-run11-persisted-cache-clock-1925`, `automation/hava81-run11-current-dates-1925`, based on main `56c9b175...`. Next action is to re-verify #474 production health, rebase/rebuild #189 onto that green main, complete API canary validation, and in parallel publish this bounded current-date guard through exact-head CI.

- Added adapter regressions across eight invalid domains. API 27/27 tests, API type-check/build, production dependency audit (0 vulnerabilities), and `git diff --check` pass. Exact-head CI plus blue-green canary validation remain required before any production API promotion.

## 2026-08-29 19:47 TRT — API traffic-switch rollback hardening

- Rebased the isolated traffic-switch worktree onto production-green main `611624fc32ba0aa348e66c99e2b78ad28037de3e` without touching the unrelated primary worktree.
- `switch-api-traffic.sh` now requires the requested local slot to pass repeated bounded readiness checks before nginx is mutated. Nginx validation/reload failures restore the exact pre-switch configuration, and repeated public-readiness failure after reload automatically restores and reloads the previous target.
- State markers are still updated only after public readiness succeeds, so a failed switch cannot falsely record the target as active.
- Live topology was inspected without switching traffic: port 4002 ready, port 4001 ready, public readiness ready, and nginx remains on 4002. `bash -n` and `git diff --check` pass. Exact-head CI remains the publication gate.

- Current worktree/branch: `/home/ubuntu/hava81-auto-run11-persisted-cache-clock-1925`, `automation/hava81-run11-current-dates-1925`, based on main `56c9b175...`. Next action is to re-verify #474 production health, rebase/rebuild #189 onto that green main, complete API canary validation, and in parallel publish this bounded current-date guard through exact-head CI.

## 2026-08-29 19:50 TRT — frontend current-weather domain boundary

- Continued the BFF trust-boundary audit on an isolated worktree from main `6dd8e7dad8e05e0aff067f1093ea8d14ad05302c` while its production pipeline runs independently.
- Current-weather payload revival now rejects non-finite temperatures and unit-independent impossible domains before they can reach rendering/scoring: humidity/cloud percentages, positive pressure, non-negative visibility/wind speed, wind direction, global coordinates, provider identity, timezone offset and freshness window.
- Temperature values are checked only for finiteness here because the BFF client supports metric/imperial/standard units; no Celsius-specific bounds are applied at this transport boundary. Persisted metric cache retains its separate broad Celsius sanity envelope.
- Focused weather-service coverage is 53/53; frontend type-check, lint and diff-check pass. Full frontend/build/audit gates follow before publication.

## 2026-08-29 20:00 TRT — restore mobile current-location access

- Static mobile-layout audit found the header’s current-location action was hidden below 768px while the bottom navigation exposes only Today, Map and Saved. The geolocation capability therefore had no reachable mobile control despite its tested implementation.
- Restored the location action in the compact header while continuing to hide the map and compare header controls that already have mobile navigation alternatives.
- Added a real-browser regression at the 390px mobile project and an additional 320px viewport assertion: the location action stays visible and the header does not horizontally overflow at either width.
- Target browser test passes; type-check, lint, 81-city production build and diff-check pass. Exact-head CI remains required before merge.

- Current worktree/branch at the 19:54 TRT checkpoint was `/home/ubuntu/hava81-auto-run11-persisted-cache-clock-1925`, `automation/hava81-run11-current-dates-1925`, based on main `56c9b175...`; that checkpoint queued production re-verification, #189 rebase/canary, and the current-date guard.

## 2026-08-29 19:54 TRT — modeled context physical-domain guard

- Audited the Open-Meteo context service because UV/pollen/dust and marine values feed user decisions but its provider schemas still accepted finite negative physical values and out-of-range wave direction.
- Next-24-hour UV/dust/pollen maxima now ignore negative provider rows rather than turning physically impossible model output into Hava81 guidance. If every in-window value is invalid, that signal remains unavailable.
- Optional marine context now accepts only non-negative wave height, positive wave period and 0–360° wave direction. Invalid marine payloads retain the existing graceful degradation to air-only context; sea-surface temperature remains unrestricted by sign because sub-zero values can be physically valid.
- API gates pass: 31/31 tests, type-check, build, production dependency audit 0 vulnerabilities and diff-check. Exact-head CI plus inactive-slot canary validation are required before production merge because this changes API normalization behavior.

## 2026-08-29 20:58 TRT — air-quality physical-domain guard

- Audited OpenWeather air-quality normalization after the current/forecast/context domain hardening and found pollutant concentration fields still accepted negative finite values even though they are surfaced as measured concentration context.
- Changed all eight upstream pollutant concentration fields (CO, NO, NO₂, O₃, SO₂, PM2.5, PM10, NH₃) to fail closed on negative values rather than carrying physically impossible concentrations into Hava81 health-context presentation.
- Added adapter regression coverage for every pollutant field. Local API gates pass: 32/32 tests, type-check, production build, production dependency audit 0 vulnerabilities, and diff-check.
- This is prepared on an isolated branch while the modeled-context canary/CI sequence proceeds; it requires exact-head CI and the normal API canary gate before production merge.

## 2026-08-29 21:03 TRT — deploy-scoped offline shell cache

- Audited PWA update semantics and found the service worker still used a fixed `hava81-shell-v2` namespace, so successful future deploys could leave an old root/manifest offline fallback cached indefinitely even though online navigation is network-first.
- Added a build-time service-worker stamp: each production build derives a deterministic 12-character namespace from the generated root HTML, manifest, and hashed asset filenames, then replaces a required placeholder in `dist/sw.js`. The build fails closed if the placeholder is missing or survives stamping.
- Old shell namespaces are still deleted on activation, but forced tab navigation is now limited to the legacy v1/v2 migration. Subsequent build-to-build cache rotation no longer forces already-open tabs to reload.
- Local gates pass: lint, type-check, full 264-test coverage suite, targeted service-worker tests, 81-city production build, stamped-cache assertion, production dependency audit 0 vulnerabilities, and diff-check.

## 2026-08-29 21:15 TRT — browser context/AQI trust boundary

- After PR #197 reached production-green main `21d8223b18254a41fba02393b4ad068be912f103`, continued the data-truth audit in isolated worktree `/home/ubuntu/hava81-auto-run11-next-2110` on `automation/hava81-run11-next-2110`.
- The browser BFF boundary now validates modeled-context provenance/timestamps, non-negative UV/dust/pollen values, marine wave domains, AQI scale, non-negative PM2.5/PM10/O₃, provider identity and bounded freshness metadata before these values can reach rendering or decision logic.
- Invalid context/AQI data fails closed with the existing retryable API-data semantics; no weather or health value is synthesized or corrected into a plausible replacement.
- Focused weather-service coverage passes 69/69. Combined gates pass: frontend type-check, lint, full frontend tests, 81-city production build, production dependency audit with 0 vulnerabilities, and `git diff --check`.

## 2026-08-29 21:30 TRT — equal daily high/low presentation

- Daily forecast cards no longer render duplicated values such as `24° / 24°` when high and low round to the same displayed temperature; they show a single temperature with a dedicated accessible label.
- Distinct rounded extrema still keep the familiar high/low pair. Turkish and English labels were added explicitly rather than inferring meaning from punctuation.
- Rebuilt this bounded change onto current main after the original PR became conflict-stale; focused and combined gates are rerun on the rebuilt exact head before merge.

## 2026-08-29 late run — browser forecast coverage

- Added browser coverage that explicitly waits for the lazy Forecast Atlas and verifies hourly, daily and scrollable forecast surfaces across mobile, tablet and desktop projects.
- Refreshed E2E current/forecast fixture timestamps from fixed 28 August values to run-relative times so fallback forecast tests do not silently expire as wall-clock time advances.
- The existing three-hour fallback contract remains asserted separately when the high-resolution hourly endpoint fails.
- Full Playwright smoke after the change: 28 passed, 38 intentional project-specific skips; focused lazy/fallback matrix: 6/6 passed.

## 2026-08-30 02:14 TRT — activity guidance unit consistency

- Audited personalized activity guidance after decision-message unit support landed and found activity comfort criteria plus temperature-sensitivity help still hard-coded Celsius even when the user selected Fahrenheit.
- Activity cards now render their established comfort thresholds in the selected temperature unit, and the 3°C sensitivity offset is converted as a temperature delta (5°F in imperial) rather than applying an absolute-temperature conversion.
- Rebased onto main `ff233272d33372f450e0a48788f605e6085048cd` after concurrent merges #232/#233, preserving their unit-message and forecast-readability changes. Focused ActivityPlanner + WeatherDecisionField coverage passes 14/14; type-check, lint, 81-city production build, production dependency audit (0 vulnerabilities), and diff-check pass.
- Host disk pressure crossed the observer threshold during isolated dependency installation. This worktree's `node_modules`/`dist` were removed immediately after validation; production stayed healthy. No production merge is permitted until exact-head CI and a fresh production/host check are green.

## 2026-08-30 02:20 TRT — single source for activity comfort thresholds

- Followed the unit-consistency merge by removing the duplicated Celsius comfort ranges from the ActivityPlanner presentation layer.
- The UI now reads the same exported comfort-range constants owned by the activity scoring domain, so future scoring-threshold changes cannot silently leave the explanation copy stale.
- Focused activity domain + ActivityPlanner coverage passes 17/17; type-check, lint, 81-city production build, and diff-check pass on main `4fafa13f06198a162ba304a1a58117897b6d20c2`.

## 2026-08-30 03:17 TRT — recent province labels rebuilt on current main

- Rebuilt the stale/non-mergeable recent-search canonicalization change on current `main` after PR #239 and #242 merged, instead of force-updating the old branch.
- Recent province history now maps localized/ASCII provider labels through the canonical 81-province identity before persistence/display, so `Istanbul` and `İstanbul` deduplicate and render as the canonical `İstanbul` label.
- Removed the obsolete identity set left unused by the canonical map conversion; lint is clean with no new warnings.
- Combined validation on `847327c`: focused useWeather 31/31, full frontend 349/349, TypeScript, ESLint, production build with 81 city pages, production dependency audit 0 vulnerabilities, and `git diff --check` all pass.
## 2026-08-30 03:20 TRT — future current-weather cache metadata fails closed

- Audited persisted current-weather cache revival independently while canonical recent-search CI runs.
- Cache parsing already bounded the storage timestamp, but accepted valid ISO `data.timestamp` / `meta.fetchedAt` values arbitrarily far in the future. Such corrupted values could surface impossible freshness/current-time metadata even when the cache envelope itself looked fresh.
- Current-weather observation timestamp and fetch timestamp now share the existing one-minute future-skew tolerance and fail closed beyond it; sunrise/sunset remain exempt because future sunset is physically valid.
- Focused useWeather coverage passes 32/32 including separate future observation/fetch regressions; TypeScript, ESLint, production build with 81 city pages, production dependency audit 0 vulnerabilities and `git diff --check` pass.

## 2026-08-30 03:24 TRT — run handoff checkpoint

- PR #239 merged as `fb5ec63f27af2aaaf13a7e1c5830af23db66f5d3`; its Daily Plan temperature timeline now honors the selected unit.
- PR #242 merged as `847327c688b60607b5e3dd3c9ad55a05533ff2e4`; persisted current-weather caches with reversed min/max fail closed. Main CI run #600 (`33282837989`) completed successfully.
- Stale PR #241 was replaced by current-main PR #243, whose exact head `d7ea1535983aa760199487b8032d152e9271e990` passed CI run #601 and merged as main `b4ada33587dbdc55a98b997c2ae4ce0035aa5af8`.
- Main pipeline #603 (`33283105253`) for `b4ada335...` is in progress. Direct production smoke before merge: root 200, İstanbul 200, local 4002 `/api/v1/health/ready` 200/fresh, production-origin CORS exact, provider circuit closed, nginx still targets 4002.
- PR #244 is the active prepared workstream: branch `automation/hava81-cache-future-fields-0320` in `/home/ubuntu/hava81-auto-cache-future-fields-0320`. It was rebased onto `b4ada335...`; combined post-rebase gates pass 351/351 frontend tests, type-check, lint, 81-city build, production audit 0 vulnerabilities and diff-check. Rebase preserved both append-only checkpoints.
- Next action: push the rebased #244 head with an explicit lease against remote old head `6204cc9340a34f2ff719ed7adfa4e8259be4d997`, wait only for exact-head CI while continuing independent work, then directly re-verify production/main head/mergeability and merge #244 when green. After merge, remove this worktree `node_modules/dist` to reduce disk pressure; keep API topology on 4002/4001.

## 2026-08-30 03:49 TRT — mobile search focus restoration

- Merged PR #244 after direct exact-head (`46bb930f1337590e25ff1af2e5c2f0b122663902`), mergeability and green-CI verification; current main became `c1f5828d6662bdcc96fbfc7dce2dab526d141f9d`.
- Post-merge direct smoke: public root and canonical İstanbul return 200; local production API `127.0.0.1:4002/api/v1/health/ready` is ready with OpenWeather circuit closed; public `api.hava81.zekiakgul.dev` readiness is 200 and exact production-origin CORS is preserved. Main CI run `33283909108` is still in progress while independent work continues.
- Removed merged #244 worktree `node_modules`/`dist` artifacts; root filesystem remains about 91% used with ~4.5 GB free, inside but near the observer threshold.
- On isolated branch `automation/hava81-run12-a11y-focus` from current main, fixed keyboard focus loss when compact/mobile search is dismissed with Escape or the search toggle: focus now returns to the search toggle rather than falling back to the document body.
- Added integration coverage for open → input focus → Escape → toggle focus + collapsed state. Combined local gates pass: 352/352 frontend tests, TypeScript, ESLint, 81-city production build, production dependency audit 0 vulnerabilities, and `git diff --check`.
- Next action: commit/push this bounded branch, open PR, continue independent audit while exact-head CI runs; merge only after direct head/mergeability/production re-verification. Keep API topology on 4002/4001.

## 2026-08-30 03:53 TRT — local-storage cross-context isolation

- While PR #245 validates independently, audited shared local-storage synchronization in a separate worktree from production-green main `c1f5828d6662bdcc96fbfc7dce2dab526d141f9d`.
- `useLocalStorage` now recognizes native `localStorage.clear()` cross-context events (`key === null`) and resets each subscribed preference to its safe initial value instead of leaving an already-open tab stale.
- Same-key `sessionStorage` events are now ignored, preventing an unrelated storage area from overwriting local-storage-backed settings/favorites/profile state. Existing synthetic same-document synchronization remains supported because its storage area is intentionally unspecified.
- Added regression coverage for native key removal with an explicit local storage area, whole-localStorage clear, and same-key sessionStorage isolation.
- Combined local gates pass: 353/353 frontend tests, TypeScript, ESLint, 81-city production build, production dependency audit 0 vulnerabilities, and `git diff --check`.
- This branch remains independent while #245 exact-head Browser/Lighthouse checks run; after #245 merge it must be rebased onto current main with both append-only checkpoints preserved before final CI/merge.

## 2026-08-30 03:57 TRT — mobile search submit focus

- PR #245 passed exact-head CI, was re-verified against live production (root/İstanbul 200, API 4002 ready, provider circuit closed, exact CORS), then merged as main `89ff53e63e1b86c8ea3408c0fb28ae14d2f11d24`.
- In a new worktree from that main, followed the same compact-search focus path through successful submission. Previously `handleSubmit` only hid the mobile search region, leaving the focused input hidden and potentially keeping a mobile virtual keyboard active.
- Submission now uses the shared `closeSearch()` path: the input is blurred, compact search collapses, and focus returns to the visible search toggle before the weather request continues.
- Added integration coverage for open → focused input → Enter submit → collapsed search + restored toggle focus.
- Local combined gates pass: 353/353 frontend tests, TypeScript, ESLint, 81-city production build, production dependency audit 0 vulnerabilities, and `git diff --check`.
- PR #246 remains isolated and was rebased onto #245 main with append-only checkpoints preserved; its post-rebase combined gates pass 354/354 and exact-head CI is being re-established after lease-safe push.
- Next action: commit/push this submit-focus branch as its own PR; continue independent work while #246/#247 CI runs, merging strictly in current-main order after direct head/production verification.

## 2026-08-30 04:05 TRT — refresh stale weather on resume

- PR #246 passed exact-head CI and was merged as main `a1168e2a6616fd2e30e4da589424003141c042b5`; its main pipeline `33284545783` completed successfully. PR #247 was then rebased on that main, passed 355/355 local combined tests plus exact-head Browser/Lighthouse CI, and merged as main `700e6ec` after a fresh production/API/CORS check.
- Audited long-lived-tab freshness. Hava81 exposed a stale marker but did not refresh weather simply because a user returned to an old open tab, allowing the decision surface to remain outdated until another explicit action.
- On isolated branch `automation/hava81-run12-stale-resume` from `700e6ec`, added a visibility-resume refresh boundary: when the document becomes visible, only refresh if the last successful result is older than five minutes and no weather request is already running.
- Preserved acquisition semantics: city-search state refreshes the active city, while location-derived state reuses the location weather path rather than silently converting it to a city-mode request.
- Added regression coverage for both stale city resume and stale location resume. Focused useWeather suite passes 35/35; combined local gates pass 357/357 frontend tests, TypeScript, ESLint, 81-city production build, production dependency audit 0 vulnerabilities, and `git diff --check`.
- Next action: commit/push/open PR for the resume refresh, allow exact-head CI to run while continuing an independent audit, and merge only after direct head/mergeability/main-pipeline/production re-verification.

## 2026-08-30 04:14 TRT — respect bounded Retry-After on retryable BFF failures

- While the stale-resume PR validated independently, audited the frontend BFF transport retry path from stable main `700e6ec` and found retryable 408/5xx responses ignored an upstream `Retry-After` hint.
- Kept the existing deliberate no-retry policy for HTTP 429 so client retries cannot amplify rate-limit pressure. For status codes Hava81 already retries, a valid delta-seconds or HTTP-date `Retry-After` now raises the retry delay above exponential backoff, capped at the existing 30-second maximum; missing/invalid hints retain current backoff behavior.
- Added regression coverage proving a 503 with `Retry-After: 2` does not retry before two seconds and then succeeds. Local combined gates pass: 356/356 frontend tests, TypeScript, ESLint, 81-city production build, production dependency audit 0 vulnerabilities, and `git diff --check`.
- PR #248 became green and mergeable during this work; direct local-4002/public readiness, CORS, root and İstanbul checks were fresh/healthy immediately before merge, then #248 merged as main `ae581e3b8053d9ac34e8a8df98d2fe030c22372a`. Main pipeline `33285196407` is in progress while this retry branch is prepared for rebase.

## 2026-08-30 04:21 TRT — offline guard for stale-resume refresh

- Followed the newly merged stale-resume refresh with an offline safety audit. Without a connectivity guard, returning to a stale tab while `navigator.onLine === false` immediately started a network refresh; the async layer clears current data on execute, so usable stale weather could be replaced by a connection error even though no network request could succeed.
- Resume refresh now skips while the browser reports offline, leaving the existing stale decision surface visible instead of degrading it. No weather value is altered or synthesized.
- Added regression coverage proving a stale visible tab remains on its prior weather result, produces no extra current-weather request, and exposes no new error while offline.
- Local gates on main `1d89e8ac2c78421b8b63b53308f25bc65e9173a4`: focused useWeather 36/36, full frontend 359/359, TypeScript, ESLint, 81-city production build, production dependency audit 0 vulnerabilities, and diff-check all pass.
- PR #249 merged after exact-head green CI and fresh production verification; current main is `1d89e8ac2c78421b8b63b53308f25bc65e9173a4`. Main pipeline `33285382627` is in progress while this offline-guard branch is prepared for PR/CI.

## 2026-08-30 04:26 TRT — refresh stale weather when connectivity returns

- Completed the offline-resume flow after PR #250: if a stale tab was preserved while offline and connectivity returned without another visibility transition, the app previously stayed stale until a manual action.
- The same bounded stale-refresh handler now listens for the browser `online` event as well as `visibilitychange`; all existing guards still apply (tab visible, data older than five minutes, browser online, no weather/location request already in flight), and city-vs-location acquisition mode remains unchanged.
- Added regression coverage for offline visibility resume followed by connectivity restoration: no request occurs while offline, then exactly one refresh occurs when the `online` event fires.
- Local gates on main `f6c7e7a85545d532e02c574a76a5b0b656ec0c0f`: focused useWeather 37/37, full frontend 360/360, TypeScript, ESLint, 81-city production build, production dependency audit 0 vulnerabilities, and diff-check all pass.
- PR #250 passed exact-head CI/Lighthouse/browser gates and merged after fresh root/İstanbul/local-4002/public-readiness/CORS verification. Main is `f6c7e7a85545d532e02c574a76a5b0b656ec0c0f`; its deployment pipeline is the next production checkpoint while this branch proceeds independently.

## 2026-08-30 04:28 TRT — Retry-After date/cap regression coverage

- Hardened regression coverage for the just-shipped bounded `Retry-After` parser while the connectivity-resume PR validates independently.
- Added an HTTP-date case proving a retryable 503 waits until the server-provided absolute retry time, plus an excessive 120-second delta case proving client delay remains capped at Hava81's existing 30-second retry maximum.
- This is test-only: no runtime/network behavior changed. Focused HTTP transport coverage is 8/8; combined frontend suite 361/361, TypeScript, ESLint, 81-city production build, production dependency audit 0 vulnerabilities, and diff-check pass on base `f6c7e7a85545d532e02c574a76a5b0b656ec0c0f`.

## 2026-08-30 04:44 TRT — bound frontend response-body reads by request timeout

- After PR #252 merged as main `44b656e1af3767155abcfbf678754ee9e298288e`, audited the frontend BFF transport deadline on a fresh isolated worktree. The timeout was cleared as soon as `fetch()` returned headers, leaving a stalled success/error JSON body able to hang indefinitely.
- Kept the existing per-request AbortController deadline active through `response.json()`. Aborted error-body reads now surface the established retryable timeout error instead of being mistaken for an HTTP response; ordinary malformed error JSON still degrades to the existing bounded HTTP error path.
- Added deterministic success-body and error-body stall regressions. Local gates pass: focused httpClient 10/10, full frontend 364/364, TypeScript, ESLint, 81-city production build, production dependency audit 0 vulnerabilities, and diff-check.

## 2026-08-30 04:50 TRT — city bootstrap rejects materially future cache clocks

- While PR #253 validated, audited generated city-entry bootstrap behavior independently. Its early weather prefetch skipped whenever the persisted cache age was less than five minutes, which also treated arbitrarily future corrupted timestamps as fresh even though the React cache boundary later rejects them.
- Generated city/root bootstrap now accepts at most the same one-minute future clock skew used by the application cache. Materially future timestamps therefore no longer suppress the early BFF prefetch; no weather value is corrected or fabricated.
- Pre-rebase gates pass: 81-city production build with generated Istanbul assertions (`cacheAge >= -60000` and `< 300000`), TypeScript, ESLint and diff-check. Branch was then rebased onto main `0ddad2c823370c87b44b298ddf12fcaa8fd6b1ed` after PR #253 merged; combined gates are rerun before push.

## 2026-08-30 04:55 TRT — align persisted pressure trust boundary with fresh weather

- While PR #254 validated, compared the persisted current-weather cache validator against `weatherService` and the OpenWeather provider schema. Fresh weather already requires pressure to be strictly positive, but persisted cache revival accepted zero via a generic non-negative check.
- Persisted pressure now rejects zero/non-finite values and falls back to a fresh BFF request instead of rendering physically impossible cached pressure. No replacement pressure is synthesized.
- Added zero-pressure cache regression; focused useWeather passes 38/38. After PR #254 merged as main `5dcea418b0c35f11a6a05b11934a0b5b17b5c54f`, this isolated branch rebased onto that exact main; combined gates are rerun before push.

## 2026-08-30 04:59 TRT — fresh BFF current-weather timestamps fail closed when materially future

- Continued the fresh-vs-persisted weather trust-boundary audit while PR #255 validated. Persisted cache already rejected materially future observation/provider-fetch timestamps, but a fresh BFF current-weather response only checked that those dates parsed successfully.
- Fresh current weather now applies the same one-minute future-clock tolerance to `current.timestamp` and `current.meta.fetchedAt`; sunrise/sunset are intentionally not constrained because future astronomical events are valid. Invalid fresh data raises the existing retryable API-data error rather than being corrected or replaced with fabricated values.
- Added separate future observation/provider-fetch regressions; focused weatherService passes 98/98. PR #255 then merged as main `a13ae87b1ef9af304043cd641244a52e8013a16e`; this branch rebased onto that exact main and combined gates are rerun before push.

## 2026-08-30 05:49 TRT — forecast metadata future-clock guard prepared

- PR #256 merged cleanly as main `de80d90e53c660cb77fae1d223861d5a4e9d0ebd` after exact-head CI success and fresh production readiness/CORS/nginx checks.
- Continued the same trust-boundary audit independently while main CI #633 was queued. Fresh forecast/hourly metadata previously parsed `fetchedAt` but accepted materially future provider-fetch timestamps.
- Added a shared one-minute future-skew guard for `forecast.meta.fetchedAt` and `hourly.meta.fetchedAt`; future forecast item times remain valid forecast data and are intentionally not constrained. Added separate regressions for both endpoints.
- Local gates: focused weatherService 100/100, full frontend 369/369, type-check, lint, 81-city production build, and production dependency audit with 0 vulnerabilities all pass.

## 2026-08-30 05:52 TRT — modeled context future-clock guard prepared

- While PR #257 CI ran, continued independently from `main` `de80d90e53c660cb77fae1d223861d5a4e9d0ebd`; after #257 merged and main #636 passed, this work was rebased onto `5218005e859236514695ab34c0931988f295c46b`, preserving both append-only checkpoints.
- Modeled context `fetchedAt` and optional marine `observedAt` reject timestamps more than one minute in the future. These are observation/fetch timestamps, so unlike forecast item times they are not allowed to point materially ahead.
- Pre-rebase gates passed: weatherService 100/100, full frontend 369/369, type-check, lint, 81-city production build, dependency audit 0 vulnerabilities. Combined gates are rerun on the rebased head before lease-protected push.

## 2026-08-30 06:10 TRT — air-quality future metadata guard rebuilt on current main

- Observer showed production healthy and PR #259 green but no longer mergeable against current main.
- Rebuilt the bounded air-quality `meta.fetchedAt` future-skew guard from exact current main on `automation/hava81-run11-air-quality-rebuild`, preserving the one-minute clock-skew tolerance and adding the focused regression.
- `git diff --check` passes. Local Node/npm tooling is not exposed in the current gateway shell, so JS gates are delegated to exact-head CI before any merge; no production change is authorized until CI is green and production is re-verified.

## 2026-08-30 06:24 TRT — cache-control freshness bounded by remaining server TTL

- While PR #260 validates independently, audited API response caching on exact current main. Weather routes emitted fixed 60/300/120-second `Cache-Control` values even when configured server TTLs were shorter, and cache HITs did not expose remaining entry lifetime.
- `MemoryTtlCache` now keeps the configured `freshForSeconds` contract while also reporting `cacheMaxAgeSeconds` from the actual remaining entry lifetime. Weather/context response headers clamp client max-age to that remaining lifetime, preventing downstream caches from retaining a response past the server cache's freshness window.
- Added deterministic cache-age regression plus configured-TTL header assertions. Local API gates pass: 37/37 tests, API type-check, API build, and diff-check. Temporary API `node_modules`/`dist` created for validation were removed immediately afterward; disk returned from 92% to 91%.

## 2026-08-30 07:48 TRT — deploy retry PR CI flake fixed deterministically

- Observer at 07:39 TRT reported production healthy: root/İstanbul/API readiness 200, exact production-origin CORS, OpenWeather circuit closed, nginx on production slot 4002, disk 90.9% used with ~4.1 GiB free. Main `89a82e69e1872c22061c21b5ceb0ce7ad9a6081b` had successful pipeline #651.
- PR #266 (`automation/hava81-deploy-hourly-retry`, head `5f01b769...`) failed API CI only because the configured-TTL header test asserted an exact `max-age=7`; the production cache intentionally reports remaining TTL and one second elapsed under CI, producing the safe `max-age=6` value.
- Replaced the wall-clock-sensitive exact header assertions with bounded contract assertions: Cache-Control must parse as public max-age, remain non-negative, and never exceed the configured server freshness. This preserves the key safety invariant without assuming zero execution time.
- Local gates on the PR head plus test fix: API 43/43, API type-check, API build, production API dependency audit 0 vulnerabilities, `bash -n deploy/oracle/deploy-api-blue-green.sh`, and `git diff --check` all pass. Live production was rechecked before publication and remained healthy on 4002.
- Next action: push this fast-forward fix onto PR #266 only if the remote head is still `5f01b769da485d58558438049825c236b61978be`; let exact-head CI run, continue an independent current-main workstream while it runs, then merge only after direct head/mergeability/production verification and green CI.

## 2026-08-30 07:52 TRT — serialize API deploy/rollback traffic operations

- PR #266 merged as main `017662e5dd4fd5c60bb535b8b9c865e257344ac9` after exact-head CI became fully green. Main pipeline #654 (`33293177708`) then completed successfully across frontend quality, API, production build, browser, Lighthouse, Docker and Pages deployment gates. Direct post-pipeline production checks remained healthy: root/İstanbul 200, local 4002 readiness `ready`, OpenWeather circuit closed, and exact production-origin CORS.
- Audited the Oracle deployment scripts while #654 ran and found they had no cross-process serialization. Two autonomous/manual deploy/rollback operations could read the same active state concurrently; `switch-api-traffic.sh` also reused fixed readiness files in `/tmp`, allowing probe output to collide across invocations.
- On `automation/hava81-deploy-lock-0750`, added one shared non-blocking `/var/lock/hava81-api-operation.lock` across deploy, rollback/direct switch, inherited by the deploy → switch child. Concurrent operations now fail before mutation. Traffic-switch readiness probes use per-invocation `mktemp` files with exit cleanup.
- Added `scripts/test-api-operation-lock.sh` and an API CI step that proves an uncontended PLAN_ONLY deploy succeeds while simultaneous deploy and direct traffic-switch attempts fail closed under a held operation lock. Local gates pass: deploy/switch/rollback/test-script `bash -n`, contention regression, and `git diff --check`.
- Production topology is intentionally unchanged by this work: nginx/current API remains 4002 and the validated 4001 slot remains available for rollback/canary. No deployment script was executed in mutation mode while validating the branch.
- Next action: push/open this branch, run exact-head CI, merge only after current-main/head/mergeability/fresh-production checks. While CI runs, continue independent product/accessibility/reliability audit from production-green main. Prioritized queue: mobile first-viewport evidence using CI browser tooling rather than the host Snap Chromium (blocked by its service cgroup); persisted/transport trust boundaries only where a concrete domain gap remains; safe disk hygiene; MGM warning integration remains deferred without a verified official freshness-aware machine-readable source.
## 2026-08-30 07:56 TRT — rollback target state fails closed

- While PR #267 validates independently, audited `rollback-api.sh` from production-green main `017662e5dd4fd5c60bb535b8b9c865e257344ac9`. With no explicit target and no readable previous-port marker, the script silently defaulted to 4001. That could turn a missing/corrupt rollback-state incident into an unintended traffic change if 4001 happened to be merely ready rather than the known previous deployment.
- On isolated branch `automation/hava81-rollback-state-0754`, rollback now requires either a readable recorded previous port or an explicit target and validates the target against the supported 4000/4001/4002 set before invoking the traffic switch. Missing or malformed state fails before nginx mutation; no guessed fallback remains.
- Added `scripts/test-api-rollback-target.sh` plus an API CI step proving missing and malformed previous state both fail closed. Local gates pass: rollback/test-script `bash -n`, targeted regression, and `git diff --check`.
- This branch does not mutate production and remains separate from pending PR #267. After #267 reaches production-green main, rebase this branch, preserve both append-only checkpoints, combine the CI steps/locking changes, rerun the shell regressions, and publish with an explicit lease.
## 2026-08-30 08:02 TRT — make observer API deployment drift runtime-aware

- The live observer reported `api_deployment.pending=true` after main `017662e5dd4fd5c60bb535b8b9c865e257344ac9`, even though GitHub comparison from deployed revision `203ff286...` showed only `apps/api/test/app.test.ts`, `deploy/oracle/deploy-api-blue-green.sh`, and autonomous docs changed. The API Dockerfile copies `package*.json`, `tsconfig.json`, and `src`; the test change cannot alter the production container. Deploying solely to clear this signal would cause an unnecessary 4002→4001 traffic switch.
- On isolated `automation/hava81-observer-runtime-diff-0800`, replaced whole-`apps/api` tree drift with one GitHub deployed-revision→main comparison. Only `apps/api/src/**`, API Docker/package/TypeScript build inputs, `.dockerignore`, and the Oracle compose file count as runtime drift. Test/docs/deploy-tool-only changes no longer set `api_deploy_pending`.
- Fail-closed semantics remain: compare failure, non-ancestor/diverged deployed revisions, or a potentially truncated 300-file comparison with no discovered runtime path marks deployment state unknown instead of current. Runtime changes are included in the observer state signature for meaningful change events.
- Observer tests now cover identical revisions, test-only drift, runtime source drift, Docker/package/compose drift, missing deployed revision, failed compare, diverged history, and comparison truncation. `17/17` observer tests, Python compile, and `git diff --check` pass. Running the candidate collector against the real deployed/main revisions returns `known=true`, `pending=false`, `runtime_changed_files=[]`, correcting the current false positive without touching production traffic.
- This observer branch remains independent from PR #267/#268. After the preceding deploy-hardening PR sequence reaches green main, rebase, preserve append-only checkpoints, rerun observer tests, then merge/deploy the observer code itself and validate one fresh timer sample before considering the false pending resolved operationally.


## 2026-08-30 09:18 TRT — forecast upstream epoch/timezone trust boundary

- PR #279 passed exact-head CI, was directly re-verified mergeable at head `29dda54237de0c8da55197428b2f7cc50357291c`, production remained healthy on API slot 4002, and it was squash-merged as main `b57204978c57011120888b7abb0b57656ab17126`. Main pipeline #680 is running independently.
- On isolated branch `automation/hava81-api-domain-audit-0914` from exact new main, audited the OpenWeather forecast provider schema. Forecast item epochs previously accepted negative/fractional values, and forecast-city timezone offsets were unbounded even though the equivalent current-weather boundary already constrains provider offsets.
- Forecast epochs now require non-negative integer Unix seconds, and provider timezone offsets use the same -12h..+14h bounds as current weather. Invalid upstream data fails closed before date normalization; no forecast value is corrected or fabricated.
- Added focused regressions for negative/fractional epochs and impossible timezone offsets. `git diff --check` passes. The gateway root shell currently has no Node/npm binary, so executable JS/API gates must run in exact-head CI before merge; no production change is authorized without green CI and fresh production verification.

## 2026-08-30 09:20 TRT — reject empty upstream forecast payloads

- While PR #280 validates independently, audited the same OpenWeather forecast boundary from untouched main `b57204978c57011120888b7abb0b57656ab17126`. The schema accepted an empty forecast list even though downstream normalization assumes provider forecast rows to produce hourly/daily guidance.
- The provider boundary now requires at least one forecast item and fails closed on an empty upstream payload instead of returning a structurally successful but unusable forecast. Added a focused regression. `git diff --check` passes; executable API gates remain delegated to exact-head CI because Node/npm is not exposed in the gateway root shell.

## 2026-08-30 09:22 TRT — current-weather sunrise/sunset epoch shape

- While PR #280/#281 validate independently, audited current-weather astronomical timestamps from untouched main `b57204978c57011120888b7abb0b57656ab17126`. Sunrise/sunset values were accepted as arbitrary numbers even though they are Unix-second epochs and are converted directly to ISO timestamps downstream.
- Sunrise and sunset now require non-negative integer epochs. They are intentionally not future-time bounded because the next sunset/sunrise can legitimately lie ahead of the observation time. Added focused negative/fractional regressions; no astronomical value is synthesized or corrected. `git diff --check` passes.


## 2026-08-30 09:27 TRT — continuation checkpoint after PR #281

- PR #281 exact rebased head `2097914bb16532a4e95ad30157be3bc2e4a8f17b` passed CI #685, was directly re-verified mergeable, and production was immediately rechecked: API slot 4002 readiness 200/fresh with OpenWeather circuit closed, exact production-origin CORS, public root 200, and İstanbul 200. It was squash-merged as main `4d01fc656fa988434a5f95b5c5f9adfdf916f05f`; main run #687 is in progress independently.
- PR #282 remote head was read as `2bddba93e805c7166fa61aed1932a4a195f9a3b7` before rebasing this isolated branch onto exact current main. Append-only conflicts were resolved by preserving the valid #280, #281, and #282 checkpoints/decisions. The code delta remains only non-negative integer sunrise/sunset epoch validation plus its focused regression.
- PR #283 remains independent on accessibility/i18n head `bea633adbac501dc64dd34ffa4c72e6bfc07ee3e`; it must not be merged without exact-head green CI and, after main moves, a clean rebase plus rerun.
- Next queue: push this rebased #282 with explicit lease, wait for exact-head CI while continuing independent work; merge only after #687 is green and fresh production is healthy; then rebase #283 onto current main preserving all append-only checkpoints and rerun exact-head gates.


## 2026-08-30 09:35 TRT — fix real 320px dashboard clipping

- Ran the live production İstanbul page through real Chromium/CDP at 390x844 and 320x700. At 390px the document fit the viewport. At 320px the document itself was clipped to 320px but `.atlas-dashboard` resolved its implicit single grid track to ~337px, pushing `.atlas-dashboard__primary`, the decision field, and forecast card to ~349px from the viewport origin; the right edge was visually clipped rather than horizontally scrollable.
- Root cause: the outer dashboard had no explicit narrow-screen grid track, so its implicit auto track honored the primary child's min-content width. Added `grid-template-columns: minmax(0, 1fr)` to the dashboard and `min-width: 0` to the primary wrapper. Live CSS injection against production before changing source reduced the primary/decision/forecast right edge from ~349px to 308px inside the 320px viewport, while keeping document scroll width at 320px.
- Added a Playwright regression that runs only in the mobile project, switches to a 320x700 viewport, renders İstanbul with the existing deterministic API fixtures, and asserts both document width and primary-card bounds remain inside the viewport. `git diff --check` passes; exact-head CI/Browser gates remain required before merge.

## 2026-08-30 09:57 TRT — deploy API runtime drift and remove exact-equal daily range duplication

- Direct GitHub/observer comparison confirmed the pending API drift was real runtime input (`apps/api/src/providers/openweather/schemas.ts`), not an observer false positive. From clean main `38ce2a24bc43965322b14cfed5301e1a6266c390`, blue-green deployment first validated 4001 (readiness contract plus 48-point Open-Meteo hourly smoke), switched traffic, then deployed the same revision to 4002 and switched back so production remains on 4002 with 4001 ready as rollback/canary. Fresh public root/İstanbul/readiness/CORS checks passed and a forced observer sample reported `api_deploy_pending=false` with production healthy.
- PR #286 rebuilt the conflicted service-worker active-cache change on current main, passed exact-head CI #694, and merged as main `d96ae563764343d06a1ea6a7ea07d9e953df553b`. PR #287 accessibility localization was rebuilt on that new main at head `9b9f74fd6d386373dd928b5d91789ffa895f7183`; exact-head CI #697 is the required merge gate.
- Independent UI audit on current main found `WeatherDecisionField` still formatted a truly equal daily high/low as a duplicated range (`26°C / 26°C`). On `automation/hava81-decision-equal-range-0956`, exact-equal values now render once, while genuinely different values that merely round to the same whole degree retain the existing one-decimal range. Regression coverage added.
- Local gates for the equal-range branch: focused WeatherDecisionField 10/10, full frontend 375/375, TypeScript, ESLint, 81-city production build, service-worker stamping, and `git diff --check` pass using the existing host dependency tree inside an isolated Node 24 container.
- Next queue: publish/open the equal-range branch; recheck exact head/CI/mergeability for #287 and merge only after fresh production verification; then rebase the equal-range PR onto new main if needed with a remote-head lease check, rerun combined gates, merge when green, watch main Pages pipeline, and smoke-test production. Continue independent non-overlapping accessibility/reliability audit while external gates run. Disk remains near the observer warning ceiling, so only safe bounded cleanup should be considered; do not delete unrelated worktrees.

## 2026-08-30 10:28 TRT — reject reversed sunrise/sunset upstream data

- While PR #290/#289 exact-head CI ran independently, audited current-weather astronomical trust boundaries from exact main `6cb0f40155ac01ae37fd1987c2b91febe2541c75`.
- OpenWeather sunrise/sunset epochs were individually validated but a structurally inconsistent `sunset < sunrise` payload could pass the API and the UI would clamp the negative daylight duration to a plausible-looking zero. The upstream schema now fails closed when sunset precedes sunrise; equal epochs remain accepted rather than inventing a nonzero daylight duration.
- Local gates pass: full API test suite 50/50, API type-check, API build, and `git diff --check`.
- This branch is isolated from pending frontend metadata/i18n PRs and does not mutate production. Exact-head CI plus fresh production verification are required before merge.

## 2026-08-30 10:32 TRT — align fresh and persisted daylight trust boundaries

- Extended the reversed daylight guard through the browser BFF and persisted-cache boundaries so a stale/corrupt client cache cannot bypass the API-side invariant before the runtime API deployment catches up.
- Fresh BFF weather now rejects `sunset < sunrise` as a retryable invalid-data response; persisted current weather rejects the same ordering and refetches rather than rendering it. No timestamp is reordered or synthesized.
- Combined local gates pass: weatherService/useWeather 145/145, frontend TypeScript, frontend ESLint, API 50/50, API type-check, API build, and diff-check.


## 2026-08-30 10:47 TRT — reject invalid decision-profile clock writes

- While main `859961db0cf45fd079749989f8c915625d69147c` CI ran after PR #295, audited persisted decision-profile trust boundaries from an isolated worktree based on that exact main. Deserialization already validates optional commute/activity times as 24-hour `HH:mm`, but the live setters accepted arbitrary strings and could persist malformed values until a reload sanitized them.
- `setCommuteTime` and `setActivityWindow` now fail closed for defined values outside the same clock-time domain before mutating state, localStorage, or analytics. Clearing with `undefined` remains supported. No weather or safety value is invented.
- Added regression coverage for malformed `25:00` and non-zero-padded `9:30`, plus valid write coverage. Local gates pass: focused decision-profile 6/6, frontend TypeScript, ESLint, 81-city production build/service-worker stamping, production dependency audit 0 vulnerabilities, and `git diff --check`.
- Disk pressure was also remediated from 95% used (~2.7 GiB free) to 91% (~4.3 GiB free) by removing only reproducible developer caches; production/runtime data was untouched. A conservative worktree cleanup removed only five clean branches whose heads were already ancestors of `origin/main`; open/dirty/unmerged worktrees were preserved.


## 2026-08-30 10:54 TRT — reject invalid live user-setting enum writes

- Continued from exact production-green main `d3f33a18730783db0c8d02baf4f93f54fdbc0aa8` while its CI ran. Persisted user settings already normalize untrusted values, but the live `updateSetting` mutator trusted its TypeScript caller and could accept an invalid runtime enum value from an unsafe JS/cast boundary, persisting it until reload.
- Added a key-aware runtime guard reusing the existing temperature/wind/theme/language validators. Invalid live values now fail closed before state or localStorage mutation; valid typed updates are unchanged.
- Regression covers invalid Kelvin/knots/sepia/de values and a subsequent valid imperial update. Local gates pass: SettingsContext suites 5/5, frontend TypeScript, ESLint, 81-city production build/service-worker stamping, production dependency audit 0 vulnerabilities, and `git diff --check`.
- The observer sample at 10:50 TRT confirms the prior exact-main API deployment is reconciled: deployed revision `859961db0cf45fd079749989f8c915625d69147c`, current main `d3f33a18730783db0c8d02baf4f93f54fdbc0aa8`, `api_deploy_pending=false`, production healthy on nginx slot 4002, and disk healthy at 91.7% used. Main run #732 and rebased PR #289 CI continue independently.


## 2026-08-30 11:00 TRT — prioritize city-search prefix matches

- While main `b891037d1441ba61d62e29bb1b79431671d22d30` CI and PR #289 validation ran, audited the primary city autocomplete from an isolated exact-main worktree. Search normalization handled Turkish characters correctly, but all substring matches inherited province alphabetical order, so a query such as `An` could rank `Adana` ahead of the more intentional prefix match `Ankara`.
- Kept the existing Turkish-insensitive matching and stable province ordering, but partitioned matches so city names beginning with the normalized query are offered before substring-only matches. This changes recommendation order only; it does not broaden accepted cities or alter weather requests.
- Added a regression proving `Ankara` ranks before substring-only `Adana`. Local gates pass: SearchBar 14/14, frontend TypeScript, ESLint, 81-city production build/service-worker stamping, production dependency audit 0 vulnerabilities, and `git diff --check`.
- Host hygiene during this session removed only Hava81-owned stale ephemeral audit containers (two 8+ hour browser audit containers and one exited verifier) plus patch-equivalent clean worktrees. Production 4002/rollback 4001 and unrelated Postify/Nexus services were preserved. The remaining disk pressure is materially driven by unrelated `/tmp/postify-*` artifacts and long-running Postify dev containers, so Hava81 automation does not delete them.

## 2026-08-30 11:47 TRT — make disk-pressure threshold exact and non-rounded

- Fresh observer state reported root usage as `92.0%` with ~3.6 GiB free but still raised `root_disk_pressure`; direct `df` agreed the filesystem was at the displayed 92% boundary and production remained healthy on API slot 4002.
- Root cause was observer logic making the health decision from the one-decimal display value with a strict `< 92.0` comparison. Real usage just below the threshold could round to 92.0 and be falsely unhealthy, while the configured field is explicitly named `maximum_used_percent`.
- `collect_host()` now decides from the unrounded filesystem ratio and treats the configured maximum as inclusive; the one-decimal percentage remains presentation-only. Added regression coverage for exact 92.0% and 91.95% (displayed 92.0%) while preserving the 92.5% unhealthy case and the independent 2 GiB free-space floor.
- Local gates pass: observer 20/20 tests, Python compile, and `git diff --check`. No production service/configuration was mutated by the code change.
- Host hygiene also removed only reproducible Hava81 dependency trees from the stale primary checkout, recovering roughly 0.5 GiB; direct root usage fell from 93% to 92%. The staged unrelated primary-checkout work was preserved.
- Current main moved concurrently through merged PR #303 to `76c3488b8fa765f44c326cc54f6d07e658886c39`; main pipeline #745 is running. This observer branch is based on that exact main and remains isolated.

## 2026-08-30 11:58 TRT — reject impossible date-only forecast calendars

- Independent browser/BFF trust-boundary audit on exact main `14cea317cb40e2e8c97637aae4815dc5e3bc086b` found that daily `YYYY-MM-DD` values were passed through JavaScript `Date`. Inputs such as `2026-02-31` can normalize into a different valid day instead of producing `Invalid Date`, allowing a malformed upstream day to become plausible-looking guidance.
- Date-only revival now requires the exact `YYYY-MM-DD` shape and verifies that the parsed UTC-noon date round-trips to the identical calendar string. Impossible dates therefore fail closed through the existing retryable API-data error; no calendar value is corrected or fabricated.
- Added regressions for impossible daily dates on both standard forecast and one-hour forecast BFF paths.
- Local current-main gates pass in isolated Node 24: weatherService 106/106, frontend TypeScript, ESLint, 81-city production build/service-worker stamping, production dependency audit 0 vulnerabilities, and `git diff --check`.
- Temporary dependency/build artifacts were removed immediately after validation. This is frontend transport validation only and does not alter provider data or API traffic.

## 2026-08-30 12:13 TRT — PR #308 current-main revalidation

- Rebased `automation/hava81-date-only-trust-1158` from `14cea317cb40e2e8c97637aae4815dc5e3bc086b` onto current `origin/main` `593a98d2d9145910b154ee800b2e78e880839f79` after confirming the remote branch still pointed to `51fdd146df81cceff463952e6fc29b9cda792724`.
- Combined gates after rebase pass: targeted weatherService 108/108; full frontend 46 files / 398 tests; TypeScript; ESLint; 81-city production build/service-worker stamping; production dependency audit 0 vulnerabilities; `git diff --check`.
- Next action: amend this checkpoint, push the rebased PR branch with explicit `--force-with-lease=refs/heads/automation/hava81-date-only-trust-1158:51fdd146df81cceff463952e6fc29b9cda792724`, then require exact-head green CI and directly re-verify production/observer immediately before merge.
- Host disk remained under pressure during the run. Only clean worktrees whose branches were already ancestors of `origin/main` were removed; unrelated staged primary-worktree changes and open PR worktrees were preserved.

## 2026-08-30 12:20 TRT — PR #308 rebased after concurrent main advance

- Pre-merge verification caught concurrent PR #310 landing on `main` as `579931b8bf2fef41a95dff2f1e7bc0700efc0000`; #308 was not merged against the stale base.
- Reconfirmed remote #308 head `8918a73899608f45c76892f43f0f6bc1eca68971`, rebased cleanly onto `579931b8bf2fef41a95dff2f1e7bc0700efc0000`, and reran combined gates.
- Current-main validation passes: targeted weatherService 110/110; full frontend 46 files / 402 tests; TypeScript; ESLint; 81-city production build/service-worker stamping; production dependency audit 0 vulnerabilities; `git diff --check`.
- Next action: amend/push with exact lease against `8918a73899608f45c76892f43f0f6bc1eca68971`, require the new exact-head CI to pass, then reverify observer + GitHub head/mergeability + production immediately before merge.

## 2026-08-30 11:54 TRT — rebuild Forecast Atlas localized copy on current main

- Legacy PR #289 remained green but conflicted with current main, so it was left untouched. Rebuilt its presentation-only localization change from exact main `54ec99c33c86377afaefbe986e8a35a56be19fb5` in a new isolated branch.
- Forecast Atlas hourly horizon heading, interval buttons, and Open-Meteo “Formatted by Hava81” attribution now route through the shared TR/EN locale tables instead of inline language-condition strings. Weather values, time horizons, provider attribution, and scoring semantics are unchanged.
- Local current-main gates pass in an isolated Node 24 container: ForecastAtlas 8/8, frontend TypeScript, ESLint, 81-city production build/service-worker stamping, production dependency audit 0 vulnerabilities, and `git diff --check`.
- Temporary dependency/build artifacts were removed immediately after validation. Next action: publish as a replacement PR, require exact-head CI, and retire #289 only after the replacement is green.

## 2026-08-30 12:27 TRT — PR #307 rebuilt on post-#308 main

- Diagnosed the previous #307 CI failure with real Chromium. Its four Forecast Atlas/browser flows passed; the sole full-suite failure was an unrelated stale commute-preparation text assertion inherited from the old base. Running that exact commute flow on current main passed.
- After PR #308 merged as `16a994d1d68ec0048ae874e5dd253af0726c546e`, rebased `automation/hava81-forecast-copy-rebuild-1153` onto that exact main. The only conflicts were append-only autonomous docs; both valid histories were preserved.
- Combined current-main gates now pass: ForecastAtlas 8/8; full frontend 46 files / 402 tests; TypeScript; ESLint; 81-city production build/service-worker stamping; production dependency audit 0 vulnerabilities; full Chromium Playwright 39 passed / 60 intentionally skipped / 0 failed; `git diff --check`.
- Next action: amend/push #307 using an explicit lease against remote `0b1a4f4bbb290e3ce6bee4641a743fd81b5e8354`, require new exact-head green CI, and continue independent work while CI/main deployment runs.

## 2026-08-30 11:50 TRT — rebuild native-share fallback on current main

- Open PR #301 remains conflicted against current main, so its product change was not force-rebased or mutated from this second workstream. Rebuilt the bounded share behavior on a fresh branch from exact main `76c3488b8fa765f44c326cc54f6d07e658886c39`.
- Daily Plan now preserves successful native Web Share and explicit `AbortError` cancellation, but a non-cancellation native-share failure falls through to the existing clipboard fallback. Analytics fires only after successful native or clipboard completion; clipboard permission failures remain isolated from weather guidance.
- Added regressions proving broken native-share -> clipboard fallback and user cancellation -> no clipboard copy.
- Current-main local gates pass in an isolated Node 24 container: DailyPlanPanel 7/7, frontend TypeScript, ESLint, 81-city production build/service-worker stamping, production dependency audit 0 vulnerabilities, and `git diff --check`.
- Temporary `node_modules`/`dist` were removed immediately after validation; no production service or weather semantics changed.
- Next action: publish this rebuilt branch as a replacement PR, require exact-head CI, and close superseded #301 only after the replacement is safely represented. Continue independent work while CI runs.

## 2026-08-30 12:33 TRT — PR #305 rebuilt on post-#307 main

- After PR #307 merged as `19ebbcce02c93343b54a85e5c00f996bcb058c31`, rebased `automation/hava81-share-fallback-rebuild-1149` onto that exact main while preserving both sides of append-only autonomous documentation.
- The old #305 CI failure was isolated to the browser-flow job on its stale base; current-main validation now passes end to end: DailyPlanPanel 7/7; full frontend 46 files / 404 tests; TypeScript; ESLint; 81-city production build/service-worker stamping; production dependency audit 0 vulnerabilities; Chromium Playwright 39 passed / 60 intentionally skipped / 0 failed; `git diff --check`.
- Product behavior remains bounded: successful native sharing stays native, explicit `AbortError` remains cancellation, other native-share failures may use clipboard, and analytics records only a completed transport. No weather data or safety semantics change.
- Next action: amend/push with exact lease against remote `6b2ac9b1a2ca0b7c010e1b0b40662a839b62ee27`, require new exact-head CI, and directly reverify current main/observer/production immediately before merge.


## 2026-08-30 13:20 TRT — collapse duplicate flat hourly temperature summary

- Audited the newly redesigned Forecast Atlas on exact production-green main `3ca751fae0fb4b1f5a0676255c52f71bdb98f391`. The hourly summary always rendered separate low/high cards, so a display-flat range such as 24.1–24.4°C appeared as the misleading duplicate `En düşük 24°C` / `En yüksek 24°C`.
- When the displayed hourly minimum and maximum are identical, the summary now uses one two-column localized `Sıcaklık` / `Temperature` card plus the independent rain-peak card. Genuinely different displayed minima/maxima retain the existing separate low/high cards. No forecast values are changed, corrected, or synthesized.
- Added regression coverage for a sub-degree range that rounds to one displayed degree. Validation passes: ForecastAtlas 10/10, full frontend 46 files / 406 tests, TypeScript, ESLint, 81-city production build/service-worker stamping, production dependency audit 0 vulnerabilities, and `git diff --check`.
- Fresh observer after main CI #771: main pipeline successful, production root/İstanbul/API readiness/CORS healthy, OpenWeather circuit closed, nginx remains on 4002, no API runtime drift, disk healthy at 82.1% used.
- Next action: commit/push/open this isolated branch, require exact-head CI, continue a separate non-overlapping audit while CI runs, then reverify PR head/mergeability/observer/production immediately before merge.


## 2026-08-30 13:26 TRT — Forecast Atlas location-timezone regression coverage

- After PR #313 merged as main `e4d536f2d63b8e01d8a0fbe0c2f043285a78dee4`, added a focused Forecast Atlas regression for a +03:00 forecast location crossing local midnight.
- The test proves hourly labels use the forecast location offset (`20:00Z -> 23:00`, `21:00Z -> 00:00`) and the midnight slot receives both the visible day marker and `is-day-boundary` styling. This protects the redesigned hourly surface from silently reverting to the browser/UTC day rather than the weather location's local day.
- Validation on exact post-#313 main: ForecastAtlas 11/11; full frontend 46 files / 407 tests; TypeScript; ESLint; 81-city production build/service-worker stamping; production dependency audit 0 vulnerabilities; `git diff --check`. Runtime behavior is unchanged; this is regression hardening only.
- Main pipeline #773 for #313 is in progress while this independent branch proceeds.


## 2026-08-30 13:36 TRT — Forecast source attribution contrast

- Measured the live Istanbul production page with Lighthouse/real Chromium after the Forecast Atlas redesign: performance 0.85, accessibility 0.97, best practices 1.00, SEO 1.00; FCP 2.4s, LCP 3.5s, TBT 10ms, CLS 0.
- The only Lighthouse accessibility failure was Forecast Atlas source attribution text/links at 11px: rendered foreground `#6c7b79` on white measured 4.42:1, just below WCAG AA's 4.5:1 normal-text threshold.
- Removed the 90%-to-transparent fade and use the existing solid `--forecast-muted` token (`#5c6c6a` in light mode), yielding ~5.51:1 against white without changing hierarchy or adding visual weight. Dark-mode token behavior is preserved.
- Validation on concurrent-safe main `8c67e4602253505ec8e7458228b7abdfd3e1eb40`: ForecastAtlas 12/12, full frontend 46 files / 408 tests, TypeScript, ESLint, 81-city production build/service-worker stamping, production dependency audit 0 vulnerabilities, `git diff --check`.
