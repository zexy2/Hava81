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

- 2026-08-30 — Service-worker fallback/static reads must be scoped to the active build `CACHE_NAME`; do not use global `caches.match()` for application requests because unrelated same-origin Cache Storage namespaces must never satisfy Hava81 fetches.
