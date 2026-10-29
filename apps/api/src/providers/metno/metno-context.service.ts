import type { ContextSignals, ContextSignalsSource } from '../../modules/context/context.service';
import { estimatedUvIndex, expandToHours, fetchMetNorwayForecast, MET_NORWAY_ATTRIBUTION } from './metno-client';
import { isDaylightHour } from './solar';

const HOUR_MS = 3_600_000;
const CONTEXT_WINDOW_HOURS = 24;

export interface MetNorwayContextOptions {
  userAgent: string;
  timeoutMs?: number;
  metBaseUrl?: string;
  now?: () => Date;
}

/**
 * Context signals from MET Norway. Only UV is available: MET publishes no dust or pollen,
 * and its ocean forecast covers Norwegian waters only. Those stay `undefined`, which the
 * app already renders as "no data" rather than as a calm reading.
 */
export class MetNorwayContextService implements ContextSignalsSource {
  private readonly now: () => Date;

  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly options: MetNorwayContextOptions
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async get(lat: number, lon: number, _includeMarine: boolean): Promise<ContextSignals> {
    const start = Math.floor(this.now().getTime() / HOUR_MS) * HOUR_MS;
    const forecast = await fetchMetNorwayForecast(
      this.fetchImpl,
      this.options.userAgent,
      lat,
      lon,
      this.options.timeoutMs,
      this.options.metBaseUrl
    );
    const window = expandToHours(forecast, start).slice(0, CONTEXT_WINDOW_HOURS);
    const uvValues = window
      .filter(hour => isDaylightHour(lat, lon, new Date(hour.time)))
      .map(hour => estimatedUvIndex(hour.uvClearSky, hour.cloudCover))
      .filter((value): value is number => value !== undefined);
    return {
      provider: 'MET Norway',
      fetchedAt: new Date().toISOString(),
      attribution: MET_NORWAY_ATTRIBUTION,
      uvIndexMax: uvValues.length > 0 ? Math.max(...uvValues) : undefined,
      units: {},
    };
  }
}
