# Hava81 — Türkiye'nin Meteorolojik Atlası

Decision-first weather intelligence for all 81 Turkish provinces. Built with React 19 and a TypeScript Fastify BFF.

[![CI/CD Pipeline](https://github.com/zexy2/Weather-app-for-Turkish-cities/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/zexy2/Weather-app-for-Turkish-cities/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/Live-GitHub%20Pages-146B73?style=flat-square)](https://zexy2.github.io/Weather-app-for-Turkish-cities/)
[![API](https://img.shields.io/badge/API-Render-E7A531?style=flat-square)](https://hava81-api.onrender.com/api/v1/health/ready)
[![License: MIT](https://img.shields.io/badge/License-MIT-0E2C32?style=flat-square)](LICENSE)

---

## Overview

Hava81 turns raw forecast data into a calm, local and immediately readable meteorological atlas. Its primary surface answers what the weather is doing now and what materially changes next, then supports that decision with hourly trends, five-day context, air quality and an interactive map. The project demonstrates production frontend architecture, a server-side API boundary, internationalization and comprehensive testing.

**Live Demo:** [Hava81 on GitHub Pages](https://zexy2.github.io/Weather-app-for-Turkish-cities/) · **API:** [Render readiness endpoint](https://hava81-api.onrender.com/api/v1/health/ready)

---

## Product Preview

### Desktop meteorological atlas

![Hava81 desktop interface showing the İstanbul decision field, hourly rhythm, five-day forecast and environment rail](docs/images/hava81-desktop.png)

### Mobile decision view

<p align="center">
  <img src="docs/images/hava81-mobile.png" width="390" alt="Hava81 mobile interface showing the İstanbul weather decision field and bottom navigation" />
</p>

---

## Features

### Core Functionality

- Real-time weather data for 81 Turkish provinces
- Decision field with the next material precipitation or temperature change
- 5-day forecast with hourly breakdown
- Air quality index monitoring
- Daylight, wind and air-quality environmental rail
- Persistent favorite cities and recent searches

### User Interface

- Original atlas-inspired visual system with topographic texture and local plate codes
- Responsive editorial layout with dedicated mobile bottom navigation
- Deterministic inline SVG weather symbols instead of emoji or remote icon assets
- Accessible light, dark and automatic themes
- Restrained, reduced-motion-aware animation via Framer Motion
- Full keyboard navigation support
- Responsive layout for mobile, tablet, and desktop

### Map Integration

- Interactive Turkey map powered by Leaflet.js
- Click-to-navigate city markers
- Temperature-based color coding

### Settings

- Language support: Turkish and English (i18next)
- Temperature units: Celsius / Fahrenheit
- Wind speed units: m/s, km/h, mph
- Persistent preferences via localStorage

---

## Tech Stack

| Category   | Technologies                                                  |
| ---------- | ------------------------------------------------------------- |
| Framework  | React 19.1, TypeScript 5.x                                    |
| Styling    | CSS, semantic design tokens, responsive atlas layout          |
| Typography | IBM Plex Sans Variable, Source Serif 4 Variable               |
| Animation  | Framer Motion 12                                              |
| Maps       | Leaflet.js, React-Leaflet                                     |
| i18n       | react-i18next                                                 |
| HTTP       | Custom httpClient with caching and retry logic                |
| Backend    | Fastify 5, Zod, OpenAPI                                       |
| Security   | Helmet, CORS, server-side provider credentials, rate limiting |
| Testing    | Jest, React Testing Library, MSW, Fastify inject              |
| Build      | Create React App, Docker                                      |

---

## Architecture

```
src/
├── api/                    # HTTP client, weather service, error handling
├── components/hava81/      # Decision field, forecast atlas, environment rail
├── components/             # Search, map, settings and supporting UI
├── context/                # React Context for global state (SettingsContext)
├── hooks/                  # Custom hooks (useWeather, useForecast, useDebounce)
├── i18n/                   # Internationalization config and locale files
├── constants/              # Static data (city list)
├── types/                  # TypeScript type definitions
├── utils/                  # Weather helpers and transport normalization
└── styles/                 # Global CSS

apps/api/
├── src/providers/          # OpenWeather adapter and runtime response schemas
├── src/modules/weather/    # Versioned routes and normalized weather service
├── src/core/               # TTL cache, in-flight dedupe and structured errors
└── test/                   # Fastify inject integration tests
```

### Data Flow

```
React Components -> hooks -> frontend weatherService
                               |
                               v
                    Fastify API (/api/v1)
                    | validation, rate limit
                    | TTL cache + request dedupe
                               |
                               v
                    OpenWeather provider adapter
```

---

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm or yarn
- OpenWeather API key ([Get one here](https://openweathermap.org/api))

### Installation

```bash
# Clone the repository
git clone https://github.com/zexy2/Weather-app-for-Turkish-cities.git
cd Weather-app-for-Turkish-cities

# Install dependencies
npm install --legacy-peer-deps
npm install --prefix apps/api

# Configure environment
cp .env.example .env
# Add the server-only OpenWeather key to .env

# Terminal 1: start the API on port 4000
npm run api:dev

# Terminal 2: start the web app on port 3000
npm start
```

### Environment Variables

```
OPENWEATHER_API_KEY=your_server_only_api_key
REACT_APP_API_BASE_URL=/api/v1
```

`OPENWEATHER_API_KEY` is read only by `apps/api`; it must never use a
`REACT_APP_` prefix. The relative web URL is forwarded to port 4000 by the CRA
development proxy and to the API container by Nginx in production.

### API

| Endpoint                                              | Description                       |
| ----------------------------------------------------- | --------------------------------- |
| `GET /api/v1/weather/current?city=İzmir`              | Current conditions by city        |
| `GET /api/v1/weather/current?lat=38.42&lon=27.13`     | Current conditions by coordinates |
| `GET /api/v1/weather/forecast?lat=38.42&lon=27.13`    | Hourly and five-day forecast      |
| `GET /api/v1/weather/air-quality?lat=38.42&lon=27.13` | Air-quality snapshot              |
| `GET /api/v1/health/live`                             | Liveness probe                    |
| `GET /api/v1/health/ready`                            | Readiness probe                   |

Interactive OpenAPI documentation is available at `http://localhost:4000/docs`.

---

## Available Scripts

| Command                  | Description                         |
| ------------------------ | ----------------------------------- |
| `npm start`              | Run development server on port 3000 |
| `npm run build`          | Create production build             |
| `npm test`               | Run test suite                      |
| `npm run test:coverage`  | Generate coverage report            |
| `npm run lint`           | Run ESLint                          |
| `npm run lint:fix`       | Auto-fix linting issues             |
| `npm run type-check`     | TypeScript type checking            |
| `npm run api:dev`        | Run the Fastify API on port 4000    |
| `npm run api:test`       | Run API inject tests                |
| `npm run api:type-check` | Type-check the API                  |
| `npm run api:build`      | Build the production API bundle     |

---

## Keyboard Shortcuts

| Shortcut               | Action        |
| ---------------------- | ------------- |
| `Ctrl/Cmd + K`         | Open search   |
| `Ctrl/Cmd + ,`         | Open settings |
| `Escape`               | Close modal   |
| `Ctrl/Cmd + Shift + R` | Refresh data  |

---

## Production Deployment

| Surface          | Platform       | Production address                                                                                        |
| ---------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| React web app    | GitHub Pages   | [zexy2.github.io/Weather-app-for-Turkish-cities](https://zexy2.github.io/Weather-app-for-Turkish-cities/) |
| Fastify BFF      | Render         | [hava81-api.onrender.com/api/v1](https://hava81-api.onrender.com/api/v1/health/ready)                     |
| Weather provider | OpenWeather    | Accessed only by the server-side provider adapter                                                         |
| CI/CD            | GitHub Actions | Frontend, API, tests, Docker image and Pages deployment                                                   |

```text
GitHub Pages browser
        │ public API base URL
        ▼
Render Fastify BFF
        │ server-only provider credential
        ▼
OpenWeather
```

The browser bundle receives only the public Render base URL through the GitHub
repository variable `API_BASE_URL`. `OPENWEATHER_API_KEY` remains a server-only
Render environment secret, while `CORS_ORIGINS=https://zexy2.github.io` limits
browser access to the deployed web origin.

Production probes:

- [`GET /api/v1/health/live`](https://hava81-api.onrender.com/api/v1/health/live)
- [`GET /api/v1/health/ready`](https://hava81-api.onrender.com/api/v1/health/ready)
- [Interactive OpenAPI documentation](https://hava81-api.onrender.com/docs)

> The current Render Free instance can spin down while idle, so the first
> request after a period of inactivity may take longer than subsequent calls.

---

## Docker

```bash
# Production web + API
cp .env.example .env
# Set OPENWEATHER_API_KEY in .env, then:
docker compose up --build

# Development
npm run docker:dev
```

Static hosts such as GitHub Pages must set `REACT_APP_API_BASE_URL` to the
absolute URL of a separately deployed API. The provider key remains only in the
API deployment environment.

---

## Project Structure Decisions

**Why custom httpClient instead of axios?**

- Smaller bundle size
- Built-in caching layer
- Custom retry logic with exponential backoff
- Type-safe error handling

**Why CSS instead of CSS-in-JS?**

- Better performance (no runtime overhead)
- Native CSS variables for theming
- Smaller bundle size

**Why Context API instead of Redux?**

- Simpler mental model for this scale
- No boilerplate
- Built into React

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -m 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [OpenWeather](https://openweathermap.org/) for the weather API
- [Leaflet](https://leafletjs.com/) for the mapping library
- [Framer Motion](https://www.framer.com/motion/) for animations
