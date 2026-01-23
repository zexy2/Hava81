/**
 * Main App Component - Enhanced Version
 */

import React, { useCallback, Suspense } from 'react';
import { 
  ErrorBoundary, 
  SearchBar, 
  WeatherCard, 
  Lightning,
  LoadingSpinner,
  Alert,
} from './components';
import { useWeather } from './hooks';
import './App.css';

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
    lastUpdated,
  } = useWeather({ initialCity: 'İzmir' });

  const handleSubmit = useCallback((selectedCity?: string) => {
    fetchWeather(selectedCity || city);
  }, [city, fetchWeather]);

  const handleLocationClick = useCallback(() => {
    fetchCurrentLocation();
  }, [fetchCurrentLocation]);

  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div className="app app--error">
          <div className="app__error-container">
            <h1>Bir şeyler yanlış gitti</h1>
            <p>{err.message}</p>
            <button onClick={reset} className="app__reset-button">
              Tekrar Dene
            </button>
          </div>
        </div>
      )}
    >
      <div className="app">
        <header className="app__header">
          {/* Background Effects */}
          <div className="app__hero" aria-hidden="true">
            <Lightning hue={220} xOffset={-15} speed={1.2} intensity={1.1} />
            <Lightning hue={260} xOffset={25} speed={0.9} intensity={0.6} />
          </div>

          <main className="app__content">
            <h1 className="app__title">
              Hava Durumu
              <span className="app__title-accent">Dashboard</span>
            </h1>
            <p className="app__subtitle">
              Türkiye şehirleri için gerçek zamanlı hava durumu bilgisi
            </p>

            <SearchBar
              value={city}
              onChange={setCity}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              recentSearches={recentSearches}
              placeholder="Şehir ara..."
            />

            {/* Location Button */}
            <button
              type="button"
              className="app__location-btn"
              onClick={handleLocationClick}
              disabled={isLoading}
              aria-label="Konumumu kullan"
            >
              📍 Konumumu Kullan
            </button>

            {/* Error State */}
            {error && (
              <Alert
                variant="error"
                message={error.message}
                dismissible
                onDismiss={clearError}
                action={
                  error.retryable
                    ? { label: 'Tekrar Dene', onClick: handleSubmit }
                    : undefined
                }
              />
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="app__loading">
                <LoadingSpinner size="medium" text="Hava durumu yükleniyor..." />
              </div>
            )}

            {/* Weather Display */}
            <Suspense fallback={<LoadingSpinner />}>
              {weather && !isLoading && (
                <>
                  <WeatherCard weather={weather} showExtendedInfo />
                  
                  {lastUpdated && (
                    <p className="app__last-updated">
                      Son güncelleme: {lastUpdated.toLocaleTimeString('tr-TR')}
                    </p>
                  )}
                </>
              )}
            </Suspense>
          </main>
        </header>
      </div>
    </ErrorBoundary>
  );
};

export default App;
