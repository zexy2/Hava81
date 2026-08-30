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
  displayHourly: HourlyForecast[];
  displayMeta: ForecastMeta | null;
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
  const [displayHourly, setDisplayHourly] = useState<HourlyForecast[]>([]);
  const [displayMeta, setDisplayMeta] = useState<ForecastMeta | null>(null);
  const [airQuality, setAirQuality] = useState<AirQuality | null>(null);
  const [contextSignals, setContextSignals] = useState<ContextSignals | null>(null);
  const [meta, setMeta] = useState<ForecastMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);
  const lastSuccessfulRequestRef = useRef<{ lat: number; lon: number; language: 'tr' | 'en' } | null>(null);

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
      const previousRequest = lastSuccessfulRequestRef.current;
      const isSameSuccessfulRequest =
        previousRequest?.lat === coords.lat &&
        previousRequest.lon === coords.lon &&
        previousRequest.language === language;
      if (!isSameSuccessfulRequest) {
        setDaily([]);
        setHourly([]);
        setDisplayHourly([]);
        setDisplayMeta(null);
        setAirQuality(null);
        setContextSignals(null);
        setMeta(null);
      }

      try {
        const hourlyRequest = weatherService
          .getHourlyForecast(coords.lat, coords.lon, language)
          .catch(() => null);
        const airQualityRequest = weatherService
          .getAirQuality(coords.lat, coords.lon, language)
          .catch(() => null);
        const contextRequest = weatherService
          .getContextSignals(coords.lat, coords.lon, supportsMarineContext(cityName))
          .catch(() => null);

        let forecastData: Awaited<ReturnType<typeof weatherService.getForecast>> | null = null;
        let forecastError: unknown;
        try {
          forecastData = await weatherService.getForecast(coords.lat, coords.lon, language);
        } catch (err) {
          forecastError = err;
        }
        if (requestId !== requestIdRef.current) return;

        if (forecastData) {
          // The three-hour OpenWeather forecast is the resilient baseline. Render it immediately;
          // the optional real-hourly layer may upgrade the Atlas later without blocking decisions.
          setDaily(forecastData.daily);
          setHourly(forecastData.hourly);
          setDisplayHourly(forecastData.hourly);
          setDisplayMeta(forecastData.meta);
          setMeta(forecastData.meta);
          lastSuccessfulRequestRef.current = { lat: coords.lat, lon: coords.lon, language };
        }

        const [hourlyData, aqData, contextData] = await Promise.all([
          hourlyRequest,
          airQualityRequest,
          contextRequest,
        ]);
        if (!forecastData && !hourlyData?.hourly.length) {
          throw forecastError ?? new Error('Tahmin alınamadı');
        }
        if (requestId !== requestIdRef.current) return;
        if (hourlyData?.hourly.length) {
          // Upgrade the visible/decision hourly series and the calendar-day extrema together.
          // OpenWeather remains the immediate fallback when available; a valid dedicated hourly
          // response can also carry the forecast surface when that baseline request itself fails.
          setHourly(hourlyData.hourly);
          setDisplayHourly(hourlyData.hourly.slice(0, 24));
          setDisplayMeta(hourlyData.meta);
          if (!forecastData) setMeta(hourlyData.meta);
          if (hourlyData.daily?.length) setDaily(hourlyData.daily);
          lastSuccessfulRequestRef.current = { lat: coords.lat, lon: coords.lon, language };
        }
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

  return {
    daily,
    hourly,
    displayHourly,
    displayMeta,
    airQuality,
    contextSignals,
    meta,
    isLoading,
    error,
    fetch,
  };
}

export default useForecast;
