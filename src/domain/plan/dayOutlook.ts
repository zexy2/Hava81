import type {
  AirQuality,
  AirQualityHourly,
  ContextSignals,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { buildActivityPlan } from '../activity/buildActivityPlan';
import type { ActivityKind } from '../activity/types';
import {
  aggregateHorizonScore,
  dropElapsedSlots,
  forecastCadenceMs,
  rainScenarioRange,
  weightHorizonSlots,
  type ScoreRange,
} from '../decision/aggregateHorizon';
import { getDailyPlanAirQualityEvidence } from '../decision/airQualityEvidence';
import { findBestWindowRange } from '../decision/bestWindowRange';
import { isRecommendableHour } from '../decision/eligibility';
import { getScoreBand, scoreWeatherWindow } from '../decision/scoreWeatherWindow';
import type {
  BestWindowRange,
  DecisionReasonCode,
  Hava81ScoreBand,
  ScoredWeatherWindow,
} from '../decision/types';
import { getPlanConfidence } from './confidence';
import type { PersonalTolerance, PlanConfidence } from './types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** A day needs at least this many usable forecast hours to be summarised honestly. */
const MIN_USABLE_HOURS = 4;

export interface DayOutlook {
  /** Local calendar day, `YYYY-MM-DD` in the city's timezone. */
  dateKey: string;
  /** Local midnight of the day, as a UTC instant. */
  start: Date;
  /** 0 = today, 1 = tomorrow, … */
  dayOffset: number;
  score: number;
  band: Hava81ScoreBand;
  bestWindowRange?: BestWindowRange;
  reasons: DecisionReasonCode[];
  /** Forecast confidence of the day's best window (or the day's first hour). */
  confidence: PlanConfidence;
  /** Usable hours of the day the summary is built from (today only counts what is left). */
  usableHours: number;
  /** Wet / dry score when open rain chances move it by at least 8 points. */
  scoreRange?: ScoreRange;
  /** Hours with a thunderstorm weather code (WMO 95–99): named, never folded into "rain". */
  thunderHours: Date[];
  /** The day's most frequent icon and its temperature range, for an at-a-glance row. */
  icon?: string;
  tempMin?: number;
  tempMax?: number;
}

const isThunder = (code: number | undefined) =>
  Number.isFinite(code) && (code as number) >= 95 && (code as number) <= 99;

/** Thunder hours, dominant icon and temperature range of one local day's raw points. */
const dayFacts = (points: readonly HourlyForecast[]) => {
  const temps = points.map(point => point.temp).filter(Number.isFinite);
  const iconCounts = new Map<string, number>();
  points.forEach(point => {
    if (point.icon) iconCounts.set(point.icon, (iconCounts.get(point.icon) ?? 0) + 1);
  });
  const icon = [...iconCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    thunderHours: points
      .filter(point => isThunder((point as HourlyForecast & { weatherCode?: number }).weatherCode))
      .map(point => point.time),
    icon,
    ...(temps.length ? { tempMin: Math.min(...temps), tempMax: Math.max(...temps) } : {}),
  };
};

export interface BuildDayOutlookInput {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  airQualityHourly?: AirQualityHourly;
  contextSignals?: ContextSignals | null;
  /** General day (walking rule) when omitted; otherwise the activity's own gates and duration. */
  activity?: ActivityKind;
  /** Personal tolerance and pollen allergy, for activity days. */
  tolerance?: PersonalTolerance;
  now?: Date;
  maxDays?: number;
}

const localDayKey = (time: Date, offsetSeconds: number) =>
  new Date(time.getTime() + offsetSeconds * 1000).toISOString().slice(0, 10);

const localMidnight = (dateKey: string, offsetSeconds: number) =>
  new Date(Date.parse(`${dateKey}T00:00:00.000Z`) - offsetSeconds * 1000);

const topReasons = (slots: readonly ScoredWeatherWindow[]): DecisionReasonCode[] => {
  const counts = new Map<DecisionReasonCode, number>();
  slots.forEach(slot =>
    slot.reasons.forEach(reason => counts.set(reason, (counts.get(reason) ?? 0) + 1))
  );
  // Severity before frequency: two thunderstorm hours outrank fifteen showery ones, so a
  // stormy day is never summarised as merely "rain risk".
  const rank = (reason: DecisionReasonCode) => (reason === 'severe-weather' ? 1 : 0);
  return [...counts.entries()]
    .sort((a, b) => rank(b[0]) - rank(a[0]) || b[1] - a[1])
    .slice(0, 2)
    .map(([reason]) => reason);
};

/**
 * Today / tomorrow / the weekend from the five-day hourly forecast. Each day is scored with the
 * same hour scorer, gates and aggregation as the live plan, restricted to that local day, so
 * "tomorrow" here is what tomorrow morning's plan will say if the forecast holds. Confidence
 * drops with lead time (medium beyond 24 h, low from 72 h).
 */
export const buildDayOutlook = ({
  weather,
  hourly,
  airQuality,
  airQualityHourly,
  contextSignals,
  activity,
  tolerance,
  now = new Date(),
  maxDays = 5,
}: BuildDayOutlookInput): DayOutlook[] => {
  const offset = weather.meta.timezoneOffsetSeconds;
  const valid = [...hourly]
    .filter(point => point.time instanceof Date && Number.isFinite(point.time.getTime()))
    .sort((a, b) => a.time.getTime() - b.time.getTime());
  const future = dropElapsedSlots(valid, now);
  if (!future.length) return [];
  const cadenceMs = forecastCadenceMs(future);
  const airQualityEvidence = getDailyPlanAirQualityEvidence({
    forecastTimes: future.map(point => point.time),
    airQuality,
    airQualityHourly,
    now: now.getTime(),
  });
  const todayKey = localDayKey(now, offset);
  const todayStart = localMidnight(todayKey, offset).getTime();

  const byDay = new Map<string, HourlyForecast[]>();
  for (const point of future) {
    const key = localDayKey(point.time, offset);
    byDay.set(key, [...(byDay.get(key) ?? []), point]);
  }

  const days: DayOutlook[] = [];
  for (const [dateKey, points] of byDay) {
    if (days.length >= maxDays) break;
    const start = localMidnight(dateKey, offset);
    const dayOffset = Math.round((start.getTime() - todayStart) / DAY_MS);

    if (activity) {
      // The activity plan already owns gates, duration-fit windows and aggregation; give it
      // exactly this day's hours with a 24-hour search so it never borrows the next day.
      const plan = buildActivityPlan({
        activity,
        weather,
        hourly: points,
        // The current AQI reading describes now, not a day ahead: later days use only the
        // exact-hour AQI forecast.
        airQuality: dayOffset === 0 ? airQuality : undefined,
        airQualityHourly,
        contextSignals,
        tolerance,
        now,
        preferredStart: '00:00',
        preferredEnd: '23:59',
      });
      const usable = plan.slots.filter(
        slot =>
          !slot.gateReasons?.some(
            reason => reason === 'daylight-required' || reason === 'outside-active-hours'
          )
      );
      const usableHours = usable.length * (cadenceMs / HOUR_MS);
      if (usableHours < MIN_USABLE_HOURS) continue;
      const peak = plan.bestWindowRange?.start ?? plan.slots[0];
      days.push({
        dateKey,
        start,
        dayOffset,
        score: plan.score,
        band: plan.band,
        bestWindowRange: plan.bestWindowRange,
        reasons: plan.reasons.slice(0, 2),
        confidence: getPlanConfidence((peak.time.getTime() - now.getTime()) / HOUR_MS, 1),
        usableHours,
        scoreRange: plan.scoreRange,
        ...dayFacts(points),
      });
      continue;
    }

    const aqiFor = (point: HourlyForecast) =>
      airQualityEvidence.hourlyAqiByTime.get(point.time.getTime()) ??
      (dayOffset === 0 ? airQualityEvidence.currentAirQuality?.aqi : undefined);
    const scorePoint = (point: HourlyForecast) =>
      scoreWeatherWindow({
        time: point.time,
        temperature: point.temp,
        apparentTemperature: point.apparentTemperature,
        humidity: point.humidity,
        precipitationProbability: point.pop,
        precipitationMm: point.precipitationMm,
        windSpeed: point.windSpeed,
        windGust: point.windGust,
        airQualityIndex: aqiFor(point),
        uvIndex: point.uvIndex,
        visibility: point.visibility,
        weatherCode: point.weatherCode,
      });
    const slots = points.map(scorePoint);
    const eligible = new WeakSet(
      slots.filter((slot, index) =>
        isRecommendableHour(
          { time: slot.time, isDay: points[index].isDay, icon: points[index].icon },
          offset
        )
      )
    );
    const usable = slots.filter(slot => eligible.has(slot));
    const usableHours = usable.length * (cadenceMs / HOUR_MS);
    if (usableHours < MIN_USABLE_HOURS) continue;
    const dayEndMs = start.getTime() + DAY_MS;
    const score = aggregateHorizonScore(weightHorizonSlots(usable, dayEndMs, cadenceMs));
    const pointOf = new Map(slots.map((slot, index) => [slot, points[index]]));
    const scoreRange = rainScenarioRange(
      usable.map(slot => pointOf.get(slot)!),
      point => scorePoint(point).score,
      dayEndMs,
      cadenceMs
    );
    const bestWindowRange = findBestWindowRange(usable);
    const peak = bestWindowRange?.peak ?? usable[0];
    days.push({
      dateKey,
      start,
      dayOffset,
      score,
      band: getScoreBand(score),
      bestWindowRange,
      reasons: topReasons(usable),
      confidence: getPlanConfidence((peak.time.getTime() - now.getTime()) / HOUR_MS, 1),
      usableHours,
      scoreRange,
      ...dayFacts(points),
    });
  }
  return days;
};

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** i18n key under `days` for an outlook day: today, tomorrow, then the local weekday name. */
export const outlookDayLabelKey = (
  day: Pick<DayOutlook, 'dayOffset' | 'start'>,
  offsetSeconds: number
) => {
  if (day.dayOffset === 0) return 'days.today';
  if (day.dayOffset === 1) return 'days.tomorrow';
  return `days.${WEEKDAY_KEYS[new Date(day.start.getTime() + offsetSeconds * 1000).getUTCDay()]}`;
};
