/**
 * Faz 3.2: `/weather/bundle` istemci sözleşmesi. weatherService testlerde sıkça
 * mock'landığı için sabitler ve hata sınıfı ayrı (mock'lanmayan) bir modülde durur.
 */
import type {
  AirQuality,
  AirQualityHourly,
  ContextSignals,
  DailyForecast,
  ForecastMeta,
  HourlyForecast,
} from '../types';

export const FORECAST_BUNDLE_PARTS = ['forecast', 'hourly', 'airQuality', 'context'] as const;
/**
 * Plan v3 (P1.2): optional part, requested explicitly. An API without it rejects the
 * `include` list, so it is not part of the default request until the engine needs it.
 */
export type ForecastBundlePart = (typeof FORECAST_BUNDLE_PARTS)[number] | 'airQualityHourly';
export type BundlePartResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

export type ParsedForecast = {
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  meta: ForecastMeta;
};
export type ParsedHourlyForecast = {
  daily?: DailyForecast[];
  /** Hours for today's surfaces (at most 48, unchanged by plan v3). */
  hourly: HourlyForecast[];
  /**
   * Full plan-engine horizon (up to 120 hours, plan v3 P1.1). Present only when the API sent
   * more than `hourly` holds; consumers fall back to `hourly` otherwise.
   */
  planHourly?: HourlyForecast[];
  meta: ForecastMeta;
};

export interface ForecastBundle {
  forecast?: BundlePartResult<ParsedForecast>;
  hourly?: BundlePartResult<ParsedHourlyForecast>;
  airQuality?: BundlePartResult<AirQuality>;
  context?: BundlePartResult<ContextSignals>;
  airQualityHourly?: BundlePartResult<AirQualityHourly>;
}

/** Bundle kullanılamadı (API'de yok ya da başarısız); çağıran eski tekil isteklere düşmeli. */
export class BundleUnavailableError extends Error {
  constructor(
    public readonly reason: 'unsupported' | 'failed',
    public readonly original?: unknown
  ) {
    super(`Weather bundle ${reason}`);
    this.name = 'BundleUnavailableError';
  }
}
