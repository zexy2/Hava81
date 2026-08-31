# Contributing to Hava81

Thanks for helping improve Hava81. Changes should preserve the product's decision-first approach, accessibility baseline and transparent weather-data behavior.

## Development setup

```bash
git clone https://github.com/zexy2/Hava81.git
cd Hava81
npm ci
npm ci --prefix apps/api
cp .env.example .env
```

Add a valid `OPENWEATHER_API_KEY` to `.env`, then run the API and web app in separate terminals:

```bash
npm run api:dev
npm run dev
```

## Branches

Create a focused branch from the latest `main`:

```bash
git switch main
git pull --ff-only
git switch -c <type>/<short-description>
```

Keep unrelated changes in separate pull requests.

## Before opening a pull request

Run the checks relevant to your change. For broad changes, use the full local gate:

```bash
npm run type-check
npm run lint
npm test
npm run api:type-check
npm run api:test
npm run api:build
npm run build
npm run e2e
```

UI changes should be checked at mobile, tablet and desktop widths and with keyboard navigation. Changes involving motion should respect reduced-motion preferences; meaning must never depend on color alone.

## Pull requests

A good pull request:

- explains the user or engineering problem,
- describes the chosen solution and important trade-offs,
- includes screenshots for visible UI changes,
- calls out API, environment or deployment changes,
- adds or updates tests when behavior changes,
- keeps secrets and provider credentials out of commits.

Use the repository pull-request template and wait for required CI checks before merging.

## Product and design principles

Before changing core UX, read [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md). Hava81 should remain calm, local, decision-first and explicit about loading, stale, missing and provider-limited data states.

## Reporting bugs and requesting features

Use the GitHub issue forms. Include reproducible steps, browser/device details and screenshots when useful. Do not report vulnerabilities in public issues; follow [SECURITY.md](SECURITY.md).
