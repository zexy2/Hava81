import { useState, useCallback, useEffect, useRef } from 'react';
import { weatherService } from '../api/weatherService';
import {
  BundleUnavailableError,
  FORECAST_BUNDLE_PARTS,
  type BundlePartResult,
  type ForecastBundle,
  type ForecastBundlePart,
} from '../api/weatherBundle';
import { supportsMarineContext } from '../utils/marineCities';
import { getOptionalEvidenceFreshness } from '../utils/optionalEvidenceFreshness';
import type {
  DailyForecast,
  HourlyForecast,
  AirQuality,
  AirQualityHourly,
  Coordinates,
  ForecastMeta,
  ContextSignals,
} from '../types';

type Settled<T> = BundlePartResult<T>;

const settle = <T>(promise: Promise<T>): Promise<Settled<T>> =>
  promise.then(
    value => ({ ok: true as const, value }),
    error => ({ ok: false as const, error: error as unknown })
  );

type BundleOutcome =
  | { kind: 'bundle'; bundle: ForecastBundle }
  | { kind: 'legacy' }
  | { kind: 'error'; error: unknown };

interface UseForecastReturn {
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  /** Plan v3 horizon (up to 120 h when the API provides it; otherwise same as `hourly`). */
  planHourly: HourlyForecast[];
  displayHourly: HourlyForecast[];
  displayMeta: ForecastMeta | null;
  airQuality: AirQuality | null;
  airQualityHourly: AirQualityHourly | null;
  contextSignals: ContextSignals | null;
  meta: ForecastMeta | null;
  isLoading: boolean;
  error: Error | null;
  fetch: (coords: Coordinates, cityName?: string) => Promise<void>;
}

export function useForecast(language: 'tr' | 'en' = 'tr'): UseForecastReturn {
  const [daily, setDaily] = useState<DailyForecast[]>([]);
  const [hourly, setHourly] = useState<HourlyForecast[]>([]);
  const [planHourly, setPlanHourly] = useState<HourlyForecast[]>([]);
  const [displayHourly, setDisplayHourly] = useState<HourlyForecast[]>([]);
  const [displayMeta, setDisplayMeta] = useState<ForecastMeta | null>(null);
  const [airQuality, setAirQuality] = useState<AirQuality | null>(null);
  const [airQualityHourly, setAirQualityHourly] = useState<AirQualityHourly | null>(null);
  const [contextSignals, setContextSignals] = useState<ContextSignals | null>(null);
  const [meta, setMeta] = useState<ForecastMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const airQualityRef = useRef<AirQuality | null>(null);
  const airQualityHourlyRef = useRef<AirQualityHourly | null>(null);
  const contextSignalsRef = useRef<ContextSignals | null>(null);
  const lastSuccessfulRequestRef = useRef<{
    lat: number;
    lon: number;
    language: 'tr' | 'en';
  } | null>(null);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      // Faz 3.2: unmount sırasında uçuştaki tahmin isteklerini gerçekten iptal et.
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (!airQuality && !airQualityHourly && !contextSignals) return undefined;

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

      if (airQualityHourly) {
        const freshness = getOptionalEvidenceFreshness(airQualityHourly.meta, now);
        if (!freshness.fresh || freshness.expiresInMs === null) {
          setAirQualityHourly(current => (current === airQualityHourly ? null : current));
          if (airQualityHourlyRef.current === airQualityHourly) airQualityHourlyRef.current = null;
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
  }, [airQuality, airQualityHourly, contextSignals]);

  const fetch = useCallback(
    async (coords: Coordinates, cityName?: string) => {
      const requestId = ++requestIdRef.current;
      // Faz 3.2: şehir/dil değişince bir önceki şehrin isteklerini iptal et.
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;
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
        setPlanHourly([]);
        setDisplayHourly([]);
        setDisplayMeta(null);
        setAirQuality(null);
        airQualityRef.current = null;
        setAirQualityHourly(null);
        airQualityHourlyRef.current = null;
        setContextSignals(null);
        contextSignalsRef.current = null;
        setMeta(null);
      }

      try {
        const { lat, lon } = coords;
        const marine = supportsMarineContext(cityName);
        // Faz 3.2: tek `/weather/bundle` isteği. Şehir sayfası saatlik tahmini önceden
        // istediyse (bootstrap) o parça bundle'dan çıkarılır ve hazır yanıt kullanılır.
        const useBootstrapHourly = weatherService.hasBootstrapHourly(language);
        const bundleParts: readonly ForecastBundlePart[] = [
          ...(useBootstrapHourly
            ? FORECAST_BUNDLE_PARTS.filter(part => part !== 'hourly')
            : FORECAST_BUNDLE_PARTS),
          'airQualityHourly',
        ];
        const bootstrapHourlyRequest = useBootstrapHourly
          ? settle(weatherService.getHourlyForecast(lat, lon, language, { signal }))
          : null;
        const bundleOutcome: Promise<BundleOutcome> = weatherService
          .getForecastBundle(lat, lon, language, { marine, signal, parts: bundleParts })
          .then(
            bundle => ({ kind: 'bundle' as const, bundle }),
            error =>
              // API bundle'ı bilmiyorsa (web API'den önce deploy edildi) ya da bundle
              // başarısızsa eski tekil isteklere düş. İptal ve 429 olduğu gibi kalır.
              error instanceof BundleUnavailableError
                ? { kind: 'legacy' as const }
                : { kind: 'error' as const, error: error as unknown }
          );
        const fromBundle = <T,>(
          pick: (bundle: ForecastBundle) => Settled<T> | undefined,
          legacy: () => Promise<T>
        ): Promise<Settled<T>> =>
          bundleOutcome.then(outcome => {
            if (outcome.kind === 'error') return { ok: false as const, error: outcome.error };
            const fromServer = outcome.kind === 'bundle' ? pick(outcome.bundle) : undefined;
            return fromServer ?? settle(legacy());
          });

        const forecastRequest = fromBundle(
          bundle => bundle.forecast,
          () => weatherService.getForecast(lat, lon, language, { signal })
        ).then(result => ({ ...result, source: 'baseline' as const }));
        const hourlyRequest = (
          bootstrapHourlyRequest ??
          fromBundle(
            bundle => bundle.hourly,
            () => weatherService.getHourlyForecast(lat, lon, language, { signal })
          )
        ).then(result => ({ ...result, source: 'hourly' as const }));
        const airQualityRequest = fromBundle(
          bundle => bundle.airQuality,
          () => weatherService.getAirQuality(lat, lon, language, { signal })
        );
        const contextRequest = fromBundle(
          bundle => bundle.context,
          () => weatherService.getContextSignals(lat, lon, marine, { signal })
        );
        const airQualityHourlyRequest = bundleOutcome.then(outcome => {
          if (outcome.kind === 'bundle') {
            return outcome.bundle.airQualityHourly ?? {
              ok: false as const,
              error: new Error('Hourly air-quality part was not returned'),
            };
          }
          return {
            ok: false as const,
            error: outcome.kind === 'error' ? outcome.error : new BundleUnavailableError('unsupported'),
          };
        });

        const applyBaseline = (data: Awaited<ReturnType<typeof weatherService.getForecast>>) => {
          setDaily(data.daily);
          setHourly(data.hourly);
          setPlanHourly(data.hourly);
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
          setPlanHourly(data.planHourly ?? data.hourly);
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

        // Faz 3.2: yükleme durumu yalnız çekirdek veriye (tahmin) bağlı; hava kalitesi ve
        // bağlam sinyalleri arka planda tamamlanır, iskelet onları beklemez.
        setIsLoading(false);

        const [aqResult, contextResult, hourlyAqResult] = await Promise.all([
          airQualityRequest,
          contextRequest,
          airQualityHourlyRequest,
        ]);
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
        if (hourlyAqResult.ok) {
          setAirQualityHourly(hourlyAqResult.value);
          airQualityHourlyRef.current = hourlyAqResult.value;
        } else if (
          isSameSuccessfulRequest &&
          (!airQualityHourlyRef.current ||
            !getOptionalEvidenceFreshness(airQualityHourlyRef.current.meta).fresh)
        ) {
          setAirQualityHourly(null);
          airQualityHourlyRef.current = null;
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err : new Error('Tahmin alınamadı'));
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          if (abortControllerRef.current === controller) abortControllerRef.current = null;
        }
      }
    },
    [language]
  );

  return {
    daily,
    hourly,
    planHourly,
    displayHourly,
    displayMeta,
    airQuality,
    airQualityHourly,
    contextSignals,
    meta,
    isLoading,
    error,
    fetch,
  };
}

export default useForecast;
