import React, { useCallback, useEffect, useMemo, Suspense } from 'react';
import { 
  ErrorBoundary, 
  SearchBar, 
  WeatherCard, 
  Forecast,
  AirQuality,
  Favorites,
  WeatherBackground,
  WeatherCardSkeleton,
  ForecastSkeleton,
  AirQualitySkeleton,
} from './components';
import { useWeather, useForecast, useLocalStorage } from './hooks';
import { getWeatherTheme, applyThemeToDOM } from './utils';
import type { FavoriteCity } from './types';
import './styles/App.css';

const App: React.FC = () => {
  const {
    city,
    setCity,
    weather,
    error,
    isLoading,
    fetchWeather,
    fetchCurrentLocation,
    clearError,
    recentSearches,
  } = useWeather({ initialCity: 'İstanbul' });

  const forecast = useForecast();
  const [favorites, setFavorites] = useLocalStorage<FavoriteCity[]>('favorites', []);

  // Get theme based on current weather
  const themeConfig = useMemo(() => {
    return getWeatherTheme(weather?.icon);
  }, [weather?.icon]);

  // Apply theme to DOM when it changes
  useEffect(() => {
    applyThemeToDOM(themeConfig);
  }, [themeConfig]);

  // Fetch forecast when weather changes
  useEffect(() => {
    if (weather?.coordinates) {
      forecast.fetch(weather.coordinates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather?.coordinates?.lat, weather?.coordinates?.lon]);

  const handleSubmit = useCallback((selectedCity?: string) => {
    fetchWeather(selectedCity || city);
  }, [city, fetchWeather]);

  const handleLocationClick = useCallback(() => {
    fetchCurrentLocation();
  }, [fetchCurrentLocation]);

  const handleAddFavorite = useCallback(() => {
    if (!weather) return;
    
    const exists = favorites.some(f => f.name === weather.cityName);
    if (exists) return;
    
    const newFavorite: FavoriteCity = {
      name: weather.cityName,
      lat: weather.coordinates.lat,
      lon: weather.coordinates.lon,
      temp: weather.temperature,
      icon: weather.icon,
    };
    
    setFavorites([...favorites, newFavorite]);
  }, [weather, favorites, setFavorites]);

  const handleRemoveFavorite = useCallback((name: string) => {
    setFavorites(favorites.filter(f => f.name !== name));
  }, [favorites, setFavorites]);

  const handleSelectFavorite = useCallback((fav: FavoriteCity) => {
    fetchWeather(fav.name);
  }, [fetchWeather]);

  const isFavorite = weather ? favorites.some(f => f.name === weather.cityName) : false;

  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div className="app app--error">
          <div className="app__error-container">
            <h1>Bir hata oluştu</h1>
            <p>{err.message}</p>
            <button onClick={reset} className="app__reset-button">
              Tekrar Dene
            </button>
          </div>
        </div>
      )}
    >
      <div className="app" data-theme={themeConfig.theme}>
        {/* Animated Weather Background */}
        <WeatherBackground config={themeConfig} />
        
        {/* Sun glow effect for clear day */}
        {themeConfig.theme === 'clear-day' && <div className="sun-glow" />}

        <header className="app__header">
          <main className="app__content">
            <h1 className="app__title">Hava Durumu</h1>
            <p className="app__subtitle">
              Türkiye için anlık hava durumu
            </p>

            <div className="search-section">
              <div className="search-row">
                <SearchBar
                  value={city}
                  onChange={setCity}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                  recentSearches={recentSearches}
                  placeholder="Şehir ara..."
                />

                <button
                  type="button"
                  className="location-button"
                  onClick={handleLocationClick}
                  disabled={isLoading}
                  title="Konumumu Kullan"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/>
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div className="error-message">
                <span>{error.message}</span>
                <button onClick={clearError}>×</button>
              </div>
            )}

            {isLoading && (
              <div className="weather-content">
                <WeatherCardSkeleton />
                <AirQualitySkeleton />
                <ForecastSkeleton />
              </div>
            )}

            <Suspense fallback={
              <div className="weather-content">
                <WeatherCardSkeleton />
                <AirQualitySkeleton />
                <ForecastSkeleton />
              </div>
            }>
              {weather && !isLoading && (
                <div className="weather-content">
                  <WeatherCard weather={weather} />
                  
                  {forecast.airQuality && (
                    <AirQuality data={forecast.airQuality} />
                  )}

                  {(forecast.daily.length > 0 || forecast.hourly.length > 0) && (
                    <Forecast 
                      daily={forecast.daily} 
                      hourly={forecast.hourly} 
                    />
                  )}

                  <Favorites
                    favorites={favorites}
                    currentCity={weather.cityName}
                    onSelect={handleSelectFavorite}
                    onRemove={handleRemoveFavorite}
                    onAdd={handleAddFavorite}
                    canAdd={!isFavorite}
                  />
                </div>
              )}
            </Suspense>
          </main>
        </header>
      </div>
    </ErrorBoundary>
  );
};

export default App;
