import { z } from 'zod';
import { AppError } from '../../core/errors';

export interface ProvincePoint {
  readonly lat: number;
  readonly lon: number;
}

export interface ProvinceCurrentObservation {
  /** Sıcaklık, °C. */
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  /** Rüzgâr hızı, m/s. */
  windSpeed?: number;
  /** Rüzgârın geldiği yön, derece (meteorolojik). */
  windDirection?: number;
  /** Bulutluluk, %. */
  cloudCover?: number;
  /** Son saatteki yağış, mm. */
  precipitation?: number;
  /** İçinde bulunulan saatin yağış olasılığı, %. */
  precipitationProbability?: number;
  /** Harita zaman şeridi için +3 ve +6 saatlik görünüm. */
  outlook?: ProvinceOutlookPoint[];
  /** Gözlem zamanı (ISO 8601, UTC). */
  observedAt: string;
}

export interface ProvinceOutlookPoint {
  hourOffset: number;
  /** % */
  precipitationProbability?: number;
  /** mm */
  precipitation?: number;
  /** °C */
  temperature?: number;
}

/** 81 il gibi çok sayıda nokta için tek upstream çağrısıyla güncel durum getirir. */
export interface ProvinceCurrentProvider {
  readonly name: string;
  readonly attribution?: string;
  getCurrent(points: readonly ProvincePoint[]): Promise<Array<ProvinceCurrentObservation | null>>;
}

const nullableNumber = z.number().nullable().optional();
const MAX_WIND_SPEED_MS = 150;
/** Hours ahead shown on the map's time scrubber. */
export const PROVINCE_OUTLOOK_HOURS = [3, 6] as const;
const SUPPORTED_WEATHER_CODES = new Set([
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82,
  85, 86, 95, 96, 99,
]);
const locationSchema = z.object({
  current: z
    .object({
      time: z.number().int().nonnegative(),
      temperature_2m: nullableNumber,
      weather_code: nullableNumber,
      is_day: nullableNumber,
      wind_speed_10m: nullableNumber,
      wind_direction_10m: nullableNumber,
      cloud_cover: nullableNumber,
      precipitation: nullableNumber,
    })
    .optional(),
  hourly: z
    .object({
      time: z.array(z.number().int().nonnegative()),
      precipitation_probability: z.array(z.number().nullable()).optional(),
      precipitation: z.array(z.number().nullable()).optional(),
      temperature_2m: z.array(z.number().nullable()).optional(),
    })
    .optional(),
});

type LocationReading = z.infer<typeof locationSchema>;

const inRange = (value: number | null | undefined, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** The hourly slot containing `seconds`, or -1. Open-Meteo slots start on the hour. */
const slotIndex = (times: readonly number[], seconds: number) => {
  for (let index = times.length - 1; index >= 0; index -= 1) {
    if (times[index] <= seconds) return index;
  }
  return -1;
};

/**
 * Optional layer readings for one location. Each value is checked on its own, so a bad
 * cloud figure drops only that figure, never the province or its temperature.
 */
const layerReadings = (location: LocationReading, observedSeconds: number) => {
  const current = location.current;
  const readings: Partial<ProvinceCurrentObservation> = {};
  if (inRange(current?.wind_direction_10m, 0, 360)) readings.windDirection = current.wind_direction_10m % 360;
  if (inRange(current?.cloud_cover, 0, 100)) readings.cloudCover = current.cloud_cover;
  if (inRange(current?.precipitation, 0, 500)) readings.precipitation = current.precipitation;

  const hourly = location.hourly;
  if (!hourly) return readings;
  const base = slotIndex(hourly.time, observedSeconds);
  if (base < 0) return readings;
  const pop = hourly.precipitation_probability ?? [];
  const mm = hourly.precipitation ?? [];
  const temperature = hourly.temperature_2m ?? [];
  if (inRange(pop[base], 0, 100)) readings.precipitationProbability = pop[base];
  const outlook: ProvinceOutlookPoint[] = [];
  for (const hourOffset of PROVINCE_OUTLOOK_HOURS) {
    const index = base + hourOffset;
    if (index >= hourly.time.length) continue;
    const point: ProvinceOutlookPoint = { hourOffset };
    if (inRange(pop[index], 0, 100)) point.precipitationProbability = pop[index];
    if (inRange(mm[index], 0, 500)) point.precipitation = mm[index];
    if (inRange(temperature[index], -100, 100)) point.temperature = Math.round(temperature[index] * 10) / 10;
    if (Object.keys(point).length > 1) outlook.push(point);
  }
  if (outlook.length) readings.outlook = outlook;
  return readings;
};

/**
 * Open-Meteo birden çok koordinatı virgülle ayrılmış tek istekte kabul eder ve her
 * konum için bir nesne içeren dizi döndürür. 81 il = 1 HTTP isteği (Open-Meteo
 * kotasında konum başına sayılır; bu yüzden sonuç uzun süre cache'lenir).
 */
export class OpenMeteoProvincesProvider implements ProvinceCurrentProvider {
  readonly name = 'Open-Meteo';
  readonly attribution = 'Open-Meteo · CC BY 4.0';

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 8_000,
    private readonly baseUrl = 'https://api.open-meteo.com',
    private readonly apiKey?: string,
  ) {}

  async getCurrent(points: readonly ProvincePoint[]): Promise<Array<ProvinceCurrentObservation | null>> {
    if (points.length === 0) return [];
    const url = new URL('/v1/forecast', this.baseUrl);
    url.searchParams.set('latitude', points.map(point => String(point.lat)).join(','));
    url.searchParams.set('longitude', points.map(point => String(point.lon)).join(','));
    url.searchParams.set(
      'current',
      'temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation',
    );
    // Map layers: the current hour plus the scrubber's +3 h and +6 h, in the same request.
    url.searchParams.set('hourly', 'precipitation_probability,precipitation,temperature_2m');
    url.searchParams.set('forecast_hours', String(Math.max(...PROVINCE_OUTLOOK_HOURS) + 2));
    url.searchParams.set('timeformat', 'unixtime');
    url.searchParams.set('timezone', 'GMT');
    url.searchParams.set('temperature_unit', 'celsius');
    url.searchParams.set('wind_speed_unit', 'ms');
    if (this.apiKey) url.searchParams.set('apikey', this.apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AppError(502, 'PROVINCES_PROVIDER_ERROR', 'İl sıcaklıkları sağlayıcısı yanıt vermedi.');
      }
      const body: unknown = await response.json();
      // Tek konum istendiğinde Open-Meteo dizi yerine tek nesne döndürür.
      const list = Array.isArray(body) ? body : [body];
      const parsed = z.array(locationSchema).safeParse(list);
      if (!parsed.success || parsed.data.length !== points.length) {
        throw new AppError(
          502,
          'INVALID_PROVINCES_PROVIDER_RESPONSE',
          'İl sıcaklıkları sağlayıcısı beklenmeyen bir cevap döndürdü.',
        );
      }
      return parsed.data.map(location => {
        const current = location.current;
        const temperature = current?.temperature_2m;
        const code = current?.weather_code;
        const isDay = current?.is_day;
        const observedAtMs = current ? current.time * 1_000 : Number.NaN;
        if (
          !current ||
          typeof temperature !== 'number' ||
          !Number.isFinite(temperature) ||
          temperature < -100 ||
          temperature > 100 ||
          typeof code !== 'number' ||
          !Number.isInteger(code) ||
          !SUPPORTED_WEATHER_CODES.has(code) ||
          (isDay !== 0 && isDay !== 1) ||
          !Number.isFinite(observedAtMs) ||
          !Number.isFinite(new Date(observedAtMs).getTime())
        ) {
          // A single malformed location should be omitted rather than turning a
          // bad icon/day flag/timestamp into a plausible-looking current reading.
          return null;
        }
        const wind = current.wind_speed_10m;
        return {
          temperature: Math.round(temperature * 10) / 10,
          weatherCode: code,
          isDay: isDay === 1,
          ...(typeof wind === 'number' && Number.isFinite(wind) && wind >= 0 && wind <= MAX_WIND_SPEED_MS
            ? { windSpeed: wind }
            : {}),
          ...layerReadings(location, current.time),
          observedAt: new Date(observedAtMs).toISOString(),
        };
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (controller.signal.aborted) {
        throw new AppError(504, 'PROVINCES_PROVIDER_TIMEOUT', 'İl sıcaklıkları sağlayıcısı zaman aşımına uğradı.');
      }
      throw new AppError(502, 'PROVINCES_PROVIDER_ERROR', 'İl sıcaklıkları sağlayıcısına ulaşılamadı.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
