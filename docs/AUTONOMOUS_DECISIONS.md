# Hava81 Autonomous Decisions

This log records product and engineering decisions made during the autonomous improvement window requested for 28 August 2026.

## 2026-08-28 initial decisions

- Keep the product centered on actionable weather decisions rather than raw-data density.
- Never synthesize UV, pollen, dust, marine, health or safety values; modeled data must be attributed and optional.
- Use Open-Meteo as an additional context source for UV/dust/pollen/marine while OpenWeather remains the core current/forecast provider.
- Treat route weather without a routing provider as an approximate weather corridor, never as turn-by-turn navigation or road-safety assurance.
- Keep core Day Plan eager-loaded; lazy-load secondary modules to protect first-load performance.
- Generate real static entry pages for all 81 provinces to eliminate GitHub Pages deep-link 404 semantics and improve crawlability.
- Production deployments use canary/blue-green and retain the previous API port for immediate rollback.

## 2026-08-28 09:43 TRT — God Mode run

- Keep browser alert dedupe signatures stable within a day. Score changes must not create repeated rain/difficult notifications; the day key already provides freshness.
- Reject route-weather corridors below 1 km or above 2,000 km before the five-upstream-forecast fan-out. This bounds provider cost and prevents meaningless same-point requests while covering realistic Türkiye intercity trips.
- Extend modeled marine context with Open-Meteo wave direction and wave period. Open-Meteo documents both as current marine variables; these remain modeled context and not navigation safety data.
- Treat nested paths such as `/istanbul/anything` as non-city routes. Only a single canonical city slug resolves to a province, avoiding accidental deep-link/canonical mismatch.
- Do not ship an MGM MeteoUyarı integration until an official, stable, machine-readable source and freshness semantics can be verified. No scraping-derived or unattributed official-warning claims will be fabricated.

## 2026-08-28 follow-up run

- Alert only on decision-level strong wind and poor AQI thresholds already used by Hava81 scoring; do not invent medical claims or new pollutant thresholds. Rain remains highest priority.
- Surface modeled marine wave period/direction and model fetch time as transparency signals, not navigation/safety recommendations.
- Route cards must show wind because wind contributes to route score; users should be able to see why a segment is penalized.
- Root and province HTML must each emit exactly one canonical and one og:url; the static generator replaces root metadata instead of appending duplicates.
- Treat ports 4001/4002 as reversible blue-green slots. Never overwrite the active slot during a release.

- Canonical province URLs use a trailing slash because GitHub Pages serves generated province directories that way. This removes the observed `/istanbul` -> `/istanbul/` 301/canonical disagreement.

## 2026-08-28 10:44 TRT — God Mode run

- Treat Open-Meteo 15-minute precipitation in Türkiye as interpolated model guidance, not radar nowcast; do not market it as nowcast.
- Calculate UV/dust/pollen maxima from the actual next 24 hours rather than the first 24 provider rows, which may include elapsed local-day hours.
- Cap route-weather requests at 12/minute per rate-limit key because each accepted route fans out to five forecast samples.
- Never let Playwright reuse an arbitrary process occupying the preview port; fail fast instead of producing misleading browser results.
- Cancel superseded CI runs for the same PR/ref to reduce queue time and wasted runner work.
- Keep PWA shortcut URLs aligned with GitHub Pages trailing-slash canonical province URLs.

## 2026-08-28 10:58 TRT — visual polish
- Cosmetic work must reinforce the decision hierarchy rather than add decorative chrome: current conditions and the actionable day decision remain visually dominant.
- Use subtle shared elevation/radius tokens for hierarchy; avoid heavy glassmorphism, large animation dependencies, or effects that cost first-load performance.
- Notification copy must describe the current foreground-browser behavior only; do not imply account-backed/background delivery before that infrastructure exists.

- 2026-08-28 polish-2: Keep cosmetic changes bounded to presentation and interaction affordances; do not alter weather thresholds or modeled-data semantics while polishing UI. Mobile route segments use horizontal scanning instead of compressing five risk cards into two narrow columns.

- 2026-08-28 — Visual polish batch 3 keeps data/decision logic unchanged: Forecast, Environment, Compare and Search now share the established surface/token system. CI downstream jobs reuse the production `dist` artifact rather than rebuilding identical frontend output; the build job remains the single artifact producer.
- 2026-08-28 — Browser notification permission `denied` is treated as a non-actionable state: Hava81 shows the blocked label but disables the opt-in button instead of repeatedly invoking a browser permission request that cannot succeed.


## 2026-08-28 11:46 TRT — performance split

- Keep the current-conditions decision field synchronous, but code-split Forecast Atlas, Daily Plan and Environment Rail. Forecast data already arrives asynchronously, so these presentation modules do not need to inflate the initial application bundle; browser smoke tests remain the guard against visible regressions.
- Normalize provider micro-unit glyphs to the SI micro sign at presentation boundaries. This is visually/semantically equivalent for units such as µg/m³ and prevents a Greek font subset from being fetched solely for U+03BC.
- Do not carry a ~125 kB animation runtime solely for the Settings drawer. CSS entry animation plus reduced-motion handling is sufficient; the prior component was unmounted by its parent on close anyway, so its internal AnimatePresence could not provide a meaningful exit lifecycle.
- 2026-08-28 — GitHub Pages currently serves HTML, hashed assets and `sw.js` with `Cache-Control: max-age=600`; repo code cannot override those platform headers. Keep the notification-only service worker cacheless and request SW updates with `updateViaCache: 'none'` instead of introducing an application cache that could serve stale weather UI.
- 2026-08-28 — Share payloads keep the canonical URL separate from native Web Share text to avoid duplicate links; clipboard fallback includes the URL. Share analytics fire only after an actual native share or clipboard copy succeeds.
- 2026-08-28 — Social/SEO metadata uses one canonical template in `index.html`; static city generation replaces city-specific title/description/URL fields instead of appending duplicate OG/Twitter tags. No weather observations are embedded in static metadata.

- 2026-08-28 — Public Lighthouse after the bundle/settings optimizations improved TBT materially but LCP remained data-bound. Preconnect only to Hava81's own API origin from the HTML shell; do not preload fabricated weather data or add speculative third-party origins.

- 2026-08-28 — Treat Vite lazy-chunk 404s during GitHub Pages deploy/cache races as recoverable once per session window: reload the same city URL with a short-lived cache-busting query, then restore the clean canonical URL. A second failure within 60 seconds is allowed to surface normally to prevent reload loops.

- 2026-08-28 — Keep first-party GitHub Actions on current supported majors when runner deprecation warnings are active. Node 20-backed v4 checkout/setup-node/artifact actions are upgraded to v6 rather than relying on GitHub temporary forced Node 24 compatibility mode.

- 2026-08-28 — Keep Leaflet's framework CSS behind the same lazy boundary as WeatherMap. The map is user-triggered and should not make its CSS render-blocking for the decision-first city view.

- 2026-08-28 — Start the first city current-weather BFF request from generated production HTML before the main module only when no matching fresh 5-minute local cache exists. Read the saved UI language, keep units metric for normalized decision logic, and let weatherService consume the same promise so early fetch never becomes a duplicate app request.
- 2026-08-28 — Bound the generated early weather bootstrap fetch to 10 seconds with AbortController. If it cannot resolve in that window, return null and let the normal httpClient path handle retry/timeout semantics instead of allowing app initialization to wait on an unbounded bootstrap promise.

## 2026-08-28 13:13 TRT — brand surfaces

- Treat browser chrome, install icons, Apple touch icons and social-preview images as first-class production UI, not build scaffolding. All of them must use the Hava81 mark; default React/Vite/CRA assets are regressions.
- When favicon artwork changes, use a Hava81-specific versioned URL in HTML in addition to replacing `/favicon.ico`, because browsers cache favicons unusually aggressively. Keep `/favicon.ico` branded as a fallback for clients that probe it implicitly.
- Keep a browser-level brand asset regression that checks both references and decoded image pixels/dimensions; HTML-only assertions are insufficient because a correct link can still point to stale scaffold artwork.

## 2026-08-28 13:21 TRT — provider AQI semantics

- Treat OpenWeather `main.aqi` strictly as OpenWeather's own five-level qualitative index (1 Good, 2 Fair, 3 Moderate, 4 Poor, 5 Very Poor). Do not relabel those ordinal values as US AQI health categories such as "Unhealthy for Sensitive Groups" without actually calculating that separate standard from pollutant concentrations.
- Never clamp out-of-range AQI values to the nearest qualitative label. Invalid provider indices are unavailable data until validated, not an opportunity to infer a health category.

## 2026-08-28 13:24 TRT — touch-target enforcement

- The documented 44 px touch-target rule is now an executable mobile browser gate rather than a visual guideline. New interactive controls must preserve at least 44×44 px rendered dimensions at the 390 px viewport unless a deliberately reviewed exception is introduced.
## 2026-08-28 13:27 TRT — scaffold identity hygiene

- Remove unused starter-brand assets instead of merely hiding them from rendered surfaces. Keep historical baseline documentation intact when it is explicitly labeled as a before-state, but current package metadata and current roadmap statements must use the Hava81 identity and current toolchain.
## 2026-08-28 13:31 TRT — social preview truthfulness

- Social-preview artwork may communicate Hava81's stable product promise and brand identity, but it must not contain a current temperature, warning, UV level, or other live condition unless that image is generated from freshness-aware verified data. The default share card therefore stays weather-data-neutral.

## 2026-08-28 13:50 TRT — service-worker cache safety

- Never serve `/sw.js` with the immutable one-year static-asset policy. Service workers must revalidate so browsers can discover notification/navigation behavior updates; keep fingerprinted JS/CSS/images immutable, but give the worker an exact-match no-cache policy.
## 2026-08-28 13:53 TRT — async test timing

- Do not globally relax frontend async-test timeouts to hide CI slowness. Code-split UI boundaries may use a narrowly scoped 3 s wait in integration coverage; synchronous decision-critical rendering keeps the default timeout so regressions remain visible.
## 2026-08-28 13:58 TRT — alert dedupe semantics

- Persist a decision alert's same-day dedupe marker only after the browser accepts notification delivery. Delivery failures stay optional/non-blocking, but must not be treated as successful user notification.

- 2026-08-28 — Treat PWA manifest availability and active service-worker registration as release contracts because browser decision alerts depend on the worker even though Hava81 does not claim offline weather freshness.

- 2026-08-28 — Ship only Latin and Latin Extended font subsets. They cover Hava81s Turkish/English interface; unrelated Greek, Cyrillic and Vietnamese subsets add transfer/storage cost without product value.

- 2026-08-28 — A successful Pages publish step is not sufficient evidence of a healthy frontend. The release workflow must verify the public custom-domain shell with bounded retries after publish, covering root, a canonical province entry page, manifest and service worker without asserting live weather values.

- 2026-08-28 — Browser startup configuration is intentionally validated with narrow typed parsers rather than a general-purpose schema runtime. The frontend has only a handful of public Vite fields; keeping Zod in the initial bundle costs more than this use case justifies, while API/server schemas remain unaffected.

- 2026-08-28 — Do not publish frontend source maps in normal production artifacts. Source-map generation is opt-in for the explicit bundle-analysis command only; operational debugging should not require exposing maps to every public visitor.

- 2026-08-28 — Treat individual Lighthouse accessibility audits as actionable even when the aggregate accessibility category rounds to 100. Interactive accessible names should contain/derive from their visible labels, and ARIA list semantics must use host/role combinations accepted by accessibility APIs rather than visually equivalent but invalid markup.

- 2026-08-28 — A canonical populated city view has exactly one level-1 heading and it is the visible city name. Product sections remain level 2/3; do not add hidden SEO-only headings.
- 2026-08-28 — Disk-pressure cleanup may remove only unattached rebuildable cache images without explicit approval. Preserve active Hava81 production and rollback/canary images, running containers, volumes and unrelated user data.

- 2026-08-28 — Static SEO structured data describes stable page/product identity only. Do not serialize live weather, UV, health, warning or decision values into GitHub Pages HTML where they can become stale between deploys.

- 2026-08-28 — CI action major upgrades must be validated in the same PR path where possible. Do not opportunistically major-upgrade main-only Docker publishing actions when pull-request CI skips that job; handle those with a separately validated release path.

- 2026-08-28 — Do not retain a stale Lighthouse CI wrapper solely for convenience when its transitive toolchain carries known advisories. Hava81 owns a minimal Lighthouse runner that preserves release thresholds, fails closed on accessibility/missing scores, refuses ambiguous occupied preview ports, and does not publish reports to third-party temporary storage.

- 2026-08-28 — PWA offline caching is limited to same-origin navigation HTML, the tiny install shell, and core boot assets. Never service-worker-cache cross-origin weather/API responses as an offline substitute for fresh weather; keep lazy feature chunks on the normal network/deploy-recovery path.

- 2026-08-28 — Main-only Docker action majors may be refreshed when the upstream tagged action.yml is directly verified to retain every used input and declare the target Node runtime. Keep Docker publish semantics unchanged and treat the first main Docker job as the final integration gate; it must not control API traffic switching.

- 2026-08-28 — `themeMode: auto` means follow the device/browser `prefers-color-scheme`, not infer light/dark from the current weather icon. Explicit light/dark choices remain authoritative; map tiles and browser `theme-color` must use the same resolved color mode.

- 2026-08-28 — GitHub Pages post-deploy smoke must distinguish the newly published artifact from a healthy stale CDN response. When `dist/` is available, compare SHA-256 of the fetched shell/assets with the exact build artifact and cache-bust each retry; also assert Hava81 branding surfaces rather than accepting a generic 200/Hava81 substring.

- 2026-08-28 — Service-worker cache-first behavior is restricted to fingerprinted Vite `/assets/` resources. Stable root branding URLs such as `hava81-mark.svg`, favicon/social assets and other replace-in-place files must remain network-fresh so a previous brand asset cannot survive indefinitely after a deploy.

- 2026-08-28 — Provider resilience tests must preserve the distinction between retryable upstream outages and non-retryable client/provider validation errors. Only exhausted retryable failures advance the circuit; while the circuit is open, a configured fallback serves requests without probing the known-failing primary until the reset window.

- 2026-08-28 — Health and readiness endpoints are operational truth surfaces and must be explicitly non-cacheable. Emit `Cache-Control: no-store` so deployment/observer checks cannot be satisfied by stale intermediary responses.

- 2026-08-28 — Rolling Open-Meteo context maxima must be computed from unambiguous GMT instants. Do not request `timezone=auto` and then feed offset-less local wall-clock strings to `Date.parse`; request `timezone=GMT`, explicitly parse offset-less model timestamps as UTC, and request 25 forecast hours so a rolling 24-hour window starting mid-hour still contains its final partial-hour slot.

- 2026-08-28 — Programmatic navigation must honor `prefers-reduced-motion`; CSS scroll overrides are not sufficient when code explicitly requests smooth scrolling. Centralize motion-aware scrolling so explicit map/overview/saved-city jumps resolve to `auto` for reduced-motion users.

- 2026-08-28 — The root HTML `lang` attribute must track Hava81's active UI language at runtime. Visible translations alone are insufficient because screen readers and other language-sensitive user agents rely on the document language metadata.

- 2026-08-28 — Top-level render failures must not expose raw JavaScript error messages in the production UI. Preserve technical errors for logging/diagnostics, but show users localized generic recovery copy.


- 2026-08-28 — Interactive activity toggles are exposed as one named accessibility group. An `aria-label` on a generic container is not sufficient by itself; use an explicit grouping role so assistive technology receives the relationship between the label and toggle buttons.


- 2026-08-28 — Named quick-guidance clusters must expose an accessibility role whenever they use `aria-label`; visual grouping alone does not guarantee an accessible group name.


- 2026-08-28 — ErrorBoundary defaults must follow the same production privacy rule as custom fallbacks: technical error objects stay in diagnostics/onError, never in user-visible fallback copy.


- 2026-08-28 — Open-Meteo `uvIndexMax`/pollen context values are modeled next-24-hour maxima, not current observations. User-facing copy must state the model/window explicitly. UV presentation follows WHO bands (Low <3, Moderate 3–5, High 6–7, Very high 8–10, Extreme 11+) and sun-protection guidance starts at UVI 3; do not collapse 11+ into “Very high”. Decision-action translations must exist in both Turkish and English rather than relying on a Turkish component fallback.

- 2026-08-28 — API production promotion uses exact-image blue-green semantics: validate the candidate on 4001, temporarily route public traffic to the healthy canary, recreate 4002 from that exact validated image without rebuilding, verify it directly, return Nginx to 4002, then restore the previous production image on 4001 so rollback remains a one-port switch rather than an image rebuild.

- 2026-08-28 — Service-worker update checks must bypass the HTTP cache. Production currently serves `sw.js` with a 10-minute cache lifetime, so registration uses `updateViaCache: 'none'` to reduce stale-worker risk after deploys without depending on GitHub Pages response-header control.

- 2026-08-28 — City comparison cards are exposed as a named list, not a partial ARIA table. A table/row role pair without cell semantics creates a misleading accessibility contract; use list/listitem for the actual card collection structure.

- 2026-08-28 — Reusable recovery controls must declare type=button unless submission is intentional; ErrorBoundary retry must never inherit HTML button submit semantics from an ancestor form.

- 2026-08-28 — Installable PWA raster icons use Hava81-specific asset URLs instead of scaffold-generic logo192.png/logo512.png names. Unique branded URLs reduce stale browser/PWA icon-cache collisions and make React-template regressions easier to detect.

- 2026-08-28 — The primary decision surface keeps a sequential heading hierarchy: province name is the page `h1`, and its decision-change/planning-signals subregion is `h2`, not `h3`. Visual styling remains class-driven rather than heading-level-driven.

- 2026-08-28 — Do not label the general Hava81 app artwork as `maskable` unless all important pixels fit the Web App Manifest safe zone. Keep the normal SVG/PNG icons at purpose `any` and provide a dedicated padded 512×512 PNG for purpose `maskable`; the browser regression enforces the W3C 40%-radius safe-zone boundary from actual pixels.

- 2026-08-28 — API readiness observation must verify freshness, not only HTTP 200 and status=ready. The read-only observer requires a parseable readiness timestamp no more than 180 seconds away from observer time and an explicit Cache-Control: no-store; otherwise production health is marked unhealthy even if the payload shape looks valid. The Oracle observer source and hardened systemd units are versioned under deploy/oracle/observer/ to prevent operational drift.
