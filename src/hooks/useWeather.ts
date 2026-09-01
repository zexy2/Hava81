/**
 * useWeather Hook - Enhanced Version
 * Comprehensive weather data fetching with caching and error handling
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { weatherService } from '../api/weatherService';
import i18n from '../i18n';
import { TURKISH_CITIES } from '../constants/cities';
import { citySlug } from '../utils/cityRoute';
import { useAsync } from './useAsync';
import { useLocalStorage } from './useLocalStorage';
import { ErrorCode, type NormalizedWeatherData, type AppError } from '../types';

interface RecentSearch {
  city: string;
  timestamp: number;
}

interface UseWeatherOptions {
  initialCity?: string;
  enableCache?: boolean;
  cacheKey?: string;
  maxRecentSearches?: number;
  language?: 'tr' | 'en';
}

interface UseWeatherReturn {
  // State
  city: string;
  weather: NormalizedWeatherData | null;
  error: AppError | null;
  isLoading: boolean;

  // Actions
  setCity: (city: string) => void;
  fetchWeather: (city?: string) => Promise<NormalizedWeatherData | null>;
  fetchCurrentLocation: () => Promise<NormalizedWeatherData | null>;
  clearError: () => void;

  // Cache/History
  recentSearches: RecentSearch[];
  clearRecentSearches: () => void;

  // Metadata
  lastUpdated: Date | null;
  isStale: boolean;
}

const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const MAX_RECENT_SEARCHES = 5;
const MAX_CACHE_FUTURE_SKEW_MS = 60_000;
const isWeatherResultStale = (lastUpdated: Date | null, now = Date.now()): boolean => {
  if (!lastUpdated) return true;
  const age = now - lastUpdated.getTime();
  return age < -MAX_CACHE_FUTURE_SKEW_MS || age > STALE_TIME;
};
const cityIdentity = (name: string): string => citySlug(name) || name.trim().toLowerCase();
const canonicalCityByIdentity = new Map(
  TURKISH_CITIES.map(city => [cityIdentity(city.name), city.name] as const)
);

const deserializeRecentSearches = (value: string): RecentSearch[] => {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const sanitized: RecentSearch[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const candidate = entry as Partial<Record<keyof RecentSearch, unknown>>;
    if (
      typeof candidate.city !== 'string' ||
      !candidate.city.trim() ||
      typeof candidate.timestamp !== 'number' ||
      !Number.isFinite(candidate.timestamp) ||
      candidate.timestamp < 0 ||
      candidate.timestamp > Date.now() + MAX_CACHE_FUTURE_SKEW_MS
    ) {
      continue;
    }

    const city = candidate.city.trim();
    const identity = cityIdentity(city);
    const canonicalCity = canonicalCityByIdentity.get(identity);
    if (!canonicalCity || seen.has(identity)) continue;
    seen.add(identity);
    sanitized.push({ city: canonicalCity, timestamp: candidate.timestamp });
  }

  return sanitized;
};

interface WeatherCache {
  data: NormalizedWeatherData;
  timestamp: number;
  language?: 'tr' | 'en';
}

const WEATHER_ICON_CODES = new Set([
  '01d',
  '01n',
  '02d',
  '02n',
  '03d',
  '03n',
  '04d',
  '04n',
  '09d',
  '09n',
  '10d',
  '10n',
  '11d',
  '11n',
  '13d',
  '13n',
  '50d',
  '50n',
]);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isPercentage = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0 && value <= 100;
const isPlausibleCelsius = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= -100 && value <= 100;
const isNonNegativeNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0;
const validCacheStatuses = new Set(['HIT', 'MISS', 'COALESCED']);

const deserializeWeatherCache = (value: string): WeatherCache | null => {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const candidate = parsed as {
    data?: Record<string, unknown>;
    timestamp?: unknown;
    language?: unknown;
  };
  const data = candidate.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const coordinates = data.coordinates;
  const meta = data.meta;
  const metaRecord =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : null;
  const timezoneOffsetSeconds = metaRecord?.timezoneOffsetSeconds;
  const intervalHours = metaRecord?.intervalHours;
  const freshForSeconds = metaRecord?.freshForSeconds;
  const cacheStatus = metaRecord?.cacheStatus;
  if (
    typeof data.cityName !== 'string' ||
    !data.cityName.trim() ||
    typeof data.country !== 'string' ||
    !data.country.trim() ||
    !isPlausibleCelsius(data.temperature) ||
    !isPlausibleCelsius(data.feelsLike) ||
    !isPlausibleCelsius(data.tempMin) ||
    !isPlausibleCelsius(data.tempMax) ||
    data.tempMin > data.tempMax ||
    !isPercentage(data.humidity) ||
    !isFiniteNumber(data.pressure) ||
    data.pressure <= 0 ||
    (data.visibility !== undefined && !isNonNegativeNumber(data.visibility)) ||
    !isNonNegativeNumber(data.windSpeed) ||
    !isFiniteNumber(data.windDirection) ||
    data.windDirection < 0 ||
    data.windDirection > 360 ||
    typeof data.description !== 'string' ||
    !WEATHER_ICON_CODES.has(String(data.icon)) ||
    !isPercentage(data.clouds) ||
    !coordinates ||
    typeof coordinates !== 'object' ||
    Array.isArray(coordinates) ||
    !isFiniteNumber((coordinates as Record<string, unknown>).lat) ||
    (coordinates as Record<string, number>).lat < -90 ||
    (coordinates as Record<string, number>).lat > 90 ||
    !isFiniteNumber((coordinates as Record<string, unknown>).lon) ||
    (coordinates as Record<string, number>).lon < -180 ||
    (coordinates as Record<string, number>).lon > 180 ||
    !metaRecord ||
    typeof metaRecord.provider !== 'string' ||
    !metaRecord.provider.trim() ||
    typeof metaRecord.fetchedAt !== 'string' ||
    (timezoneOffsetSeconds !== undefined &&
      (!isFiniteNumber(timezoneOffsetSeconds) ||
        timezoneOffsetSeconds < -43_200 ||
        timezoneOffsetSeconds > 50_400)) ||
    (intervalHours !== undefined &&
      (!isFiniteNumber(intervalHours) || intervalHours <= 0 || intervalHours > 24)) ||
    (freshForSeconds !== undefined &&
      (!isFiniteNumber(freshForSeconds) || freshForSeconds <= 0 || freshForSeconds > 86_400)) ||
    (cacheStatus !== undefined &&
      (typeof cacheStatus !== 'string' || !validCacheStatuses.has(cacheStatus))) ||
    !isFiniteNumber(candidate.timestamp) ||
    candidate.timestamp > Date.now() + MAX_CACHE_FUTURE_SKEW_MS ||
    (candidate.language !== undefined && candidate.language !== 'tr' && candidate.language !== 'en')
  ) {
    return null;
  }

  const sunrise = new Date(String(data.sunrise));
  const sunset = new Date(String(data.sunset));
  const timestamp = new Date(String(data.timestamp));
  const fetchedAt = new Date(String(metaRecord.fetchedAt));
  if ([sunrise, sunset, timestamp, fetchedAt].some(date => Number.isNaN(date.getTime())))
    return null;
  if (sunset.getTime() < sunrise.getTime()) return null;
  const latestPlausibleCurrentTimestamp = Date.now() + MAX_CACHE_FUTURE_SKEW_MS;
  if (
    timestamp.getTime() > latestPlausibleCurrentTimestamp ||
    fetchedAt.getTime() > latestPlausibleCurrentTimestamp
  )
    return null;

  return {
    timestamp: candidate.timestamp,
    language: candidate.language as WeatherCache['language'],
    data: {
      ...(data as unknown as NormalizedWeatherData),
      cityName: data.cityName.trim(),
      country: data.country.trim(),
      sunrise,
      sunset,
      timestamp,
      meta: {
        ...(metaRecord as unknown as NormalizedWeatherData['meta']),
        provider: metaRecord.provider.trim(),
        fetchedAt,
      },
    },
  };
};

export function useWeather(options: UseWeatherOptions = {}): UseWeatherReturn {
  const {
    initialCity = '',
    enableCache = true,
    cacheKey = 'weather_cache',
    maxRecentSearches = MAX_RECENT_SEARCHES,
    language = 'tr',
  } = options;

  // City input state
  const [city, setCity] = useState(initialCity);

  // Last successful fetch timestamp
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Recent searches history
  const deserializeStoredRecentSearches = useCallback(
    (value: string) => deserializeRecentSearches(value).slice(0, maxRecentSearches),
    [maxRecentSearches]
  );
  const [recentSearches, setRecentSearches, clearRecentSearches] = useLocalStorage<RecentSearch[]>(
    'recent_weather_searches',
    [],
    { deserializer: deserializeStoredRecentSearches }
  );

  // Cached weather data
  const [cachedWeather, setCachedWeather] = useLocalStorage<WeatherCache | null>(cacheKey, null, {
    deserializer: deserializeWeatherCache,
  });
  const previousLanguageRef = useRef(language);

  // Async weather fetching
  const weatherAsync = useAsync(
    async (cityName: string) => {
      const data = await weatherService.getCurrentWeather({ city: cityName, lang: language });
      return data;
    },
    {
      onSuccess: data => {
        if (!data) return;

        const now = new Date();
        setLastUpdated(now);

        // Update cache
        if (enableCache) {
          setCachedWeather({ data, timestamp: now.getTime(), language });
        }

        // Update recent searches using a stable province identity across localized provider labels.
        setRecentSearches(prev => {
          const dataIdentity = cityIdentity(data.cityName);
          const canonicalCity = canonicalCityByIdentity.get(dataIdentity);
          if (!canonicalCity) return prev;
          const filtered = prev.filter(s => cityIdentity(s.city) !== dataIdentity);
          return [{ city: canonicalCity, timestamp: now.getTime() }, ...filtered].slice(
            0,
            maxRecentSearches
          );
        });
      },
      preserveDataOnReload: true,
    }
  );

  // Location-based weather
  const locationAsync = useAsync(
    async () => {
      const data = await weatherService.getCurrentLocationWeather(language);
      return data;
    },
    {
      onSuccess: data => {
        // Keep the existing city visible while location is pending, then invalidate
        // any older city request only when a real location result is ready to replace it.
        weatherAsync.reset();
        setCity(data.cityName);
        setLastUpdated(new Date());
        if (enableCache) {
          setCachedWeather({ data, timestamp: Date.now(), language });
        }
      },
      preserveDataOnReload: true,
    }
  );

  // Fetch weather function
  const fetchWeather = useCallback(
    async (cityName?: string): Promise<NormalizedWeatherData | null> => {
      const targetCity = cityName ?? city;
      if (!targetCity.trim()) return null;

      // City search is a handoff from location mode. Clear and invalidate any
      // existing/in-flight location result so it cannot remain visible or win a late race.
      locationAsync.reset();
      const normalizedTarget = targetCity.trim();
      if (
        weatherAsync.data &&
        cityIdentity(weatherAsync.data.cityName) !== cityIdentity(normalizedTarget)
      ) {
        weatherAsync.reset();
      }
      return weatherAsync.execute(normalizedTarget);
    },
    [city, locationAsync, weatherAsync]
  );

  // Fetch current location weather
  const fetchCurrentLocation = useCallback(async () => {
    // A location action supersedes any stale city-request failure. Clear only the
    // opposite-mode error so the last successful city data remains visible while
    // geolocation runs and any new location failure can surface authoritatively.
    weatherAsync.clearError();
    // Preserve the last successful city while permission/network work is pending.
    // A successful location handoff clears city state in locationAsync.onSuccess.
    return locationAsync.execute();
  }, [locationAsync, weatherAsync]);

  // Clear error
  const clearError = useCallback(() => {
    weatherAsync.clearError();
    locationAsync.clearError();
  }, [weatherAsync, locationAsync]);

  // Check if data is stale
  const isStale = isWeatherResultStale(lastUpdated);

  // Fetch initial city weather
  useEffect(() => {
    if (initialCity) {
      // Check cache first
      if (enableCache && cachedWeather) {
        const cacheAge = Date.now() - cachedWeather.timestamp;
        if (
          cacheAge < STALE_TIME &&
          cityIdentity(cachedWeather.data.cityName) === cityIdentity(initialCity) &&
          (cachedWeather.language ?? 'tr') === language
        ) {
          weatherAsync.setData(cachedWeather.data);
          setLastUpdated(new Date(cachedWeather.timestamp));
          return;
        }
      }
      fetchWeather(initialCity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Weather descriptions are localized by the provider, so refresh the active
  // city whenever the interface language changes.
  useEffect(() => {
    if (previousLanguageRef.current === language) return;
    previousLanguageRef.current = language;

    const activeCity =
      weatherAsync.data?.cityName ?? locationAsync.data?.cityName ?? city ?? initialCity;
    if (activeCity.trim()) {
      // The current payload contains provider-localized descriptions from the old language.
      // Do not preserve it across a language handoff.
      weatherAsync.reset();
      locationAsync.reset();
      fetchWeather(activeCity);
    }
    // Only language changes should trigger this refresh; async state objects
    // intentionally stay out of the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Long-lived tabs can otherwise keep an old decision surface indefinitely. Refresh only
  // when the app becomes visible again, the last successful result is stale, and no request
  // is already running. Preserve whether the active result came from city search or location.
  useEffect(() => {
    const refreshStaleVisibleWeather = () => {
      if (
        document.visibilityState !== 'visible' ||
        navigator.onLine === false ||
        !isWeatherResultStale(lastUpdated) ||
        weatherAsync.isLoading ||
        locationAsync.isLoading
      ) {
        return;
      }

      if (locationAsync.data) {
        void fetchCurrentLocation();
        return;
      }

      const activeCity = weatherAsync.data?.cityName ?? city ?? initialCity;
      if (activeCity.trim()) void fetchWeather(activeCity);
    };

    document.addEventListener('visibilitychange', refreshStaleVisibleWeather);
    window.addEventListener('online', refreshStaleVisibleWeather);
    return () => {
      document.removeEventListener('visibilitychange', refreshStaleVisibleWeather);
      window.removeEventListener('online', refreshStaleVisibleWeather);
    };
  }, [
    city,
    fetchCurrentLocation,
    fetchWeather,
    initialCity,
    lastUpdated,
    locationAsync.data,
    locationAsync.isLoading,
    weatherAsync.data,
    weatherAsync.isLoading,
  ]);

  // Combine error from both async operations while keeping raw provider/exception details out of the UI.
  const rawError = weatherAsync.error || locationAsync.error;
  const translateError = i18n.getFixedT(language);
  const localizedErrorMessage = rawError
    ? (() => {
        switch (rawError.code) {
          case ErrorCode.NETWORK_ERROR:
            return translateError('errors.networkError');
          case ErrorCode.NOT_FOUND:
            return translateError('weather.cityNotFound');
          case ErrorCode.RATE_LIMIT:
            return translateError('errors.rateLimit');
          case ErrorCode.LOCATION_DENIED:
            return translateError('errors.locationDenied');
          case ErrorCode.LOCATION_UNAVAILABLE:
            return translateError('errors.locationUnavailable');
          case ErrorCode.LOCATION_TIMEOUT:
            return translateError('errors.locationTimeout');
          default:
            return translateError('errors.genericError');
        }
      })()
    : null;
  const error = rawError ? { ...rawError, message: localizedErrorMessage! } : null;
  const isLoading = weatherAsync.isLoading || locationAsync.isLoading;

  return {
    // State
    city,
    weather: weatherAsync.data || locationAsync.data,
    error,
    isLoading,

    // Actions
    setCity,
    fetchWeather,
    fetchCurrentLocation,
    clearError,

    // Cache/History
    recentSearches,
    clearRecentSearches,

    // Metadata
    lastUpdated,
    isStale,
  };
}

export default useWeather;
