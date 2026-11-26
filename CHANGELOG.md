# Changelog

Notable changes to Hava81. Versions follow [semantic versioning](https://semver.org/); full notes are on the [releases page](https://github.com/zexy2/Hava81/releases).

## [2.1.0] - 2026-08-31

Decision platform release.

- Day Plan with an explainable 0–100 suitability score and "now or later?" guidance
- Activity-specific planning: walking, running, picnics, children, motorcycles, laundry
- Environmental context: air quality, UV, dust, pollen and supported coastal marine signals
- City comparison, route-weather context, shareable decision summaries
- PWA support, opt-in decision alerts, city deep links, sitemap, source and freshness attribution

## [2.0.0] - 2026-08-27

- Frontend moved to Vite; Fastify API hardened and kept as the only holder of provider credentials
- Timezone and 3-hour forecast fixes; source and freshness metadata on forecasts
- Shareable city routes and comparison; resilient provider handling
- CI/CD with browser tests and Lighthouse budgets; live data checks across all 81 provinces

[2.1.0]: https://github.com/zexy2/Hava81/releases/tag/v2.1.0
[2.0.0]: https://github.com/zexy2/Hava81/releases/tag/v2.0.0
