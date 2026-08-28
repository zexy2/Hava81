import type { AirQuality, HourlyForecast, NormalizedWeatherData } from "../../types";
import { getScoreBand, scoreWeatherWindow } from "./scoreWeatherWindow";
import type {
  AirQualityAdvice,
  DailyPlan,
  Hava81ScoreFactor,
  NowOrLaterAdvice,
  ScoreConfidence,
  ScoreFactorImpact,
  ScoredWeatherWindow,
  UmbrellaAdvice,
  WindAdvice,
} from "./types";

export interface BuildDailyPlanInput {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
}

const HOUR_MS = 60 * 60 * 1000;
const SCORE_HORIZON_HOURS = 12;
const NEAR_TERM_HOURS = 6;

interface WeightedSlot {
  slot: ScoredWeatherWindow;
  weightHours: number;
}

const byTime = <T extends { time: Date }>(a: T, b: T) => a.time.getTime() - b.time.getTime();

const withinHours = (slots: ScoredWeatherWindow[], hours: number) => {
  const first = slots[0];
  if (!first) return [];
  const end = first.time.getTime() + hours * HOUR_MS;
  const selected = slots.filter(slot => slot.time.getTime() < end);
  return selected.length ? selected : [first];
};

const buildWeightedSlots = (slots: ScoredWeatherWindow[], horizonHours: number): WeightedSlot[] => {
  const selected = withinHours(slots, horizonHours);
  const first = selected[0];
  if (!first) return [];
  if (selected.length === 1) return [{ slot: first, weightHours: horizonHours }];

  const horizonEnd = first.time.getTime() + horizonHours * HOUR_MS;
  return selected.map((slot, index) => {
    const current = slot.time.getTime();
    const next = selected[index + 1]?.time.getTime() ?? horizonEnd;
    const effectiveEnd = Math.min(Math.max(next, current), horizonEnd);
    return { slot, weightHours: Math.max(0.01, (effectiveEnd - current) / HOUR_MS) };
  });
};

const weightedAverage = (entries: WeightedSlot[]) => {
  const total = entries.reduce((sum, entry) => sum + entry.weightHours, 0);
  if (total <= 0) return 0;
  return entries.reduce((sum, entry) => sum + entry.slot.score * entry.weightHours, 0) / total;
};

const weightedDownsideAverage = (entries: WeightedSlot[], fraction = 0.25) => {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weightHours, 0);
  const targetWeight = Math.max(0.25, totalWeight * fraction);
  let remaining = targetWeight;
  let sum = 0;
  let used = 0;

  for (const entry of [...entries].sort((a, b) => a.slot.score - b.slot.score)) {
    if (remaining <= 0) break;
    const weight = Math.min(entry.weightHours, remaining);
    sum += entry.slot.score * weight;
    used += weight;
    remaining -= weight;
  }
  return used > 0 ? sum / used : weightedAverage(entries);
};

const aggregateImpacts = (entries: WeightedSlot[]): ScoreFactorImpact[] => {
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
  if (!slots.length) return "basic";
  const richness = slots.map(slot =>
    [
      slot.apparentTemperature,
      slot.humidity,
      slot.precipitationMm,
      slot.windGust,
      slot.uvIndex,
      slot.visibility,
      slot.weatherCode,
    ].filter(value => Number.isFinite(value)).length
  );
  const richShare = richness.filter(count => count >= 6).length / slots.length;
  const usefulShare = richness.filter(count => count >= 4).length / slots.length;
  if (richShare >= 0.7) return "high";
  if (usefulShare >= 0.5) return "medium";
  return "basic";
};

const pickUmbrellaAdvice = (slots: ScoredWeatherWindow[]): UmbrellaAdvice => {
  const near = withinHours(slots, NEAR_TERM_HOURS);
  const maxPop = Math.max(0, ...near.map(slot => slot.precipitationProbability));
  const maxMm = Math.max(0, ...near.map(slot => slot.precipitationMm ?? 0));
  if (maxMm >= 1 || maxPop >= 0.55) return "yes";
  if (maxMm >= 0.2 || maxPop >= 0.25) return "maybe";
  return "no";
};

const pickWindAdvice = (slots: ScoredWeatherWindow[]): WindAdvice => {
  const near = withinHours(slots, NEAR_TERM_HOURS);
  const maxWind = Math.max(0, ...near.map(slot => slot.windSpeed));
  const maxGust = Math.max(0, ...near.map(slot => slot.windGust ?? 0));
  if (maxWind >= 13 || maxGust >= 20) return "strong";
  if (maxWind >= 8 || maxGust >= 13) return "caution";
  return "normal";
};

const pickAirQualityAdvice = (airQuality?: AirQuality): AirQualityAdvice => {
  if (!airQuality) return "unknown";
  if (airQuality.aqi >= 4) return "poor";
  if (airQuality.aqi >= 3) return "sensitive";
  return "good";
};

const buildNowOrLater = (slots: ScoredWeatherWindow[]): NowOrLaterAdvice => {
  const near = withinHours(slots, NEAR_TERM_HOURS);
  const current = near[0];
  if (!current) {
    return { kind: "similar", currentScore: 0, targetScore: 0, reasons: [] };
  }
  const bestLater = near.slice(1).reduce<ScoredWeatherWindow | undefined>(
    (best, slot) => (!best || slot.score > best.score ? slot : best),
    undefined
  );
  if (!bestLater) {
    return {
      kind: "similar",
      currentScore: current.score,
      targetScore: current.score,
      reasons: current.reasons,
    };
  }

  const improvement = bestLater.score - current.score;
  if (improvement >= 10) {
    return {
      kind: "later",
      targetTime: bestLater.time,
      improvement,
      currentScore: current.score,
      targetScore: bestLater.score,
      reasons: current.reasons,
    };
  }

  if (current.score - bestLater.score >= 8 || (current.score >= 88 && improvement <= 3)) {
    return {
      kind: "now",
      targetTime: current.time,
      improvement: current.score - bestLater.score,
      currentScore: current.score,
      targetScore: bestLater.score,
      reasons: bestLater.reasons,
    };
  }

  return {
    kind: "similar",
    targetTime: bestLater.time,
    improvement: Math.max(0, improvement),
    currentScore: current.score,
    targetScore: bestLater.score,
    reasons: current.reasons,
  };
};

export const buildDailyPlan = ({ weather, hourly, airQuality }: BuildDailyPlanInput): DailyPlan => {
  const source = [...hourly].sort(byTime).slice(0, 24);
  const slots = source.length
    ? source.map(point =>
        scoreWeatherWindow({
          time: point.time,
          temperature: point.temp,
          apparentTemperature: point.apparentTemperature,
          humidity: point.humidity ?? weather.humidity,
          precipitationProbability: point.pop,
          precipitationMm: point.precipitationMm,
          windSpeed: point.windSpeed ?? weather.windSpeed,
          windGust: point.windGust,
          airQualityIndex: airQuality?.aqi,
          uvIndex: point.uvIndex,
          visibility: point.visibility,
          weatherCode: point.weatherCode,
        })
      )
    : [
        scoreWeatherWindow({
          time: weather.timestamp,
          temperature: weather.temperature,
          apparentTemperature: weather.feelsLike,
          humidity: weather.humidity,
          precipitationProbability: 0,
          windSpeed: weather.windSpeed,
          airQualityIndex: airQuality?.aqi,
          visibility: weather.visibility,
        }),
      ];

  const weighted = buildWeightedSlots(slots, SCORE_HORIZON_HOURS);
  const meanScore = weightedAverage(weighted);
  const downsideScore = weightedDownsideAverage(weighted);
  let score = Math.round(meanScore * 0.78 + downsideScore * 0.22);
  const minimumScore = Math.min(...weighted.map(entry => entry.slot.score));
  if (minimumScore <= 25) score = Math.min(score, 55);
  else if (minimumScore <= 40) score = Math.min(score, 65);

  const bestWindow = withinHours(slots, SCORE_HORIZON_HOURS).reduce<ScoredWeatherWindow | undefined>(
    (best, slot) => (!best || slot.score > best.score ? slot : best),
    undefined
  );

  return {
    score,
    band: getScoreBand(score),
    slots,
    bestWindow,
    umbrella: pickUmbrellaAdvice(slots),
    wind: pickWindAdvice(slots),
    airQuality: pickAirQualityAdvice(airQuality),
    nowOrLater: buildNowOrLater(slots),
    impacts: aggregateImpacts(weighted),
    confidence: confidenceFor(slots),
  };
};
