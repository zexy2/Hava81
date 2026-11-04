import { z } from 'zod';

// Reads the Copernicus context grid published by scripts/context-grid: the Türkiye window of
// the CAMS European air-quality forecast (dust, pollen; CC BY 4.0) and the Copernicus Marine
// Mediterranean and Black Sea forecasts (waves, sea temperature; free with credit).
// The grid is fetched rarely and held in memory; requests only do array lookups.

const HOUR_MS = 3_600_000;
const DEFAULT_REFRESH_MS = 30 * 60_000;
// After a failed fetch: retry soon, doubling up to the normal refresh interval.
const DEFAULT_RETRY_MS = 2 * 60_000;
// Two missed runs: the job publishes twice a day, so anything older is not today's forecast.
// Applies to the grid build and, separately, to each source's own model run.
const DEFAULT_MAX_AGE_MS = 36 * HOUR_MS;
const DEFAULT_TIMEOUT_MS = 10_000;
// One cell (~28 km at 0.25°) reaches a coastal city's nearest sea or land value without
// carrying pollen far out to sea or waves inland.
const SEARCH_RADIUS_CELLS = 1;

export const CONTEXT_GRID_FIELDS = [
  'dust',
  'grassPollen',
  'olivePollen',
  'waveHeight',
  'waveDirection',
  'wavePeriod',
  'seaSurfaceTemperature',
] as const;
export type ContextGridField = (typeof CONTEXT_GRID_FIELDS)[number];

const sourceSchema = z.object({
  name: z.string().min(1),
  licence: z.string().min(1),
  run: z.string().datetime({ offset: true }).optional(),
  dois: z.array(z.string().min(1)).optional(),
});

const fieldSchema = z.array(z.number().finite().nullable());

const documentSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }),
  grid: z.object({
    lat0: z.number().finite().min(-90).max(90),
    lon0: z.number().finite().min(-180).max(180),
    step: z.number().finite().positive().max(5),
    rows: z.number().int().positive().max(2_000),
    cols: z.number().int().positive().max(2_000),
  }),
  times: z
    .array(z.string().datetime({ offset: true }))
    .min(1)
    .max(240),
  // Every field is always present; a source that failed contributes nulls, not a gap.
  fields: z.object(
    Object.fromEntries(CONTEXT_GRID_FIELDS.map(name => [name, fieldSchema])) as Record<
      ContextGridField,
      typeof fieldSchema
    >
  ),
  units: z.record(z.string(), z.string().min(1)),
  sources: z.array(sourceSchema).min(1),
});

export type ContextGridDocument = z.infer<typeof documentSchema>;

export interface ContextGridSnapshot {
  readonly document: ContextGridDocument;
  readonly times: readonly number[];
}

export interface ContextGridOptions {
  url: string;
  refreshMs?: number;
  /** First retry delay after a failed fetch; doubles on each failure up to `refreshMs`. */
  retryMs?: number;
  maxAgeMs?: number;
  timeoutMs?: number;
  now?: () => Date;
}

/** Hourly series for one field at one point, aligned with the snapshot's `times`. */
export type PointSeries = Array<number | null>;

export type ContextGridSource = ContextGridDocument['sources'][number];

/** Fields each source fills; a source's values are only used while its own run is fresh. */
const CAMS_FIELDS: readonly ContextGridField[] = ['dust', 'grassPollen', 'olivePollen'];
const MARINE_FIELDS: readonly ContextGridField[] = [
  'waveHeight',
  'waveDirection',
  'wavePeriod',
  'seaSurfaceTemperature',
];
export const isMarineSource = (source: ContextGridSource) => /marine/i.test(source.name);
export const isCamsSource = (source: ContextGridSource) => /CAMS|atmosphere/i.test(source.name);

export class CopernicusContextGrid {
  private snapshot: ContextGridSnapshot | null = null;
  /** When the next fetch may start; set from the last attempt, success or failure. */
  private nextAttemptAt = 0;
  private failures = 0;
  private inflight: Promise<ContextGridSnapshot | null> | null = null;
  private readonly now: () => Date;

  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly options: ContextGridOptions
  ) {
    this.now = options.now ?? (() => new Date());
  }

  /** The current grid, or null when it is unavailable, malformed or too old to trust. */
  async current(): Promise<ContextGridSnapshot | null> {
    const now = this.now().getTime();
    if (now < this.nextAttemptAt) return this.fresh(this.snapshot);
    if (!this.inflight) {
      this.inflight = this.load().finally(() => {
        this.inflight = null;
      });
    }
    const loaded = await this.inflight;
    return this.fresh(loaded);
  }

  private fresh(snapshot: ContextGridSnapshot | null) {
    if (!snapshot) return null;
    const age = this.now().getTime() - Date.parse(snapshot.document.generatedAt);
    return age <= this.maxAgeMs ? snapshot : null;
  }

  private get maxAgeMs() {
    return this.options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  }

  /**
   * Whether a source's own model run is recent enough to show its values. A source without a
   * verifiable run time is never fresh: the grid's build time says nothing about the forecast.
   */
  sourceIsFresh(source: ContextGridSource | undefined): source is ContextGridSource & { run: string } {
    if (!source?.run) return false;
    const run = Date.parse(source.run);
    return Number.isFinite(run) && this.now().getTime() - run <= this.maxAgeMs;
  }

  /** Fields whose source run is fresh in this snapshot. */
  freshFields(snapshot: ContextGridSnapshot): Set<ContextGridField> {
    const fields = new Set<ContextGridField>();
    for (const source of snapshot.document.sources) {
      if (!this.sourceIsFresh(source)) continue;
      if (isCamsSource(source)) CAMS_FIELDS.forEach(field => fields.add(field));
      if (isMarineSource(source)) MARINE_FIELDS.forEach(field => fields.add(field));
    }
    return fields;
  }

  private async load(): Promise<ContextGridSnapshot | null> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
    try {
      const response = await this.fetchImpl(this.options.url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
        redirect: 'follow',
      });
      if (!response.ok) return this.keepPrevious();
      const parsed = documentSchema.safeParse(await response.json());
      if (!parsed.success || !shapeMatches(parsed.data)) return this.keepPrevious();
      this.snapshot = {
        document: parsed.data,
        times: parsed.data.times.map(time => Date.parse(time)),
      };
      this.failures = 0;
      this.nextAttemptAt = this.now().getTime() + (this.options.refreshMs ?? DEFAULT_REFRESH_MS);
      return this.snapshot;
    } catch {
      return this.keepPrevious();
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * A failed refresh keeps the last good grid without renewing its age (`fresh` and the source
   * runs still drop it once too old) and retries soon, backing off up to the refresh interval.
   */
  private keepPrevious() {
    const refreshMs = this.options.refreshMs ?? DEFAULT_REFRESH_MS;
    const retryMs = this.options.retryMs ?? DEFAULT_RETRY_MS;
    this.nextAttemptAt = this.now().getTime() + Math.min(refreshMs, retryMs * 2 ** this.failures);
    this.failures += 1;
    return this.snapshot;
  }
}

const shapeMatches = (document: ContextGridDocument) => {
  const cells = document.grid.rows * document.grid.cols;
  const expected = cells * document.times.length;
  const times = document.times.map(time => Date.parse(time));
  if (times.some((time, index) => index > 0 && time - times[index - 1] !== HOUR_MS)) return false;
  return CONTEXT_GRID_FIELDS.every(name => document.fields[name].length === expected);
};

/**
 * The series for `field` at the point: the point's own cell when it has a value, otherwise the
 * nearest cell within one step that does. Null when there is nothing close enough.
 */
export const seriesAt = (
  snapshot: ContextGridSnapshot,
  field: ContextGridField,
  lat: number,
  lon: number
): PointSeries | null => {
  const { grid, fields } = snapshot.document;
  const values = fields[field];
  const row = Math.round((lat - grid.lat0) / grid.step);
  const col = Math.round((lon - grid.lon0) / grid.step);
  const cells = grid.rows * grid.cols;
  const hours = snapshot.times.length;
  const hasValue = (r: number, c: number) => {
    const offset = r * grid.cols + c;
    for (let hour = 0; hour < hours; hour += 1) {
      if (values[hour * cells + offset] !== null) return true;
    }
    return false;
  };

  let best: { r: number; c: number; distance: number } | null = null;
  for (let dr = -SEARCH_RADIUS_CELLS; dr <= SEARCH_RADIUS_CELLS; dr += 1) {
    for (let dc = -SEARCH_RADIUS_CELLS; dc <= SEARCH_RADIUS_CELLS; dc += 1) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= grid.rows || c >= grid.cols || !hasValue(r, c)) continue;
      const cellLat = grid.lat0 + r * grid.step;
      const cellLon = grid.lon0 + c * grid.step;
      const lonScale = Math.cos((lat * Math.PI) / 180);
      const distance = (cellLat - lat) ** 2 + ((cellLon - lon) * lonScale) ** 2;
      if (!best || distance < best.distance) best = { r, c, distance };
    }
  }
  if (!best) return null;
  const offset = best.r * grid.cols + best.c;
  return Array.from({ length: hours }, (_, hour) => values[hour * cells + offset]);
};

/** Index of the grid hour containing `instant`, or -1 when the grid does not cover it. */
export const hourIndexAt = (snapshot: ContextGridSnapshot, instant: number) => {
  const hour = Math.floor(instant / HOUR_MS) * HOUR_MS;
  return snapshot.times.indexOf(hour);
};

/** Highest finite value in hours [start, start + count). */
export const windowMax = (series: PointSeries, start: number, count: number) => {
  let best: number | undefined;
  for (let index = Math.max(0, start); index < Math.min(series.length, start + count); index += 1) {
    const value = series[index];
    if (value !== null && (best === undefined || value > best)) best = value;
  }
  return best;
};

export const round2 = (value: number) => Math.round(value * 100) / 100;
