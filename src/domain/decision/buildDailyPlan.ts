import type {
  AirQuality,
  AirQualityHourly,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { getDailyPlanAirQualityEvidence } from './airQualityEvidence';
import { assessEvenDay, findBestWindowRange } from './bestWindowRange';
import { explainContrast, explainWindow } from './explain';
import { isRecommendableHour } from './eligibility';
import { airLevel, rainLevel, windLevel } from './thresholds';
import {
  aggregateHorizonScore,
  dropElapsedSlots,
  forecastCadenceMs,
  rainScenarioRange,
  weightHorizonSlots,
  type WeightedHorizonSlot,
} from './aggregateHorizon';
import { getScoreBand, scoreWeatherWindow } from './scoreWeatherWindow';
import type {
  AirQualityAdvice,
  BestWindowRange,
  DailyPlan,
  Hava81ScoreFactor,
  NowOrLaterAdvice,
  ScoreConfidence,
  ScoreFactorImpact,
  ScoredWeatherWindow,
  UmbrellaAdvice,
  WindAdvice,
} from './types';

export interface BuildDailyPlanInput {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  airQualityHourly?: AirQualityHourly;
  /** Clock used to drop forecast steps that already ended. UI callers pass the live clock. */
  now?: Date;
}

const HOUR_MS = 60 * 60 * 1000;
// One horizon for every Gün planı verdict (score, best window, now/later, umbrella, wind),
// plan v3 Faz 0.5 (L6).
const SCORE_HORIZON_HOURS = 12;

const byTime = <T extends { time: Date }>(a: T, b: T) => a.time.getTime() - b.time.getTime();

const withinHours = (slots: ScoredWeatherWindow[], hours: number) => {
  const first = slots[0];
  if (!first) return [];
  const end = first.time.getTime() + hours * HOUR_MS;
  const selected = slots.filter(slot => slot.time.getTime() < end);
  return selected.length ? selected : [first];
};

const aggregateImpacts = (
  entries: WeightedHorizonSlot<ScoredWeatherWindow>[]
): ScoreFactorImpact[] => {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weightHours, 0);
  if (totalWeight <= 0) return [];
  const totals = new Map<Hava81ScoreFactor, number>();
  entries.forEach(({ slot, weightHours }) => {
    slot.impacts.forEach(impact => {
      totals.set(impact.factor, (totals.get(impact.factor) ?? 0) + impact.penalty * weightHours);
    });
  });
  return [...totals.entries()]
    .map(([factor, total]) => ({ factor, penalty: Math.round((total / totalWeight) * 10) / 10 }))
    .filter(impact => impact.penalty >= 0.5)
    .sort((a, b) => b.penalty - a.penalty);
};

const confidenceFor = (slots: ScoredWeatherWindow[]): ScoreConfidence => {
  if (!slots.length) return 'basic';
  const coverage = slots.map(slot => {
    const hasPrecipitationEvidence =
      Number.isFinite(slot.precipitationProbability) || Number.isFinite(slot.precipitationMm);
    // Apparent temperature is derived from other inputs and is not an independent signal.
    const richness = [
      slot.humidity,
      slot.precipitationMm,
      slot.windGust,
      slot.uvIndex,
      slot.visibility,
      slot.weatherCode,
    ].filter(value => Number.isFinite(value)).length;
    return { richness, hasPrecipitationEvidence };
  });
  // A rich payload without either rain probability or amount cannot support a high-confidence
  // outdoor recommendation: unknown precipitation must not silently count as dry.
  const richShare =
    coverage.filter(
      ({ richness, hasPrecipitationEvidence }) => hasPrecipitationEvidence && richness >= 6
    ).length / slots.length;
  const usefulShare =
    coverage.filter(
      ({ richness, hasPrecipitationEvidence }) => hasPrecipitationEvidence && richness >= 4
    ).length / slots.length;
  if (richShare >= 0.7) return 'high';
  if (usefulShare >= 0.5) return 'medium';
  return 'basic';
};

const pickUmbrellaAdvice = (slots: ScoredWeatherWindow[]): UmbrellaAdvice => {
  const near = withinHours(slots, SCORE_HORIZON_HOURS);
  const probabilities = near
    .map(slot => slot.precipitationProbability)
    .filter((value): value is number => Number.isFinite(value));
  const amounts = near
    .map(slot => slot.precipitationMm)
    .filter((value): value is number => Number.isFinite(value));
  const level = rainLevel(
    probabilities.length ? Math.max(...probabilities) : undefined,
    amounts.length ? Math.max(...amounts) : undefined
  );
  if (!level) return 'unknown';
  return level === 'likely' ? 'yes' : level === 'possible' ? 'maybe' : 'no';
};

const pickWindAdvice = (slots: ScoredWeatherWindow[]): WindAdvice => {
  const near = withinHours(slots, SCORE_HORIZON_HOURS);
  const level = windLevel(
    Math.max(0, ...near.map(slot => slot.windSpeed)),
    Math.max(0, ...near.map(slot => slot.windGust ?? 0))
  );
  return level === 'strong' ? 'strong' : level === 'caution' ? 'caution' : 'normal';
};

/**
 * The air-quality card describes the same horizon as the score: the worst known index among
 * the current fresh reading and the exact-hour forecast values inside the horizon.
 */
const pickAirQualityAdvice = (slotAqi: readonly (number | undefined)[]): AirQualityAdvice => {
  const known = slotAqi.filter((value): value is number => Number.isFinite(value));
  if (!known.length) return 'unknown';
  const worst = Math.max(...known);
  const level = airLevel(worst);
  if (!level) return 'unknown';
  if (level === 'poor' || level === 'very-poor') return 'poor';
  if (level === 'sensitive') return 'sensitive';
  return worst >= 2 ? 'fair' : 'good';
};

const LATER_MIN_IMPROVEMENT = 10;

/**
 * Plan v3 Faz 0.5: "now or later" is derived from the same 12-hour best window the UI shows,
 * so "Şu an uygun" and "en uygun 22:00–02:00" can never appear together (L6).
 * - now: the best window contains the current slot and the current slot is in a good band;
 * - later: the best window is ahead and either clearly better (≥ 10) or the current hour is
 *   not recommendable at all (e.g. 01:00 for the walking rule), targeting the window start;
 * - similar: otherwise (no window is promoted).
 */
const buildNowOrLater = (
  slots: ScoredWeatherWindow[],
  bestWindowRange: BestWindowRange | undefined,
  isEligible: (slot: ScoredWeatherWindow) => boolean = () => true
): NowOrLaterAdvice => {
  const current = slots[0];
  if (!current) {
    return { kind: 'similar', currentScore: 0, targetScore: 0, reasons: [] };
  }
  if (!bestWindowRange) {
    return {
      kind: 'similar',
      currentScore: current.score,
      targetScore: current.score,
      reasons: current.reasons,
    };
  }

  const { start, endTime, peak } = bestWindowRange;
  const currentMs = current.time.getTime();
  const containsCurrent = start.time.getTime() <= currentMs && currentMs < endTime.getTime();
  const improvement = peak.score - current.score;
  const goodNow = current.band === 'excellent' || current.band === 'good';

  if (containsCurrent && goodNow) {
    return {
      kind: 'now',
      targetTime: current.time,
      improvement: 0,
      currentScore: current.score,
      targetScore: peak.score,
      reasons: current.reasons,
    };
  }

  if (!containsCurrent && (improvement >= LATER_MIN_IMPROVEMENT || !isEligible(current))) {
    return {
      kind: 'later',
      targetTime: start.time,
      improvement: Math.max(0, improvement),
      currentScore: current.score,
      targetScore: peak.score,
      reasons: current.reasons,
    };
  }

  return {
    kind: 'similar',
    targetTime: peak.time,
    improvement: Math.max(0, improvement),
    currentScore: current.score,
    targetScore: peak.score,
    reasons: current.reasons,
  };
};

export const buildDailyPlan = ({
  weather,
  hourly,
  airQuality,
  airQualityHourly,
  now,
}: BuildDailyPlanInput): DailyPlan => {
  const valid = [...hourly]
    .filter(point => point.time instanceof Date && Number.isFinite(point.time.getTime()))
    .sort(byTime);
  // "Now" must be the step in progress, never a cached hour that already ended.
  const source = dropElapsedSlots(valid, now).slice(0, 24);
  const airQualityEvidence = getDailyPlanAirQualityEvidence({
    forecastTimes: source.length ? source.map(point => point.time) : [weather.timestamp],
    airQuality,
    airQualityHourly,
    now: now?.getTime(),
  });
  // Prefer a fresh exact-hour European AQI sample. The current reading is only a fallback
  // while fresh; never interpolate timestamps or project stale evidence into future hours.
  const slotAqi = source.length
    ? source.map(
        point =>
          airQualityEvidence.hourlyAqiByTime.get(point.time.getTime()) ??
          airQualityEvidence.currentAirQuality?.aqi
      )
    : [airQualityEvidence.currentAirQuality?.aqi];
  const scorePoint = (point: HourlyForecast, airQualityIndex: number | undefined) =>
    scoreWeatherWindow({
      time: point.time,
      temperature: point.temp,
      apparentTemperature: point.apparentTemperature,
      humidity: point.humidity,
      precipitationProbability: point.pop,
      precipitationMm: point.precipitationMm,
      windSpeed: point.windSpeed,
      windGust: point.windGust,
      airQualityIndex,
      uvIndex: point.uvIndex,
      visibility: point.visibility,
      weatherCode: point.weatherCode,
    });
  const slots = source.length
    ? source.map((point, index) => scorePoint(point, slotAqi[index]))
    : [
        scoreWeatherWindow({
          time: weather.timestamp,
          temperature: weather.temperature,
          apparentTemperature: weather.feelsLike,
          humidity: weather.humidity,
          windSpeed: weather.windSpeed,
          airQualityIndex: slotAqi[0],
          visibility: weather.visibility,
        }),
      ];

  // Plan v3 Faz 0.3: the general plan follows the walking rule (07–23 local). The fallback
  // single "now" slot (no hourly data) is not filtered.
  const timezoneOffsetSeconds = weather.meta.timezoneOffsetSeconds;
  const eligibleSlots = new WeakSet<ScoredWeatherWindow>(
    source.length
      ? slots.filter((slot, index) =>
          isRecommendableHour(
            { time: slot.time, isDay: source[index]?.isDay, icon: source[index]?.icon },
            timezoneOffsetSeconds
          )
        )
      : slots
  );
  const isEligible = (slot: ScoredWeatherWindow) => eligibleSlots.has(slot);

  const horizonSlots = withinHours(slots, SCORE_HORIZON_HOURS);
  const horizonEndMs = slots[0].time.getTime() + SCORE_HORIZON_HOURS * HOUR_MS;
  // The score answers "how good are the hours you could actually use?": it reads the same
  // recommendable hours the best window is chosen from, so 03:00 cold cannot drag down an
  // evening plan. Umbrella and wind advice keep every hour, because the walk home still counts.
  const eligibleHorizon = horizonSlots.filter(isEligible);
  const scoringSlots = eligibleHorizon.length ? eligibleHorizon : horizonSlots;
  const cadenceMs = forecastCadenceMs(slots);
  const weighted = weightHorizonSlots(scoringSlots, horizonEndMs, cadenceMs);
  const score = aggregateHorizonScore(weighted);
  // "Depends on the rain": the same scoring hours under both outcomes of the open showers.
  const indexOf = new Map(slots.map((slot, index) => [slot, index]));
  const scoringPoints = source.length
    ? scoringSlots.map(slot => ({
        ...source[indexOf.get(slot)!],
        aqi: slotAqi[indexOf.get(slot)!],
      }))
    : [];
  const scoreRange = rainScenarioRange(
    scoringPoints,
    point => scorePoint(point, point.aqi).score,
    horizonEndMs,
    cadenceMs
  );

  const bestWindowRange = findBestWindowRange(horizonSlots, undefined, isEligible);
  const bestWindow = bestWindowRange?.peak;
  const evenDay = assessEvenDay(horizonSlots, undefined, isEligible);
  // On an even day the "why" names what makes the weak hours weaker, not why a window won.
  const weakSet = new Set(evenDay.weakSlots);
  const explanation = evenDay.even
    ? bestWindowRange
      ? explainContrast(
          scoringSlots.filter(slot => !weakSet.has(slot)),
          evenDay.weakSlots,
          bestWindowRange.peak
        )
      : undefined
    : bestWindowRange
      ? explainWindow(bestWindowRange, scoringSlots)
      : undefined;

  return {
    score,
    band: getScoreBand(score),
    slots,
    bestWindow,
    bestWindowRange,
    umbrella: pickUmbrellaAdvice(slots),
    wind: pickWindAdvice(slots),
    airQuality: pickAirQualityAdvice(slotAqi.slice(0, horizonSlots.length)),
    // The verdict itself is shared with Today; `evenDay` only changes how Planla words it.
    nowOrLater: buildNowOrLater(slots, bestWindowRange, isEligible),
    ...(evenDay.even ? { evenDay: { weakSlots: evenDay.weakSlots } } : {}),
    impacts: aggregateImpacts(weighted),
    // Confidence must describe the same forecast horizon that contributes to the score.
    confidence: confidenceFor(weighted.map(entry => entry.slot)),
    explanation,
    scoreRange,
  };
};
