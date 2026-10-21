/**
 * Faz 3.2: `/weather/bundle` istemci sözleşmesi. weatherService testlerde sıkça
 * mock'landığı için sabitler ve hata sınıfı ayrı (mock'lanmayan) bir modülde durur.
 */
import type {
  AirQuality,
  ContextSignals,
  DailyForecast,
  ForecastMeta,
  HourlyForecast,
} from '../types';

export const FORECAST_BUNDLE_PARTS = ['forecast', 'hourly', 'airQuality', 'context'] as const;
export type ForecastBundlePart = (typeof FORECAST_BUNDLE_PARTS)[number];
export type BundlePartResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

export type ParsedForecast = {
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  meta: ForecastMeta;
};
export type ParsedHourlyForecast = {
  daily?: DailyForecast[];
  hourly: HourlyForecast[];
  meta: ForecastMeta;
};

export interface ForecastBundle {
  forecast?: BundlePartResult<ParsedForecast>;
  hourly?: BundlePartResult<ParsedHourlyForecast>;
  airQuality?: BundlePartResult<AirQuality>;
  context?: BundlePartResult<ContextSignals>;
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
