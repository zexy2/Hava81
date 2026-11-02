import { z } from 'zod';
import { AppError } from '../../core/errors';

// MET Norway Locationforecast 2.0 (https://api.met.no/weatherapi/locationforecast/2.0/documentation).
// Terms (https://api.met.no/doc/TermsOfService): identify the client with a User-Agent, cache,
// stay under 20 requests/s per application and send at most four coordinate decimals.
// Data licence: CC BY 4.0 (https://api.met.no/doc/License).

export const MET_NORWAY_FORECAST_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
export const MET_NORWAY_ATTRIBUTION = 'MET Norway · CC BY 4.0';
export const MET_NORWAY_SOURCE_URL = 'https://api.met.no/';
const DEFAULT_TIMEOUT_MS = 8_000;
const HOUR_MS = 3_600_000;

const finite = z.number().finite();
const periodSchema = z
  .object({
    summary: z.object({ symbol_code: z.string().min(1) }).partial().optional(),
    details: z
      .object({
        precipitation_amount: finite.min(0).max(2_000),
        air_temperature_max: finite,
        air_temperature_min: finite,
      })
      .partial()
      .optional(),
  })
  .optional();

const forecastSchema = z.object({
  properties: z.object({
    meta: z.object({ updated_at: z.string().datetime({ offset: true }) }).partial().optional(),
    timeseries: z
      .array(
        z.object({
          time: z.string().datetime({ offset: true }),
          data: z.object({
            instant: z.object({
              details: z
                .object({
                  air_temperature: finite.min(-100).max(100),
                  apparent_air_temperature: finite.min(-100).max(100),
                  relative_humidity: finite.min(0).max(100),
                  dew_point_temperature: finite.min(-100).max(100),
                  wind_speed: finite.min(0).max(150),
                  wind_from_direction: finite.min(0).max(360),
                  cloud_area_fraction: finite.min(0).max(100),
                  fog_area_fraction: finite.min(0).max(100),
                  ultraviolet_index_clear_sky: finite.min(0).max(50),
                })
                .partial(),
            }),
            next_1_hours: periodSchema,
            next_6_hours: periodSchema,
            next_12_hours: periodSchema,
          }),
        })
      )
      .min(1),
  }),
});

/** One hour of the expanded timeline, starting at `time`. */
export interface MetHour {
  time: number;
  temperature: number;
  apparentTemperature?: number;
  humidity?: number;
  dewPoint?: number;
  windSpeed: number;
  windDirection?: number;
  cloudCover?: number;
  uvClearSky?: number;
  /**
   * Precipitation in this hour, mm; six-hour totals are spread evenly over their hours.
   * Undefined when MET gives no amount for the period: unknown, never assumed dry.
   */
  precipitationMm?: number;
  /** MET symbol for the period; undefined when the period is missing. */
  symbol?: string;
  /** Length of the MET period the amount and symbol come from; undefined when none covers the hour. */
  periodHours?: 1 | 6;
}

export type MetNorwayForecast = z.infer<typeof forecastSchema>;

/** When MET last ran the model behind this forecast (`meta.updated_at`), as ISO-8601 UTC. */
export const modelUpdatedAt = (forecast: MetNorwayForecast): string | undefined => {
  const updated = forecast.properties.meta?.updated_at;
  const at = updated === undefined ? Number.NaN : Date.parse(updated);
  return Number.isFinite(at) ? new Date(at).toISOString() : undefined;
};

/** Four decimals at most, as the terms of service ask (≈11 m, plenty for a forecast). */
const coordinate = (value: number) => String(Math.round(value * 10_000) / 10_000);

export interface MetNorwayTransportOptions {
  userAgent: string;
  timeoutMs?: number;
  metBaseUrl?: string;
  /** Requests started per second for the whole application; MET asks for fewer than 20. */
  maxRequestsPerSecond?: number;
  /** Stored responses kept for conditional revalidation. */
  maxStoredResponses?: number;
}

interface StoredResponse {
  lastModified: string;
  expiresAt: number;
  body: unknown;
}

const DEFAULT_REQUESTS_PER_SECOND = 10;
const DEFAULT_STORED_RESPONSES = 200;

/**
 * The one way the API talks to MET Locationforecast. Every request takes a turn on a shared
 * pace (default 10/s), a response is reused until its `Expires`, and after that it is
 * revalidated with `If-Modified-Since` so an unchanged forecast costs a 304, not a download.
 * Share one instance between the hourly, province and context providers.
 */
export class MetNorwayTransport {
  private nextStartAt = 0;
  private readonly stored = new Map<string, StoredResponse>();

  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly options: MetNorwayTransportOptions
  ) {}

  /** Waits for the next free start slot so requests never exceed the configured rate. */
  private async takeTurn(): Promise<void> {
    const interval = 1_000 / Math.max(1, this.options.maxRequestsPerSecond ?? DEFAULT_REQUESTS_PER_SECOND);
    const now = Date.now();
    const startAt = Math.max(now, this.nextStartAt);
    this.nextStartAt = startAt + interval;
    if (startAt > now) await new Promise(resolve => setTimeout(resolve, startAt - now));
  }

  private remember(key: string, entry: StoredResponse) {
    this.stored.delete(key);
    this.stored.set(key, entry);
    const limit = this.options.maxStoredResponses ?? DEFAULT_STORED_RESPONSES;
    while (this.stored.size > limit) {
      const oldest = this.stored.keys().next().value;
      if (oldest === undefined) break;
      this.stored.delete(oldest);
    }
  }

  async forecast(lat: number, lon: number): Promise<MetNorwayForecast> {
    const url = new URL(this.options.metBaseUrl ?? MET_NORWAY_FORECAST_URL);
    url.searchParams.set('lat', coordinate(lat));
    url.searchParams.set('lon', coordinate(lon));
    const key = url.toString();
    const stored = this.stored.get(key);
    // HTTP caching runs on the wall clock, whatever clock the forecast logic is given.
    if (stored && stored.expiresAt > Date.now()) return parseForecast(stored.body);

    await this.takeTurn();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(url, {
        headers: {
          accept: 'application/json',
          'user-agent': this.options.userAgent,
          ...(stored ? { 'if-modified-since': stored.lastModified } : {}),
        },
        signal: controller.signal,
      });
      const expiresAt = Date.parse(response.headers.get('expires') ?? '');
      if (response.status === 304 && stored) {
        this.remember(key, { ...stored, expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0 });
        return parseForecast(stored.body);
      }
      if (!response.ok) {
        throw new AppError(502, 'HOURLY_PROVIDER_ERROR', 'MET Norway tahmin servisi yanıt vermedi.');
      }
      const body: unknown = await response.json();
      const forecast = parseForecast(body);
      const lastModified = response.headers.get('last-modified');
      if (lastModified) {
        this.remember(key, { lastModified, expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0, body });
      }
      return forecast;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'HOURLY_PROVIDER_ERROR', 'MET Norway tahmin servisine ulaşılamadı.');
    } finally {
      clearTimeout(timeout);
    }
  }
}

const parseForecast = (body: unknown): MetNorwayForecast => {
  const parsed = forecastSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      502,
      'INVALID_HOURLY_PROVIDER_RESPONSE',
      'MET Norway tahmin servisi beklenmeyen bir cevap döndürdü.'
    );
  }
  return parsed.data;
};

/** One-off request through a private transport; prefer a shared `MetNorwayTransport`. */
export const fetchMetNorwayForecast = async (
  fetchImpl: typeof fetch,
  userAgent: string,
  lat: number,
  lon: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  baseUrl = MET_NORWAY_FORECAST_URL
): Promise<MetNorwayForecast> =>
  new MetNorwayTransport(fetchImpl, { userAgent, timeoutMs, metBaseUrl: baseUrl }).forecast(lat, lon);

const lerp = (from: number | undefined, to: number | undefined, ratio: number) => {
  if (from === undefined) return to;
  if (to === undefined) return from;
  return from + (to - from) * ratio;
};

/**
 * Expands MET's timeline (hourly for ~2.5 days, then 6-hourly) into contiguous hours from
 * `start`. Instant values are interpolated linearly between steps, which stays inside the
 * bracket of the neighbouring values; precipitation comes from the period that covers the
 * hour, split evenly so totals are preserved.
 */
export const expandToHours = (
  forecast: MetNorwayForecast,
  start: number
): MetHour[] => {
  const steps = forecast.properties.timeseries
    .map(step => ({ ...step, at: Date.parse(step.time) }))
    .filter(step => Number.isFinite(step.at) && step.data.instant.details.air_temperature !== undefined)
    .sort((a, b) => a.at - b.at);
  if (steps.length === 0) return [];
  const first = Math.max(start, Math.ceil(steps[0].at / HOUR_MS) * HOUR_MS);
  const last = steps[steps.length - 1].at;
  const hours: MetHour[] = [];
  let cursor = 0;
  for (let time = first; time <= last; time += HOUR_MS) {
    while (cursor < steps.length - 1 && steps[cursor + 1].at <= time) cursor += 1;
    const previous = steps[cursor];
    const next = steps[Math.min(cursor + 1, steps.length - 1)];
    const span = next.at - previous.at;
    const ratio = span > 0 ? (time - previous.at) / span : 0;
    const a = previous.data.instant.details;
    const b = next.data.instant.details;
    const temperature = lerp(a.air_temperature, b.air_temperature, ratio);
    const windSpeed = lerp(a.wind_speed, b.wind_speed, ratio);
    if (temperature === undefined || windSpeed === undefined) continue;

    // The hour's own one-hour block when MET has one; otherwise the six-hour period that
    // covers it. A missing block or field stays undefined: no amount means unknown, not 0.
    const ownHour = time === previous.at ? previous.data.next_1_hours : undefined;
    const sixHours = ownHour ? undefined : previous.data.next_6_hours;
    const sixHourAmount = sixHours?.details?.precipitation_amount;
    const precipitationMm = ownHour
      ? ownHour.details?.precipitation_amount
      : sixHourAmount !== undefined
        ? sixHourAmount / 6
        : undefined;
    const symbol = ownHour ? ownHour.summary?.symbol_code : sixHours?.summary?.symbol_code;
    const periodHours = ownHour ? 1 : sixHours ? 6 : undefined;

    hours.push({
      time,
      temperature,
      apparentTemperature: lerp(a.apparent_air_temperature, b.apparent_air_temperature, ratio),
      humidity: lerp(a.relative_humidity, b.relative_humidity, ratio),
      dewPoint: lerp(a.dew_point_temperature, b.dew_point_temperature, ratio),
      windSpeed,
      // Directions wrap at 360°, so they are not interpolated.
      windDirection: a.wind_from_direction,
      cloudCover: lerp(a.cloud_area_fraction, b.cloud_area_fraction, ratio),
      uvClearSky: lerp(a.ultraviolet_index_clear_sky, b.ultraviolet_index_clear_sky, ratio),
      precipitationMm,
      symbol,
      periodHours,
    });
  }
  return hours;
};

/**
 * Clear-sky UV scaled by a cloud modification factor (Kasten–Czeplak form, 1 − 0.75·c^3.4).
 * MET publishes only the clear-sky index, so the result is an estimate and never exceeds it.
 */
export const estimatedUvIndex = (uvClearSky: number | undefined, cloudPercent: number | undefined) => {
  if (uvClearSky === undefined) return undefined;
  const cloud = Math.max(0, Math.min(1, (cloudPercent ?? 0) / 100));
  return Math.round(uvClearSky * (1 - 0.75 * cloud ** 3.4) * 10) / 10;
};

export const round1 = (value: number) => Math.round(value * 10) / 10;
