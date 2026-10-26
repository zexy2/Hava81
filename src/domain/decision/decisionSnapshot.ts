import type {
  AirQuality,
  AirQualityHourly,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { buildDailyPlan } from './buildDailyPlan';
import { getOptionalEvidenceFreshness } from '../../utils/optionalEvidenceFreshness';
import type { BestWindowRange, DailyPlan } from './types';

/**
 * Faz 1.1 — the single decision snapshot for the city screen.
 *
 * Every surface (hero glance, decision field, daily plan, share text) reads the best window,
 * current condition, next-24h min/max and wind from here, so the same screen can never show
 * contradicting values. Results are memoized per input object identity, so calling it from
 * several components costs one computation.
 */
export interface DecisionSnapshot {
  plan: DailyPlan;
  /**
   * The one recommended window. `undefined` when the near hours are "similar" — the UI must
   * then not print an "en uygun saat" next to a "benzer görünüyor" message.
   */
  bestWindow?: BestWindowRange;
  /** Current condition: always the "now" provider (OpenWeather current), see Faz 1.2. */
  condition: { description: string; icon: string; temperature: number };
  /** Min/max over the next 24 forecast hours (rolling), not the calendar day. */
  next24h: { min: number; max: number } | null;
  /** Current wind in m/s from the "now" provider. */
  windSpeed: number;
}

export interface DecisionSnapshotInput {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  airQualityHourly?: AirQualityHourly;
}

const HOUR_MS = 60 * 60 * 1000;
const NO_AIR = {};
const NO_HOURLY_AIR = {};
interface DecisionSnapshotCacheEntry {
  snapshot: DecisionSnapshot;
  /** Optional AQI evidence makes a snapshot time-dependent; expire it with that evidence. */
  expiresAt: number | null;
}
const cache = new WeakMap<
  NormalizedWeatherData,
  WeakMap<HourlyForecast[], WeakMap<object, WeakMap<object, DecisionSnapshotCacheEntry>>>
>();

const nextOptionalEvidenceExpiry = (input: DecisionSnapshotInput, now: number): number | null => {
  const expiries = [
    getOptionalEvidenceFreshness(input.airQuality?.meta, now).expiresInMs,
    getOptionalEvidenceFreshness(input.airQualityHourly?.meta, now).expiresInMs,
  ].filter((value): value is number => value !== null);
  return expiries.length ? now + Math.min(...expiries) : null;
};

export const next24hRange = (hourly: HourlyForecast[]): { min: number; max: number } | null => {
  if (!hourly.length) return null;
  const sorted = [...hourly].sort((a, b) => a.time.getTime() - b.time.getTime());
  const end = sorted[0].time.getTime() + 24 * HOUR_MS;
  const temps = sorted
    .filter(p => p.time.getTime() < end)
    .map(p => p.temp)
    .filter(Number.isFinite);
  return temps.length ? { min: Math.min(...temps), max: Math.max(...temps) } : null;
};

export const buildDecisionSnapshot = (
  { weather, hourly, airQuality, airQualityHourly }: DecisionSnapshotInput,
  now?: Date
): DecisionSnapshot => {
  const plan = buildDailyPlan({ weather, hourly, airQuality, airQualityHourly, now });
  return {
    plan,
    bestWindow: plan.nowOrLater.kind === 'similar' ? undefined : plan.bestWindowRange,
    condition: {
      description: weather.description,
      icon: weather.icon,
      temperature: weather.temperature,
    },
    next24h: next24hRange(hourly),
    windSpeed: weather.windSpeed,
  };
};

export const getDecisionSnapshot = (input: DecisionSnapshotInput): DecisionSnapshot => {
  const airKey = (input.airQuality as object | undefined) ?? NO_AIR;
  const hourlyAirKey = (input.airQualityHourly as object | undefined) ?? NO_HOURLY_AIR;
  let byHourly = cache.get(input.weather);
  if (!byHourly) cache.set(input.weather, (byHourly = new WeakMap()));
  let byAir = byHourly.get(input.hourly);
  if (!byAir) byHourly.set(input.hourly, (byAir = new WeakMap()));
  let byHourlyAir = byAir.get(airKey);
  if (!byHourlyAir) byAir.set(airKey, (byHourlyAir = new WeakMap()));
  const now = Date.now();
  const cached = byHourlyAir.get(hourlyAirKey);
  if (cached && (cached.expiresAt === null || now < cached.expiresAt)) return cached.snapshot;

  const snapshot = buildDecisionSnapshot(input, new Date(now));
  // "Now" is the forecast step in progress; when the next step starts the plan must be rebuilt.
  const nextSlotStart = snapshot.plan.slots[1]?.time.getTime();
  const expiries = [
    nextOptionalEvidenceExpiry(input, now),
    nextSlotStart !== undefined && nextSlotStart > now ? nextSlotStart : null,
  ].filter((value): value is number => value !== null);
  byHourlyAir.set(hourlyAirKey, {
    snapshot,
    expiresAt: expiries.length ? Math.min(...expiries) : null,
  });
  return snapshot;
};
