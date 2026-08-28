import { useState, useCallback, useEffect, useRef } from 'react';
import { weatherService } from '../api/weatherService';
import { supportsMarineContext } from '../utils/marineCities';
import type {
  DailyForecast,
  HourlyForecast,
  AirQuality,
  Coordinates,
  ForecastMeta,
  ContextSignals,
} from '../types';

interface UseForecastReturn {
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  airQuality: AirQuality | null;
  contextSignals: ContextSignals | null;
  meta: ForecastMeta | null;
  isLoading: boolean;
  error: Error | null;
  fetch: (coords: Coordinates, cityName?: string) => Promise<void>;
}

export function useForecast(language: 'tr' | 'en' = 'tr'): UseForecastReturn {
  const [daily, setDaily] = useState<DailyForecast[]>([]);
  const [hourly, setHourly] = useState<HourlyForecast[]>([]);
  const [airQuality, setAirQuality] = useState<AirQuality | null>(null);
  const [contextSignals, setContextSignals] = useState<ContextSignals | null>(null);
  const [meta, setMeta] = useState<ForecastMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
    },
    []
  );

  const fetch = useCallback(
    async (coords: Coordinates, cityName?: string) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      setDaily([]);
      setHourly([]);
      setAirQuality(null);
      setContextSignals(null);
      setMeta(null);

      try {
        const [forecastData, aqData, contextData] = await Promise.all([
          weatherService.getForecast(coords.lat, coords.lon, language),
          weatherService.getAirQuality(coords.lat, coords.lon, language).catch(() => null),
          weatherService
            .getContextSignals(coords.lat, coords.lon, supportsMarineContext(cityName))
            .catch(() => null),
        ]);
        if (requestId !== requestIdRef.current) return;
        setDaily(forecastData.daily);
        setHourly(forecastData.hourly);
        setMeta(forecastData.meta);
        setAirQuality(aqData);
        setContextSignals(contextData);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err : new Error('Tahmin alınamadı'));
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    },
    [language]
  );

  return { daily, hourly, airQuality, contextSignals, meta, isLoading, error, fetch };
}

export default useForecast;
