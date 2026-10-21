import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SearchBar } from './components/SearchBar';
import { suggestCity } from './utils/citySuggestion';
import { formatCityTime } from './utils/format';
import { CityTabs } from './components/CityTabs';
import { WeatherDecisionField } from './components/hava81/WeatherDecisionField';
import { DecisionGlance } from './components/hava81/DecisionGlance';
import { AtlasBottomNav } from './components/hava81/AtlasBottomNav';
import { useWeather } from './hooks/useWeather';
import { useForecast } from './hooks/useForecast';
import { useFavorites } from './hooks/useFavorites';
import { useResolvedColorMode } from './hooks/useResolvedColorMode';
import { createAppShortcuts, useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSettings } from './context/SettingsContext';
import type { TurkishCity } from './constants/cities';
import type { FavoriteCity } from './types/weather.types';
import { ErrorCode } from './types';
import { ApiError } from './api/errors/ApiError';
import { resolveInitialCity } from './utils/appRoute';
import { useAppRouting } from './hooks/useAppRouting';
import {
  LocationIcon,
  MapIcon,
  SearchIcon,
  SettingsIcon,
  StarIcon,
} from './components/app/AppIcons';
import { AtlasLoadingState, ForecastLoadingCard } from './components/app/AppSkeletons';
import { scrollIntoViewRespectingMotion } from './utils/motion';
import { parseAtlasView, resolveAtlasView, type AtlasView } from './utils/atlasView';
import { getOptionalEvidenceFreshness } from './utils/optionalEvidenceFreshness';
import { trackProductEvent } from './analytics/productEvents';
import './styles/App.css';

const WeatherMap = lazy(() => import('./components/WeatherMap'));
const ForecastAtlas = lazy(() => import('./components/hava81/ForecastAtlas'));
const DailyPlanPanel = lazy(() => import('./components/hava81/DailyPlanPanel'));
const CommutePlanPanel = lazy(() => import('./components/hava81/CommutePlanPanel'));
const EnvironmentRail = lazy(() => import('./components/hava81/EnvironmentRail'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const ComparePanel = lazy(() => import('./components/hava81/ComparePanel'));
const ActivityPlanner = lazy(() => import('./components/hava81/ActivityPlanner'));
const ContextSignalsPanel = lazy(() => import('./components/hava81/ContextSignalsPanel'));
const DecisionAlertsPanel = lazy(() => import('./components/hava81/DecisionAlertsPanel'));
const RouteWeatherPanel = lazy(() => import('./components/hava81/RouteWeatherPanel'));

type AtlasNavItem = AtlasView;

const App: React.FC = () => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Faz 2.5 + 2.3: `?view=map`, `?view=compare` and `?view=plan` open those views directly.
  const [initialView] = useState(() => parseAtlasView(window.location.search));
  const [showMap, setShowMap] = useState(initialView === 'map');
  const [activeNav, setActiveNav] = useState<AtlasNavItem>(initialView);
  const currentView = resolveAtlasView(activeNav, showMap);
  const isPlanView = currentView === 'plan';
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const cityRailRef = useRef<HTMLDivElement>(null);
  const mapRegionRef = useRef<HTMLElement>(null);
  const mapReturnFocusRef = useRef<HTMLElement | null>(null);
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [initialCity] = useState(() => resolveInitialCity(window.location));
  const isRootRoute = window.location.pathname === '/';

  const {
    city,
    setCity,
    weather,
    error,
    isLoading,
    fetchWeather,
    fetchCurrentLocation,
    clearWeather,
    clearError,
    lastKnownAt,
    recentSearches,
  } = useWeather({ initialCity, language: settings.language });

  const forecast = useForecast(settings.language);
  const fetchForecast = forecast.fetch;
  const {
    favorites,
    isFavorite,
    addFavorite: handleAddFavorite,
    removeFavorite: handleRemoveFavorite,
    toggleFavorite: handleToggleFavorite,
  } = useFavorites(weather);

  useEffect(() => {
    if (!isLoading || weather) {
      setIsSlowLoading(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setIsSlowLoading(true), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [isLoading, weather]);

  const colorMode = useResolvedColorMode(settings.themeMode);

  useEffect(() => {
    const themeColor = colorMode === 'dark' ? '#0E2C32' : '#F3F6F4';
    document.documentElement.style.colorScheme = colorMode;
    document.documentElement.dataset.colorMode = colorMode;
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
      meta.content = themeColor;
    });
  }, [colorMode]);

  useEffect(() => {
    const lat = weather?.coordinates.lat;
    const lon = weather?.coordinates.lon;
    if (lat !== undefined && lon !== undefined) {
      fetchForecast({ lat, lon }, weather?.cityName);
    }
  }, [fetchForecast, weather?.cityName, weather?.coordinates.lat, weather?.coordinates.lon]);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const openSearch = useCallback(() => {
    setIsMobileSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);
  const closeSearch = useCallback(() => {
    searchInputRef.current?.blur();
    setIsMobileSearchOpen(false);
    requestAnimationFrame(() => searchToggleRef.current?.focus());
  }, []);
  const toggleMobileSearch = useCallback(() => {
    if (isMobileSearchOpen) {
      closeSearch();
      return;
    }
    openSearch();
  }, [closeSearch, isMobileSearchOpen, openSearch]);

  useAppRouting({
    weather,
    currentView,
    language: settings.language,
    t,
    fetchWeather,
    clearWeather,
    setShowMap,
    setActiveNav,
  });

  const shortcuts = useMemo(
    () =>
      createAppShortcuts({
        openSearch,
        openSettings,
        closeModal: closeSettings,
      }),
    [closeSettings, openSearch, openSettings]
  );

  const { getShortcutDisplay } = useKeyboardShortcuts(shortcuts, { enabled: !isSettingsOpen });
  const searchShortcut = shortcuts.find(shortcut => shortcut.key === 'k');
  const settingsShortcut = shortcuts.find(shortcut => shortcut.key === ',');
  const searchShortcutLabel = searchShortcut ? getShortcutDisplay(searchShortcut) : 'Ctrl+K';
  const settingsShortcutLabel = settingsShortcut ? getShortcutDisplay(settingsShortcut) : 'Ctrl+,';

  const handleSubmit = useCallback(
    (selectedCity?: string) => {
      closeSearch();
      fetchWeather(selectedCity || city);
    },
    [city, closeSearch, fetchWeather]
  );

  const handleSelectFavorite = useCallback(
    (favorite: FavoriteCity) => {
      setShowMap(false);
      setActiveNav('today');
      fetchWeather(favorite.name);
    },
    [fetchWeather]
  );

  const restoreMapTriggerFocus = useCallback(() => {
    const trigger = mapReturnFocusRef.current;
    mapReturnFocusRef.current = null;
    if (!trigger) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (trigger.isConnected) trigger.focus({ preventScroll: true });
      });
    });
  }, []);

  const handleMapCitySelect = useCallback(
    (cityData: TurkishCity) => {
      fetchWeather(cityData.name);
      setShowMap(false);
      setActiveNav('today');
      restoreMapTriggerFocus();
      requestAnimationFrame(() => {
        if (overviewRef.current) scrollIntoViewRespectingMotion(overviewRef.current);
      });
    },
    [fetchWeather, restoreMapTriggerFocus]
  );

  const openMap = useCallback(() => {
    const activeElement = document.activeElement;
    mapReturnFocusRef.current =
      activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null;
    setShowMap(true);
    setActiveNav('map');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (mapRegionRef.current) {
          scrollIntoViewRespectingMotion(mapRegionRef.current, { block: 'start' });
        }
        mapRegionRef.current?.focus({ preventScroll: true });
      });
    });
  }, []);

  const closeMap = useCallback(() => {
    const activeElement = document.activeElement;
    const shouldRestoreFocus =
      activeElement instanceof HTMLElement && Boolean(activeElement.closest('#weather-map-region'));

    setShowMap(false);
    setActiveNav('today');
    if (shouldRestoreFocus) restoreMapTriggerFocus();
  }, [restoreMapTriggerFocus]);

  const handleBottomNav = useCallback(
    (item: AtlasNavItem) => {
      if (item === 'map') {
        openMap();
        return;
      }

      if (item === 'plan') {
        setShowMap(false);
        setActiveNav('plan');
        requestAnimationFrame(() => {
          if (overviewRef.current) {
            scrollIntoViewRespectingMotion(overviewRef.current, { block: 'start' });
          }
        });
        return;
      }

      if (item === 'compare') {
        trackProductEvent('compare_opened', { favorites: favorites.length });
        setShowMap(false);
        setActiveNav('compare');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (cityRailRef.current) {
              scrollIntoViewRespectingMotion(cityRailRef.current, { block: 'start' });
            }
          });
        });
        return;
      }

      setShowMap(false);
      setActiveNav('today');
      if (overviewRef.current) {
        scrollIntoViewRespectingMotion(overviewRef.current, { block: 'start' });
      }
    },
    [favorites.length, openMap]
  );

  // "Skorun nedenini gör" in the decision summary: the explanation lives in Planla now.
  const openScoreDetails = useCallback(() => {
    setShowMap(false);
    setActiveNav('plan');
    let attempts = 0;
    const focusDayPlan = () => {
      const heading = document.getElementById('daily-plan-title');
      if (heading) {
        scrollIntoViewRespectingMotion(heading, { block: 'start' });
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
        return;
      }
      // The day plan is lazy; give Suspense a few frames before giving up.
      attempts += 1;
      if (attempts < 60) requestAnimationFrame(focusDayPlan);
    };
    requestAnimationFrame(focusDayPlan);
  }, []);

  const handleInitialLocation = useCallback(async () => {
    clearError();
    await fetchCurrentLocation();
  }, [clearError, fetchCurrentLocation]);

  const handleInitialIstanbul = useCallback(() => {
    clearError();
    void fetchWeather('İstanbul');
  }, [clearError, fetchWeather]);

  const isLocationError =
    error?.code === ErrorCode.LOCATION_DENIED ||
    error?.code === ErrorCode.LOCATION_UNAVAILABLE ||
    error?.code === ErrorCode.LOCATION_TIMEOUT;
  // A typo is not a system error: show it inline under the search box (Faz 1.3).
  const searchNotFound = error?.code === ErrorCode.NOT_FOUND;
  const failedQuery = city;
  const searchSuggestion = useMemo(
    () => (searchNotFound ? suggestCity(failedQuery) : null),
    [failedQuery, searchNotFound]
  );
  const canRetryCurrentWeather = Boolean(error && (isLocationError || error.retryable));

  const retryCurrentWeather = useCallback(() => {
    clearError();
    if (isLocationError) {
      void fetchCurrentLocation();
      return;
    }
    void fetchWeather(city || weather?.cityName || 'İstanbul');
  }, [city, clearError, fetchCurrentLocation, fetchWeather, isLocationError, weather?.cityName]);

  const canRetryForecast =
    !forecast.error || !(forecast.error instanceof ApiError) || forecast.error.retryable;

  const retryForecast = useCallback(() => {
    if (weather?.coordinates) fetchForecast(weather.coordinates, weather.cityName);
  }, [fetchForecast, weather?.cityName, weather?.coordinates]);

  const freshUvIndexMax =
    forecast.contextSignals && getOptionalEvidenceFreshness(forecast.contextSignals).fresh
      ? forecast.contextSignals.uvIndexMax
      : undefined;
  const freshAirQuality =
    forecast.airQuality && getOptionalEvidenceFreshness(forecast.airQuality.meta).fresh
      ? forecast.airQuality
      : undefined;

  return (
    <>
      <ErrorBoundary
        fallback={(_caughtError, reset) => (
          <div className="app-fatal" role="alert">
            <span className="atlas-kicker">{t('hava81.systemStatus')}</span>
            <h1>{t('common.error')}</h1>
            <p>{t('errors.genericError')}</p>
            <button type="button" onClick={reset} className="atlas-button atlas-button--primary">
              {t('common.retry')}
            </button>
          </div>
        )}
      >
        <div
          className="app"
          data-color-mode={colorMode}
          data-active-nav={activeNav}
          data-has-bottom-nav={weather || favorites.length > 0 ? 'true' : 'false'}
        >
          <a
            className="skip-link"
            href="#main-content"
            onClick={() => overviewRef.current?.focus({ preventScroll: true })}
          >
            {t('common.skipToContent')}
          </a>

          <header
            className={`atlas-header${isMobileSearchOpen ? ' atlas-header--search-open' : ''}`}
          >
            <div className="atlas-header__inner">
              <a className="atlas-brand" href="/">
                <span className="atlas-brand__name">Hava81</span>
                <span className="atlas-brand__index" aria-hidden="true">
                  <b>81</b>
                  <small>ATLAS</small>
                </span>
              </a>

              <div className="atlas-header__search" id="atlas-search-region">
                <SearchBar
                  ref={searchInputRef}
                  value={city}
                  onChange={setCity}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                  recentSearches={recentSearches}
                  placeholder={t('weather.searchPlaceholder')}
                  manualQueryHint={t('weather.districtSearchHint')}
                  label={t('weather.searchLabel')}
                  submitLabel={t('common.search')}
                  loadingLabel={t('common.loading')}
                  suggestionsLabel={t('weather.citySuggestions')}
                  onDismiss={isMobileSearchOpen ? closeSearch : undefined}
                />
                {searchNotFound && (
                  <p className="atlas-search-inline-error" role="alert">
                    {t('weather.searchNotFound', { query: failedQuery })}{' '}
                    {searchSuggestion && (
                      <>
                        {t('weather.didYouMean')}{' '}
                        <button
                          type="button"
                          className="atlas-text-button"
                          onClick={() => {
                            setCity(searchSuggestion.name);
                            handleSubmit(searchSuggestion.name);
                          }}
                        >
                          {searchSuggestion.name}
                        </button>
                        ?
                      </>
                    )}
                  </p>
                )}
              </div>

              <div
                className="atlas-header__actions"
                role="group"
                aria-label={t('weather.quickActions')}
              >
                <button
                  ref={searchToggleRef}
                  type="button"
                  className="atlas-icon-button atlas-icon-button--search"
                  onClick={toggleMobileSearch}
                  aria-expanded={isMobileSearchOpen}
                  aria-controls="atlas-search-region"
                  aria-label={
                    isMobileSearchOpen ? t('hava81.closeSearch') : t('weather.searchLabel')
                  }
                >
                  <SearchIcon />
                </button>
                <button
                  type="button"
                  className="atlas-icon-button atlas-icon-button--location"
                  onClick={!isRootRoute || weather ? fetchCurrentLocation : handleInitialLocation}
                  disabled={isLoading}
                  aria-busy={isLoading}
                  aria-label={t('weather.useMyLocation')}
                  title={t('weather.useMyLocation')}
                >
                  <LocationIcon />
                </button>
                <button
                  type="button"
                  className="atlas-icon-button"
                  onClick={handleToggleFavorite}
                  disabled={!weather}
                  aria-pressed={isFavorite}
                  aria-label={
                    isFavorite ? t('weather.removeFromFavorites') : t('weather.addToFavorites')
                  }
                  title={
                    isFavorite ? t('weather.removeFromFavorites') : t('weather.addToFavorites')
                  }
                >
                  <StarIcon filled={isFavorite} />
                </button>
                {weather && (
                  <button
                    type="button"
                    className="atlas-plan-button"
                    onClick={() => handleBottomNav('plan')}
                    aria-current={isPlanView ? 'page' : undefined}
                  >
                    {t('navigation.plan')}
                  </button>
                )}
                {favorites.length >= 2 && (
                  <button
                    type="button"
                    className="atlas-compare-button"
                    onClick={() => handleBottomNav('compare')}
                    aria-current={activeNav === 'compare' ? 'page' : undefined}
                  >
                    {t('hava81.compare.action')}
                    <span aria-hidden="true">{favorites.length}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="atlas-icon-button atlas-icon-button--map"
                  onClick={showMap ? closeMap : openMap}
                  disabled={!weather}
                  aria-expanded={showMap}
                  aria-controls="weather-map-region"
                  aria-label={showMap ? t('weather.hideMap') : t('weather.showMap')}
                  title={showMap ? t('weather.hideMap') : t('weather.showMap')}
                >
                  <MapIcon />
                </button>
                <button
                  type="button"
                  className="atlas-icon-button atlas-settings-button"
                  onClick={openSettings}
                  aria-haspopup="dialog"
                  aria-expanded={isSettingsOpen}
                  aria-controls="settings-panel-dialog"
                  aria-label={t('common.settings')}
                >
                  <span className="atlas-settings-button__language" aria-hidden="true">
                    {settings.language.toUpperCase()}
                  </span>
                  <SettingsIcon />
                </button>
              </div>
            </div>

            {favorites.length > 0 && (
              <div className="atlas-city-rail" ref={cityRailRef}>
                <CityTabs
                  cities={favorites}
                  activeCity={weather?.cityName ?? ''}
                  onSelect={handleSelectFavorite}
                  onRemove={handleRemoveFavorite}
                  onAdd={handleAddFavorite}
                  canAdd={Boolean(weather && !isFavorite)}
                />
              </div>
            )}
          </header>

          {weather || favorites.length > 0 ? (
            <AtlasBottomNav
              active={currentView}
              onSelect={handleBottomNav}
              hasSaved={favorites.length > 0}
              canMap={Boolean(weather)}
            />
          ) : null}

          <main
            className="atlas-main"
            id="main-content"
            tabIndex={-1}
            aria-busy={isLoading}
            ref={overviewRef}
          >
            {activeNav === 'compare' ? (
              <Suspense fallback={<p role="status">{t('common.loading')}</p>}>
                <ComparePanel
                  cities={favorites}
                  language={settings.language}
                  onExplore={() => handleBottomNav('today')}
                />
              </Suspense>
            ) : null}
            {activeNav !== 'compare' && error && !searchNotFound && (
              <section className="atlas-message atlas-message--error" role="alert">
                <div>
                  <span className="atlas-kicker">{t('common.error')}</span>
                  <p>{error.message}</p>
                  {lastKnownAt && (
                    <p className="atlas-message__last-known">
                      {t('errors.showingLastKnown', {
                        time: formatCityTime(
                          lastKnownAt,
                          weather?.meta.timezoneOffsetSeconds ?? 10800,
                          settings.language
                        ),
                      })}
                    </p>
                  )}
                </div>
                <div className="atlas-message__actions">
                  {canRetryCurrentWeather && (
                    <button type="button" className="atlas-button" onClick={retryCurrentWeather}>
                      {t('common.retry')}
                    </button>
                  )}
                  <button type="button" className="atlas-text-button" onClick={clearError}>
                    {t('common.close')}
                  </button>
                </div>
              </section>
            )}

            {activeNav !== 'compare' && isLoading && !weather && (
              <AtlasLoadingState
                label={t('hava81.loadingWeather')}
                slowMessage={isSlowLoading ? t('hava81.slowLoading') : undefined}
              />
            )}

            {activeNav !== 'compare' && weather && (
              <div
                key={weather.cityName}
                className={`atlas-dashboard${isPlanView ? ' atlas-dashboard--plan' : ''}`}
              >
                {!isPlanView && (
                  <>
                    <div className="atlas-dashboard__primary">
                      <WeatherDecisionField
                        weather={weather}
                        hourly={forecast.hourly}
                        daily={forecast.daily}
                        airQuality={freshAirQuality}
                        uvIndexMax={freshUvIndexMax}
                        forecastMeta={forecast.displayMeta ?? forecast.meta}
                      />
                      <DecisionGlance
                        weather={weather}
                        hourly={forecast.hourly}
                        airQuality={freshAirQuality}
                        forecastMeta={forecast.displayMeta ?? forecast.meta}
                        onOpenDetails={openScoreDetails}
                      />

                      {!forecast.displayMeta && !forecast.error ? (
                        <ForecastLoadingCard
                          title={t('hava81.forecastAtlas.title')}
                          label={t('common.loading')}
                        />
                      ) : forecast.displayMeta &&
                        (forecast.daily.length > 0 || forecast.displayHourly.length > 0) ? (
                        <Suspense
                          fallback={
                            <ForecastLoadingCard
                              title={t('hava81.forecastAtlas.title')}
                              label={t('common.loading')}
                            />
                          }
                        >
                          <ForecastAtlas
                            daily={forecast.daily}
                            hourly={forecast.displayHourly}
                            meta={forecast.displayMeta}
                            current={{
                              temperature: weather.temperature,
                              icon: weather.icon,
                              description: weather.description,
                            }}
                          />
                        </Suspense>
                      ) : forecast.error ? (
                        <section
                          className="atlas-forecast-error-card"
                          aria-labelledby="forecast-error-title"
                        >
                          <h2 id="forecast-error-title" className="atlas-forecast-loading__title">
                            {t('hava81.forecastAtlas.title')}
                          </h2>
                          <div className="atlas-message atlas-message--inline" role="status">
                            <p>{t('errors.forecastUnavailable')}</p>
                            {canRetryForecast && (
                              <button
                                type="button"
                                className="atlas-text-button"
                                onClick={retryForecast}
                              >
                                {t('common.retry')}
                              </button>
                            )}
                          </div>
                        </section>
                      ) : null}
                    </div>

                    {forecast.error && forecast.displayMeta && (
                      <section className="atlas-message atlas-message--inline" role="status">
                        <p>{t('errors.forecastUnavailable')}</p>
                        {canRetryForecast && (
                          <button
                            type="button"
                            className="atlas-text-button"
                            onClick={retryForecast}
                          >
                            {t('common.retry')}
                          </button>
                        )}
                      </section>
                    )}

                    <Suspense fallback={null}>
                      <EnvironmentRail
                        weather={weather}
                        airQuality={freshAirQuality}
                        onOpenMap={showMap ? closeMap : openMap}
                        mapExpanded={showMap}
                      />
                    </Suspense>

                    {showMap && (
                      <section
                        className="atlas-map-panel"
                        id="weather-map-region"
                        ref={mapRegionRef}
                        tabIndex={-1}
                        aria-labelledby="weather-map-heading"
                      >
                        <div className="atlas-map-panel__header">
                          <div>
                            <span className="atlas-kicker">{t('hava81.mapEyebrow')}</span>
                            <h2 id="weather-map-heading">{t('common.map')}</h2>
                          </div>
                          <button type="button" className="atlas-text-button" onClick={closeMap}>
                            {t('common.close')}
                          </button>
                        </div>
                        <Suspense
                          fallback={
                            <div className="atlas-map-loading" role="status">
                              {t('common.loading')}
                            </div>
                          }
                        >
                          <WeatherMap weather={weather} onCitySelect={handleMapCitySelect} />
                        </Suspense>
                      </section>
                    )}

                    <section className="atlas-plan-entry" aria-labelledby="atlas-plan-entry-title">
                      <div>
                        <span className="atlas-kicker">{t('hava81.planView.entryEyebrow')}</span>
                        <h2 id="atlas-plan-entry-title">{t('hava81.planView.title')}</h2>
                        <p>{t('hava81.planView.entryBody')}</p>
                      </div>
                      <button
                        type="button"
                        className="atlas-button atlas-button--primary"
                        onClick={() => handleBottomNav('plan')}
                      >
                        {t('hava81.planView.open')} <span aria-hidden="true">→</span>
                      </button>
                    </section>
                  </>
                )}

                {/* Planla stays mounted (hidden) on Today so alert notifications, activity
                    choices and the route form keep working and keep their state. */}
                <section
                  className="atlas-plan-view"
                  id="atlas-plan-view"
                  aria-labelledby="atlas-plan-view-title"
                  hidden={!isPlanView}
                >
                  <header className="atlas-plan-view__header">
                    <div>
                      <span className="atlas-kicker">{t('hava81.planView.eyebrow')}</span>
                      <h1 id="atlas-plan-view-title">
                        {t('hava81.planView.titleWithCity', { city: weather.cityName })}
                      </h1>
                      <p>{t('hava81.planView.intro')}</p>
                    </div>
                    <button
                      type="button"
                      className="atlas-text-button atlas-plan-view__back"
                      onClick={() => handleBottomNav('today')}
                    >
                      <span aria-hidden="true">←</span> {t('hava81.planView.back')}
                    </button>
                  </header>
                  {isPlanView && forecast.hourly.length === 0 && !forecast.error && (
                    <ForecastLoadingCard
                      title={t('hava81.planView.title')}
                      label={t('common.loading')}
                    />
                  )}
                  {isPlanView && forecast.hourly.length === 0 && forecast.error && (
                    <div className="atlas-message atlas-message--inline" role="status">
                      <p>{t('errors.forecastUnavailable')}</p>
                      {canRetryForecast && (
                        <button type="button" className="atlas-text-button" onClick={retryForecast}>
                          {t('common.retry')}
                        </button>
                      )}
                    </div>
                  )}
                  {forecast.hourly.length > 0 && (
                    <Suspense fallback={null}>
                      <DailyPlanPanel
                        weather={weather}
                        hourly={forecast.hourly}
                        airQuality={freshAirQuality}
                        forecastMeta={forecast.displayMeta ?? forecast.meta}
                      />
                    </Suspense>
                  )}

                  {forecast.hourly.length > 0 && (
                    <Suspense fallback={null}>
                      <CommutePlanPanel
                        weather={weather}
                        hourly={forecast.hourly}
                        forecastMeta={forecast.displayMeta ?? forecast.meta}
                      />
                    </Suspense>
                  )}

                  {forecast.hourly.length > 0 && (
                    <Suspense fallback={null}>
                      <ActivityPlanner
                        weather={weather}
                        hourly={forecast.hourly}
                        airQuality={freshAirQuality}
                        forecastMeta={forecast.displayMeta ?? forecast.meta}
                      />
                    </Suspense>
                  )}

                  {forecast.contextSignals && (
                    <Suspense fallback={null}>
                      <ContextSignalsPanel
                        signals={forecast.contextSignals}
                        timezoneOffsetSeconds={weather.meta.timezoneOffsetSeconds}
                      />
                    </Suspense>
                  )}

                  {forecast.hourly.length > 0 && (
                    <Suspense fallback={null}>
                      <DecisionAlertsPanel
                        weather={weather}
                        hourly={forecast.hourly}
                        airQuality={freshAirQuality}
                        forecastMeta={forecast.displayMeta ?? forecast.meta}
                      />
                    </Suspense>
                  )}

                  <Suspense fallback={null}>
                    <RouteWeatherPanel currentCityName={weather.cityName} />
                  </Suspense>
                </section>
              </div>
            )}

            {activeNav !== 'compare' && !weather && !isLoading && !error && (
              <section className={`atlas-empty${isRootRoute ? ' atlas-empty--location' : ''}`}>
                {!isRootRoute ? (
                  <>
                    <span className="atlas-kicker">{t('hava81.emptyEyebrow')}</span>
                    <h1>{t('weather.searchLabel')}</h1>
                    <p>{t('weather.searchPlaceholder')}</p>
                    <button
                      type="button"
                      className="atlas-button atlas-button--primary"
                      onClick={openSearch}
                    >
                      {t('common.search')}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="atlas-kicker">{t('hava81.locationGate.eyebrow')}</span>
                    <h1>{t('hava81.locationGate.title')}</h1>
                    <p>{t('hava81.locationGate.body')}</p>
                    <div className="atlas-empty__actions">
                      <button
                        type="button"
                        className="atlas-button atlas-button--primary"
                        aria-describedby="location-gate-privacy"
                        onClick={() => void handleInitialLocation()}
                      >
                        {t('weather.useMyLocation')}
                      </button>
                      <button
                        type="button"
                        className="atlas-button"
                        onClick={handleInitialIstanbul}
                      >
                        {t('hava81.locationGate.fallback')}
                      </button>
                      <button type="button" className="atlas-button" onClick={openSearch}>
                        {t('hava81.locationGate.searchAnother')}
                      </button>
                    </div>
                    <small id="location-gate-privacy" className="atlas-empty__note">
                      {t('hava81.locationGate.privacy')}
                    </small>
                  </>
                )}
              </section>
            )}
          </main>

          <footer className="atlas-footer">
            <span>Hava81 · {t('hava81.tagline')}</span>
            <span className="atlas-footer__shortcuts">
              <kbd>{searchShortcutLabel}</kbd> {t('common.keyboardSearch')}{' '}
              <kbd>{settingsShortcutLabel}</kbd> {t('common.keyboardSettings')}
            </span>
          </footer>

          {isSettingsOpen ? (
            <Suspense
              fallback={
                <div className="atlas-settings-loading" role="status" aria-live="polite">
                  {t('common.loading')}
                </div>
              }
            >
              <SettingsPanel isOpen={isSettingsOpen} onClose={closeSettings} />
            </Suspense>
          ) : null}
        </div>
      </ErrorBoundary>
    </>
  );
};

export default App;
