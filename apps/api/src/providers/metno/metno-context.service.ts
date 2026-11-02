import type { ContextSignals, ContextSignalsSource } from '../../modules/context/context.service';
import { AppError } from '../../core/errors';
import {
  CONTEXT_GRID_FIELDS,
  hourIndexAt,
  isMarineSource,
  round2,
  seriesAt,
  windowMax,
  type ContextGridSnapshot,
  type CopernicusContextGrid,
} from '../copernicus/context-grid';
import { estimatedUvIndex, expandToHours, MET_NORWAY_ATTRIBUTION, MetNorwayTransport } from './metno-client';
import { isDaylightHour } from './solar';

const HOUR_MS = 3_600_000;
const CONTEXT_WINDOW_HOURS = 24;
// Beach and boat plans look up to three days ahead.
const MARINE_HOURLY_LIMIT = 72;

export interface MetNorwayContextOptions {
  userAgent: string;
  timeoutMs?: number;
  metBaseUrl?: string;
  now?: () => Date;
  /** Shared MET client so every provider counts against the same request pace. */
  transport?: MetNorwayTransport;
  /** Copernicus dust, pollen and sea grid; without it only UV is reported. */
  grid?: CopernicusContextGrid;
}

/**
 * Credits for the published grid, in the wording each licence asks for: CAMS (CC BY 4.0)
 * and "Generated using E.U. Copernicus Marine Service Information" with the product DOIs.
 * Sources whose run is not fresh are left out: none of their values are shown.
 */
const gridCredits = (snapshot: ContextGridSnapshot, used: (source: ContextGridSnapshot['document']['sources'][number]) => boolean) =>
  snapshot.document.sources.filter(used).map(source => {
    if (/marine/i.test(source.name)) {
      const links = (source.dois ?? []).map(doi => `https://doi.org/${doi}`).join(', ');
      return `Generated using E.U. Copernicus Marine Service Information${links ? `; ${links}` : ''}`;
    }
    if (/CAMS|atmosphere/i.test(source.name)) {
      return `Contains modified Copernicus Atmosphere Monitoring Service information (${source.name}, ${source.licence})`;
    }
    return `${source.name} (${source.licence})`;
  });

/**
 * Context signals: UV from MET Norway (clear-sky index reduced for cloud), dust and pollen
 * from CAMS, waves and sea temperature from Copernicus Marine. A value is only reported when
 * the grid is fresh and has a cell close to the point; otherwise it stays undefined and the
 * app shows "no data" instead of a calm reading.
 */
export class MetNorwayContextService implements ContextSignalsSource {
  private readonly now: () => Date;
  private readonly transport: MetNorwayTransport;

  constructor(
    fetchImpl: typeof fetch,
    private readonly options: MetNorwayContextOptions
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

  async get(lat: number, lon: number, includeMarine: boolean): Promise<ContextSignals> {
    const nowMs = this.now().getTime();
    const start = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
    // MET (UV) and the Copernicus grid are independent: one being down must not hide the other.
    const [metResult, gridResult] = await Promise.allSettled([
      this.transport.forecast(lat, lon),
      this.options.grid ? this.options.grid.current() : Promise.resolve(null),
    ]);
    const forecast = metResult.status === 'fulfilled' ? metResult.value : null;
    const snapshot = gridResult.status === 'fulfilled' ? gridResult.value : null;
    const grid = this.options.grid;
    const freshFields = snapshot && grid ? grid.freshFields(snapshot) : new Set();
    if (!forecast && freshFields.size === 0) {
      if (metResult.status === 'rejected') throw metResult.reason;
      throw new AppError(502, 'CONTEXT_PROVIDER_ERROR', 'Bağlam verisi şu anda kullanılamıyor.');
    }

    const window = forecast ? expandToHours(forecast, start).slice(0, CONTEXT_WINDOW_HOURS) : [];
    const uvValues = window
      .filter(hour => isDaylightHour(lat, lon, new Date(hour.time)))
      .map(hour => estimatedUvIndex(hour.uvClearSky, hour.cloudCover))
      .filter((value): value is number => value !== undefined);

    const signals: ContextSignals = {
      provider: forecast ? 'MET Norway' : 'Copernicus',
      fetchedAt: new Date().toISOString(),
      // Replaced by the grid credits below; this only stands when MET is the sole source.
      attribution: MET_NORWAY_ATTRIBUTION,
      uvIndexMax: uvValues.length > 0 ? Math.max(...uvValues) : undefined,
      units: {},
    };
    if (!snapshot || freshFields.size === 0) return signals;

    const startIndex = hourIndexAt(snapshot, nowMs);
    if (startIndex < 0) return signals;
    // A field is read only while the source that fills it has a fresh, verifiable model run.
    const series = Object.fromEntries(
      CONTEXT_GRID_FIELDS.map(field => [
        field,
        freshFields.has(field) ? seriesAt(snapshot, field, lat, lon) : null,
      ])
    ) as Record<(typeof CONTEXT_GRID_FIELDS)[number], ReturnType<typeof seriesAt>>;
    const units = snapshot.document.units;
    const peak = (field: 'dust' | 'grassPollen' | 'olivePollen') => {
      const values = series[field];
      const value = values ? windowMax(values, startIndex, CONTEXT_WINDOW_HOURS) : undefined;
      return value === undefined || !units[field] ? undefined : round2(value);
    };

    const dustMax = peak('dust');
    const grassPollenMax = peak('grassPollen');
    const olivePollenMax = peak('olivePollen');
    const usedAir =
      dustMax !== undefined || grassPollenMax !== undefined || olivePollenMax !== undefined;
    if (dustMax !== undefined) {
      signals.dustMax = dustMax;
      signals.units.dust = units.dust;
    }
    if (grassPollenMax !== undefined) {
      signals.grassPollenMax = grassPollenMax;
      signals.units.grassPollen = units.grassPollen;
    }
    if (olivePollenMax !== undefined) {
      signals.olivePollenMax = olivePollenMax;
      signals.units.olivePollen = units.olivePollen;
    }

    let usedMarine = false;
    if (includeMarine) {
      const at = (
        field: 'waveHeight' | 'waveDirection' | 'wavePeriod' | 'seaSurfaceTemperature',
        index: number
      ) => {
        const value = series[field]?.[index];
        return value === null || value === undefined || !units[field] ? undefined : round2(value);
      };
      const current = {
        waveHeight: at('waveHeight', startIndex),
        waveDirection: at('waveDirection', startIndex),
        wavePeriod: at('wavePeriod', startIndex),
        seaSurfaceTemperature: at('seaSurfaceTemperature', startIndex),
      };
      if (current.waveHeight !== undefined || current.seaSurfaceTemperature !== undefined) {
        usedMarine = true;
        const validAt = new Date(snapshot.times[startIndex]).toISOString();
        const marineRun = snapshot.document.sources.find(isMarineSource)?.run;
        signals.marine = {
          // Model values for the current hour, not an in-situ observation. `observedAt` is
          // kept for older clients and carries the same valid time.
          observedAt: validAt,
          validAt,
          ...(marineRun ? { modelRunAt: new Date(marineRun).toISOString() } : {}),
          ...current,
        };
        for (const field of [
          'waveHeight',
          'waveDirection',
          'wavePeriod',
          'seaSurfaceTemperature',
        ] as const) {
          if (current[field] !== undefined) signals.units[field] = units[field];
        }
        const hourly: NonNullable<ContextSignals['marineHourly']> = [];
        const end = Math.min(snapshot.times.length, startIndex + MARINE_HOURLY_LIMIT);
        for (let index = startIndex; index < end; index += 1) {
          const waveHeight = at('waveHeight', index);
          const seaSurfaceTemperature = at('seaSurfaceTemperature', index);
          if (waveHeight === undefined && seaSurfaceTemperature === undefined) continue;
          hourly.push({
            time: new Date(snapshot.times[index]).toISOString(),
            waveHeight,
            seaSurfaceTemperature,
          });
        }
        if (hourly.length > 0) signals.marineHourly = hourly;
      }
    }

    if (usedAir || usedMarine) {
      signals.provider = forecast ? 'MET Norway + Copernicus' : 'Copernicus';
      // Every source with a fresh run is credited, as the grid's licences ask.
      const credits = gridCredits(snapshot, source => grid?.sourceIsFresh(source) ?? false);
      signals.attribution = [...(forecast ? [MET_NORWAY_ATTRIBUTION] : []), ...credits].join(' · ');
    }
    return signals;
  }
}
