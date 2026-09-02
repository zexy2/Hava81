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

- 2026-08-28 — Runtime browser title language follows the active Hava81 UI language. Keep statically generated province SEO metadata deterministic in Turkish, but when a user switches/persists English, synchronize the live document title with the same language as `html[lang]` and visible UI copy rather than leaving a Turkish tab title.


- 2026-08-28 — New product work must pass a marketability gate before earning permanent UI space: it should solve a recurring user job, end in a concrete action, be demonstrable in about ten seconds, use explainable/trustworthy data semantics, and produce more value than a quick glance at a generic forecast. Raw forecast cards, generic maps/radar, AQI/UV cards, activity labels, alerts, or route-weather existence alone are supporting capabilities rather than Hava81's moat.

- 2026-08-28 — The first routine-first application of that gate is the local-only “Çıkış planı”: users may persist a leave/return clock pair and Hava81 compares the nearest available forecast windows to answer preparation questions such as whether to carry an umbrella and whether rain, wind, or temperature materially worsens by return time. It must explicitly disclose that the nearest forecast window is used, reject schedules without sufficiently near forecast data, and never imply minute-level nowcast, traffic, road-safety, or official-warning precision.

- 2026-08-28 — Current-weather error privacy is enforced at the `useWeather` boundary rather than by individual renderers. Provider/internal exception text is sanitized before UI consumers receive it, while network/not-found remain useful localized categories; route-weather failures likewise use localized recovery copy.

- 2026-08-28 — Persisted commute routines must make the exact next evaluated leave/return window visible in the verdict. A saved morning routine opened in the evening evaluates the next day by design; the UI must expose that rollover instead of letting users assume the recommendation applies to the current calendar day.

- 2026-08-28 — A persisted alert opt-in must remain locally reversible even if browser Notification permission later becomes denied or unavailable. Block new opt-in attempts in that state, but never trap an already-enabled user by disabling Hava81's own opt-out control.

- 2026-08-28 — Interactive commute-plan verdict updates are exposed as one atomic polite status region. The leave/return controls remain ordinary inputs, but the computed preparation result must be announced when it changes so decision-first UX is available to screen-reader users without forcing focus movement.

- 2026-08-28 — Commute-plan empty states must distinguish incomplete user input from insufficient forecast coverage. Once both routine times are present, never tell the user to select them again; explain that no sufficiently close forecast window is available instead of implying a plan can be computed from unavailable data.

- 2026-08-28 — Every map disclosure that exposes `aria-expanded` must also identify the controlled lazy map region with `aria-controls="weather-map-region"`; keep duplicate entry points semantically consistent even when they share the same open/close handler.

- 2026-08-28 — Asynchronous route-weather success results are exposed as one atomic polite status region. Keep provider failures as alerts, but announce successful corridor decisions without moving focus so the decision-first workflow remains usable with assistive technology.

- 2026-08-28 — Hava81 may use Open-Meteo as an explicitly attributed secondary provider for true one-hour forecast presentation, but decision engines remain on the established OpenWeather three-hour series until separately validated for provider-semantic changes. Optional hourly enrichment must never block the baseline forecast: render the three-hour data as soon as it is available, then upgrade the Atlas asynchronously when hourly data succeeds; on failure retain the baseline without surfacing provider internals to users.

- 2026-08-28 — Clipboard-success feedback for the Gün planı share action is an asynchronous UI result and must be exposed through an atomic polite status without moving focus. The visible button-label change remains, but assistive-technology users should receive the same successful-copy feedback.

## 2026-08-28 — Hava81 Score v2 uses continuous, explainable multi-signal suitability

- Replace threshold-step deductions with smooth risk curves so tiny changes around 32°C, 50% rain, or similar boundaries cannot create artificial score jumps.
- Prefer true one-hour Open-Meteo decision signals (apparent temperature, humidity, precipitation amount, gusts, UV, visibility, WMO code) while preserving the existing three-hour OpenWeather forecast as a non-blocking fallback.
- Keep precipitation probability separate from precipitation amount; probability is confidence that precipitation occurs, not intensity.
- Aggregate the next 12 hours by elapsed time and add bounded downside weighting, making the result stable across one-hour and three-hour forecast cadences.
- Expose dominant approximate factor impacts and data coverage in the UI; do not present the score as a safety guarantee.
- Align activity, commute, comparison, and limited-signal route scoring with the same continuous-score philosophy instead of maintaining independent hard cliffs.


- 2026-08-29 — Do not enable ads, subscriptions, promotional commercial use, or other monetization while Hava81 is using Open-Meteo's free hosted endpoints. The API BFF supports server-only customer-prefixed forecast/air-quality/marine hosts and `OPEN_METEO_API_KEY`; switch those production variables to a paid Open-Meteo plan before commercial activation. Keep CC BY 4.0 attribution/modification disclosure even on the paid endpoint.

## 2026-08-29 — decision UI semantics follow the data actually being scored

- Never label OpenWeather current-response `temp_min/temp_max` as a daily high/low. The primary weather rail uses the normalized daily forecast for that label; absence is preferable to a misleading same-value range.
- Zero precipitation probability remains available to assistive technology but is visually suppressed in repeated forecast/timeline rows. Non-zero probabilities remain visible.
- A user-selected activity clock range is a scoring constraint, not a display-only filter: best-window selection, aggregate activity score and dominant reasons are all derived from eligible slots in that range. The UI states the evaluated range and the activity-specific criteria so nearby 100/98-style scores are explainable.
- Commute preparation is multi-factor. Umbrella advice remains a rain-specific signal, but the headline may instead be heat/cold, wind/gust or air-quality guidance; saved temperature sensitivity shifts commute heat/cold thresholds consistently with personal activity planning.

- 2026-08-29 — Rota havası is a Türkiye intercity product, so its `datetime-local` departure contract and displayed route ETAs use explicit `Europe/Istanbul` wall-clock time rather than the visitor device timezone. Make the timezone visible in the departure label; never let travel/browser timezone silently change the absolute forecast instant being evaluated.


## 2026-08-29 — activity clock-range boundary semantics

- A preferred activity range may cross midnight: when the end clock is earlier than the start clock, evaluate the late-evening and following early-morning slots as one continuous local-clock range.
- Equal start/end clocks mean the selected clock instant, not a hidden full-day range. The UI must not say a score is limited to `18:00–18:00` while silently evaluating the whole day.


- 2026-08-29 — Tests for clock-gated notification behavior must not depend on the runner’s wall clock. Freeze only `Date` to a known daytime instant for ordinary alert tests and keep a separate explicit quiet-hours case; do not disable or weaken the production 22:00–07:00 suppression to make CI pass.


## 2026-08-29 — named explanation groups

- A visible explanatory cluster that has its own `aria-label` must expose a grouping semantic rather than attaching an inaccessible name to a generic container. Daily Plan's score explanation uses `role="group"`; no scoring or visual behavior changes.

- 2026-08-29 — Loading duration alone must not be presented as a diagnosis of server wake-up. Slow-state copy may state the observed delay and bounded possible causes, but it must not invent infrastructure state that the frontend has not measured.


- 2026-08-29 — Product labels must describe the geographic/data objects actually rendered. A province/city marker map must not be called a station map unless real meteorological station entities are present.

- 2026-08-29 — Multi-city comparison uses graceful partial availability: successful cities remain usable when another city fails, but the missing data must be explained. If every selected city fails, show a bounded localized unavailable state; never expose raw provider exceptions while explaining partial/total failure.

- 2026-08-29 — Local persisted preferences must treat removal as a first-class synchronized state change. Clearing a localStorage-backed setting resets the in-memory functional-update ref immediately and propagates a `storage` event with `newValue: null`; consumers interpret that removal as the configured initial value instead of retaining stale cross-tab state.

- 2026-08-29 — Open-Meteo modeled-context surfaces follow the same explicit attribution contract as hourly data: provider link, CC BY 4.0 license link, and a visible indication that Hava81 summarizes/transforms the provider output. Do not rely on an unlinked combined attribution string when the transformed values are displayed to users.

- 2026-08-29 — Comparison refreshes must not present stale result cards under a new selection/language/profile context. Clear prior rows when a new comparison request starts, then show the bounded loading state until replacement data resolves; partial-success preservation applies to the current request only.

- 2026-08-29 — `useAsync.reset()` is a logical cancellation boundary, not only a visual reset. Increment the async call generation on reset so any pre-reset result or error is ignored if it arrives later; this protects handoffs such as city search → current location from stale-response takeover without requiring transport-level abort support.

- 2026-08-29 — Route-weather results are bound to the exact route inputs and departure instant that produced them. Editing departure/origin/destination or starting a replacement request must invalidate the previous corridor result immediately and advance a request generation; late responses from older generations are ignored so old guidance can never repopulate under new parameters.

- 2026-08-29 — User-facing astronomical clock times must be rendered in the weather location timezone, not the visitor device timezone. Use the provider timezone offset consistently across primary and secondary surfaces; keep duration calculations on absolute instants.
- 2026-08-29 — Decision Alert quiet hours are evaluated in the active weather location timezone, not the visitor device timezone. Hava81 serves Turkish provinces; 22:00–07:00 silence must follow the province/provider offset so travelers abroad do not receive locally overnight notifications or lose locally daytime alerts.

- 2026-08-29 — Decision Alerts treat browser storage as an optional capability. Storage exceptions must never escape into the weather experience; if the sent-marker store cannot be read, alert delivery fails closed to avoid duplicate spam, and an opt-in is not considered enabled until its preference is successfully persisted.

- 2026-08-29 — Do not make the entire primary weather/decision surface a live region. Its freshness label updates on a timer, so broad `aria-live` would create repetitive screen-reader announcements unrelated to a new weather decision. Reserve live/status semantics for bounded user-triggered or asynchronously completed results.

- 2026-08-29 — Activity score explainability should expose the measurable effect of activity-specific criteria, not only generic prose. Preserve the weather-only baseline per slot, aggregate baseline and final values with the same time/downside weighting, and show the signed `final - baseline` impact; never imply that the delta is a provider observation or official safety score.
- 2026-08-29 — Persisted user settings are untrusted input even when JSON parsing succeeds. Normalize each supported enum field at the SettingsProvider boundary and fill missing/invalid values from defaults; do not let a generic storage hook cast arbitrary JSON into a complete `UserSettings` contract.
- 2026-08-29 — During the legacy language migration window, SettingsProvider initial state must honor i18n's already-validated startup language when canonical `user-settings.language` is absent/invalid. The legacy key remains read-only; new writes stay canonical in `user-settings`.

- 2026-08-29 — A surface labeled as a real one-hour forecast must receive a contiguous one-hour core series. If required Open-Meteo fields are missing such that normalization would create a timestamp gap, reject that optional hourly enrichment and retain Hava81’s established three-hour fallback rather than presenting sparse points under one-hour semantics. Optional enrichment fields may still be absent without invalidating the core series.

- 2026-08-29 — API freshness metadata must describe the server cache TTL that produced the payload, not a duplicated route constant. Browser/proxy Cache-Control may intentionally be shorter, but UI stale-state logic compares payload fetchedAt with freshForSeconds and therefore needs the actual backend cache lifetime.

- 2026-08-29 — Deploy-time chunk recovery must remain loop-bounded even when browser storage is unavailable. Capture the one-shot recovery timestamp from the temporary URL marker before cleaning the canonical URL; sessionStorage is an optimization/persistence aid, not the only loop guard.

- 2026-08-29 — Frontend in-memory weather cache age must be monotonic-safe at its trust boundary: negative wall-clock age is invalid, not fresh. If the client clock moves behind a cached response timestamp, refetch rather than extending weather freshness beyond the configured TTL.

- 2026-08-29 — User-facing freshness labels must not convert materially future provider timestamps into “just updated.” Allow only the same one-minute clock-skew tolerance used at persisted-weather boundaries; beyond it, report freshness as unknown rather than inventing recency.

- 2026-08-29 — Modeled-context provenance must not publish a materially future provider fetch clock time. Reuse the same one-minute clock-skew tolerance as primary weather freshness; when the fetch timestamp is farther ahead, omit the displayed fetch time while retaining provider/license attribution.

- 2026-08-29 — Local Lighthouse quality gates may use an isolated preview port through `HAVA81_LIGHTHOUSE_PORT`, with 4173 retained as the default. Concurrent worktrees must not kill, reuse or mutate another preview listener merely to run performance audits. Invalid/out-of-range overrides fall back to the established default.

- 2026-08-29 — Persisted weather temperatures are untrusted input even when they are finite numbers. Current, feels-like, minimum and maximum Celsius values outside a broad `-100..100°C` sanity envelope invalidate the local cache and fall back to a fresh BFF request; do not render or score physically impossible finite cache values merely because JSON parsing succeeds.
- 2026-08-29 — Upstream weather schemas should reject finite values that violate unit-independent physical/protocol domains rather than normalizing them into plausible-looking guidance. Bound coordinates, humidity/cloud percentages, wind direction, non-negative wind/visibility, positive pressure and timezone offsets at the OpenWeather adapter boundary; do not add temperature bounds there because that adapter also supports metric, imperial and standard units.

- 2026-08-29 — Browser-side current-weather date revival is a data-trust boundary just like forecast revival. Reject invalid sunrise, sunset, observation and metadata fetch timestamps with a retryable API-data error rather than allowing `Invalid Date` to enter rendering, decisions or persistence.


- 2026-08-29 — API traffic switching is fail-closed: preflight the requested slot with repeated bounded readiness checks before changing nginx; if nginx validation/reload or repeated public readiness fails, restore the exact saved configuration. Do not update current/previous slot markers until the public endpoint is healthy on the new target.


- 2026-08-29 — Treat the browser BFF boundary as untrusted even when the server already validates its upstream provider. Current-weather client revival rejects non-finite numeric data and impossible unit-independent domains before rendering/scoring; do not impose Celsius bounds at this boundary because current-weather requests may use metric, imperial or standard units.

- 2026-08-29 — Do not hide a capability on mobile unless an equivalent mobile control exists. Keep “use my location” reachable in the compact header because the bottom nav has no geolocation action; validate both visibility and no horizontal overflow at 390px and 320px.

- 2026-08-29 — Modeled environmental context must fail closed on impossible physical domains without inventing replacements. Filter negative UV/dust/pollen rows out of rolling maxima; if no valid rows remain, omit the signal. Marine wave height must be non-negative, wave period positive and direction 0–360°, while sea-surface temperature is not sign-bounded. Invalid optional marine context degrades to air-only data.

- 2026-08-29 — OpenWeather pollutant concentration fields are physical concentration measurements and must be non-negative. Reject an upstream air-quality payload containing a negative CO/NO/NO₂/O₃/SO₂/PM2.5/PM10/NH₃ value instead of displaying or scoring an impossible concentration; absence is safer than fabricated correction.

- 2026-08-29 — PWA shell caches must be deploy-scoped rather than a permanent manual version. Stamp the production service worker from generated shell/manifest/hashed-asset identity; fail the build if stamping cannot occur. Continue one forced-tab refresh only for migration from legacy v1/v2 caches, not on every future deploy.

- 2026-08-29 — Browser-side modeled-context and air-quality responses remain untrusted even when the Hava81 BFF validates its own upstream providers. Reject malformed timestamps and impossible physical domains (negative UV/dust/pollen/concentrations, invalid marine geometry/period, AQI outside 1–5) at the browser transport boundary rather than coercing them into plausible-looking guidance.

- 2026-08-29 — When rounded daily high and low temperatures collapse to the same displayed value, show one temperature rather than a duplicated `high / low` pair. Preserve the high/low range only when the displayed values materially differ, and expose an accessible single-temperature label for the equal case.

## 2026-08-29 — browser fixture time semantics

- End-to-end weather fixtures must be relative to the test run rather than hard-coded calendar dates when application code intentionally filters stale forecast rows. This keeps browser tests validating the intended current/fallback behavior instead of failing as time passes.
- Keep the high-resolution hourly success contract and three-hour fallback contract as separate browser assertions so a provider failure cannot masquerade as an empty forecast surface.

- 2026-08-30 — User-facing activity thresholds and sensitivity offsets must follow the selected temperature unit. Convert absolute comfort thresholds with the normal temperature conversion, but convert sensitivity shifts as deltas (difference of converted endpoints), never as absolute temperatures; otherwise a 3°C shift would incorrectly become 37°F.

- 2026-08-30 — Explanatory activity comfort ranges must come from the scoring domain's constants rather than duplicating numeric thresholds in UI code. If scoring thresholds change, presentation should follow the same source of truth automatically.

- 2026-08-30 — Frontend BFF request timeouts cover the full response-consumption boundary, not only time-to-headers. A response body that stalls after headers must remain abortable at the configured deadline rather than hanging weather UI indefinitely.

- 2026-08-30 — Generated city-page bootstrap may reuse a persisted weather cache only within the same one-minute future clock-skew tolerance as the app cache boundary. A materially future cache timestamp must not suppress the early BFF prefetch.

- 2026-08-30 — Persisted current-weather cache pressure must use the same strictly-positive trust boundary as fresh BFF weather. Zero pressure is physically invalid provider/cache data and must fail closed to a fresh request.

- 2026-08-30 — Fresh current-weather observation and provider-fetch timestamps must fail closed when materially in the future, using the same one-minute clock-skew tolerance as persisted current-weather cache. Sunrise/sunset remain exempt because future astronomical event times are normal.

- 2026-08-30 — Fresh forecast metadata (`forecast.meta.fetchedAt` and `hourly.meta.fetchedAt`) must use the same one-minute future clock-skew trust boundary as current weather metadata. Materially future provider-fetch timestamps fail closed as retryable API-data errors; forecast observation times themselves remain forecast data and are not constrained by this metadata guard.

- 2026-08-30 — Modeled context fetch timestamps and marine observation timestamps must fail closed when more than one minute in the future. These are observation/fetch times, not forecast horizons, so materially future values are treated as untrustworthy rather than displayed or corrected.

- 2026-08-30 — Air-quality provider metadata `fetchedAt` must fail closed when more than one minute in the future. Hava81 must not present pollutant measurements as trustworthy when their fetch timestamp is materially ahead of the client clock.

- 2026-08-30 — Client/CDN `Cache-Control` max-age must never outlive the remaining in-memory server cache entry. Preserve `freshForSeconds` as the configured freshness window for UI semantics, but expose remaining cache lifetime separately and clamp route max-age to the smaller of the route policy and remaining server freshness.

- 2026-08-30 — API deploy, rollback, and direct traffic-switch operations share one non-blocking host lock. A concurrent operation must fail closed before reading/mutating deployment state rather than racing Docker/nginx/state markers. A deploy passes its inherited lock descriptor to the traffic-switch child; direct rollback/switch invocations acquire the same lock independently. Readiness probe files are unique per switch invocation and removed on exit.

- 2026-08-30 — Rollback must never guess a target port when `/var/lib/hava81/previous-api-port` is absent, unreadable, or invalid. Require a validated recorded target or an explicit validated operator target; readiness alone does not establish that an arbitrary default port is the intended rollback revision.
- 2026-08-30 — `api_deploy_pending` must represent deployable Oracle API runtime/build drift, not arbitrary changes anywhere under `apps/api`. Determine drift from the deployed revision to main and count only `apps/api/src/**`, API Docker/package/TypeScript build inputs, and `deploy/oracle/docker-compose.yml`. Test/docs-only changes must not trigger a needless blue/green traffic switch. If the deployed revision is not an ancestor of main or GitHub's changed-file list is potentially truncated without finding runtime drift, report deployment state unknown rather than guessing current.

- 2026-08-30 — OpenWeather forecast item timestamps must be non-negative integer Unix seconds, and provider timezone offsets must remain within the same -12h..+14h domain already enforced for current weather. Reject malformed upstream temporal metadata rather than allowing it to distort date grouping.

- 2026-08-30 — A successful OpenWeather forecast payload must contain at least one forecast item. Empty upstream lists are provider-data failure, not a valid empty forecast state.

- 2026-08-30 — Validate sunrise/sunset only as non-negative integer Unix epochs; do not apply observation future-skew guards to astronomical events because future sunrise/sunset values are legitimate.

- 2026-08-30 — The narrow dashboard must explicitly use a shrinkable `minmax(0, 1fr)` outer grid track and a `min-width: 0` primary wrapper. Hiding horizontal overflow is not a valid mobile-fit fix: 320px browser evidence must prove key card bounds remain inside the viewport.

- 2026-08-30 — A truly equal daily high/low is one displayed temperature, not a duplicated range. If two distinct temperatures only collapse under whole-degree rounding, preserve the real spread with one-decimal precision rather than falsely implying equality.

- 2026-08-30 — Current-weather astronomical epochs must satisfy `sunrise <= sunset` at the upstream trust boundary. Individually valid epochs with sunset earlier than sunrise are internally inconsistent and must fail closed; the UI must not turn that provider defect into a plausible-looking zero daylight duration.

- 2026-08-30 — Decision-profile time mutators must enforce the same 24-hour `HH:mm` domain as persisted-profile deserialization. Invalid defined clock strings fail closed before state/storage/analytics mutation; `undefined` remains the explicit clear operation.

- 2026-08-30 — Live user-setting mutations are a runtime trust boundary even when TypeScript constrains normal callers. Reuse the persisted-settings enum validators before state/storage mutation so invalid temperature, wind, theme, or language values fail closed rather than surviving until reload normalization.

- 2026-08-30 — City autocomplete should preserve the existing Turkish-normalized match set but rank prefix matches ahead of substring-only matches. This improves intent resolution without accepting new city identities or changing weather data semantics.

- 2026-08-30 — Disk-pressure health must be decided from the unrounded filesystem ratio, not the rounded display percentage. `maximum_used_percent` is an inclusive ceiling; a true value at or below 92.0% passes the percentage guard while the independent absolute free-space floor still fails closed. This prevents display rounding from creating false host incidents at the boundary.

- 2026-08-30 — Date-only forecast fields are exact calendar identities, not forgiving JavaScript date inputs. Require `YYYY-MM-DD` and an identical parse/serialize round trip so impossible dates such as February 31 fail closed instead of being normalized into a different day and presented as trustworthy forecast guidance.

- 2026-08-30 — User-facing Forecast Atlas prose belongs in the shared locale tables even when the text is parameterized by the available horizon or interval. Keep weather/provider values in component logic, but avoid inline TR/EN conditionals for headings, controls, and attribution copy so localization remains one auditable source of truth.

- 2026-08-30 — Native Web Share capability is proven by a successful share, not merely by `navigator.share` being present. Treat explicit `AbortError` as user cancellation with no fallback, but use clipboard after other native-share failures when available. Record share analytics only after one transport succeeds.


## 2026-08-30 13:20 TRT — do not present duplicate low/high when display precision is flat

- Hourly low/high labels describe the displayed forecast range, not hidden provider precision. If both extrema resolve to the same displayed degree, two separate cards communicate a distinction the UI does not actually show.
- Collapse only the display-flat case into one neutral temperature summary card. Preserve separate extrema whenever the displayed values differ, and do not invent decimal precision merely to force visual separation.

- 2026-08-30 — Open-Meteo forecast temporal metadata is an upstream trust boundary. Require non-negative integer Unix epochs for hourly/daily forecast times and constrain `utc_offset_seconds` to the real-world UTC-12..UTC+14 domain already used for OpenWeather. Reject malformed values instead of allowing them to shift forecast grouping into a plausible-looking wrong calendar.

- 2026-08-30 — Dry hourly forecast slots should not each emit a redundant hidden “no precipitation expected” sentence. Keep one aggregate accessible rain summary for the horizon and explicit per-hour precipitation detail only where probability or measurable accumulation is non-zero; this reduces screen-reader noise without changing weather semantics.

- 2026-08-30 — Open-Meteo `weather_code` is a constrained WMO interpretation code, not an arbitrary integer. Reject unsupported hourly/daily codes at the provider boundary rather than mapping them to a generic condition; unsupported upstream conditions must never be converted into plausible-looking weather guidance.

- 2026-08-30 15:43 TRT — Context-provider modeled series are accepted only when their timestamps parse and every present modeled value array exactly matches the provider time axis. Silent truncation or index drift can understate UV/pollen/dust maxima, so malformed context timelines fail closed rather than being repaired or partially consumed.
- 2026-08-30 15:49 TRT — OpenWeather temperature validation uses a deliberately broad provider-unit envelope (-150..400) rather than unit-specific assumptions because the shared schema serves metric, imperial, and Kelvin modes. This rejects obviously impossible finite upstream values without fabricating corrections or rejecting legitimate terrestrial weather.

- 2026-08-30 15:58 TRT — Zod errors at provider-response boundaries must not escape as request-validation errors. Malformed upstream Open-Meteo context payloads are provider failures (`502 INVALID_CONTEXT_PROVIDER_RESPONSE`), while Zod validation of user query parameters remains a client-side 400. This preserves correct fault attribution without exposing or repairing malformed weather data.
- 2026-08-30 16:04 TRT — OpenWeather visibility is a provider-bound quantity documented in meters with a 10 km maximum. Reject values outside 0..10,000 m at the adapter boundary rather than clamping them, while preserving omission because the upstream field is optional.


- 2026-08-30 16:16 TRT — Treat the Open-Meteo daily time axis as ordered provider identity, not display data that can be repaired. Duplicate or backwards daily epochs make day-to-value association ambiguous, so reject the upstream payload rather than sorting, deduplicating, or presenting plausible-looking reordered weather.

## 2026-08-30 — Required hourly forecast rows must not be silently dropped at horizon edges

- Treat temperature, precipitation probability, weather code, wind speed and day/night flag as required members of every Open-Meteo hourly row.
- If any required row value is missing, reject the provider response rather than shortening the requested forecast. A missing edge row can otherwise evade a post-filter continuity check and make the displayed horizon look complete when it is not.
- Preserve fail-soft omission for optional decision fields such as apparent temperature, humidity, accumulation, gust, visibility and UV; this decision does not broaden provider data or fabricate replacements.

## 2026-08-30 — Fresh current-weather temperature validation follows requested units

- Use the same broad physical temperature domain (-100..100°C) at the browser BFF trust boundary, converted exactly for imperial (-148..212°F) and standard (173.15..373.15K) requests.
- Do not apply a Celsius-only bound to `getCurrentWeather`, because its public client contract permits `metric`, `imperial`, and `standard` units.
- Reject out-of-domain finite values rather than clamping or converting malformed provider/BFF data into plausible guidance.

- 2026-08-30 — Fresh forecast temperatures use the same broad physical metric trust domain as current-weather validation because the browser forecast endpoints currently request/contract metric data. Daily extrema, hourly temperature, and optional apparent temperature outside -100..100°C fail closed rather than being displayed, clamped, or repaired.
- 2026-08-30 — Hava81 browser decision alerts must visibly identify themselves as modeled Hava81 guidance and explicitly state that they are not official MGM MeteoUyarı warnings. This disclosure is product/safety provenance only; it must not imply an MGM feed or change modeled alert thresholds.

- 2026-08-30 — Route-weather segment temperatures are metric by service contract and must use the same -100..100°C browser trust domain as other metric forecast values. Reject out-of-domain finite route temperatures rather than allowing them to influence travel guidance or route scores.
- 2026-08-30 — Route origin/destination reversal should be a single explicit action, and invalid same-city route selection must explain why route checking is unavailable. Keep the swap compact on mobile while preserving an accessible text name.

- 2026-08-30 — Explicit navigation between two valid province routes should create browser history (`pushState`) so Back/Forward can traverse prior cities. First-load/root/trailing-slash canonicalization should continue using `replaceState` to avoid duplicate history entries; popstate-driven loads must not push themselves again.
- 2026-08-30 — A share action must not fail as a silent no-op when no usable transport exists. Preserve explicit native-share cancellation as neutral user intent, but surface unavailable/permission failures as temporary localized UI state without recording successful-share analytics.


- 2026-08-30 — SPA city navigation must keep canonical URL, document title, Open Graph URL/title/image-alt, Twitter title/image-alt, and locale metadata coherent with the active city/language. Generated city pages remain authoritative for crawler-first descriptions/structured data; runtime metadata synchronization must not synthesize weather claims.
- 2026-08-30 — SPA city/language navigation should keep standard, Open Graph, and Twitter description metadata coherent with the active canonical city using localized product-capability copy only. Runtime metadata synchronization must not fabricate weather claims; generated city pages remain crawler-first.
- 2026-08-30: A visible retry must repeat the failed interaction class. Geolocation-specific errors (`LOCATION_DENIED`, `LOCATION_UNAVAILABLE`, `LOCATION_TIMEOUT`) retry the geolocation flow; unrelated weather errors keep the city retry path. This avoids a successful-looking fallback that does not perform the action the user asked to retry.

- 2026-08-30 — A sanitized `RATE_LIMIT` error should tell the user that request volume is the problem and that a short pause is appropriate. Keep provider detail hidden and do not change automatic retry policy merely to improve copy.

- 2026-08-30 — Notification capability absence is not equivalent to denied permission. If the browser lacks the Notification API, present a localized unsupported/unavailable state and do not instruct the user to change permission settings. Explicit `permission === denied` retains browser-settings guidance; weather and decision guidance must remain fully usable in either case.
- 2026-08-30 — A same-city current-weather refresh may keep the last successful payload visible while a replacement request is pending or fails; this is continuity, not fabricated freshness. Different-city and language handoffs must clear prior current weather before loading so data from another province or localization is never shown under the new context. Dismissing a refresh error must not destroy a retained successful payload.

- 2026-08-30 — A visual forecast skeleton that replaces not-yet-available forecast content must expose a polite status message to assistive technology. Keep the loading copy localized and screen-reader-only when the visual skeleton already communicates progress; do not turn loading UI into a weather claim.

- 2026-08-31 — Missing optional AQI in comparison must remain visibly unknown. Do not render an unavailable AQI as `—/5`, which visually suggests a value on the five-point scale; show a standalone em dash while keeping real AQI values as `n/5`.

- 2026-08-31 — Decision-card timestamps must describe the observation that actually determines the displayed value. If current apparent temperature is more extreme than every forecast hour, heat/cold guidance stays untimed/current; attach a future time only when the forecast point is at least as extreme as the current observation.

- 2026-08-31 — Current air quality is an observation, not a future commute forecast. Do not project the current OpenWeather AQI into later outbound/return commute scoring, advice, or share summaries. Keep current AQI on explicitly current/overall air-quality surfaces unless a time-aligned future air-quality source with verified freshness semantics is introduced.

- 2026-08-31 — Once the frontend BFF validator marks an hourly weather field mandatory, the normalized domain type should match that guarantee. Deliberate malformed-data boundary tests may use explicit invalid-fixture casts to exercise runtime fail-closed behavior rather than weakening the production type or preserving synthetic fallbacks such as missing wind becoming `0`.

- 2026-08-31 — OpenWeather forecast timezone metadata is required provider identity, not a field that may default to UTC. If city.timezone is absent, fail closed at the upstream schema boundary rather than silently grouping forecast rows under offset 0 and presenting plausible-looking wrong local days/hours.

- 2026-08-31 — Browser BFF secondary-data envelopes are runtime trust boundaries too. Context, air-quality, and route payload containers/nested records must be objects before field access; malformed shapes fail closed as the existing retryable API-data error instead of leaking raw `TypeError`s or continuing into decision surfaces. This validation does not repair, infer, clamp, or fabricate any weather, AQ, UV, marine, route, or safety value.

- 2026-08-31 — Context unit metadata is executable display input, not decoration. Require the context `units` container to be an object and every present unit to be a string before it reaches UI formatting; malformed or missing unit metadata fails closed rather than crashing or inventing fallback units.

- 2026-08-31 — Route-weather timestamps are part of the BFF trust boundary, not free-form display metadata. Segment ETA must remain consistent with requested departure + estimated duration × corridor fraction, and the current producer's better-departure candidate remains exactly +3 hours with improvement equal to candidate score minus primary score. Reject inconsistent envelopes rather than presenting valid weather against a plausible-looking wrong travel time.

- 2026-08-31 — Normalized air-quality data must carry metadata because the API contract and browser BFF validator already require it and freshness continuity depends on it. Keep `AirQuality.meta` required after normalization; malformed or missing upstream/BFF metadata fails closed before the normalized domain object exists rather than being represented as an optional internal state.

- 2026-08-31 — Normalized current weather timezone is required identity because the browser BFF validator already requires it and current city-local decisions depend on it. Keep `timezoneOffsetSeconds` required in `CurrentWeatherMeta` and remove UTC fallbacks from normalized-current consumers; shared air-quality metadata may omit timezone because that endpoint does not contract it. Malformed current timezone fails closed rather than being defaulted to UTC.

- 2026-08-31 — Required normalized hourly wind must never regain an internal calm-wind fallback after BFF validation. Consumers of `HourlyForecast.windSpeed` should use the required value directly; only genuinely optional gust may use a neutral absent-value fallback. Malformed required wind fails closed at the BFF boundary rather than becoming `0`.

## 2026-08-31 11:18 TRT — decision value invariants

- Model weather decisions as a discriminated union: rain, wind, heat, cold, AQI and UV decisions require a numeric value after construction. Do not mask impossible internal states with UI fallbacks such as zero or em dash; reserve optional value semantics for context-only decisions that do not present that field.
## 2026-08-31 11:23 TRT — commute timezone contract

- Commute planning requires an explicit validated location timezone offset. Do not silently reinterpret a missing offset as UTC; callers with genuine UTC locations must pass `0` explicitly.

## 2026-08-31 — A new service worker must secure the root shell before activation

- `/` is the critical offline navigation fallback for a versioned Hava81 service-worker cache. If fetching or caching it fails during install, the install must reject so the previous active worker and cache remain authoritative.
- Optional shell metadata such as `/manifest.json` stays best-effort and must not block an otherwise usable upgrade.
- This prevents transient deploy/network failures from activating an empty versioned cache and then deleting the user's previously usable offline shell during activation.

## 2026-08-31 — Preserve real daily ranges that collapse under integer rounding
When converted daily min/max values are genuinely different by at least 0.1° but round to the same integer, render both with one decimal. This avoids presenting a false flat daily temperature while keeping the normal compact integer display for ordinary ranges and a single value for effectively identical temperatures. No provider data or forecast semantics are altered.


## 2026-08-31 — Comparison scores must carry their qualitative meaning
A bare `/100` score is not sufficient context in comparative decision surfaces. Wherever city comparison exposes a daily or activity Hava81 score, pair it with the existing score-band label derived from the same plan object. Reuse the established bands rather than inventing a second interpretation scale, and do not change the scoring model merely to improve presentation.
## 2026-08-31 — Route and commute scores reuse the established qualitative bands
Route and commute decision surfaces should not expose bare numeric Hava81 scores when the score model already has a qualitative band vocabulary. Route scores derive the band with the shared `getScoreBand` function; commute windows use the band already returned by the commute planner. This is presentation-only and must not alter route risk enums, thresholds, scoring weights, or weather data.

## 2026-08-31 — Shared decision scores carry the same band as the in-app plan
A shared Hava81 decision must not reduce an explainable in-app score back to a bare `/100` number. The share builder receives the plan's existing score band and localizes that band for Turkish/English output. It must not infer new weather semantics or alter the score when generating share copy.


## 2026-08-31 — Shared best-time labels must also be valid for ranges
The daily-plan share payload uses one field for either a single best time or a multi-hour range. Share copy therefore uses range-safe wording (`En uygun zaman / Best window`) rather than asserting that the value is always one clock time.

## 2026-08-31 — Difficult-day notifications keep the same qualitative score meaning
A browser notification that includes a Hava81 `/100` score must pair it with the same localized score band already computed by the daily plan. Notification rendering may localize that band but must not reinterpret the score, change alert thresholds, or imply official MGM warning provenance.

## 2026-08-31 — Factor impact numbers are explanatory averages, not direct deductions
The `≈−X` values shown in the daily-score breakdown describe 12-hour duration-weighted average factor penalties. Because the final daily score also emphasizes the most difficult quarter of the window and may apply low-slot caps, UI copy must not imply those values subtract one-for-one from 100. This is an explanation contract only; it does not change scoring math.

## 2026-08-31 — Enlarged text must not turn activity filters into fixed-width layouts
Activity preferred-time controls may preserve their desktop proportions, but their grid tracks must be allowed to shrink to the available card width. Avoid hard `rem` minimums on the multi-column filter row because user text enlargement scales those minima and can create page-level horizontal overflow. This is layout-only; activity scoring/window semantics remain unchanged.

## 2026-08-31 — Compact-tablet outer gutters must not grow with enlarged text
At the 768px breakpoint seam, rem-scaled header outer padding can consume enough horizontal space to clip otherwise valid enlarged controls even when the document suppresses horizontal scrolling. For the compact-tablet header, cap horizontal gutters at the normal 32px spacing value while allowing typography and controls themselves to enlarge. This preserves normal-size layout and WCAG-style text reflow without hiding the right edge of interactive actions.

## 2026-08-31 — Fixed layout minima must not scale into content constraints under text resize
A rem-based minimum column width is appropriate when it represents readable content width, but not when that minimum is an outer layout allocation that can starve a more important decision surface at 200% text. For the desktop forecast sidebar, retain its normal 352px minimum with `min(22rem, 352px)` so typography can enlarge without the sidebar allocation itself doubling. Long dynamic guidance also receives explicit wrapping rather than relying on document-level overflow clipping.

## 2026-09-01 — Settings trigger exposes its dialog relationship
The header Settings control opens a modal dialog, so its accessibility contract should expose `aria-haspopup="dialog"`, live `aria-expanded`, and `aria-controls` pointing to the dialog's stable id. The dialog keeps its existing modal/focus-trap behavior; this change adds relationship/state semantics only and does not alter settings, weather, scoring, provider, or safety behavior.

## 2026-09-01 — Unknown precipitation must remain unknown in current-only fallbacks
Current weather does not contain a forecast precipitation probability. When an hourly forecast is absent, decision/activity fallback scoring must not synthesize `0%`, because that turns missing evidence into a dry-weather claim and can yield a false "no umbrella" recommendation. The scoring domain now permits precipitation probability to be unknown: absent probability/amount contributes no invented rain penalty or reason, but also cannot earn dry-weather activity benefits. Umbrella guidance becomes `unknown` when no precipitation signal exists at all; genuine forecast `0%` remains an explicit dry signal. UI/share copy renders the distinction as unavailable data rather than "not needed"/"dry".

## 2026-09-01 — Missing near-term forecast is unavailable, not stable
A decision surface may report `stable` only when it has actual near-term forecast evidence to assess. If the hourly forecast is absent and no independent current/context hazard is actionable, represent near-term guidance as unavailable rather than asserting that no material risk stands out. This is an evidence/provenance rule only: it must not synthesize weather values, change hazard thresholds, or suppress valid current wind/heat/cold/AQI/UV decisions.

## 2026-09-01 — Observer CI state follows the CI/CD workflow for the newest exact SHA
GitHub can expose multiple workflow runs for one commit. Operational merge/deploy truth must not depend on whichever workflow appears first. For each PR exact head and for the newest main SHA, prefer the repository `CI/CD Pipeline` run; keep a bounded history deep enough to cover concurrent open automation PRs. CodeQL remains an independent required gate but must not stand in for deployment-pipeline state.

## 2026-09-01 — Lighthouse performance uses a hard floor plus a higher target
CI Lighthouse performance is materially noisier than the other categories on GitHub-hosted runners: six recent successful main samples ranged from 69 to 97 while accessibility stayed 100, best-practices 96 and SEO 100. Treating the observed performance target as a hard pass/fail threshold would create flaky releases, but leaving it warning-only provides no catastrophic-regression protection. Use a 60 hard floor plus an 80 warning target for performance, and evidence-supported 95 hard floors for accessibility, best-practices and SEO. Log FCP/LCP/TBT/CLS/SI on every run so future optimization is driven by metrics rather than category-score cosmetics.

## 2026-09-01 — Favorite city controls must expose visible temperature context
Saved-city buttons render cached temperature as meaningful quick-decision context. An explicit `aria-label` overrides descendant text for assistive technology, so the accessible name must carry the same converted temperature/unit when available. Missing cached temperature must remain a city-only label rather than inventing a value. This is presentation/accessibility only; the underlying weather and conversion functions remain the source of truth.

## 2026-09-01 — Skip navigation must transfer keyboard focus, not only scroll
A skip link to the main weather content must land on a programmatically focusable main landmark so keyboard users actually leave repeated header controls. Keep the landmark out of the normal Tab order with `tabIndex={-1}`; the link remains the entry point. This is navigation/accessibility semantics only and does not alter weather, scoring, provider, or safety behavior.

## 2026-09-01 — Commute precipitation deltas require two measured amounts
A return-vs-outbound precipitation-amount change is meaningful only when both windows provide finite precipitation amounts. Missing amount data must not be coerced to 0 for comparison. Probability-based change logic and umbrella advice may still use their independently available verified signals.

## 2026-09-01 — Score-engine wind is required evidence, never an implicit calm fallback
The shared Hava81 score engine must require a finite validated sustained-wind input from its producer. Missing wind must fail at the type/trust boundary instead of becoming `0 m/s` inside apparent-temperature or wind scoring. Optional gust remains optional because absence of gust is a legitimate provider state.

## 2026-09-01 — Large GitHub Actions observer reads get a dedicated bounded timeout
Keep normal observer HTTP calls on the tight 6-second default, but allow the `actions/runs?per_page=100` response up to 12 seconds because its payload is materially larger and measured network latency can exceed 6 seconds. The oneshot service still has a 55-second hard systemd ceiling, so this improves CI observability without allowing an unbounded observer or weakening production health timeouts.
## 2026-09-01 — Observer CI state follows evidence: unknown is not running
When an open PR head has no matching workflow in the observer's bounded GitHub runs window, report it as `ci_unknown`, not `ci_running`. Only explicit queued/in-progress/waiting/pending workflow states count as running. This prevents stale PRs from looking perpetually active while preserving direct GitHub re-verification as the merge authority.
## 2026-09-01 — Daily-plan score actions must wrap at compact-tablet text resize
At the 768px breakpoint, 200% root text can make the daily-plan heading, share action, and score band compete for one fixed flex row even though the page itself clips outer overflow. Allow the header and action group to wrap, keep the copy child shrinkable, and cap the score minimum to its available width. This is presentation-only; Hava81 scoring, weather inputs, share semantics, and safety guidance are unchanged.

## 2026-09-01 — Modeled context values require provider-supplied units
A modeled dust, pollen, wave-height, wave-direction, wave-period or sea-temperature value is not presentation-safe without its matching provider unit. The browser trust boundary must reject a present value whose unit is missing or blank; the UI must not substitute assumed physical units. Missing measurements may remain absent, but a displayed measurement must preserve both the provider value and provider unit.
## 2026-09-01 — Aggregate modeled values keep the unit from the winning source series
When a UI aggregate chooses the maximum across multiple provider series, the displayed unit must be selected atomically from the same series as the winning value. Never choose the numeric maximum and unit through separate fallback rules, even if today's provider happens to use identical units.

## 2026-09-01 — Partial activity time ranges must not look applied
The Activity Planner applies a custom time filter only when both start and end are present. If exactly one bound is selected, keep the default scoring behavior but explicitly tell the user that both times are required, and connect that status to both time inputs for assistive technology. Do not coerce, infer, or auto-fill the missing bound; overnight and equal-time semantics remain owned by the existing activity-window model.
## 2026-09-01 — Intentional horizontal weather scrollers must be keyboard reachable
When a responsive Hava81 surface intentionally uses horizontal overflow to preserve readable weather cards, make the labeled scroll container keyboard-focusable and provide a non-clipped `:focus-visible` indicator. Do not replace readable cards with compressed text merely to avoid scrolling.

## 2026-09-01 — Non-interactive timeline scrollers need a keyboard entry point
A horizontal weather timeline made of non-interactive cards cannot rely on child focus to expose off-screen content. Keep the labeled list semantics, make the scroll container itself keyboard-focusable, and render the focus indicator inside its clipped border so it remains visible.

## 2026-09-01 — Partial commute time selections must be explicitly incomplete
The commute planner calculates a decision only when both departure and return times are present. If exactly one bound is selected, render a distinct localized incomplete-state message and associate both time inputs with it via `aria-describedby`. Do not infer or auto-fill the missing time; once both values exist, remove that relationship and let the normal forecast/decision state take over. This is state clarity/accessibility only and does not change weather evidence, scoring, commute matching, or safety guidance.
## 2026-09-01 — Invalid route endpoint combinations describe the selects as well as the action
When route origin and destination are identical, the existing inline status explains why route checking is disabled. Associate that same status with both endpoint selects, not only the disabled submit action, so assistive-technology users encounter the validation context while editing the fields that caused it. Remove the relationship as soon as the endpoints differ. This is accessibility semantics only; route identity, weather data, scoring and safety behavior remain unchanged.

## 2026-09-01 — Unavailable decision-alert actions expose their existing explanation
When browser notifications are unsupported or permission is blocked, the disabled decision-alert action already has visible explanatory copy. Associate that same copy with the action via `aria-describedby` so the reason remains part of the control's accessibility contract. Do not change notification permission, opt-in, delivery, deduplication, weather evidence, or safety behavior.

## 2026-09-01 — Notification permission prompts are single-flight and visibly busy
Treat the browser notification permission prompt as one in-flight operation. While it is pending, disable the alert opt-in action, expose `aria-busy`, and show the existing localized loading copy so rapid repeat activation cannot issue duplicate permission requests. If the browser rejects the promise, fail closed with alerts disabled and restore the action for retry. This does not alter weather evidence, alert thresholds, quiet hours, MGM provenance, delivery deduplication, or safety guidance.

## 2026-09-01 — Current-location action exposes shared weather loading state
When the current-location header action is disabled because the shared weather request is in flight, expose the same state with `aria-busy`. This keeps the icon-only control's programmatic state aligned with the visible/main-content loading state without changing geolocation, weather acquisition, provider, scoring, MGM, UV/AQI, or safety behavior.


## 2026-09-01 — Notification permission prompts are single-flight and visibly busy
Treat the browser notification permission prompt as one in-flight operation. While it is pending, disable the alert opt-in action, expose `aria-busy`, and show the existing localized loading copy so rapid repeat activation cannot issue duplicate permission requests. If the browser rejects the promise, fail closed with alerts disabled and restore the action for retry. This does not alter weather evidence, alert thresholds, quiet hours, MGM provenance, delivery deduplication, or safety guidance.

## 2026-09-01 — Daily-plan sharing is single-flight and visibly busy
Treat a native-share/clipboard delivery as one in-flight user action. While the share transport is unresolved, keep an in-memory guard, disable the share action, expose `aria-busy`, and show localized loading feedback. Always release the guard in `finally`, including AbortError/failure paths, so cancellation or failure remains retryable. This changes only share transport state; weather evidence, scoring, providers, MGM, UV/AQI and safety guidance are unchanged.

## 2026-09-01 — Disabled activity choices expose the selection-limit reason directly
When three activities are selected, each additional disabled activity choice must reference the existing visible limit explanation with `aria-describedby`, rather than relying only on the surrounding group relationship. Selected choices stay enabled so users can remove one. This changes only accessibility semantics; activity scoring, weather evidence, thresholds, providers, MGM, UV/AQI and safety guidance remain unchanged.

## 2026-09-01 — Stable commute preparation copy must not exceed the signals it checks
The commute preparation advice currently derives explicit carry/preparation actions from precipitation, apparent temperature and wind. Its stable fallback must name that scope instead of claiming that no extra weather preparation is needed in general, because optional UV, air-quality and other evidence may be absent or surfaced elsewhere. This is wording/evidence scope only; commute matching, score math, weather values and safety thresholds are unchanged.

## 2026-09-01 — Map reveal controls use disclosure semantics, not toggle-button semantics
Both controls that show/hide the weather map control the visibility of `weather-map-region`; `aria-expanded` + `aria-controls` expresses that relationship. Do not also expose `aria-pressed`, which describes a persistent toggle-button state and can produce redundant/conflicting announcements. The visible label continues to switch between show/hide map.

## 2026-09-01 — Search suggestions support Home/End keyboard navigation
The city search is an ARIA combobox with a visible listbox. When suggestions are open, Home and End should move the active descendant to the first and last visible option instead of falling through to text-caret movement. Keep ArrowUp/ArrowDown wrapping behavior unchanged and preserve Enter selection/Escape dismissal semantics. This is keyboard accessibility only; city matching, debounce, weather fetching, providers and decision logic are unchanged.
## 2026-09-01 — Comparison refresh exposes its busy region state
When saved-city comparison data is being replaced, the labeled comparison region must expose `aria-busy=true` in addition to its visible loading status. Clear the busy state when loading settles. This is asynchronous-state accessibility only; comparison requests, weather evidence, score calculation, winner selection and failure handling are unchanged.

## 2026-09-01 — Route result replacement exposes a busy content state
When a route-weather request is in flight, mark the route content body `aria-busy=true` as well as the submit button. Clear it when the request is invalidated or settles. This communicates that the result area itself is being replaced, without changing route timing, weather modeling, provider calls or error semantics.

## 2026-09-01 13:50 TRT — comparison navigation semantics
- Treat the desktop header comparison action as navigation, not a pressed toggle: expose `aria-current="page"` only while the saved-city comparison view is active. Keep toggle semantics (`aria-pressed`) for controls that actually switch a persistent binary state.

## 2026-09-01 14:00 TRT — browser GET cache retention
- Keep the browser response cache freshness window unchanged, but bound retained response objects to 128 fresh GET keys and prune expired/future-skewed entries on successful cache writes. Cache eviction may cause an older key to refetch, but must never make stale data live longer or fabricate fallback data.

## 2026-09-01 — Hava81 shortcuts must not override browser bookmark or hard refresh
Do not bind hidden application actions to standard browser recovery/navigation commands such as `Ctrl/Cmd+D` (bookmark) or `Ctrl/Cmd+Shift+R` (hard reload). Favorite toggling and weather refresh already have visible controls, while browser bookmark and hard-refresh behavior is user-agent functionality Hava81 should preserve. Keep only deliberate, discoverable app shortcuts that do not remove important browser escape/recovery paths.

## 2026-09-01 — Offline navigation shell cache keys ignore query variants
Hava81's generated root/province HTML shell is pathname-defined; query parameters are not weather evidence and do not change the shell document. Keep network navigation requests intact, but normalize successful service-worker navigation cache keys to same-origin pathname so UTM/share/cache-bust variants cannot retain duplicate offline HTML. Preserve distinct province path entries and keep API/weather responses outside service-worker caching.

## 2026-09-01 — Focus rings inside clipped disclosure cards must render inward
When a keyboard-focusable disclosure such as Route Weather's `<summary>` sits on the edge of an `overflow: hidden` rounded card, do not rely on an outer user-agent outline that may be clipped. Use an explicit `:focus-visible` indicator inset within the card boundary. This is presentation/accessibility only and must not alter disclosure, route or weather semantics.
## 2026-09-01 — Modeled-context fetch clocks use the weather-location timezone
Provider `fetchedAt` is an absolute freshness timestamp; when Hava81 displays its clock time beside context attribution, format it using the validated current-weather location offset rather than the viewer device timezone. Apply future/staleness checks to the absolute instant before presentation. This changes only the displayed clock context and must not alter provider values, freshness thresholds, modeled guidance or safety semantics.

## 2026-09-01 — Native disclosure focus rings must be explicit on Activity Planner
Activity Planner `<summary>` controls are keyboard-operable application controls, so do not rely on browser-default focus styling that varies by engine/theme and can render outside rounded surfaces. Give the window help, score explanation and per-card detail summaries an explicit `:focus-visible` indicator using the shared focus token, inset inside their own boxes. This is presentation/accessibility only and does not change activity scoring, forecast evidence or guidance semantics.

## 2026-09-01 — Full-height mobile shells prefer dynamic viewport units with vh fallback
Keep `100vh` as a compatibility fallback, then override with `100dvh` for full-height app/root/body and viewport-derived main/fatal surfaces. Mobile browser chrome can change the visual viewport while a page is open; dynamic viewport units follow that change and avoid stale oversized/undersized shells. This is layout ergonomics only and must not alter weather data or guidance semantics.

## 2026-09-01 — bound Pages rollback/propagation asset retention

**Decision:** Preserve only recent prior hashed Pages assets for 30 minutes during deployment, with an explicit 32-generation metadata cap; never retain source maps and reject unsafe paths.

**Why:** Static HTML and hashed assets can propagate/cache on different timelines. Keeping a short bounded overlap avoids stale-HTML → missing-chunk failures without turning the publish branch into unbounded storage. This is a deployment reliability safeguard only; it does not cache or alter weather/API responses.

## 2026-09-01 — post-deploy static smoke verifies the exact current boot asset set
Treat exact HTML propagation and asset propagation as separate release conditions. After the deployed root matches `dist/index.html`, enumerate its same-origin `/assets/` script/link references and require each public response to hash-match the corresponding built file. This complements short previous-generation retention: retention protects stale clients, while current-asset verification protects the newly published shell from partial edge propagation.


## 2026-09-01 — browser/performance CI jobs have bounded wall-clock budgets
Use a 10-minute job timeout for Playwright browser flows and 5 minutes for Lighthouse. These gates normally finish far below those limits; bounding them prevents external browser/package stalls from consuming the default multi-hour GitHub Actions allowance while preserving enough headroom for cold runners.

## 2026-09-01 — Lighthouse performance floor uses one confirmation measurement
When the first Lighthouse performance score falls below the hard floor, run exactly one confirmation measurement and evaluate that second result. Do not retry deterministic accessibility/best-practices/SEO failures, and do not loop retries. This handles observed GitHub-runner contention without weakening persistent-regression detection or turning CI into a best-of-N score hunt.

## 2026-09-01 — City suggestion activation uses Pointer Events
Use Pointer Events for direct city-suggestion activation instead of mouse-only handlers. Prevent the pointer-down default so the combobox does not blur and close its list before selection, while letting mouse, touch and pen share one activation path. This is input ergonomics only; city matching, request semantics and weather evidence are unchanged.

## 2026-09-01 — Comparison minimum-state transitions settle busy state
When saved-city comparison drops below its two-city minimum, treat that transition as a settled non-loading state even if a superseded request is still resolving. Keep the existing stale-result guard, clear `aria-busy`, and show the minimum requirement immediately. This changes async-state semantics only; it does not cancel or reinterpret weather evidence.

## 2026-09-01 — Notification permission is re-read when the page becomes visible
Treat browser notification permission as external mutable state, not a mount-time constant. When Hava81 becomes visible again, re-read `Notification.permission` so browser/site-settings changes immediately re-enter the existing permission gates. Do not auto-enable alerts or alter stored opt-in; this only makes the UI and delivery eligibility reflect the browser's current authority.

## 2026-09-01 — Route result language follows the current interface language
Route corridor payloads may contain provider-localized descriptions, so a language change invalidates any rendered or in-flight route result that was requested under the previous locale. Reuse the existing request-generation guard to ignore late responses; do not translate provider text locally or fabricate replacement descriptions.

## 2026-09-01 — Language refresh does not change the user's weather source mode
Treat city-vs-current-location as user intent independent of provider localization. A language change may re-fetch the already known city name to refresh localized provider text without prompting for geolocation, but it must not convert a successful current-location session into city mode. Preserve that source identity in memory so later stale/online refreshes can reacquire current location. Explicit city searches still switch to city mode, and failed location attempts do not replace the previously successful source.

### 2026-09-01 19:53 TRT — async regression tests must wait for operation settlement, not only invocation
**Decision:** When a regression test triggers an async refresh and then simulates a later lifecycle event, wait for the refresh's observable settled state before advancing clocks or dispatching that later event. A mock being called proves only that the operation started.

**Why:** Main CI #1339 exposed a race in the new current-location/language regression test: it waited for `getCurrentWeather(...)` invocation, then immediately made the result stale and dispatched `visibilitychange`. `useWeather` intentionally suppresses stale refreshes while another request is loading, so runner timing could make the location refresh assertion fail even though product behavior was correct. Waiting for `isLoading === false` models the intended sequence and keeps the test strict about reacquiring current location after the settled localized refresh becomes stale.
### 2026-09-01 20:07 TRT — route result header may wrap under large text
**Decision:** Allow the route-result title/summary column and score badge to wrap instead of forcing one horizontal row at large text sizes.

**Why:** Hava81's route result is decision content, not a fixed dashboard chrome element. Under WCAG-style 200% text resizing, preserving readable text and eliminating page-level horizontal overflow is more important than retaining the desktop one-row arrangement. The change keeps normal-width hierarchy intact while making the constrained state responsive.

## 2026-09-01 — Bound Pages propagation verification without weakening exact hashes

- Main run #1345 pushed `gh-pages` successfully, while its public-shell gate still saw the previous root HTML for the full 55-second default retry window. Every upstream quality gate (frontend, API, build, browser, Lighthouse) was green, so the failure was propagation latency rather than a generated-artifact failure.
- Keep exact SHA-256 equality for HTML and current boot assets. Do **not** downgrade the deploy check to HTTP-200-only or accept stale content.
- Give only the CI deploy job 36 attempts at the existing 5-second interval (roughly a three-minute propagation window) and cap the whole deploy job at seven minutes. The standalone verifier keeps its shorter default so manual outage probes remain bounded.

## 2026-09-01 — Retry Lighthouse process startup once, never score failures

- Hosted GitHub runner failures have now repeated where Lighthouse exits with `Unable to connect to Chrome` before producing a report, while adjacent runs on the same code pass and Browser flows successfully launch Chromium.
- Treat a Lighthouse process/report-generation failure as retryable exactly once inside the existing measurement runner. This retry occurs before score evaluation; accessibility/performance/best-practice/SEO floors are unchanged and a second process failure still fails the gate.
- Keep the existing separate confirmation measurement for a produced performance score below the hard floor. Infrastructure startup retry and performance-score confirmation serve different failure modes and must not be conflated.

## 2026-09-01 — Worktree cleanup must prove source is already represented on main

Autonomous host hygiene may remove rebuildable validation artifacts, or an entire linked checkout when explicitly requested, only when that worktree is clean and its HEAD is either an ancestor of `origin/main` or every branch patch is already represented on `origin/main` according to `git cherry`. This covers squash-merged PR branches without treating a merely closed/stale branch as merged. The primary/current worktrees, dirty worktrees, unmerged patches, branch refs, Git metadata and Docker/runtime resources are excluded.


## 2026-09-01 — Route departure picker bounds refresh when the user returns to it

Treat the native `datetime-local` min/max as presentation guardrails, not a mount-time snapshot. A long-lived Hava81 tab may remain open while the current time advances, so refresh the picker bounds when the departure control receives focus. Keep submit-time validation authoritative and use the same 18-hour route horizon constant for both layers; this changes neither modeled route weather nor provider/safety semantics.

## 2026-09-01 — Runner shutdown regression gets an outer budget larger than its internal waits

The Playwright SIGTERM regression intentionally allows up to 5 seconds for each of two descendant processes to disappear, so Vitest's default 5-second test timeout is internally inconsistent and can fail under host contention before the test's own bounded checks complete. Give only this regression a 12-second outer timeout; do not change production shutdown grace, descendant wait bounds, or CI job limits.

## 2026-09-01 — Freshness labels refresh on clock boundaries, not mount-relative intervals

Weather freshness text is derived from provider evidence timestamps and the current clock. Keep that evidence immutable, but schedule UI-only age-label refreshes at the next minute boundary and resync when a suspended tab becomes visible. This avoids up-to-59-second mount-relative drift without increasing polling or synthesizing weather data.
## 2026-09-01 — Hourly “now” markers advance without requiring a weather refetch

The hourly forecast's `aria-current="time"` and visual “now” marker describe clock context, not provider evidence. Keep forecast data immutable between refreshes, but reschedule the marker at the next location-local hour boundary and resync it when a hidden tab becomes visible. Use one boundary timer rather than a frequent polling interval; this must not synthesize forecast rows or change weather freshness/scoring semantics.

## 2026-09-01 — Provider stale-state UI flips at the evidence TTL boundary

Provider `freshForSeconds` is an evidence freshness contract, not merely display copy. Schedule the decision-field clock at the earlier of the next minute label boundary or the exact fetched-at + freshness TTL boundary, with the existing small timer cushion. This updates only UI freshness state; it must not refetch, extend, interpolate, or otherwise alter weather evidence.

## 2026-09-01 — Optional environmental evidence expires in-memory at provider TTL

AQI and modeled context signals (UV/pollen/dust/marine) must not remain decision inputs indefinitely just because a long-lived tab receives no subsequent forecast refresh. Treat each source's `fetchedAt + freshForSeconds` as an in-memory evidence deadline: retain a still-fresh value through a transient optional-source failure, but fail closed by removing it once its own TTL passes. Do not extrapolate, refresh the timestamp, or substitute modeled values.

## 2026-09-01 — Pages exact-hash verification gets a measured ten-minute propagation window

The three-minute Pages smoke window is no longer sufficient evidence of deploy failure. Main run #1378 pushed `gh-pages` successfully at 19:00:32Z, but the custom domain continued serving the prior healthy shell until the new root hash appeared at 19:07:29Z (~6m57s later); the response advertises `Cache-Control: max-age=600`. Keep exact HTML and boot-asset hashes as the release gate and retain prior asset generations, but allow up to 120 five-second attempts (~10 minutes) with a 12-minute deploy-job cap. Do not weaken this to HTTP-200-only, and keep the standalone verifier's shorter default for manual probes.

## 2026-09-01 — Pending modeled alerts wake at the location-local quiet-hours boundary

Quiet-hour suppression is a time-dependent delivery gate, so an enabled alert candidate that exists before 07:00 must be reconsidered when the weather location leaves quiet hours even if no weather result changes. Schedule one timeout to the location-local 07:00 boundary only while quiet, then re-enter the existing permission/dedupe/storage checks. Do not poll, refetch weather, extend evidence freshness, or bypass quiet hours.

## 2026-09-01 — Saved commute plans re-evaluate at the next outbound clock boundary

The commute planner's “next occurrence” semantics are time-dependent. A long-lived tab must re-run the existing plan when the saved outbound time passes in the weather location timezone, otherwise an already-passed window can remain visible. Use one timer to that boundary with a small cushion; do not poll, refetch weather, alter saved clocks, or extend forecast evidence.

## 2026-09-01 — Long-lived route forms may refresh only untouched time defaults

A generated route departure default is convenience state, not user intent. When a long-lived tab makes the untouched default stale, refresh it to one hour from current time as the datetime control is focused, alongside its native min/max bounds. Once the user edits the field, preserve that value exactly and let normal range validation explain invalid choices; never silently rewrite explicit input.

## 2026-09-01 — Cleanup must preflight removability and skip permission-mismatched trees

A worktree can be safely classified as merged yet still contain stale root-owned generated directories from earlier privileged validation. Before removing an eligible artifact or linked checkout, verify its parent and directory tree are removable by the cleanup user. If not, report and skip it without attempting a partial deletion, continue with other independently eligible targets, and preserve all branch refs. Permission mismatch must never relax the clean/merged eligibility guard or trigger Docker/runtime cleanup.
## 2026-09-01 — Modeled notifications require fresh current and forecast evidence at delivery time

A notification candidate may outlive the evidence that produced it, especially across quiet hours. Production alert delivery must re-check both current-weather and decision-forecast metadata at the instant a quiet-hours timer is scheduled or a notification is sent. Use provider `freshForSeconds` when present, otherwise the API's current defaults (5 minutes current, 30 minutes forecast), reject timestamps more than 60 seconds in the future, and fail closed without silently refreshing timestamps or extrapolating stale values.

## 2026-09-01 — Optional evidence freshness revalidates when a tab becomes visible

AQI and modeled context TTLs are evidence boundaries, not timer hints. Because browsers may throttle background timers, a visible-tab return must immediately re-evaluate the existing provider timestamps and remove expired optional evidence before it can keep influencing UI/decisions. This resync may only drop or reschedule existing evidence; it must not refresh timestamps, fetch implicitly, or extend source TTLs.

## 2026-09-02 — A service-worker upgrade must secure the complete boot shell before activation

Caching only the root HTML is not enough for a first offline launch: a newly installed worker can claim the page after its hashed JS/CSS were fetched outside service-worker control, leaving the cached HTML unusable offline. During install, parse the fetched same-origin root shell and fail closed unless every referenced same-origin `/assets/` script, stylesheet, and modulepreload asset can also be fetched with `cache: 'no-store'` and stored in the new versioned cache. Optional metadata such as the manifest remains best-effort. Never cache third-party URLs or unrelated asset links as required boot dependencies.

## 2026-09-02 — Modeled decision alerts require explicit forecast freshness metadata

An alert candidate is derived from hourly forecast evidence, so absence of `ForecastMeta` cannot be treated as fresh. The production alert surface must receive an explicit forecast metadata value and fail closed when it is unavailable/null. Delivery and quiet-hours wake scheduling require both current-weather and forecast timestamps to pass their freshness contracts. Do not infer freshness from the presence of hourly values or silently substitute a new timestamp.

## 2026-09-02 — Equal comparison scores must be presented as a tie, not an arbitrary winner

City comparison is a decision surface, so favorite ordering must not break a genuine score tie. When multiple successfully loaded cities share the highest Hava81 daily-plan score, present them explicitly as tied leaders and highlight each tied city. Keep a single winner only when exactly one row has the top score. This changes no score formula, weather evidence, provider data, activity model, or safety semantics.

## 2026-09-02 — Commute guidance must disappear when its forecast evidence expires

The saved commute planner is a modeled decision surface, so a recommendation must not remain actionable after the forecast evidence that produced it crosses its provider freshness boundary. Pass the exact displayed forecast metadata into the planner, use provider `freshForSeconds` when present with the API's 30-minute forecast fallback, reject timestamps more than 60 seconds in the future, and fail closed when metadata is missing or expired. Re-evaluate at the expiry boundary and again when a backgrounded tab becomes visible; do not refresh timestamps, fetch implicitly, extrapolate stale hourly values, or change the user's saved commute clocks.

## 2026-09-02 — Activity recommendations fail closed when forecast evidence expires

Activity scores and best-time windows are modeled guidance derived from the hourly forecast, so they must not remain actionable after that evidence leaves its provider freshness window. Pass the exact displayed forecast metadata into the activity planner, honor provider `freshForSeconds` with the API's 30-minute forecast fallback, reject timestamps more than 60 seconds in the future, and hide the modeled recommendations when metadata is missing, invalid, or stale. Re-evaluate at the expiry boundary and when a throttled background tab becomes visible without refreshing timestamps, fetching implicitly, changing activity thresholds, or synthesizing weather.

## 2026-09-02 — Day-plan guidance shares one forecast freshness contract

The day-plan score, best window, umbrella decision and share payload are modeled from the hourly forecast, so they must disappear when that forecast evidence expires rather than remain actionable in a long-lived tab. Use one shared forecast-freshness helper for modeled decision surfaces: honor provider `freshForSeconds`, fall back to the API's 30-minute forecast TTL, reject timestamps more than 60 seconds in the future, and expose the exact remaining delay for bounded expiry timers. Missing, invalid or stale metadata fails closed without refreshing timestamps, fetching implicitly or changing decision thresholds.

## 2026-09-02 — Route guidance expires after its projected trip window

An on-demand corridor result describes the user-selected departure and the API's modeled trip duration; it is not timeless weather guidance. Keep the result available through that projected journey, then remove its score/segments/better-departure advice at `selected departure + estimated duration` and ask the user to check again. Use the validated client departure that produced the request rather than inventing provider freshness metadata, resync on tab visibility, and never mutate the user's selected departure or synthesize a replacement route result.

## 2026-09-02 — City comparison rows expire at the earliest evidence freshness boundary

A city-comparison row combines current weather, hourly forecast evidence, and optional AQI into modeled scores and recommendations, so it must not outlive any evidence source that actually contributed to that row. Keep a row only while current weather and forecast metadata are fresh and, when AQI is present, its metadata is fresh too. Wake once at the earliest evidence deadline and re-check again when a backgrounded tab becomes visible; never extend timestamps, synthesize weather, silently refetch, or present expired rows as current. If expiry removes rows, explain the stale state explicitly rather than framing it as a new provider observation.

## 2026-09-02 — First-viewport modeled guidance fails closed when its evidence expires

The primary Weather Decision Field is an action surface, not merely a historical weather readout. Keep current measurements visible with their existing freshness label, but stop presenting modeled rain/wind/temperature/UV/outdoor recommendations when current weather evidence is invalid/stale or the hourly forecast metadata is missing/expired. Use provider freshness metadata and the shared forecast freshness contract; do not extend timestamps, synthesize replacement values, or silently refetch from the presentation component. Re-evaluate at the exact forecast TTL boundary and when a backgrounded tab becomes visible.


## 2026-09-02 — First-viewport guidance freshness follows the hourly evidence actually rendered

When the dedicated one-hour forecast upgrades the baseline three-hour forecast, the primary Weather Decision Field must validate freshness against the metadata that belongs to that upgraded hourly series. Prefer `displayMeta` with the existing baseline `meta` fallback so the action surface cannot be incorrectly suppressed by stale metadata from a different provider/evidence snapshot while fresh hourly evidence is driving its modeled guidance. This changes no weather values, provider timestamps, scoring thresholds, refresh cadence, MGM semantics, or official-warning behavior.


## 2026-09-02 — Forecast Atlas stops presenting expired provider evidence as current

The hourly/daily forecast visualization is an evidence surface even when it is not itself a score or safety recommendation. Honor the same forecast `fetchedAt + freshForSeconds` contract used by modeled decision panels: when metadata is missing/invalid/future-skewed or the TTL expires, hide the forecast values and show an explicit stale state. Re-evaluate once at the exact provider expiry boundary and on visible-tab resume so background timer throttling cannot leave old forecasts presented as current. Do not refresh timestamps, synthesize rows, change provider values, or add polling from the presentation component.


## 2026-09-02 — Current wind observations stop at the current-weather TTL

The environment rail's wind direction/speed are current observations, not timeless city attributes. Honor current weather `fetchedAt + freshForSeconds` (5-minute fallback, 60-second future-skew ceiling) and stop presenting wind values once that evidence expires. Re-evaluate at the exact expiry boundary and when a backgrounded tab becomes visible. Daylight times and the map city control remain available because they are not live wind observations; AQI already expires under its own provider contract. Do not refresh timestamps, poll implicitly, or synthesize replacement wind data.


## 2026-09-02 — Favorites persist province identity, not untimestamped weather snapshots

Saved-city state is navigation identity (`name`, canonical coordinates), while comparison fetches fresh evidence independently. Stop persisting/updating `temp` and `icon` because those fields have no source timestamp or TTL and create stale local snapshots plus unnecessary localStorage churn. The deserializer continues accepting legacy payloads but intentionally drops their weather fields while canonicalizing the province, so existing users retain favorites without presenting or carrying forward unprovable weather evidence.

## 2026-09-02 — First-viewport current observations fail closed at their provider TTL

The main decision field already suppresses modeled action guidance when current evidence expires, but current temperature, condition, feels-like, humidity and wind must follow the same current-observation boundary. Once current `fetchedAt + freshForSeconds` is stale/invalid/future-skewed, hide those values and show explicit stale-current status while preserving city identity/provider metadata. Forecast-derived daily range follows forecast freshness independently, and independently fresh AQI may remain visible. Do not convert an expired observation into a fresh-looking number merely because the surrounding decision list is unavailable.

## 2026-09-02 — Saved-city navigation must not present untimestamped weather as current

Legacy favorites may carry the temperature/icon observed on the last visit, but that persisted shape has no provider `fetchedAt` or TTL. Keep those fields backward-compatible in storage for now, but do not render them in saved-city tabs or include them in accessible labels as if they were current observations. Saved tabs remain navigation affordances (province plate + city name) until a freshness-aware saved-city evidence contract exists.

## 2026-09-02 — The map must not preserve an expired current-temperature marker

The selected-city map marker is a current observation surface because it renders the current temperature and condition. Reuse a shared current-weather freshness contract (provider TTL, 5-minute fallback, 60-second future-skew ceiling), re-evaluate at provider expiry and visible-tab resume, and replace expired temperature/condition content with an explicit unavailable observation marker while keeping the city location navigable. Do not refresh timestamps, poll from the map, synthesize weather, or hide static featured-city navigation.

### 2026-09-02 — Prefer provider observation freshness over client receipt age
- Current-weather refresh eligibility must use the provider evidence timestamp (`meta.fetchedAt`) and TTL when available, not merely the moment the browser received the response.
- A provider-cached observation can already be expired when it reaches the client; treating receipt time as freshness would unnecessarily preserve expired evidence for another client-side TTL window.
- Reuse the shared `getCurrentWeatherFreshness` contract so map rendering and refresh eligibility agree on TTL, future-skew, and fail-closed semantics. Client receipt age remains only a compatibility fallback for legacy payloads without provider metadata.

### 2026-09-02 — Revalidate weather evidence immediately before asynchronous alert delivery
- Starting a notification delivery while current/forecast evidence is fresh is insufficient when service-worker readiness can take seconds. Evidence can cross its TTL while delivery is in flight.
- Decision alerts now reuse the shared current/forecast freshness contracts and re-check both immediately after service-worker readiness resolves, before any notification is shown. Expired evidence aborts delivery without writing a sent marker, preserving a later fresh-data retry.

## 2026-09-02 — first-viewport current evidence uses the shared freshness contract
`WeatherDecisionField` must derive whether current observations are actionable and when their expiry timer fires from `getCurrentWeatherFreshness`, rather than carrying its own TTL/future-skew math. Keep the user-facing age/minute text separate because it is presentation cadence, not evidence validity. This prevents the primary decision surface from drifting from map/environment/current-refresh freshness semantics without changing weather values or decision thresholds.

## 2026-09-02 — Optional AQ/context evidence gets one freshness contract
Air-quality and modeled context evidence must use one shared fail-closed TTL/future-skew/expiry calculation in `useForecast`. Keep this contract distinct from current-weather/forecast freshness because its legacy metadata fallback is five minutes, but use one explicit-clock decision per expiry pass so same-city retention and timer invalidation cannot drift apart.

### 2026-09-02 — Comparison current observations reuse the shared current-weather freshness contract
City comparison must evaluate each row's current observation with `getCurrentWeatherFreshness`, not a private TTL/future-skew copy. Keep optional AQ evidence on its distinct five-minute compatibility contract. This is a behavior-preserving deduplication that prevents comparison current evidence from drifting from map, environment and refresh semantics without changing provider values, scoring or decision thresholds.

### 2026-09-02 — Comparison optional AQ evidence reuses the shared optional-evidence contract
After the optional evidence helper became part of main, city comparison must also evaluate AQ metadata with `getOptionalEvidenceFreshness` rather than retaining a second five-minute/future-skew implementation. This completes comparison freshness deduplication while preserving the distinct contracts for current observations, forecast evidence, and optional AQ evidence.


### 2026-09-02 — Current-weather freshness owns presentation age/status semantics
Current observation freshness already centralizes provider TTL and future-skew validity. It now also exposes bounded age-in-minutes plus an explicit `fresh` / `stale` / `unknown` status so first-viewport presentation cannot reimplement the same 60-second future-skew boundary independently. Invalid/missing/materially-future timestamps remain fail-closed as unknown; expired but valid evidence is stale. No provider values, TTLs, score thresholds or safety guidance change.

### 2026-09-02 — Modeled-context provenance uses the shared optional-evidence validity boundary
The Context Signals source timestamp is provenance, not a separate freshness algorithm. Reuse `getOptionalEvidenceFreshness` to distinguish valid stale/fresh timestamps from invalid/missing/materially-future evidence before displaying a provider fetch time. Keep stale-but-valid fetch times visible as provenance; hide only unknown timestamps. No UV, pollen, dust, marine values or provider TTLs change.

### 2026-09-02 — Multi-source comparison freshness uses a single clock snapshot
A comparison row combines current weather, forecast and optional AQ evidence. Evaluate all contributing freshness contracts against one wall-clock snapshot per validity pass, and calculate the next expiry from one separate snapshot per scheduling pass. This prevents sub-millisecond boundary drift between evidence sources without extending timestamps, changing TTLs, synthesizing weather, or altering scores.
### 2026-09-02 — Inclusive freshness boundaries must retain an expiry wake-up
When a freshness contract considers evidence fresh through `age <= TTL`, the exact `age === TTL` instant must still return the small expiry cushion instead of a null timer. Otherwise a render landing on the inclusive boundary can remain fresh indefinitely until unrelated state changes. Preserve the existing 100 ms cushion and do not extend provider TTLs or mutate evidence timestamps.


### 2026-09-02 — Browser transport cache never outlives provider evidence freshness
The generic GET cache may shorten reuse but must not extend a weather payload beyond an explicit provider evidence window. For payloads with structurally valid `meta.fetchedAt` and positive finite `meta.freshForSeconds`, use `min(client cache expiry, provider evidence expiry)`; when that evidence metadata is absent or unusable, preserve the existing client TTL fallback. This changes cache reuse only and never rewrites provider timestamps or freshness windows.


### 2026-09-02 — Malformed provider freshness metadata must not poison the browser GET cache
Provider freshness metadata is a cache-validity contract, not merely an optimization hint. When a response includes only part of that contract, an invalid/non-positive/over-one-day TTL, an invalid fetch timestamp, or a fetch timestamp beyond the same 60-second future-skew ceiling used by weather validation, do not retain that response in the generic browser GET cache. Metadata-less responses keep the existing client-TTL compatibility path. This allows the next request to reach the BFF instead of replaying a payload that higher-level validation will reject.


### 2026-09-02 — Initial current-weather cache restore follows provider evidence freshness
A recent browser persistence timestamp is not proof that the provider observation itself is current. When cached current weather carries provider `fetchedAt`/TTL metadata, initial restore must use the same shared evidence-freshness decision as resume/online refresh; client receipt age is only the compatibility fallback when provider evidence metadata is unavailable. Rejecting a provider-stale cache should trigger the normal initial fetch rather than extending stale evidence with a new local cache age.


### 2026-09-02 — Top-level provider freshness remains authoritative when nested metadata is unrelated
Modeled context payloads may expose freshness as top-level `fetchedAt` / `freshForSeconds` while also carrying an unrelated nested `meta` object. The browser transport cache must continue using the complete top-level freshness contract unless nested `meta` itself contains freshness fields; unrelated nested metadata must not silently restore the generic client TTL. Conversely, malformed top-level freshness evidence remains non-cacheable so corrected network evidence can recover immediately. This affects cache reuse only and never rewrites provider evidence or user-facing weather guidance.


### 2026-09-02 — Pages deploy health requires coherence for the shell a normal navigation actually receives
Exact-hash smoke checks prove the new release and its current boot assets have reached an edge, but a normal custom-domain navigation can briefly receive a cached prior HTML generation during propagation. Treat that state as healthy only when every hashed `/assets/` script/style/modulepreload referenced by the actually served navigation shell is still available. Keep the existing bounded propagation window and retained-generation strategy; do not change application cache semantics or hide persistent missing-asset failures.


### 2026-09-02 — Versioned production-observer behavior is a required hosted CI contract
The Oracle observer participates in merge/deploy decisions and production-incident detection, so its deterministic unittest suite must run in hosted pull-request CI rather than relying only on local/manual execution. Keep this gate fast and dependency-free inside the existing quality job; observer changes still require direct post-merge host validation before replacing the installed read-only collector.

### 2026-09-02 — Frontend observer health includes the boot assets referenced by the served HTML
HTTP 200 for an SPA shell is insufficient evidence that the frontend can boot. The read-only production observer must parse the same-origin `/assets/` references from the root HTML it actually receives and require those hashed boot resources to return 200. Keep the check bounded and observational: cap asset fan-out, store only failure summaries, and do not mutate Pages, caches, application state, weather evidence, or API traffic.

### 2026-09-02 — Production boot-asset health covers both core navigation shells
Root-shell coherence alone is insufficient because GitHub Pages/custom-domain propagation can serve different cached HTML generations for `/` and `/istanbul/`. The read-only observer must require boot-asset evidence from both core shells and verify the bounded union of their same-origin hashed assets. A city shell that returns HTTP 200 but references an unavailable asset is a production frontend incident, not a healthy response. Keep fan-out bounded and do not alter Pages caches or application traffic to perform this check.

### 2026-09-02 — Deploy the read-only observer with atomic file replacement, not by pausing its timer
The observer's systemd `RuntimeDirectory` is lifecycle-bound to the oneshot service, so its runtime flock path cannot be assumed to exist while idle. Observer deployments should validate versioned tests/syntax first, stage files on each target filesystem, then atomically rename the complete collector/status/unit files into place. Keep the five-minute timer enabled and active throughout; reload systemd, run one collection, and verify the resulting state immediately. This gives a concurrent collection either the complete old collector or complete new collector without creating a deployment-only lock inode that can diverge from the service's lock.

### 2026-09-02 — Paginate GitHub compare commit objects before raising observer HTTP bounds
The GitHub compare endpoint includes up to hundreds of commit objects plus the changed-file list, so long-running non-API history can exceed the observer's bounded HTTP body even when only a modest number of files changed. Keep the 1.5 MB observer read cap. For API deployment drift, request `per_page=1&page=1`: GitHub still supplies compare status and the first-page changed-file list (up to its documented compare file limit), but avoids transferring hundreds of irrelevant commit objects. Continue treating the existing maximum-file-count case as ambiguous rather than assuming no runtime drift.


### 2026-09-02 — Compact observer status must expose evidence for each core shell
When production health depends on multiple HTML shells, the operator-facing status should surface the per-shell evidence already present in state instead of only an aggregate count. Keep the aggregate for compatibility, add root/İstanbul counts, and compile the standalone status script in hosted CI because observer unit tests do not import that executable.


### 2026-09-02 — Forecast Atlas uses an editorial data strip instead of nested cards
The hourly forecast is a continuous evidence surface, not a stack of dashboard cards. Keep the outer atlas and hourly viewport flat with border rules, remove the decorative rounded/gradient chart container, and present low/high/rain summary values as one divided editorial strip. Preserve temperature/rain values, provider attribution, interval controls, chart geometry, freshness semantics, keyboard focus, 44px touch targets, and responsive text reflow. Current-hour emphasis remains subtle and informational rather than becoming another filled card.

## 2026-09-02 — observer GitHub timeout resilience

- Keep the comprehensive 100-run GitHub Actions lookup as the primary observer read, but retry once with a 30-run payload when that bounded request fails. A transient large-payload timeout must not erase otherwise actionable main/PR CI state; the retry remains read-only and bounded to the same 12-second timeout.

## 2026-09-02 — make Lighthouse floor failures actionable

- When a Lighthouse category breaches its hard floor, print the weighted audits that actually lost points instead of logging only the aggregate category score. This keeps quality gates strict while making regressions diagnosable without downloading and manually inspecting the raw LHR artifact.

## 2026-09-02 — Browser CI does not reinstall OS dependencies on every hosted run
GitHub's current `ubuntu-24.04` hosted image already contains the core Chromium runtime libraries required by Hava81's Playwright suite, while the repo separately caches the version-keyed Playwright Chromium bundle. Do not run `playwright install --with-deps` on every Browser job: it invokes apt and can spend the full job timeout downloading optional font packages from a slow mirror. Use `playwright install chromium` to materialize/verify the version-keyed browser and let the actual browser suite fail clearly if the hosted image ever loses a required shared library. Keep the cache key tied to `package-lock.json` so browser-version changes cannot silently reuse an incompatible binary.

## 2026-09-02 — The tablet activity reflow includes the exact 768px boundary
Responsive breakpoints that protect Activity Planner text reflow must include the exact 48rem/768px tablet width rather than stopping at 47.99rem. Keep the existing desktop layout above that boundary; this is a presentation/accessibility correction only.

## 2026-09-02 — Preserve the normal 768px Activity Planner layout
The exact 768px viewport is intentionally on the wider side of the Activity Planner viewport breakpoint so its normal-size cards remain side by side. Enlarged-text resilience at that width must be proven by content reflow rather than forcing the entire 768px layout into the narrow/mobile presentation. Keep `47.99rem` as the viewport breakpoint and retain a dedicated English 200%-text containment regression. This supersedes the immediately preceding 48rem breakpoint decision after hosted Browser CI exposed its normal-size regression.

## 2026-09-02 — Global horizontal-arrow shortcuts yield to focused surfaces
Plain left/right arrows are native interaction keys for horizontal scrollers and many focused widgets. Hava81 city navigation may use them only when focus is effectively on the document itself; never intercept them from a focused control or keyboard-reachable content region. Modifier shortcuts and the global Escape close affordance keep their existing semantics.

## 2026-09-02 — Root location choice always includes a direct city-search escape hatch
The location-first onboarding may recommend nearby weather and offer İstanbul as a zero-permission default, but it must not force either choice. Keep a first-class “Başka şehir ara / Search another city” action that opens and focuses the existing city search without touching browser geolocation. This preserves explicit user control while retaining the location-first product path.

### 2026-09-02 — Do not render an empty Forecast Atlas after total forecast failure
A forecast metadata object alone is not sufficient evidence for a forecast surface. Render Forecast Atlas only when at least one daily or display-hourly row is available; when all forecast data is unavailable, keep the localized error/recovery surface without an empty visualization shell. This does not alter weather values, provider semantics, freshness thresholds, or retry policy.

## 2026-09-02 — Partial same-city forecast recovery must not mix stale daily evidence with fresh hourly provenance
Forecast Atlas presents one provider/freshness authority for both hourly and daily rows. Once a successful dedicated-hourly response becomes that visible authority, retain daily rows only when the same response supplies replacement daily evidence. Otherwise clear the daily series rather than presenting baseline or prior-generation values under the new hourly provenance. This fail-closed rule changes neither provider values nor retry semantics; it prevents cross-source and cross-generation evidence mixing.


### 2026-09-02 — Optional environmental evidence must not block resilient forecast recovery
Air quality and context signals enrich decisions but are not prerequisites for rendering a valid hourly forecast. When the baseline forecast fails and the dedicated hourly source succeeds, apply that core forecast as soon as its request resolves; await optional AQ/context evidence only afterward. Keep the overall loading lifecycle until optional requests settle, retain request-id guards before every state application, and preserve fail-closed behavior when neither forecast source succeeds. This changes response ordering only, not provider values, freshness windows, scoring, MGM semantics, or API topology.


### 2026-09-02 — Core forecast providers should race for first usable guidance
The OpenWeather baseline and dedicated Open-Meteo hourly requests already start in parallel, so UI ordering should not serialize them. Render the first valid core forecast that resolves; if OpenWeather wins it remains the immediate baseline until dedicated hourly upgrades it, while if dedicated hourly wins it becomes visible immediately and a later OpenWeather response must not downgrade that fresher hourly authority. Still await both core requests before final failure/completion so one provider can rescue the other, retain request-id guards, and keep dedicated hourly as final authority when both succeed. This changes latency/order only, not weather values, provider TTLs, scoring, MGM semantics, or API topology.

## 2026-09-02 — Loading shells follow the editorial surface geometry
Primary weather loading shells should preserve the same visual boundary model as the loaded decision and forecast surfaces: transparent field, block-axis rules, square corners, and no card shadow. Keep shimmer shapes and motion as loading affordances; do not reintroduce rounded elevated cards solely during loading.

## 2026-09-02 — Recovery and error messages use editorial signal callouts
Weather recovery/status messages should read as editorial callouts rather than elevated cards. Use a subtle contextual field, a 4px inline-start signal rule, square corners, and no shadow. Reserve Aegean for neutral recovery/status and vermilion for errors; keep the existing semantic roles, actions, and responsive behavior unchanged.

### 2026-09-02 — Activity Planner uses editorial surfaces instead of dashboard cards
Activity guidance is evidence and planning content, not a stack of floating dashboard cards. Keep the planner, activity result rows, preferred-time window, and score explanation flat with block-axis rules, square corners, and no elevation. Preserve activity scores, risk bands, controls, 44px targets, responsive reflow, and all weather/freshness semantics; chips and form controls remain interactive affordances rather than being flattened into text.


### 2026-09-02 — The weather-map viewport uses a flat editorial frame
The map is a primary evidence surface inside an already-flat map panel, so its desktop viewport should not reintroduce the legacy rounded/elevated dashboard-card treatment. Keep a visible map boundary, square corners and no container shadow; marker and popup elevation remain functional spatial cues, and map values, attribution, controls, touch targets and provider semantics are unchanged.

### 2026-09-02 — Fatal recovery surfaces inherit the resolved color mode
The ErrorBoundary fallback sits outside the normal `.app` wrapper but the resolved color mode is applied to the document root. Use the shared atlas ink/field tokens there instead of hard-coded light colors so recovery remains readable and visually coherent in dark mode. Keep light fallbacks for pre-theme safety and do not couple fatal presentation to weather or retry logic.

### 2026-09-02 — Theme-adaptive Aegean actions use the theme-adaptive paper foreground
Do not hard-code white text on controls whose Aegean background becomes light in dark mode. Pair `--color-aegean` with `--color-atlas-paper`: light mode retains white-on-deep-teal while dark mode receives dark ink on light teal with AA text contrast. Loading indicators inside those actions should inherit `currentColor` rather than restoring a fixed white ring.

### 2026-09-02 — Initial location onboarding has one primary decision
The root location-choice gate should not present location, İstanbul fallback, and city search as three equal competing CTAs. Keep “use my location” as the single primary full-width action, group İstanbul and explicit city search as equal secondary choices below it on wider screens, and stack all actions on narrow screens. Preserve zero automatic geolocation calls, the explicit city-search escape hatch, 44px targets, and associate the primary action with the privacy note.

### 2026-09-02 — Stale clean checkout removal requires an attached exact branch ref

Severe host disk pressure can justify removing a linked checkout even when its branch is not merged, because `git worktree remove` preserves an attached local branch. This broader path must be opt-in with an explicit positive age threshold, and it is eligible only when the worktree is clean, old enough, attached to a local branch, and that branch ref points exactly at the checked-out HEAD. Detached, dirty, recent, current and primary worktrees remain excluded. Default cleanup behavior remains merge-equivalence-only, so routine automation cannot silently broaden its deletion set.

### 2026-09-02 — Unknown worktree status is never equivalent to clean

Cleanup eligibility requires positive evidence that a worktree is clean. If `git status --porcelain` cannot be read, skip that checkout entirely rather than interpreting empty command output as a clean result. This fail-closed rule applies to both merge-equivalent cleanup and the opt-in stale-clean path; inability to inspect worktree state must never widen deletion eligibility.

### 2026-09-02 18:18 TRT — standalone clone cleanup must archive exact represented HEADs before deletion

**Decision:** Treat stale standalone Hava81 clones as a separate storage class from linked worktrees. Automated removal is allowed only after positive proof that the clone is clean, attached, old enough, not in use, has the exact Hava81 origin, and its HEAD is already represented on `origin/main`; preserve that exact HEAD in an archive ref in the primary repository and recheck all eligibility immediately before deletion.

**Why:** Root disk pressure is critical while merge-only linked-worktree cleanup now yields little space. Standalone clones can duplicate checkout storage but are not protected by `git worktree` metadata, so a broader `rm` strategy would risk deleting unique work. Archive-first, represented-commit-only eligibility keeps the operation reversible and fail-closed without touching Docker/runtime/browser/user data.


### 2026-09-02 18:54 TRT — modeled context must fail closed before paint

**Decision:** `ContextSignalsPanel` must independently refuse stale, invalid, or materially future provider evidence and expire itself at the provider TTL boundary. Parent-hook cleanup remains useful state hygiene, but it is not the trust boundary for UV, dust, pollen, or marine guidance.

**Why:** React effects run after render. Relying only on `useForecast` to drop expired optional evidence permits a transient render of stale or future health/activity guidance. The component that publishes that evidence must enforce freshness synchronously and schedule its own boundary refresh.


### 2026-09-02 19:04 TRT — first-viewport modeled UV must be filtered before handoff

**Decision:** App must pass modeled `uvIndexMax` into the decision hero only when the context-signals envelope is fresh. The `useForecast` expiry effect remains responsible for state cleanup and boundary rerender, but the render handoff itself must fail closed for stale, invalid, or materially future context evidence.

**Why:** The first viewport can render before parent effects run. UV-driven activity guidance is health-adjacent, so even a transient stale/future model value must not be published as current guidance.
### 2026-09-02 18:50 TRT — air-quality advice must expire with its own evidence

**Decision:** Treat air-quality observations as independently freshness-gated evidence. The decision hero may show AQI or generate AQI-based activity guidance only while `airQuality.meta` is fresh under the same provider TTL semantics used for current observations; when that evidence expires, render the metric unavailable and remove AQI-derived guidance without hiding still-fresh weather evidence.

**Why:** Air quality arrives as a separately timestamped provider payload. Letting a fresh current-weather observation keep stale AQI visible would present expired health-related evidence as current and violate Hava81's evidence-first trust model.


### 2026-09-02 19:52 TRT — optional AQ evidence must fail closed before App handoff

**Decision:** App must pass `airQuality` to decision, planning, alert, activity, and environment surfaces only while the provider envelope is fresh. `useForecast` remains responsible for state cleanup and expiry rerender, but render-time handoff must independently reject stale, invalid, or materially future AQ evidence.

**Why:** Air quality is health-adjacent and is consumed by several surfaces. Effect-based cleanup alone can permit one render of expired/future AQ data before state is cleared; a single App-level trust boundary prevents that transient publication across all downstream consumers.


### 2026-09-02 20:56 TRT — cleanup may trust a specific linked worktree without global Git trust

**Decision:** The linked-worktree cleaner may pass `-c safe.directory=<exact-worktree-path>` only on the read-only per-worktree Git inspections needed to prove cleanliness, HEAD, and attachment. It must not change global Git safe-directory configuration, and any inspection failure still excludes that checkout.

**Why:** Hava81 automation has created linked checkouts under more than one Unix owner. Git's dubious-ownership protection caused the root-run cleaner to treat otherwise inspectable worktrees as unknown, blocking safe reclamation during severe disk pressure. Narrow per-command trust preserves Git's default global protection while allowing the cleaner to make the same positive-evidence decision it already requires.

## 2026-09-02 — Mobile Activity Planner must not inherit desktop flex basis as vertical height
At the mobile breakpoint the Activity Planner header switches from row to column. The desktop sensitivity control uses `flex: 0 1 12rem`; without an override, that basis becomes a vertical main-axis size and can create excessive header height, especially under 200% text. Set the mobile sensitivity `flex-basis` to `auto` so the control sizes to its content while preserving the desktop width behavior. This is layout-only; activity scoring, weather evidence, thresholds and provider semantics are unchanged.

## 2026-09-02 — Focus indicators inside horizontally clipped saved-city rails render inward
The saved-city rail is an intentional horizontal scroll container. Controls at its edges must not rely on a positive outer outline offset that the scroll viewport can clip. Keep tab, remove and add actions on the shared inset focus-indicator treatment. This is keyboard presentation only; saved-city persistence, selection and weather behavior are unchanged.
## 2026-09-02 — Patch Fastify before relying on production hop-count trustProxy
GitHub Dependabot alert #1 (`GHSA-3m5p-2c4r-xxw2` / `CVE-2026-16732`) affects Fastify `>=5.8.3 <5.12.1` when hop-count `trustProxy` is used. Hava81 production config intentionally uses `trustProxy: 1` behind Nginx, so this is applicable runtime exposure rather than a dormant dependency alert. Keep the single-Nginx topology, require Fastify `>=5.12.1`, and replace numeric hop-count trust with explicit immediate-peer CIDRs matching host loopback plus the Docker 172.16/12 bridge range; do not weaken proxy trust to `true`.
## 2026-09-02 — Keyboard focus inside horizontal choice rails renders inward
Forecast interval choices and mobile activity preference chips intentionally use horizontal scroll rails to preserve readable labels. Their focused controls must render the focus indicator inside the control boundary rather than outside the clipped scroll viewport. Use a small negative outline offset for rail children; this is accessibility presentation only and does not change forecast resampling, activity scoring or weather semantics.

### 2026-09-02 22:00 TRT — keep the keyboard-scrollable hourly viewport focus inside its own rail

- The Forecast Atlas hourly viewport is itself keyboard-focusable (`role="region"`, `tabIndex=0`) and horizontally scrollable, but its focus outline still used a positive 2px offset. Unlike an ordinary static region, this control sits directly on the rail boundary, so rendering the indicator inward is the safer clipping-resistant behavior and matches the interval/activity rail policy already merged.
- Change only the focus outline offset to `-2px`; no chart, forecast, weather-provider, scoring, or safety semantics change. Extend the existing 320px Forecast Atlas browser regression to focus the actual hourly viewport and require a visible >=2px, non-positive-offset indicator.

### 2026-09-02 22:24 TRT — modeled-warning provenance travels with the notification payload

**Decision:** Every Hava81 browser notification generated from modeled decision guidance must carry an explicit localized statement in the notification body that it is Hava81 modeled guidance and not an official MGM MeteoUyarı warning. The disclosure shown inside the alerts panel is necessary but not sufficient because system notifications are consumed outside that UI context.

**Why:** Notification titles such as rain or strong-wind alerts can be seen on the lock screen or notification center without the panel that explains their provenance. Keeping the distinction in the payload itself prevents modeled Hava81 guidance from being mistaken for an official warning while leaving all weather evidence, thresholds and provider semantics unchanged.

### 2026-09-02 22:38 TRT — disk cleanup diagnostics must explain exclusion without weakening eligibility

**Decision:** Standalone-cleanup audit mode may report aggregate reasons why clones are excluded, but those diagnostics must remain read-only and separate from the mutation eligibility function. Dirty, unrepresented, recent, in-use, unreadable, wrong-origin, detached, or archive-conflicting checkouts remain non-candidates.

**Why:** Under disk pressure, a bare “0 eligible” result encourages unsafe manual cleanup. Aggregate reason counts expose whether space is tied up in potentially valuable/unknown work without inspecting file contents or broadening deletion authority.

### 2026-09-02 22:31 TRT — optional AQ expiry must degrade comparison, not erase it

**Decision:** In saved-city comparison, current weather and forecast freshness remain mandatory for a city row, but air-quality evidence is optional and independently freshness-gated. When AQ evidence expires or becomes invalid, remove AQI and AQ-derived plan/activity influence while keeping the row usable if current weather and forecast remain fresh.

**Why:** AQ is separately timestamped optional evidence. Treating its shorter TTL as a reason to hide an otherwise current weather comparison reduces availability without improving safety. Recomputing decision output without expired AQ preserves the fail-closed trust boundary and avoids presenting stale health-adjacent guidance.

### 2026-09-02 22:53 TRT — cleanup audit mode is structurally read-only

**Decision:** `cleanup-stale-standalone-checkouts.sh --audit` must be mutually exclusive with `--apply`. Reject the combination before candidate discovery or ref mutation rather than relying on operator convention.

**Why:** Audit mode is documented as read-only evidence gathering. Allowing `--apply --audit` made that guarantee false and could turn a diagnostic invocation into an archive/remove operation. Mutation remains available through explicit `--apply` without `--audit`; eligibility and archive-first safety checks are unchanged.

### 2026-09-02 23:05 TRT — cleanup audit eligibility must honor registered checkout exclusion

**Decision:** Standalone-cleanup audit classification must mark the repository itself or any registered checkout as `registered` before evaluating content/age eligibility. Its `eligible` aggregate must mean the same thing as mutation candidate eligibility at this structural boundary.

**Why:** The mutation path already refuses the primary/current repository and registered worktrees. Without the same guard, a clean primary clone located under the scanned `hava81-*` parent could be reported as audit-eligible even though apply would correctly refuse it, weakening the audit's value during disk incidents. This changes diagnostics only; deletion authority remains unchanged.

### 2026-09-02 23:16 TRT — disk-cleanup audit reports aggregate bytes by blocker

**Decision:** Standalone-cleanup `--audit` may measure and report aggregate checkout bytes for each existing eligibility/exclusion reason, while remaining read-only and path/content-silent. The byte measurement must not influence `candidate_is_eligible`, archive refs, or removal authorization.

**Why:** During disk pressure, reason counts alone do not show whether a blocked class is materially responsible for host consumption. Aggregate byte totals let autonomous operations prioritize the real storage pressure while preserving dirty/unrepresented clones and avoiding disclosure of candidate paths or file contents.

### 2026-09-02 23:20 TRT — compact observer status includes absolute used disk

**Decision:** The human-readable worker status should display both `used_gib` and `free_gib` when the observer state provides absolute disk bytes, while tolerating older state snapshots by rendering missing values as `None`.

**Why:** Percent usage alone obscures the scale of a disk incident. The observer already computes absolute used bytes, so surfacing that existing evidence improves operational decisions without adding probes, changing thresholds, or increasing mutation authority.

### 2026-09-02 23:24 TRT — persistent mobile navigation precedes main content semantically

**Decision:** Keep the fixed mobile bottom navigation immediately after the application header and before `<main>` in DOM order, even though CSS continues to pin it visually to the viewport bottom.

**Why:** A persistent primary navigation that is visually available at all times should not require keyboard users to traverse the entire weather dashboard and footer before reaching it. Moving only the DOM position preserves the mobile visual design and behavior while making landmark and focus order match the navigation's role.

### 2026-09-02 23:31 TRT — compact status must surface host incident evidence

**Decision:** The human-readable worker status must expose both `host.issues` on the disk line and `signals.host_incident` alongside `production_incident`.

**Why:** An active host incident can coexist with healthy production and an empty warnings array. Hiding the state’s explicit incident fields makes operator summaries ambiguous during disk pressure; surfacing existing evidence improves triage without changing any health decision or write authority.
### 2026-09-02 23:35 TRT — outdoor-window copy describes weather suitability only

**Decision:** Phrase the generic `outdoor-window` decision as a calmer **weather** window (“hava açısından” in Turkish) rather than an unqualified best time to be outdoors.

**Why:** The decision scorer uses meteorological evidence and cannot judge lifestyle, sleep, personal-security, transport, or other non-weather constraints. Explicitly scoping the copy preserves Hava81's decision-first value while avoiding a broader recommendation than the evidence supports.
### 2026-09-02 23:41 TRT — mobile first viewport prioritizes provider/freshness over coordinates

**Decision:** Hide latitude/longitude metadata below 40rem while retaining observation time, provider, and freshness; keep coordinates visible at tablet/desktop widths.

**Why:** Live 390px measurement showed coordinates force provenance/freshness onto a second row and consume scarce first-viewport space. Exact coordinates are secondary technical detail for a city forecast, whereas source and freshness directly support weather-data trust.

### 2026-09-02 23:52 TRT — no-risk copy is scoped to weather evidence

**Decision:** Hava81 may describe a forecast window as having no material **weather** risk among the signals it evaluates, but must not publish an unqualified “no material risk” statement that could be read as a broader safety guarantee.

**Why:** The score and decision engine evaluate meteorological/provider evidence only. Explicitly naming weather keeps favorable guidance useful while preserving the product boundary already stated in the score note: Hava81 is not a general safety guarantee.


### 2026-09-03 00:20 TRT — browser DOM-order checks wait for asynchronous controls

**Decision:** Browser regressions that compare DOM order after asynchronous city rendering must first wait for the exact participating elements to be attached, then evaluate their relative document position.

**Why:** `page.goto` guarantees navigation completion, not that React's weather-dependent controls have rendered. Waiting for the participants preserves the semantic assertion while removing a race that can fail an otherwise healthy production commit.
### 2026-09-03 00:12 TRT — city metadata recommendations name the weather scope

**Decision:** City document descriptions may advertise a best outing window only as a **weather** window (`hava açısından` / `weather window`), rather than as an unqualified best time to go out.

**Why:** Hava81 ranks meteorological evidence; search/social metadata can be read outside the product UI and therefore must carry the evidence-domain boundary itself instead of relying on nearby in-app disclaimers.
