# Weather Dashboard

Modern weather app for Turkish cities with dynamic themes and animated backgrounds.

<p align="center">
  <a href="https://zexy2.github.io/react-hava-durumu/">
    <img src="https://img.shields.io/badge/🌤️_Live_Demo-Visit_Site-blue?style=for-the-badge" alt="Live Demo" />
  </a>
</p>

> **[👉 https://zexy2.github.io/react-hava-durumu/](https://zexy2.github.io/react-hava-durumu/)**

## Features

- 🎨 Dynamic themes based on weather (sunny, rainy, snowy, etc.)
- ✨ Animated backgrounds (rain drops, snowflakes, stars)
- 🔍 Search with autocomplete for 81 Turkish cities
- 📍 Geolocation support
- 📊 5-day forecast with hourly details
- 💨 Air quality index (AQI)
- ⭐ Favorite cities
- 📱 Responsive glassmorphism UI

## Setup

```bash
npm install
cp .env.example .env
# Add your OpenWeather API key
npm start
```

Get an API key from [OpenWeather](https://openweathermap.org/api).

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
