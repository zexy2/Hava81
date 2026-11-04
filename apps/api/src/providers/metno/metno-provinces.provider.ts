import { AppError } from '../../core/errors';
import {
  PROVINCE_OUTLOOK_HOURS,
  type ProvinceCurrentObservation,
  type ProvinceCurrentProvider,
  type ProvincePoint,
} from '../openmeteo/openmeteo-provinces.provider';
import { expandToHours, MET_NORWAY_ATTRIBUTION, MetNorwayTransport, modelUpdatedAt, round1 } from './metno-client';
import { weatherCodeForSymbol } from './metno-symbols';
import { isDaylightHour } from './solar';

const HOUR_MS = 3_600_000;
// Requests in flight at a time. The rate itself is held below MET's 20/s by the transport's
// pace, so fast responses cannot push the 81-province refresh over the limit.
const DEFAULT_CONCURRENCY = 4;

export interface MetNorwayProvincesOptions {
  userAgent: string;
  concurrency?: number;
  timeoutMs?: number;
  metBaseUrl?: string;
  now?: () => Date;
  /** Requests started per second when this provider builds its own transport. */
  maxRequestsPerSecond?: number;
  /** Shared MET client so every provider counts against the same request pace. */
  transport?: MetNorwayTransport;
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
  private readonly transport: MetNorwayTransport;

  constructor(
    fetchImpl: typeof fetch,
    private readonly options: MetNorwayProvincesOptions
  ) {
    this.now = options.now ?? (() => new Date());
    this.transport =
      options.transport ??
      new MetNorwayTransport(fetchImpl, {
        userAgent: options.userAgent,
        timeoutMs: options.timeoutMs,
        metBaseUrl: options.metBaseUrl,
        maxRequestsPerSecond: options.maxRequestsPerSecond,
      });
  }

  private async observe(point: ProvincePoint, start: number): Promise<ProvinceCurrentObservation | null> {
    try {
      const forecast = await this.transport.forecast(point.lat, point.lon);
      const hours = expandToHours(forecast, start);
      const current = hours[0];
      if (!current || current.time !== start) return null;
      // An unknown or missing symbol leaves the province blank rather than guessing a category.
      const weatherCode = current.symbol === undefined ? null : weatherCodeForSymbol(current.symbol);
      if (weatherCode === null) return null;
      const validAt = new Date(current.time).toISOString();
      const updatedAt = modelUpdatedAt(forecast);
      const ownHourAmount =
        current.periodHours === 1 && current.precipitationMm !== undefined
          ? Math.round(current.precipitationMm * 100) / 100
          : undefined;
      const outlook = PROVINCE_OUTLOOK_HOURS.flatMap(hourOffset => {
        const hour = hours.find(candidate => candidate.time === start + hourOffset * HOUR_MS);
        return hour
          ? [
              {
                hourOffset,
                temperature: round1(hour.temperature),
                ...(hour.precipitationMm === undefined ? {} : { precipitation: round1(hour.precipitationMm) }),
              },
            ]
          : [];
      });
      return {
        temperature: round1(current.temperature),
        weatherCode,
        isDay: isDaylightHour(point.lat, point.lon, new Date(current.time)),
        windSpeed: round1(current.windSpeed),
        windDirection: current.windDirection,
        cloudCover: current.cloudCover === undefined ? undefined : Math.round(current.cloudCover),
        // The coming hour's forecast amount (MET has no observed past hour); see the period.
        ...(ownHourAmount === undefined ? {} : { precipitation: round1(ownHourAmount) }),
        ...(ownHourAmount === undefined
          ? {}
          : {
              precipitationPeriod: {
                amountMm: ownHourAmount,
                validFrom: validAt,
                validTo: new Date(current.time + HOUR_MS).toISOString(),
              },
            }),
        outlook,
        observedAt: validAt,
        validAt,
        ...(updatedAt ? { modelUpdatedAt: updatedAt } : {}),
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
