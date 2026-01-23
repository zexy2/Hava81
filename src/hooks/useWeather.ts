/**
 * useWeather Hook - Enhanced Version
 * Comprehensive weather data fetching with caching and error handling
 */

import { useState, useCallback, useEffect } from 'react';
import { weatherService } from '../api/weatherService';
import { useAsync } from './useAsync';
import { useLocalStorage } from './useLocalStorage';
import type { NormalizedWeatherData, AppError } from '../types';

interface RecentSearch {
  city: string;
  timestamp: number;
}

interface UseWeatherOptions {
  initialCity?: string;
  enableCache?: boolean;
  cacheKey?: string;
  maxRecentSearches?: number;
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

export function useWeather(options: UseWeatherOptions = {}): UseWeatherReturn {
  const {
    initialCity = '',
    enableCache = true,
    cacheKey = 'weather_cache',
    maxRecentSearches = MAX_RECENT_SEARCHES,
  } = options;

  // City input state
  const [city, setCity] = useState(initialCity);

  // Last successful fetch timestamp
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Recent searches history
  const [recentSearches, setRecentSearches, clearRecentSearches] = useLocalStorage<RecentSearch[]>(
    'recent_weather_searches',
    []
  );

  // Cached weather data
  const [cachedWeather, setCachedWeather] = useLocalStorage<{
    data: NormalizedWeatherData;
    timestamp: number;
  } | null>(cacheKey, null);

  // Async weather fetching
  const weatherAsync = useAsync(
    async (cityName: string) => {
      const data = await weatherService.getCurrentWeather({ city: cityName });
      return data;
    },
    {
      onSuccess: (data) => {
        if (!data) return;
        
        const now = new Date();
        setLastUpdated(now);
        
        // Update cache
        if (enableCache) {
          setCachedWeather({ data, timestamp: now.getTime() });
        }
        
        // Update recent searches
        setRecentSearches(prev => {
          const filtered = prev.filter(s => 
            s.city.toLowerCase() !== data.cityName.toLowerCase()
          );
          return [
            { city: data.cityName, timestamp: now.getTime() },
            ...filtered,
          ].slice(0, maxRecentSearches);
        });
      },
    }
  );

  // Location-based weather
  const locationAsync = useAsync(
    async () => {
      const data = await weatherService.getCurrentLocationWeather();
      return data;
    },
    {
      onSuccess: (data) => {
        setCity(data.cityName);
        setLastUpdated(new Date());
        if (enableCache) {
          setCachedWeather({ data, timestamp: Date.now() });
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
  const isStale = lastUpdated 
    ? Date.now() - lastUpdated.getTime() > STALE_TIME 
    : true;

  // Fetch initial city weather
  useEffect(() => {
    if (initialCity) {
      // Check cache first
      if (enableCache && cachedWeather) {
        const cacheAge = Date.now() - cachedWeather.timestamp;
        if (
          cacheAge < STALE_TIME && 
          cachedWeather.data.cityName.toLowerCase() === initialCity.toLowerCase()
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

  // Combine error from both async operations
  const error = weatherAsync.error || locationAsync.error;
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
