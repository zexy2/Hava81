import React, { useCallback, useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  ErrorBoundary, 
  SearchBar, 
  WeatherCard, 
  Forecast,
  AirQualityPanel,
  CityTabs,
  WeatherBackground,
  WeatherCardSkeleton,
  ForecastSkeleton,
  AirQualitySkeleton,
  SunriseSunset,
  WindCompass,
  UVIndex,
  SettingsPanel,
  MotionList,
  MotionItem,
} from './components';
import { useWeather, useForecast, useLocalStorage, useKeyboardShortcuts, createAppShortcuts } from './hooks';
import { useSettings } from './context';
import { getWeatherTheme, applyThemeToDOM } from './utils';
import type { TurkishCity } from './constants/cities';
import type { FavoriteCity } from './types';
import './styles/App.css';

// Lazy load the map component
const WeatherMap = lazy(() => import('./components/WeatherMap'));

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      damping: 20,
      stiffness: 300,
    },
  },
} as const;

const App: React.FC = () => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

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

  // Handle add favorite
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

  // Keyboard shortcuts
  const shortcuts = useMemo(() => createAppShortcuts({
    openSearch: () => searchInputRef.current?.focus(),
    openSettings: () => setIsSettingsOpen(true),
    closeModal: () => setIsSettingsOpen(false),
    refreshData: () => weather && fetchWeather(weather.cityName),
    toggleFavorite: handleAddFavorite,
  }), [weather, fetchWeather, handleAddFavorite]);

  useKeyboardShortcuts(shortcuts);

  // Get theme based on current weather and user preference
  const themeConfig = useMemo(() => {
    const baseTheme = getWeatherTheme(weather?.icon);
    
    // Override with user preference if not auto
    if (settings.themeMode !== 'auto') {
      const overrideTheme = settings.themeMode === 'dark' ? 'clear-night' : 'clear-day';
      return {
        ...baseTheme,
        theme: overrideTheme as typeof baseTheme.theme,
      };
    }
    
    return baseTheme;
  }, [weather?.icon, settings.themeMode]);

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

  const handleRemoveFavorite = useCallback((name: string) => {
    setFavorites(favorites.filter(f => f.name !== name));
  }, [favorites, setFavorites]);

  const handleSelectFavorite = useCallback((fav: FavoriteCity) => {
    fetchWeather(fav.name);
  }, [fetchWeather]);

  const handleMapCitySelect = useCallback((cityData: TurkishCity) => {
    fetchWeather(cityData.name);
  }, [fetchWeather]);

  const isFavorite = weather ? favorites.some(f => f.name === weather.cityName) : false;

  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div className="app app--error">
          <div className="app__error-container">
            <h1>{t('common.error')}</h1>
            <p>{err.message}</p>
            <button onClick={reset} className="app__reset-button">
              {t('common.retry')}
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
            {/* Settings Button */}
            <motion.button
              className="settings-trigger"
              onClick={() => setIsSettingsOpen(true)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label={t('common.settings')}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </motion.button>

            <motion.h1 
              className="app__title"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {t('weather.title')}
            </motion.h1>
            <motion.p 
              className="app__subtitle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {t('weather.subtitle')}
            </motion.p>

            <motion.div 
              className="search-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="search-row">
                <SearchBar
                  value={city}
                  onChange={setCity}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                  recentSearches={recentSearches}
                  placeholder={t('weather.searchPlaceholder')}
                />

                <motion.button
                  type="button"
                  className="location-button"
                  onClick={handleLocationClick}
                  disabled={isLoading}
                  title={t('weather.useMyLocation')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/>
                  </svg>
                </motion.button>

                <motion.button
                  type="button"
                  className="map-toggle-button"
                  onClick={() => setShowMap(!showMap)}
                  title={t('common.map')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  data-active={showMap}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                    <line x1="8" y1="2" x2="8" y2="18" />
                    <line x1="16" y1="6" x2="16" y2="22" />
                  </svg>
                </motion.button>
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  className="error-message"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <span>{error.message}</span>
                  <button onClick={clearError}>×</button>
                </motion.div>
              )}
            </AnimatePresence>

            {isLoading && (
              <motion.div 
                className="weather-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <WeatherCardSkeleton />
                <AirQualitySkeleton />
                <ForecastSkeleton />
              </motion.div>
            )}

            <Suspense fallback={
              <div className="weather-content">
                <WeatherCardSkeleton />
                <AirQualitySkeleton />
                <ForecastSkeleton />
              </div>
            }>
              <AnimatePresence mode="wait">
                {weather && !isLoading && (
                  <motion.div
                    key={weather.cityName}
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, y: -20 }}
                  >
                    {/* City Tabs for multi-city support */}
                    {favorites.length > 0 && (
                      <motion.div variants={itemVariants}>
                        <CityTabs
                          cities={favorites}
                          activeCity={weather.cityName}
                          onSelect={handleSelectFavorite}
                          onRemove={handleRemoveFavorite}
                          onAdd={handleAddFavorite}
                          canAdd={!isFavorite}
                        />
                      </motion.div>
                    )}

                    <div className="weather-content">
                      <motion.div variants={itemVariants}>
                        <WeatherCard weather={weather} />
                      </motion.div>
                      
                      {/* Weather Map */}
                      <AnimatePresence>
                        {showMap && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <WeatherMap 
                              weather={weather}
                              onCitySelect={handleMapCitySelect}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {/* Weather Details Grid */}
                      <MotionList className="weather-details-grid">
                        <MotionItem>
                          <SunriseSunset 
                            sunrise={weather.sunrise} 
                            sunset={weather.sunset} 
                          />
                        </MotionItem>
                        <MotionItem>
                          <WindCompass 
                            speed={weather.windSpeed} 
                            direction={weather.windDirection} 
                          />
                        </MotionItem>
                        {forecast.airQuality && (
                          <MotionItem>
                            <AirQualityPanel data={forecast.airQuality} />
                          </MotionItem>
                        )}
                        <MotionItem>
                          <UVIndex value={3.5} />
                        </MotionItem>
                      </MotionList>

                      {(forecast.daily.length > 0 || forecast.hourly.length > 0) && (
                        <motion.div variants={itemVariants}>
                          <Forecast 
                            daily={forecast.daily} 
                            hourly={forecast.hourly} 
                          />
                        </motion.div>
                      )}

                      {/* Add to favorites button if not already added */}
                      {!isFavorite && favorites.length === 0 && (
                        <motion.button 
                          className="add-favorite-btn"
                          onClick={handleAddFavorite}
                          variants={itemVariants}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {t('weather.addToFavorites')}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Suspense>

            {/* Keyboard shortcuts hint */}
            <motion.div 
              className="keyboard-hints"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <span>⌘K {t('common.keyboardSearch')}</span>
              <span>⌘, {t('common.keyboardSettings')}</span>
            </motion.div>
          </main>
        </header>

        {/* Settings Panel */}
        <SettingsPanel 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      </div>
    </ErrorBoundary>
  );
};

export default App;
