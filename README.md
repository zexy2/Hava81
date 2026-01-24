# Weather Dashboard

A modern, responsive weather application for Turkish cities built with React and TypeScript. Features real-time weather data, dynamic theming based on current conditions, and smooth canvas-based animations.

**Live Demo:** [zexy2.github.io/react-hava-durumu](https://zexy2.github.io/react-hava-durumu/)

## Features

- **Dynamic Theming** - UI colors and backgrounds adapt to current weather conditions (clear, cloudy, rain, snow, thunderstorm, etc.)
- **Canvas Animations** - Particle-based weather effects: rain drops, snowflakes, moving clouds, stars at night
- **City Search** - Autocomplete search supporting all 81 Turkish provinces
- **Geolocation** - Automatic location detection with user permission
- **5-Day Forecast** - Extended forecast with daily breakdown
- **Air Quality Index** - Real-time AQI data from OpenWeather
- **Favorites** - Save frequently checked cities to local storage
- **Glassmorphism UI** - Modern frosted-glass design with smooth transitions

## Tech Stack

| Category | Technologies |
|----------|-------------|
| Frontend | React 19, TypeScript 5.3 |
| Styling | CSS3 (Custom Properties, Backdrop Filter) |
| Validation | Zod |
| Testing | Jest, React Testing Library, MSW |
| Build | Create React App |
| Deployment | GitHub Pages, Docker |

## Getting Started

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Add REACT_APP_WEATHER_API_KEY=your_api_key

# Start development server
npm start
```

Requires an API key from [OpenWeather](https://openweathermap.org/api).

## Available Scripts

```bash
npm start       # Start dev server on localhost:3000
npm run build   # Create optimized production build
npm test        # Run test suite
npm run lint    # Run ESLint
```

## Project Structure

```
src/
├── api/          # HTTP client, weather service, error handling
├── components/   # React components (SearchBar, WeatherCard, etc.)
├── config/       # Environment and API configuration
├── hooks/        # Custom hooks (useWeather, useDebounce, etc.)
├── types/        # TypeScript type definitions
└── utils/        # Helper functions, theme utilities
```

## License

MIT
