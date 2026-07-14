# Quality baseline

Recorded on 2026-07-14 before the product-foundation work. This file is a baseline for the portfolio case study, not a statement about the current branch after fixes.

## Baseline results

| Check | Result | Notes |
| --- | --- | --- |
| TypeScript | Pass | `npm run type-check` |
| ESLint | Pass with warning | Unused `i18n` value in `Forecast.tsx` |
| Production build | Pass | Main JavaScript: 195.3 kB gzip, approximately 647 kB raw |
| Unit/integration tests | Fail | 21 passed, 6 failed across 27 tests |
| Coverage gate | Fail | Statements 14.69%, branches 11.26%, functions 15.29%, lines 15.13%; configured threshold 20% |
| Dependency audit | Fail | 53 findings: 1 critical, 25 high, 16 moderate, 11 low |
| Development Docker build | Fail | `react-scripts` and resolved TypeScript peer dependency conflict |
| Production Docker runtime | Fail | GitHub Pages base path produces 404 responses for JavaScript assets in root-hosted Nginx |
| Live desktop smoke check | Pass | Core Istanbul weather data rendered without console warnings |
| Live 390 px visual check | Fail | Utility controls push current conditions below the first viewport |

## Known causes

- WeatherCard tests render without the settings/i18n providers required by the component.
- The weather service test file primarily covers `ApiError`; MSW is not wired into the global test lifecycle.
- An async update in the `useWeather` suite is not fully awaited.
- CRA/react-scripts keeps an obsolete webpack dependency chain and requires legacy peer-dependency installation.
- The package `homepage` value is correct for GitHub Pages but incompatible with the root path used by the production Nginx image.
- The lazy WeatherMap import is defeated by an eager barrel export, leaving a single application chunk.

## Product correctness risks at baseline

- The provider key is compiled into the client bundle and included in request/tile URLs.
- UV is displayed as a hard-coded value.
- The notification and offline flags have no corresponding product behavior.
- English mode still leaves provider responses and several interface strings in Turkish.
- PWA shortcuts point at paths the application does not consume.

## Target gates

The foundation branch is complete only when:

- lint, type-check, tests, coverage, web build, API build, and container smoke tests are green;
- build steps do not suppress warnings with `CI=false`;
- no critical or high vulnerability remains in production dependencies;
- core browser flows run at 390, 768, and 1280 px;
- provider credentials are absent from browser artifacts;
- every displayed live measurement comes from a validated response or is clearly unavailable.
