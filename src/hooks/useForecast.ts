import { useState, useCallback, useEffect, useRef } from 'react';
import { weatherService } from '../api/weatherService';
import { supportsMarineContext } from '../utils/marineCities';
import { getOptionalEvidenceFreshness } from '../utils/optionalEvidenceFreshness';
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
  const airQualityRef = useRef<AirQuality | null>(null);
  const contextSignalsRef = useRef<ContextSignals | null>(null);
  const lastSuccessfulRequestRef = useRef<{
    lat: number;
    lon: number;
    language: 'tr' | 'en';
  } | null>(null);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
    },
    []
  );

  useEffect(() => {
    if (!airQuality && !contextSignals) return undefined;

    let timerId: number | undefined;

    const refreshOptionalEvidence = () => {
      const now = Date.now();
      const deadlines: number[] = [];
      let droppedInvalidEvidence = false;

      if (airQuality) {
        const freshness = getOptionalEvidenceFreshness(airQuality.meta, now);
        if (!freshness.fresh || freshness.expiresInMs === null) {
          setAirQuality(current => (current === airQuality ? null : current));
          if (airQualityRef.current === airQuality) airQualityRef.current = null;
          droppedInvalidEvidence = true;
        } else {
          deadlines.push(now + freshness.expiresInMs);
        }
      }

      if (contextSignals) {
        const freshness = getOptionalEvidenceFreshness(contextSignals, now);
        if (!freshness.fresh || freshness.expiresInMs === null) {
          setContextSignals(current => (current === contextSignals ? null : current));
          if (contextSignalsRef.current === contextSignals) contextSignalsRef.current = null;
          droppedInvalidEvidence = true;
        } else {
          deadlines.push(now + freshness.expiresInMs);
        }
      }

      if (droppedInvalidEvidence || deadlines.length === 0) return;

      const nextDeadline = Math.min(...deadlines);
      timerId = window.setTimeout(refreshOptionalEvidence, Math.max(0, nextDeadline - now));
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (timerId !== undefined) window.clearTimeout(timerId);
      refreshOptionalEvidence();
    };

    refreshOptionalEvidence();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [airQuality, contextSignals]);

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
        airQualityRef.current = null;
        setContextSignals(null);
        contextSignalsRef.current = null;
        setMeta(null);
      }

      try {
        const hourlyRequest = weatherService
          .getHourlyForecast(coords.lat, coords.lon, language)
          .catch(() => null);
        const airQualityRequest = weatherService
          .getAirQuality(coords.lat, coords.lon, language)
          .then(value => ({ ok: true as const, value }))
          .catch(() => ({ ok: false as const }));
        const contextRequest = weatherService
          .getContextSignals(coords.lat, coords.lon, supportsMarineContext(cityName))
          .then(value => ({ ok: true as const, value }))
          .catch(() => ({ ok: false as const }));

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

        const [hourlyData, aqResult, contextResult] = await Promise.all([
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
        if (aqResult.ok) {
          setAirQuality(aqResult.value);
          airQualityRef.current = aqResult.value;
        } else if (
          isSameSuccessfulRequest &&
          (!airQualityRef.current ||
            !getOptionalEvidenceFreshness(airQualityRef.current.meta).fresh)
        ) {
          setAirQuality(null);
          airQualityRef.current = null;
        }
        if (contextResult.ok) {
          setContextSignals(contextResult.value);
          contextSignalsRef.current = contextResult.value;
        } else if (
          isSameSuccessfulRequest &&
          !getOptionalEvidenceFreshness(contextSignalsRef.current).fresh
        ) {
          setContextSignals(null);
          contextSignalsRef.current = null;
        }
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
