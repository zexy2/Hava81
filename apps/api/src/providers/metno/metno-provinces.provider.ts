import { AppError } from '../../core/errors';
import {
  PROVINCE_OUTLOOK_HOURS,
  type ProvinceCurrentObservation,
  type ProvinceCurrentProvider,
  type ProvincePoint,
} from '../openmeteo/openmeteo-provinces.provider';
import { expandToHours, fetchMetNorwayForecast, MET_NORWAY_ATTRIBUTION, round1 } from './metno-client';
import { weatherCodeForSymbol } from './metno-symbols';
import { isDaylightHour } from './solar';

const HOUR_MS = 3_600_000;
// MET Norway asks for fewer than 20 requests/s per application; four in flight at a time
// with ~0.3 s per response keeps 81 provinces well under that and finishes in a few seconds.
const DEFAULT_CONCURRENCY = 4;

export interface MetNorwayProvincesOptions {
  userAgent: string;
  concurrency?: number;
  timeoutMs?: number;
  metBaseUrl?: string;
  now?: () => Date;
}

/**
 * Current conditions for many points, one MET request each. MET has no chance of rain for
 * Turkey, so `precipitationProbability` is left out and the map reads the amount instead;
 * fetching it from OpenWeather for 81 points would exceed the free plan's 60 calls/min.
 */
export class MetNorwayProvincesProvider implements ProvinceCurrentProvider {
  readonly name = 'MET Norway';
  readonly attribution = MET_NORWAY_ATTRIBUTION;
  private readonly now: () => Date;

  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly options: MetNorwayProvincesOptions
  ) {
    this.now = options.now ?? (() => new Date());
  }

  private async observe(point: ProvincePoint, start: number): Promise<ProvinceCurrentObservation | null> {
    try {
      const forecast = await fetchMetNorwayForecast(
        this.fetchImpl,
        this.options.userAgent,
        point.lat,
        point.lon,
        this.options.timeoutMs,
        this.options.metBaseUrl
      );
      const hours = expandToHours(forecast, start);
      const current = hours[0];
      if (!current || current.time !== start) return null;
      const outlook = PROVINCE_OUTLOOK_HOURS.flatMap(hourOffset => {
        const hour = hours.find(candidate => candidate.time === start + hourOffset * HOUR_MS);
        return hour
          ? [{ hourOffset, temperature: round1(hour.temperature), precipitation: round1(hour.precipitationMm) }]
          : [];
      });
      return {
        temperature: round1(current.temperature),
        weatherCode: weatherCodeForSymbol(current.symbol),
        isDay: isDaylightHour(point.lat, point.lon, new Date(current.time)),
        windSpeed: round1(current.windSpeed),
        windDirection: current.windDirection,
        cloudCover: current.cloudCover === undefined ? undefined : Math.round(current.cloudCover),
        precipitation: round1(current.precipitationMm),
        outlook,
        observedAt: new Date(current.time).toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getCurrent(points: readonly ProvincePoint[]): Promise<Array<ProvinceCurrentObservation | null>> {
    const start = Math.floor(this.now().getTime() / HOUR_MS) * HOUR_MS;
    const results: Array<ProvinceCurrentObservation | null> = new Array(points.length).fill(null);
    let next = 0;
    const worker = async () => {
      while (next < points.length) {
        const index = next;
        next += 1;
        results[index] = await this.observe(points[index], start);
      }
    };
    const workers = Math.max(1, Math.min(this.options.concurrency ?? DEFAULT_CONCURRENCY, points.length));
    await Promise.all(Array.from({ length: workers }, worker));
    if (points.length > 0 && results.every(result => result === null)) {
      // Nothing usable: fail so the service keeps serving the last good map from cache.
      throw new AppError(502, 'PROVINCES_PROVIDER_ERROR', 'İl hava durumu sağlayıcısı yanıt vermedi.');
    }
    return results;
  }
}
