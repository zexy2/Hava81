# Weather Dashboard

Weather app for Turkish cities. Built with React and TypeScript.

## Setup

```bash
npm install
cp .env.example .env
# Add your OpenWeather API key
npm start
```

Get an API key from [OpenWeather](https://openweathermap.org/api).

## Features

- Search with autocomplete for 81 Turkish cities
- Geolocation support
- Request caching with retry logic
- Responsive glassmorphism UI

## Tech

- React 19, TypeScript
- Zod for validation
- Jest + RTL + MSW for testing
- Docker support

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Dev server |
| `npm run build` | Production build |
| `npm test` | Run tests |
| `npm run lint` | ESLint |

## License

MIT
