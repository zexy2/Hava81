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
        const forecastRequest = weatherService
          .getForecast(coords.lat, coords.lon, language)
          .then(value => ({ source: 'baseline' as const, ok: true as const, value }))
          .catch(error => ({ source: 'baseline' as const, ok: false as const, error }));
        const hourlyRequest = weatherService
          .getHourlyForecast(coords.lat, coords.lon, language)
          .then(value => ({ source: 'hourly' as const, ok: true as const, value }))
          .catch(error => ({ source: 'hourly' as const, ok: false as const, error }));
        const airQualityRequest = weatherService
          .getAirQuality(coords.lat, coords.lon, language)
          .then(value => ({ ok: true as const, value }))
          .catch(() => ({ ok: false as const }));
        const contextRequest = weatherService
          .getContextSignals(coords.lat, coords.lon, supportsMarineContext(cityName))
          .then(value => ({ ok: true as const, value }))
          .catch(() => ({ ok: false as const }));

        const applyBaseline = (data: Awaited<ReturnType<typeof weatherService.getForecast>>) => {
          setDaily(data.daily);
          setHourly(data.hourly);
          setDisplayHourly(data.hourly);
          setDisplayMeta(data.meta);
          setMeta(data.meta);
          lastSuccessfulRequestRef.current = { lat: coords.lat, lon: coords.lon, language };
        };
        const applyHourly = (
          data: Awaited<ReturnType<typeof weatherService.getHourlyForecast>>,
          becomesPrimaryMeta: boolean
        ) => {
          setHourly(data.hourly);
          setDisplayHourly(data.hourly.slice(0, 24));
          setDisplayMeta(data.meta);
          if (becomesPrimaryMeta) setMeta(data.meta);
          if (data.daily?.length) {
            setDaily(data.daily);
          } else {
            // ForecastAtlas exposes one provenance/freshness contract for its hourly and daily rows.
            // Once the dedicated hourly source becomes the visible authority, do not retain daily
            // rows from another response generation when it cannot supply a matching daily series.
            setDaily([]);
          }
          lastSuccessfulRequestRef.current = { lat: coords.lat, lon: coords.lon, language };
        };

        // Both core providers start together. Render whichever valid forecast becomes available
        // first; a slower baseline must not hide already-usable dedicated hourly guidance.
        const firstCoreResult = await Promise.race([forecastRequest, hourlyRequest]);
        if (requestId !== requestIdRef.current) return;
        const firstAppliedBaseline = firstCoreResult.source === 'baseline' && firstCoreResult.ok;
        const firstAppliedHourly =
          firstCoreResult.source === 'hourly' && firstCoreResult.ok && firstCoreResult.value.hourly.length > 0;
        if (firstAppliedBaseline) applyBaseline(firstCoreResult.value);
        if (firstAppliedHourly) applyHourly(firstCoreResult.value, true);

        const [forecastResult, hourlyResult] = await Promise.all([forecastRequest, hourlyRequest]);
        if (requestId !== requestIdRef.current) return;
        const forecastData = forecastResult.ok ? forecastResult.value : null;
        const hourlyData = hourlyResult.ok ? hourlyResult.value : null;
        if (!forecastData && !hourlyData?.hourly.length) {
          const coreError = !forecastResult.ok
            ? forecastResult.error
            : !hourlyResult.ok
              ? hourlyResult.error
              : undefined;
          throw coreError ?? new Error('Tahmin alınamadı');
        }
        if (hourlyData?.hourly.length) {
          // Dedicated hourly remains the final visible authority when both providers succeed.
          if (!firstAppliedHourly) applyHourly(hourlyData, !forecastData);
        } else if (forecastData && !firstAppliedBaseline) {
          applyBaseline(forecastData);
        }

        const [aqResult, contextResult] = await Promise.all([airQualityRequest, contextRequest]);
        if (requestId !== requestIdRef.current) return;
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
