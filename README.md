# Turkiye Hava Durumu

Modern, responsive weather dashboard for all 81 Turkish provinces. Built with React 19 and TypeScript.

---

## Overview

A production-grade weather application featuring real-time weather data, interactive maps, and a dynamic theming system that adapts to current weather conditions. The project demonstrates modern frontend architecture patterns including custom hooks, context-based state management, and comprehensive internationalization.

**Live Demo:** [https://zexy2.github.io/Weather-app-for-Turkish-cities/](https://zexy2.github.io/Weather-app-for-Turkish-cities/)

---

## Features

### Core Functionality
- Real-time weather data for 81 Turkish provinces
- 5-day forecast with hourly breakdown
- Air quality index monitoring
- Wind speed and direction compass
- UV index gauge with recommendations
- Sunrise/sunset times with visual arc

### User Interface
- Weather-adaptive theme system (clear, cloudy, rain, snow, etc.)
- Glassmorphism design with backdrop blur effects
- Smooth animations via Framer Motion
- Full keyboard navigation support
- Responsive layout for mobile, tablet, and desktop

### Map Integration
- Interactive Turkey map powered by Leaflet.js
- Temperature overlay from OpenWeather
- Click-to-navigate city markers
- Temperature-based color coding

### Settings
- Language support: Turkish and English (i18next)
- Temperature units: Celsius / Fahrenheit
- Wind speed units: m/s, km/h, mph
- Persistent preferences via localStorage

---

## Tech Stack

| Category | Technologies |
|----------|-------------|
| Framework | React 19.1, TypeScript 5.x |
| Styling | CSS3, CSS Variables, Glassmorphism |
| Animation | Framer Motion 11 |
| Maps | Leaflet.js, React-Leaflet |
| i18n | react-i18next |
| HTTP | Custom httpClient with caching and retry logic |
| Testing | Jest, React Testing Library, MSW |
| Build | Create React App, Docker |

---

## Architecture

```
src/
├── api/                    # HTTP client, weather service, error handling
├── components/             # UI components (WeatherCard, Map, Settings, etc.)
├── context/                # React Context for global state (SettingsContext)
├── hooks/                  # Custom hooks (useWeather, useForecast, useDebounce)
├── i18n/                   # Internationalization config and locale files
├── constants/              # Static data (city list)
├── types/                  # TypeScript type definitions
├── utils/                  # Theme system, weather icons, helpers
└── styles/                 # Global CSS
```

### Data Flow

```
OpenWeather API
      |
      v
  httpClient (caching, retry, error handling)
      |
      v
  weatherService (data transformation)
      |
      v
  useWeather / useForecast hooks
      |
      v
  React Components
```

---

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- OpenWeather API key ([Get one here](https://openweathermap.org/api))

### Installation

```bash
# Clone the repository
git clone https://github.com/zexy2/Weather-app-for-Turkish-cities.git
cd Weather-app-for-Turkish-cities

# Install dependencies
npm install --legacy-peer-deps

# Configure environment
cp .env.example .env
# Add your API key to .env file

# Start development server
npm start
```

### Environment Variables

```
REACT_APP_OPENWEATHER_KEY=your_api_key
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run development server on port 3000 |
| `npm run build` | Create production build |
| `npm test` | Run test suite |
| `npm run test:coverage` | Generate coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix linting issues |
| `npm run type-check` | TypeScript type checking |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open search |
| `Ctrl/Cmd + ,` | Open settings |
| `Escape` | Close modal |
| `Ctrl/Cmd + Shift + R` | Refresh data |

---

## Docker

```bash
# Production
docker build -t weather-dashboard .
docker run -p 80:80 weather-dashboard

# Development
docker-compose --profile dev up
```

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
