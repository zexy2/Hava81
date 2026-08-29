/**
 * useWeather Hook - Enhanced Version
 * Comprehensive weather data fetching with caching and error handling
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { weatherService } from '../api/weatherService';
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
const cityIdentity = (name: string): string => citySlug(name) || name.trim().toLowerCase();

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
      !Number.isFinite(candidate.timestamp)
    ) {
      continue;
    }

    const city = candidate.city.trim();
    const identity = cityIdentity(city);
    if (seen.has(identity)) continue;
    seen.add(identity);
    sanitized.push({ city, timestamp: candidate.timestamp });
  }

  return sanitized;
};

interface WeatherCache {
  data: NormalizedWeatherData;
  timestamp: number;
  language?: 'tr' | 'en';
}

const deserializeWeatherCache = (value: string): WeatherCache | null => {
  const parsed = JSON.parse(value) as WeatherCache | null;
  if (!parsed) return null;

  const sunrise = new Date(parsed.data.sunrise);
  const sunset = new Date(parsed.data.sunset);
  const timestamp = new Date(parsed.data.timestamp);

  if ([sunrise, sunset, timestamp].some(date => Number.isNaN(date.getTime()))) {
    throw new Error('Cached weather dates are invalid');
  }

  return {
    ...parsed,
    data: {
      ...parsed.data,
      sunrise,
      sunset,
      timestamp,
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
          const filtered = prev.filter(s => cityIdentity(s.city) !== dataIdentity);
          return [{ city: data.cityName, timestamp: now.getTime() }, ...filtered].slice(
            0,
            maxRecentSearches
          );
        });
      },
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
        setCity(data.cityName);
        setLastUpdated(new Date());
        if (enableCache) {
          setCachedWeather({ data, timestamp: Date.now(), language });
        }
      },
    }
  );

  // Fetch weather function
  const fetchWeather = useCallback(
    async (cityName?: string): Promise<NormalizedWeatherData | null> => {
      const targetCity = cityName ?? city;
      if (!targetCity.trim()) return null;

      return weatherAsync.execute(targetCity.trim());
    },
    [city, weatherAsync]
  );

  // Fetch current location weather
  const fetchCurrentLocation = useCallback(async () => {
    // Clear previous weather data so location data takes precedence
    weatherAsync.reset();
    return locationAsync.execute();
  }, [locationAsync, weatherAsync]);

  // Clear error
  const clearError = useCallback(() => {
    weatherAsync.reset();
    locationAsync.reset();
  }, [weatherAsync, locationAsync]);

  // Check if data is stale
  const isStale = lastUpdated ? Date.now() - lastUpdated.getTime() > STALE_TIME : true;

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
      fetchWeather(activeCity);
    }
    // Only language changes should trigger this refresh; async state objects
    // intentionally stay out of the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Combine error from both async operations while keeping raw provider/exception details out of the UI.
  const rawError = weatherAsync.error || locationAsync.error;
  const error = rawError
    ? {
        ...rawError,
        message:
          rawError.code === ErrorCode.NETWORK_ERROR
            ? language === 'en'
              ? 'Connection error. Check your internet connection.'
              : 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.'
            : rawError.code === ErrorCode.NOT_FOUND
              ? language === 'en'
                ? 'City not found'
                : 'Şehir bulunamadı'
              : language === 'en'
                ? 'Something went wrong'
                : 'Bir şeyler ters gitti',
      }
    : null;
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
