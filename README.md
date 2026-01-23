# Weather Dashboard

Modern weather application built with React and TypeScript. Provides real-time weather data for Turkish cities using the OpenWeather API.

## Features

- Real-time weather data via OpenWeather API
- Autocomplete search for 81 Turkish cities with keyboard navigation
- Geolocation support
- Request caching and retry logic with exponential backoff
- Responsive design with glassmorphism UI
- Accessible (WCAG 2.1 compliant)
- Docker support with multi-stage builds
- CI/CD via GitHub Actions

## Tech Stack

- React 19, TypeScript 5.3
- Custom hooks for state management
- Zod for runtime validation
- Jest + React Testing Library + MSW
- Docker, nginx, GitHub Actions

## Getting Started

### Prerequisites

- Node.js 18+
- OpenWeather API key - [Get one here](https://openweathermap.org/api)

### Installation

```bash
git clone https://github.com/zexy2/react-hava-durumu.git
cd react-hava-durumu
npm install
cp .env.example .env
# Add your REACT_APP_OPENWEATHER_KEY to .env
npm start
```

### Docker

```bash
docker build -t weather-dashboard \
  --build-arg REACT_APP_OPENWEATHER_KEY=your_key .
docker run -p 3000:80 weather-dashboard
```

## Project Structure

```
src/
├── api/                 # HTTP client, weather service, error handling
├── components/          # React components (SearchBar, WeatherCard, etc.)
├── config/              # Environment and API configuration
├── hooks/               # Custom hooks (useWeather, useAsync, useDebounce)
├── types/               # TypeScript definitions
└── __tests__/           # Test suites
```

## Scripts

| Command                 | Description              |
| ----------------------- | ------------------------ |
| `npm start`             | Start development server |
| `npm run build`         | Production build         |
| `npm test`              | Run tests                |
| `npm run test:coverage` | Tests with coverage      |
| `npm run type-check`    | TypeScript check         |
| `npm run lint`          | ESLint                   |

## Environment Variables

| Variable                    | Required | Default | Description         |
| --------------------------- | -------- | ------- | ------------------- |
| `REACT_APP_OPENWEATHER_KEY` | Yes      | -       | OpenWeather API key |
| `REACT_APP_CACHE_TTL`       | No       | 300000  | Cache TTL (ms)      |
| `REACT_APP_MAX_RETRIES`     | No       | 3       | Max retry attempts  |

## License

MIT
