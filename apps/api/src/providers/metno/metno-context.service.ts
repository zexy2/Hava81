import type { ContextSignals, ContextSignalsSource } from '../../modules/context/context.service';
import { estimatedUvIndex, expandToHours, MET_NORWAY_ATTRIBUTION, MetNorwayTransport, modelUpdatedAt } from './metno-client';
import { isDaylightHour } from './solar';

const HOUR_MS = 3_600_000;
const CONTEXT_WINDOW_HOURS = 24;

export interface MetNorwayContextOptions {
  userAgent: string;
  timeoutMs?: number;
  metBaseUrl?: string;
  now?: () => Date;
  /** Shared MET client so every provider counts against the same request pace. */
  transport?: MetNorwayTransport;
}

/**
 * Context signals from MET Norway. Only UV is available: MET publishes no dust or pollen,
 * and its ocean forecast covers Norwegian waters only. Those stay `undefined`, which the
 * app already renders as "no data" rather than as a calm reading.
 */
export class MetNorwayContextService implements ContextSignalsSource {
  private readonly now: () => Date;
  private readonly transport: MetNorwayTransport;

  constructor(
    fetchImpl: typeof fetch,
    options: MetNorwayContextOptions
  ) {
    this.now = options.now ?? (() => new Date());
    this.transport =
      options.transport ??
      new MetNorwayTransport(fetchImpl, {
        userAgent: options.userAgent,
        timeoutMs: options.timeoutMs,
        metBaseUrl: options.metBaseUrl,
      });
  }

  async get(lat: number, lon: number, _includeMarine: boolean): Promise<ContextSignals> {
    const start = Math.floor(this.now().getTime() / HOUR_MS) * HOUR_MS;
    const forecast = await this.transport.forecast(lat, lon);
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
      ...(forecast && modelUpdatedAt(forecast) ? { modelUpdatedAt: modelUpdatedAt(forecast) } : {}),
      units: {},
    };
  }
}
