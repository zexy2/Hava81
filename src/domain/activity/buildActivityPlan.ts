import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../../types';
import { findBestWindowRange } from '../decision/bestWindowRange';
import { getScoreBand, scoreWeatherWindow } from '../decision/scoreWeatherWindow';
import type { DecisionReasonCode } from '../decision/types';
import type {
  ActivityKind,
  ActivityPlan,
  ActivityWindowScore,
  TemperatureSensitivity,
} from './types';

const HOUR_MS = 60 * 60 * 1000;
const HORIZON_HOURS = 12;

export const ACTIVITY_COMFORT_RANGES_C: Partial<
  Record<ActivityKind, readonly [number, number]>
> = {
  walk: [12, 26],
  run: [10, 22],
  picnic: [16, 27],
  children: [14, 25],
};
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const unit = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (value: number, start: number, end: number) => {
  const t = unit((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

interface ActivityAdjustmentInput {
  activity: ActivityKind;
  temperature: number;
  pop: number;
  precipitationMm?: number;
  wind?: number;
  gust?: number;
  aqi?: number;
  humidity?: number;
  uvIndex?: number;
  visibility?: number;
  sensitivity: TemperatureSensitivity;
}

const rainExposure = (pop: number, precipitationMm?: number) => {
  const chance = smoothstep(pop, 0.15, 0.85) * 0.72;
  const amount = Number.isFinite(precipitationMm)
    ? smoothstep(precipitationMm as number, 0.1, 5)
    : 0;
  return Math.max(chance, amount);
};

const windExposure = (wind?: number, gust?: number) => {
  const hasWind = Number.isFinite(wind);
  const hasGust = Number.isFinite(gust);
  if (!hasWind && !hasGust) return { effective: undefined, exposure: 0 };
  const effective = Math.max(
    hasWind ? (wind as number) : 0,
    hasGust ? (gust as number) * 0.72 : 0
  );
  return { effective, exposure: smoothstep(effective, 6, 18) };
};

const airExposure = (aqi?: number) =>
  Number.isFinite(aqi) ? smoothstep(aqi as number, 2, 5) : 0;

const uvExposure = (uvIndex?: number) =>
  Number.isFinite(uvIndex) ? smoothstep(uvIndex as number, 3, 11) : 0;

const lowVisibilityExposure = (visibility?: number) =>
  Number.isFinite(visibility)
    ? smoothstep(5000 - Math.max(0, visibility as number), 0, 4800)
    : 0;

const activityAdjustment = ({
  activity,
  temperature,
  pop,
  precipitationMm,
  wind,
  gust,
  aqi,
  humidity,
  uvIndex,
  visibility,
  sensitivity,
}: ActivityAdjustmentInput) => {
  let penalty = 0;
  let benefit = 0;
  const reasons: DecisionReasonCode[] = [];
  const rain = rainExposure(pop, precipitationMm);
  const { effective: effectiveWind, exposure: windRisk } = windExposure(wind, gust);
  const air = airExposure(aqi);
  const uv = uvExposure(uvIndex);
  const visibilityRisk = lowVisibilityExposure(visibility);
  const heatShift = sensitivity === 'heat' ? -3 : sensitivity === 'cold' ? 2 : 0;
  const coldShift = sensitivity === 'cold' ? 3 : sensitivity === 'heat' ? -2 : 0;

  const addHeat = (start: number, end: number, maxPenalty: number) => {
    const penaltyValue = maxPenalty * smoothstep(temperature, start + heatShift, end + heatShift);
    penalty += penaltyValue;
    if (penaltyValue >= 8) reasons.push(temperature >= end + heatShift - 1 ? 'extreme-heat' : 'heat');
  };
  const addCold = (start: number, end: number, maxPenalty: number) => {
    const penaltyValue = maxPenalty * smoothstep(start + coldShift - temperature, 0, start - end);
    penalty += penaltyValue;
    if (penaltyValue >= 7) reasons.push(temperature <= end + 1 ? 'freezing' : 'cold');
  };
  const addRain = (maxPenalty: number) => {
    const penaltyValue = maxPenalty * rain;
    penalty += penaltyValue;
    if (penaltyValue >= 7) reasons.push((precipitationMm ?? 0) >= 2.5 || pop >= 0.6 ? 'heavy-rain' : 'rain-risk');
  };
  const addWind = (maxPenalty: number) => {
    const penaltyValue = maxPenalty * windRisk;
    penalty += penaltyValue;
    if (penaltyValue >= 7) reasons.push((effectiveWind ?? 0) >= 13 ? 'strong-wind' : 'windy');
  };
  const addAir = (maxPenalty: number) => {
    const penaltyValue = maxPenalty * air;
    penalty += penaltyValue;
    if (penaltyValue >= 7) reasons.push((aqi ?? 0) >= 4 ? 'poor-air-quality' : 'sensitive-air-quality');
  };
  const addUv = (maxPenalty: number) => {
    const penaltyValue = maxPenalty * uv;
    penalty += penaltyValue;
    if (penaltyValue >= 6) reasons.push('high-uv');
  };

  switch (activity) {
    case 'run':
      addHeat(24, 36, 22);
      addCold(8, -5, 10);
      addRain(14);
      addWind(14);
      addAir(20);
      addUv(8);
      if (
        temperature >= 10 &&
        temperature <= 22 &&
        rain < 0.12 &&
        effectiveWind !== undefined &&
        effectiveWind < 7 &&
        air < 0.2
      ) {
        benefit += 6;
      }
      break;
    case 'walk':
      addHeat(27, 38, 11);
      addCold(7, -5, 7);
      addRain(9);
      addWind(8);
      addAir(10);
      addUv(5);
      if (
        temperature >= 12 &&
        temperature <= 26 &&
        rain < 0.18 &&
        effectiveWind !== undefined &&
        effectiveWind < 8
      ) benefit += 4;
      break;
    case 'picnic':
      addHeat(28, 39, 14);
      addCold(10, 0, 12);
      addRain(28);
      addWind(22);
      addAir(8);
      addUv(9);
      if (
        temperature >= 16 &&
        temperature <= 27 &&
        rain < 0.08 &&
        effectiveWind !== undefined &&
        effectiveWind < 7
      ) benefit += 7;
      break;
    case 'children':
      addHeat(26, 37, 24);
      addCold(10, 0, 15);
      addRain(14);
      addWind(13);
      addAir(24);
      addUv(13);
      if (temperature >= 14 && temperature <= 25 && rain < 0.12 && air < 0.15) benefit += 5;
      break;
    case 'motorcycle':
      addHeat(34, 43, 8);
      addCold(8, -3, 12);
      addRain(34);
      addWind(34);
      if (visibilityRisk > 0) {
        const penaltyValue = 22 * visibilityRisk;
        penalty += penaltyValue;
        if (penaltyValue >= 7) reasons.push('low-visibility');
      }
      break;
    case 'laundry': {
      addRain(42);
      const humidityPenalty = Number.isFinite(humidity)
        ? 18 * smoothstep(humidity as number, 65, 90)
        : 0;
      penalty += humidityPenalty;
      if (effectiveWind !== undefined && effectiveWind >= 14) {
        const strongWindPenalty = 14 * smoothstep(effectiveWind, 14, 25);
        penalty += strongWindPenalty;
        if (strongWindPenalty >= 6) reasons.push('strong-wind');
      } else if (effectiveWind !== undefined && effectiveWind >= 2 && effectiveWind <= 9) {
        benefit += 8;
      }
      if (temperature >= 18 && temperature <= 32) benefit += 8;
      addCold(5, -5, 10);
      break;
    }
  }

  return { penalty, benefit, reasons: [...new Set(reasons)] };
};

export interface BuildActivityPlanInput {
  activity: ActivityKind;
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  sensitivity?: TemperatureSensitivity;
  preferredStart?: string;
  preferredEnd?: string;
}

const parseClockMinutes = (clock?: string): number | null => {
  if (!clock) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const localClockMinutes = (date: Date, timezoneOffsetSeconds: number) => {
  const local = new Date(date.getTime() + timezoneOffsetSeconds * 1000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
};

const clockInRange = (value: number, start: number, end: number) => {
  if (start === end) return value === start;
  return start < end ? value >= start && value <= end : value >= start || value <= end;
};

const weightedActivityScore = (slots: ActivityWindowScore[], horizonHours = HORIZON_HOURS) => {
  if (!slots.length) return 0;
  if (slots.length === 1) return slots[0].score;

  const diffs = slots
    .slice(1)
    .map((slot, index) => (slot.time.getTime() - slots[index].time.getTime()) / HOUR_MS)
    .filter(value => value > 0 && Number.isFinite(value))
    .sort((a, b) => a - b);
  const cadenceHours = diffs.length ? diffs[Math.floor(diffs.length / 2)] : 1;
  const naturalEnd = slots[slots.length - 1].time.getTime() + cadenceHours * HOUR_MS;
  const hardEnd = slots[0].time.getTime() + horizonHours * HOUR_MS;
  const end = Math.min(naturalEnd, hardEnd);
  const selected = slots.filter(slot => slot.time.getTime() < end);
  if (!selected.length) return slots[0].score;

  const weighted = selected.map((slot, index) => {
    const current = slot.time.getTime();
    const next = selected[index + 1]?.time.getTime() ?? end;
    return { slot, weight: Math.max(0.01, (Math.min(next, end) - current) / HOUR_MS) };
  });
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const mean = weighted.reduce((sum, entry) => sum + entry.slot.score * entry.weight, 0) / total;
  const downsideTarget = total * 0.25;
  let remaining = downsideTarget;
  let downsideSum = 0;
  let downsideWeight = 0;
  for (const entry of [...weighted].sort((a, b) => a.slot.score - b.slot.score)) {
    if (remaining <= 0) break;
    const used = Math.min(entry.weight, remaining);
    downsideSum += entry.slot.score * used;
    downsideWeight += used;
    remaining -= used;
  }
  const downside = downsideWeight ? downsideSum / downsideWeight : mean;
  return clamp(mean * 0.82 + downside * 0.18);
};

export const buildActivityPlan = ({
  activity,
  weather,
  hourly,
  airQuality,
  sensitivity = 'balanced',
  preferredStart,
  preferredEnd,
}: BuildActivityPlanInput): ActivityPlan => {
  const source = [...hourly].sort((a, b) => a.time.getTime() - b.time.getTime()).slice(0, 48);
  const points = source.length
    ? source
    : [
        {
          time: weather.timestamp,
          temp: weather.temperature,
          apparentTemperature: weather.feelsLike,
          humidity: weather.humidity,
          pop: 0,
          windSpeed: weather.windSpeed,
          visibility: weather.visibility,
        } as HourlyForecast,
      ];

  const hasHourlySource = source.length > 0;
  const slots: ActivityWindowScore[] = points.map(point => {
    const airQualityIndex = hasHourlySource ? undefined : airQuality?.aqi;
    const base = scoreWeatherWindow({
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
    const adj = activityAdjustment({
      activity,
      temperature: base.apparentTemperature,
      pop: point.pop,
      precipitationMm: point.precipitationMm,
      wind: point.windSpeed,
      gust: point.windGust,
      aqi: airQualityIndex,
      humidity: point.humidity,
      uvIndex: point.uvIndex,
      visibility: point.visibility,
      sensitivity,
    });
    // Activity comfort can only refund generic penalties that the activity genuinely benefits from.
    // It must never erase unrelated AQI, UV, precipitation, visibility or severe-weather risk.
    const reclaimablePenalty = base.impacts
      .filter(impact => impact.factor === 'thermal' || (activity === 'laundry' && impact.factor === 'wind'))
      .reduce((sum, impact) => sum + impact.penalty, 0);
    const reclaimed = Math.min(adj.benefit, reclaimablePenalty);
    const reasons = [...new Set([...base.reasons, ...adj.reasons])];
    let score = clamp(base.score - adj.penalty + reclaimed);
    if (reasons.length > 0) score = Math.min(score, 96);
    return {
      ...base,
      activity,
      baselineScore: base.score,
      score,
      band: getScoreBand(score),
      activityReasons: adj.reasons,
      reasons,
    };
  });

  const timezoneOffsetSeconds = weather.meta.timezoneOffsetSeconds;
  const startMinutes = parseClockMinutes(preferredStart);
  const endMinutes = parseClockMinutes(preferredEnd);
  const windowApplied =
    startMinutes !== null && endMinutes !== null && preferredStart && preferredEnd
      ? { start: preferredStart, end: preferredEnd }
      : undefined;

  const defaultEnd = slots[0]?.time.getTime() + HORIZON_HOURS * HOUR_MS;
  const defaultSlots = defaultEnd
    ? slots.filter(slot => slot.time.getTime() < defaultEnd)
    : slots;
  const nextDayEnd = slots[0]?.time.getTime() + 24 * HOUR_MS;
  const filteredSlots = windowApplied && nextDayEnd
    ? slots.filter(slot =>
        slot.time.getTime() < nextDayEnd &&
        clockInRange(localClockMinutes(slot.time, timezoneOffsetSeconds), startMinutes!, endMinutes!)
      )
    : defaultSlots;
  const evaluatedSlots = windowApplied ? filteredSlots : defaultSlots;

  const bestWindowRange = findBestWindowRange(evaluatedSlots);
  const bestWindow = bestWindowRange?.peak;
  const scoringHorizon = windowApplied ? 24 : HORIZON_HOURS;
  const rawScore = weightedActivityScore(evaluatedSlots, scoringHorizon);
  const baselineScore = weightedActivityScore(
    evaluatedSlots.map(slot => ({ ...slot, score: slot.baselineScore })),
    scoringHorizon
  );
  const reasonCounts = new Map<DecisionReasonCode, number>();
  evaluatedSlots.forEach(slot =>
    slot.reasons.forEach(reason => reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1))
  );
  const reasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason]) => reason);
  const score = reasons.length > 0 ? Math.min(rawScore, 96) : rawScore;
  const activityImpact = score - baselineScore;

  return {
    activity,
    score,
    baselineScore,
    activityImpact,
    band: getScoreBand(score),
    bestWindow,
    bestWindowRange,
    slots,
    reasons,
    windowApplied,
    windowUnavailable: Boolean(windowApplied && evaluatedSlots.length === 0),
  };
};
