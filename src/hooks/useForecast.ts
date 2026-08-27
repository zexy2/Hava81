import { useState, useCallback, useEffect, useRef } from 'react';
import { weatherService } from '../api/weatherService';
import type {
  DailyForecast,
  HourlyForecast,
  AirQuality,
  Coordinates,
  ForecastMeta,
} from '../types';

interface UseForecastReturn {
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  airQuality: AirQuality | null;
  meta: ForecastMeta | null;
  isLoading: boolean;
  error: Error | null;
  fetch: (coords: Coordinates) => Promise<void>;
}

export function useForecast(language: 'tr' | 'en' = 'tr'): UseForecastReturn {
  const [daily, setDaily] = useState<DailyForecast[]>([]);
  const [hourly, setHourly] = useState<HourlyForecast[]>([]);
  const [airQuality, setAirQuality] = useState<AirQuality | null>(null);
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
    async (coords: Coordinates) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      setDaily([]);
      setHourly([]);
      setAirQuality(null);
      setMeta(null);

      try {
        const [forecastData, aqData] = await Promise.all([
          weatherService.getForecast(coords.lat, coords.lon, language),
          weatherService.getAirQuality(coords.lat, coords.lon, language).catch(() => null),
        ]);

        if (requestId !== requestIdRef.current) return;
        setDaily(forecastData.daily);
        setHourly(forecastData.hourly);
        setMeta(forecastData.meta);
        setAirQuality(aqData);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err : new Error('Tahmin alınamadı'));
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    },
    [language]
  );

  return { daily, hourly, airQuality, meta, isLoading, error, fetch };
}

export default useForecast;
