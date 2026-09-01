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

const OPTIONAL_FRESHNESS_FALLBACK_SECONDS = 300;
const MAX_OPTIONAL_FUTURE_SKEW_MS = 60_000;

const isFreshTimestamp = (
  fetchedAt: Date | string | undefined,
  freshForSeconds = OPTIONAL_FRESHNESS_FALLBACK_SECONDS
): boolean => {
  if (!fetchedAt || !Number.isFinite(freshForSeconds) || freshForSeconds <= 0) return false;
  const fetchedAtMs =
    fetchedAt instanceof Date ? fetchedAt.getTime() : new Date(fetchedAt).getTime();
  if (!Number.isFinite(fetchedAtMs)) return false;
  const ageMs = Date.now() - fetchedAtMs;
  return ageMs >= -MAX_OPTIONAL_FUTURE_SKEW_MS && ageMs <= freshForSeconds * 1000;
};

const isFreshOptionalMeta = (meta: AirQuality['meta'] | undefined): boolean =>
  Boolean(meta && isFreshTimestamp(meta.fetchedAt, meta.freshForSeconds));

const freshnessDeadline = (
  fetchedAt: Date | string | undefined,
  freshForSeconds = OPTIONAL_FRESHNESS_FALLBACK_SECONDS
): number | null => {
  if (!fetchedAt || !Number.isFinite(freshForSeconds) || freshForSeconds <= 0) return null;
  const fetchedAtMs =
    fetchedAt instanceof Date ? fetchedAt.getTime() : new Date(fetchedAt).getTime();
  if (!Number.isFinite(fetchedAtMs)) return null;
  return fetchedAtMs + freshForSeconds * 1000;
};

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

    const now = Date.now();
    const deadlines: number[] = [];
    let droppedInvalidEvidence = false;

    if (airQuality) {
      const deadline = freshnessDeadline(
        airQuality.meta?.fetchedAt,
        airQuality.meta?.freshForSeconds
      );
      if (!isFreshOptionalMeta(airQuality.meta) || deadline === null) {
        setAirQuality(null);
        if (airQualityRef.current === airQuality) airQualityRef.current = null;
        droppedInvalidEvidence = true;
      } else {
        deadlines.push(deadline);
      }
    }

    if (contextSignals) {
      const deadline = freshnessDeadline(
        contextSignals.fetchedAt,
        contextSignals.freshForSeconds
      );
      if (
        !isFreshTimestamp(contextSignals.fetchedAt, contextSignals.freshForSeconds) ||
        deadline === null
      ) {
        setContextSignals(null);
        if (contextSignalsRef.current === contextSignals) contextSignalsRef.current = null;
        droppedInvalidEvidence = true;
      } else {
        deadlines.push(deadline);
      }
    }

    if (droppedInvalidEvidence || deadlines.length === 0) return undefined;

    const nextDeadline = Math.min(...deadlines);
    const timerId = window.setTimeout(() => {
      if (airQuality && !isFreshOptionalMeta(airQuality.meta)) {
        setAirQuality(current => (current === airQuality ? null : current));
        if (airQualityRef.current === airQuality) airQualityRef.current = null;
      }
      if (
        contextSignals &&
        !isFreshTimestamp(contextSignals.fetchedAt, contextSignals.freshForSeconds)
      ) {
        setContextSignals(current => (current === contextSignals ? null : current));
        if (contextSignalsRef.current === contextSignals) contextSignalsRef.current = null;
      }
    }, Math.max(0, nextDeadline - now + 100));

    return () => window.clearTimeout(timerId);
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
          (!airQualityRef.current || !isFreshOptionalMeta(airQualityRef.current.meta))
        ) {
          setAirQuality(null);
          airQualityRef.current = null;
        }
        if (contextResult.ok) {
          setContextSignals(contextResult.value);
          contextSignalsRef.current = contextResult.value;
        } else if (
          isSameSuccessfulRequest &&
          !isFreshTimestamp(
            contextSignalsRef.current?.fetchedAt,
            contextSignalsRef.current?.freshForSeconds
          )
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
