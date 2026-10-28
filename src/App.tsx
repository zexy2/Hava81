import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from './components/ErrorBoundary';
import { suggestCity } from './utils/citySuggestion';
import { formatCityTime } from './utils/format';
import { getCityMetadata } from './constants/cityMetadata';
import { WeatherDecisionField } from './components/hava81/WeatherDecisionField';
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
import { AppHeader } from './components/app/AppHeader';
import { getCurrentWeatherFreshness } from './utils/currentWeatherFreshness';
import { NotFoundState } from './components/app/NotFoundState';
import { DeferredForecastAtlas } from './components/app/DeferredForecastAtlas';
import { isHomePathname, isUnknownPathname } from './utils/cityRoute';
import { AtlasLoadingState, ForecastLoadingCard } from './components/app/AppSkeletons';
import { scrollIntoViewRespectingMotion } from './utils/motion';
import { parseAtlasView, resolveAtlasView, type AtlasView } from './utils/atlasView';
import { getOptionalEvidenceFreshness } from './utils/optionalEvidenceFreshness';
import { trackProductEvent } from './analytics/productEvents';
import { resolveSkyScene } from './components/sky/skyScene';
import './styles/App.css';
import './styles/editorial.css';
// Glass and hero styles load with the page, not with the lazy sky chunks: a late
// stylesheet re-lays out the weather field after first paint (a layout shift).
import './components/sky/LivingSky.css';
import './components/sky/HeroSky.css';

const WeatherMap = lazy(() => import('./components/WeatherMap'));
const DecisionGlance = lazy(() => import('./components/hava81/DecisionGlance'));
const SevereWeatherBanner = lazy(() => import('./components/hava81/SevereWeatherBanner'));
const DailyPlanPanel = lazy(() => import('./components/hava81/DailyPlanPanel'));
const CommutePlanPanel = lazy(() => import('./components/hava81/CommutePlanPanel'));
const EnvironmentRail = lazy(() => import('./components/hava81/EnvironmentRail'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const ComparePanel = lazy(() => import('./components/hava81/ComparePanel'));
const ActivityPlanner = lazy(() => import('./components/hava81/ActivityPlanner'));
const DayOutlookPanel = lazy(() => import('./components/hava81/DayOutlookPanel'));
const ContextSignalsPanel = lazy(() => import('./components/hava81/ContextSignalsPanel'));
const DeferredDecisionAlertsPanel = lazy(
  () => import('./components/app/DeferredDecisionAlertsPanel')
);
const RouteWeatherPanel = lazy(() => import('./components/hava81/RouteWeatherPanel'));
const LivingSky = lazy(() => import('./components/sky/LivingSky'));

type AtlasNavItem = AtlasView;

const App: React.FC = () => {
  const { t } = useTranslation();
  const { settings, convertTemperature } = useSettings();
  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );
  // Cached weather may remain useful offline, but the connection state must be explicit.
  useEffect(() => {
    const syncOnlineState = () => {
      setIsOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    };
    window.addEventListener('online', syncOnlineState);
    window.addEventListener('offline', syncOnlineState);
    return () => {
      window.removeEventListener('online', syncOnlineState);
      window.removeEventListener('offline', syncOnlineState);
    };
  }, []);
  // Faz 2.5 + 2.3: `?view=map`, `?view=compare` and `?view=plan` open those views directly.
  const [initialView] = useState(() => parseAtlasView(window.location.search));
  const [showMap, setShowMap] = useState(initialView === 'map');
  const [activeNav, setActiveNav] = useState<AtlasNavItem>(initialView);
  const currentView = resolveAtlasView(activeNav, showMap);
  const isPlanView = currentView === 'plan';
  // Plan-only UI chunks stay off the first-viewport critical path until the user
  // opens Planla. Once opened, keep them mounted while hidden so choices and
  // route form state survive switching back to Today.
  const [hasOpenedPlan, setHasOpenedPlan] = useState(initialView === 'plan');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const cityRailRef = useRef<HTMLDivElement>(null);
  const mapRegionRef = useRef<HTMLElement>(null);
  const mapReturnFocusRef = useRef<HTMLElement | null>(null);
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [initialCity] = useState(() => resolveInitialCity(window.location));
  const isRootRoute = isHomePathname(window.location.pathname);
  const isUnknownRoute = isUnknownPathname(window.location.pathname);

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

  // Keep the initial shell lighter, but warm the below-hero decision summary
  // while current weather is being fetched so the split chunk rarely adds a
  // second network wait after the forecast arrives.
  useEffect(() => {
    if (isPlanView || activeNav === 'compare') return undefined;

    const timeoutId = window.setTimeout(() => {
      void import('./components/hava81/DecisionGlance').catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeNav, isPlanView]);

  const colorMode = useResolvedColorMode(settings.themeMode);
  // The living sky follows the clock too (dawn → day → dusk → night) without a refetch.
  const [skyClock, setSkyClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setSkyClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const skyScene = useMemo(
    () => (weather ? resolveSkyScene(weather, forecast.hourly, skyClock) : null),
    [weather, forecast.hourly, skyClock]
  );

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
        setHasOpenedPlan(true);
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
    setHasOpenedPlan(true);
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
  const freshAirQualityHourly =
    forecast.airQualityHourly && getOptionalEvidenceFreshness(forecast.airQualityHourly.meta).fresh
      ? forecast.airQualityHourly
      : undefined;

  return (
    <>
      <ErrorBoundary
        fallback={(_caughtError, reset, focusRef) => (
          <div className="app-fatal" role="alert">
            <span className="atlas-kicker">{t('hava81.systemStatus')}</span>
            <h1>{t('common.error')}</h1>
            <p>{t('errors.genericError')}</p>
            <button
              ref={focusRef}
              type="button"
              onClick={reset}
              className="atlas-button atlas-button--primary"
            >
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
          data-living-sky={skyScene ? 'true' : undefined}
        >
          {skyScene ? (
            <Suspense fallback={null}>
              <LivingSky scene={skyScene} />
            </Suspense>
          ) : null}
          <a
            className="skip-link"
            href="#main-content"
            onClick={() => overviewRef.current?.focus({ preventScroll: true })}
          >
            {t('common.skipToContent')}
          </a>

          <AppHeader
            isMobileSearchOpen={isMobileSearchOpen}
            searchInputRef={searchInputRef}
            searchToggleRef={searchToggleRef}
            cityRailRef={cityRailRef}
            query={city}
            onQueryChange={setCity}
            onSubmit={handleSubmit}
            onCloseSearch={closeSearch}
            onToggleMobileSearch={toggleMobileSearch}
            isLoading={isLoading}
            recentSearches={recentSearches}
            searchNotFound={searchNotFound}
            failedQuery={failedQuery}
            searchSuggestion={searchSuggestion}
            onLocate={!isRootRoute || weather ? fetchCurrentLocation : handleInitialLocation}
            hasWeather={Boolean(weather)}
            activeCity={weather?.cityName ?? ''}
            isFavorite={isFavorite}
            onToggleFavorite={handleToggleFavorite}
            isPlanView={isPlanView}
            onOpenPlan={() => handleBottomNav('plan')}
            favorites={favorites}
            isCompareActive={activeNav === 'compare'}
            onOpenCompare={() => handleBottomNav('compare')}
            showMap={showMap}
            onToggleMap={showMap ? closeMap : openMap}
            isSettingsOpen={isSettingsOpen}
            onOpenSettings={openSettings}
            language={settings.language}
            onSelectFavorite={handleSelectFavorite}
            onRemoveFavorite={handleRemoveFavorite}
            onAddFavorite={handleAddFavorite}
            activeView={currentView}
            onNavigate={handleBottomNav}
            searchShortcutLabel={searchShortcutLabel}
            context={
              weather
                ? {
                    cityName: weather.cityName,
                    temperatureLabel: getCurrentWeatherFreshness(weather.meta).fresh
                      ? new Intl.NumberFormat(
                          settings.language === 'en' ? 'en-US' : 'tr-TR'
                        ).format(Math.round(convertTemperature(weather.temperature)))
                      : null,
                  }
                : null
            }
          />

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
            {isOffline && weather && error?.message !== t('errors.offline') ? (
              <section
                className="atlas-message atlas-message--offline"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <p>{t('errors.offlineCached')}</p>
              </section>
            ) : null}
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
                      <div className="atlas-dashboard__field-rail">
                        <WeatherDecisionField
                          weather={weather}
                          hourly={forecast.hourly}
                          daily={forecast.daily}
                          airQuality={freshAirQuality}
                          airQualityHourly={freshAirQualityHourly}
                          uvIndexMax={freshUvIndexMax}
                          forecastMeta={forecast.displayMeta ?? forecast.meta}
                        />
                      </div>
                      <Suspense fallback={null}>
                        <SevereWeatherBanner
                          daily={forecast.daily}
                          timezoneOffsetSeconds={weather.meta.timezoneOffsetSeconds}
                        />
                        <DecisionGlance
                          weather={weather}
                          hourly={forecast.hourly}
                          airQuality={freshAirQuality}
                          airQualityHourly={freshAirQualityHourly}
                          forecastMeta={forecast.displayMeta ?? forecast.meta}
                          onOpenDetails={openScoreDetails}
                        />
                      </Suspense>

                      {!forecast.displayMeta && !forecast.error ? (
                        <ForecastLoadingCard
                          title={t('hava81.forecastAtlas.title')}
                          label={t('common.loading')}
                        />
                      ) : forecast.displayMeta &&
                        (forecast.daily.length > 0 || forecast.displayHourly.length > 0) ? (
                        <DeferredForecastAtlas
                          daily={forecast.daily}
                          hourly={forecast.displayHourly}
                          meta={forecast.displayMeta}
                          current={{
                            temperature: weather.temperature,
                            icon: weather.icon,
                            description: weather.description,
                          }}
                        />
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
                            <h1 id="weather-map-heading">{t('common.map')}</h1>
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
                  </>
                )}

                {/* Keep alert delivery active on Today. The larger Planla panels mount on
                    first visit, then stay mounted while hidden so their state survives. */}
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
                        {t('hava81.planView.titleWithCity', {
                          city: getCityMetadata(weather.cityName)?.name ?? weather.cityName,
                        })}
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
                  {/* One loading boundary for every Planla section: they arrive together in a
                      reserved slot instead of pushing each other down one by one. */}
                  <Suspense fallback={null}>
                    {hasOpenedPlan && forecast.hourly.length > 0 && (
                      <DailyPlanPanel
                        weather={weather}
                        hourly={forecast.hourly}
                        airQuality={freshAirQuality}
                        airQualityHourly={freshAirQualityHourly}
                        forecastMeta={forecast.displayMeta ?? forecast.meta}
                      />
                    )}

                    {/* Main tools on the wide column; short reference panels on a narrow
                        column that stays in view instead of stretching to its neighbour. */}
                    <div className="atlas-plan-view__columns">
                      <div className="atlas-plan-view__main">
                        {hasOpenedPlan && forecast.hourly.length > 0 && (
                          <ActivityPlanner
                            weather={weather}
                            hourly={forecast.hourly}
                            airQuality={freshAirQuality}
                            airQualityHourly={freshAirQualityHourly}
                            forecastMeta={forecast.displayMeta ?? forecast.meta}
                            contextSignals={forecast.contextSignals}
                          />
                        )}

                        {hasOpenedPlan && forecast.hourly.length > 0 && (
                          <CommutePlanPanel
                            weather={weather}
                            hourly={forecast.hourly}
                            forecastMeta={forecast.displayMeta ?? forecast.meta}
                          />
                        )}
                      </div>
                      <aside
                        className="atlas-plan-view__aside"
                        aria-label={t('hava81.planView.asideLabel')}
                      >
                        {hasOpenedPlan && forecast.hourly.length > 0 && (
                          <DayOutlookPanel
                            weather={weather}
                            hourly={forecast.hourly}
                            airQuality={freshAirQuality}
                            airQualityHourly={freshAirQualityHourly}
                            contextSignals={forecast.contextSignals}
                            forecastMeta={forecast.displayMeta ?? forecast.meta}
                          />
                        )}

                        {hasOpenedPlan && forecast.contextSignals && (
                          <ContextSignalsPanel
                            signals={forecast.contextSignals}
                            timezoneOffsetSeconds={weather.meta.timezoneOffsetSeconds}
                          />
                        )}

                        {forecast.hourly.length > 0 && (
                          <DeferredDecisionAlertsPanel
                            weather={weather}
                            hourly={forecast.hourly}
                            airQuality={freshAirQuality}
                            airQualityHourly={freshAirQualityHourly}
                            forecastMeta={forecast.displayMeta ?? forecast.meta}
                          />
                        )}
                      </aside>
                    </div>

                    {hasOpenedPlan && <RouteWeatherPanel currentCityName={weather.cityName} />}
                  </Suspense>
                </section>
              </div>
            )}

            {activeNav !== 'compare' && !weather && !isLoading && !error && isUnknownRoute && (
              <NotFoundState
                pathname={window.location.pathname}
                language={settings.language}
                onSearch={openSearch}
              />
            )}

            {activeNav !== 'compare' && !weather && !isLoading && !error && !isUnknownRoute && (
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

          <footer className="atlas-footer" data-testid="app-footer">
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
