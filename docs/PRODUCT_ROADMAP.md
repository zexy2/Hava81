# Hava81 product roadmap

Hava81 is a Turkey-first weather product for people who want to understand the day quickly, not inspect a wall of meteorological widgets. The working product promise is:

> Know what the weather means for your day in any of Turkey's 81 provinces.

The name is provisional until the brand pass is complete.

## Product thesis

Most weather demos stop at current temperature and a generic forecast. Hava81 should turn reliable weather data into three decisions:

1. What is it like outside now?
2. What will materially change in the next 24 hours?
3. Do I need to act because of rain, wind, heat, UV, or air quality?

The product remains useful without an account. Accounts are introduced only when they unlock cross-device favorites and alerts.

## Primary users and jobs

| User | Job to be done | Product response |
| --- | --- | --- |
| Daily commuter | Decide what to wear and whether to carry an umbrella | Current conditions, feels-like temperature, rain window, commute summary |
| Outdoor planner | Pick the safest and most comfortable time | Hourly timeline, wind, UV, air quality, daylight |
| Multi-city household | Check family, work, or travel cities quickly | Favorites and city comparison |
| Alert subscriber | Avoid repeatedly checking the app | Threshold-based severe weather notifications |

## Experience principles

- Decision first: explain the consequence before exposing every measurement.
- Source visible: show observation time, provider, freshness, and stale state.
- Turkey specific: 81 canonical provinces, Turkish locale behavior, plate-code identifiers, and a Turkey-centered map.
- Calm by default: one dominant current-conditions surface, restrained motion, and fewer nested cards.
- Honest states: partial provider failures, unavailable UV data, offline data, and permission denial are shown explicitly.
- Accessible by construction: keyboard operation, visible focus, reduced motion, semantic charts, and 44 px touch targets.

## Visual direction

**Meteorological atlas of Turkey.** A stable ink-and-paper product shell is paired with an atmospheric condition field that can change with the weather. Aegean blue, saffron, and alert vermilion provide meaning; editorial temperature typography and topographic linework provide identity. Emoji and generic glassmorphism are replaced by a consistent SVG weather system and precise dividers.

The first mobile viewport must contain the city, current temperature, condition, and the next material change. Search and utility controls cannot push this information below the fold.

## Delivery plan

### Phase 0 - Trust the existing product

- Restore green type-check, lint, test, and build gates.
- Fix the mobile control layout and current accessibility blockers.
- Remove fabricated UV data and misleading offline/notification claims.
- Correct SEO/PWA metadata and Docker base-path behavior.
- Document the API-key exposure and rotate the current production key after the BFF is deployed.

Exit criteria:

- CI is green without disabling warnings.
- No known nested interactive controls or inaccessible modal behavior.
- Desktop and 390 px mobile core flows are visually verified.
- No value presented as live data is hard-coded.

### Phase 1 - Full-stack weather foundation

- Add a versioned TypeScript API/BFF.
- Keep provider credentials on the server.
- Validate input and upstream payloads at runtime.
- Add central caching, in-flight request deduplication, rate limiting, structured errors, health endpoints, and API documentation.
- Return freshness and source metadata and tolerate partial air-quality failure.
- Move the web app from direct OpenWeather requests to the product API.
- Replace the exposed weather-tile integration with a safe server route or product-owned temperature markers.

Exit criteria:

- Browser bundles and URLs contain no provider secret.
- Repeated requests for a city produce a measurable cache hit.
- API contract and integration tests cover success, validation, upstream failure, partial data, and rate limiting.
- Web and API start together locally and in Docker.

### Phase 2 - A distinctive daily weather experience

- Introduce the Hava81 shell and SVG weather iconography.
- Consolidate current conditions, hourly changes, daily forecast, and details into a clear information hierarchy.
- Add deterministic decision helpers: umbrella, UV protection, strong wind, poor air quality, and best outdoor window.
- Add compare mode for up to three provinces.
- Add shareable, canonical city views.
- Maintain the completed Vite migration with supported build and test tooling.

Exit criteria:

- A first-time visitor understands the current day in under five seconds.
- The mobile first viewport satisfies the product requirement above.
- Lighthouse budgets and accessibility checks run in CI.
- The core city/search/favorite/map/settings flows have Playwright coverage.

### Phase 3 - Accounts and alerts

- Add managed OIDC or magic-link authentication; do not build password storage.
- Add PostgreSQL-backed favorites and preferences.
- Add alert rules with thresholds, quiet hours, cooldowns, and deduplication.
- Evaluate alerts by unique location in a background worker and deliver through Web Push and email.
- Add notification history and transparent delivery status.

Exit criteria:

- Every user-owned query is scoped to the authenticated subject.
- Alert evaluation reuses one weather observation per location.
- Retry and idempotency behavior is covered by integration tests.
- Data retention and location privacy are documented.

### Phase 4 - Portfolio-grade operations

- Add Redis-backed distributed cache and job queue where deployment scale requires them.
- Add provider fallback and a circuit breaker.
- Add error tracking, traces, latency/error/cache metrics, dashboards, and runbooks.
- Add container scanning, dependency policy, contract tests, and production smoke tests.
- Publish an architecture case study with measured before/after results.

## Explicit non-goals for the first release

- Microservices: a modular monolith is easier to operate and demonstrates better judgment at this scale.
- A social feed or generic weather news.
- AI-generated forecasts or advice that cannot be explained from weather measurements.
- Storing raw weather payloads indefinitely.
- Login before the anonymous experience is excellent.

## Portfolio story

The finished case study should demonstrate more than component count:

- A client-side secret was removed through a typed BFF.
- Provider cost and reliability were improved with caching, deduplication, rate limits, and partial failure handling.
- A generic dashboard was turned into a Turkey-specific decision product.
- Accessibility, responsive behavior, CI, containers, observability, and deployment were treated as product work.
- Outcomes are supported by test counts, cache-hit data, bundle/performance budgets, and before/after screenshots.
