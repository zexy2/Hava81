import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../../types';
import { getScoreBand, scoreWeatherWindow } from './scoreWeatherWindow';
import type {
  AirQualityAdvice,
  DailyPlan,
  NowOrLaterAdvice,
  ScoredWeatherWindow,
  UmbrellaAdvice,
  WindAdvice,
} from './types';

export interface BuildDailyPlanInput {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
}

const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const pickUmbrellaAdvice = (slots: ScoredWeatherWindow[]): UmbrellaAdvice => {
  const maxPop = Math.max(0, ...slots.slice(0, 4).map(slot => slot.precipitationProbability));
  if (maxPop >= 0.5) return 'yes';
  if (maxPop >= 0.25) return 'maybe';
  return 'no';
};

const pickWindAdvice = (slots: ScoredWeatherWindow[]): WindAdvice => {
  const maxWind = Math.max(0, ...slots.slice(0, 4).map(slot => slot.windSpeed));
  if (maxWind >= 17.2) return 'strong';
  if (maxWind >= 10.8) return 'caution';
  return 'normal';
};

const pickAirQualityAdvice = (airQuality?: AirQuality): AirQualityAdvice => {
  if (!airQuality) return 'unknown';
  if (airQuality.aqi >= 4) return 'poor';
  if (airQuality.aqi >= 3) return 'sensitive';
  return 'good';
};

const buildNowOrLater = (slots: ScoredWeatherWindow[]): NowOrLaterAdvice => {
  const current = slots[0];
  if (!current) {
    return {
      kind: 'similar',
      currentScore: 0,
      targetScore: 0,
      reasons: [],
    };
  }

  const candidates = slots.slice(1, 5);
  const bestLater = candidates.reduce<ScoredWeatherWindow | undefined>(
    (best, slot) => (!best || slot.score > best.score ? slot : best),
    undefined
  );

  if (!bestLater) {
    return {
      kind: 'similar',
      currentScore: current.score,
      targetScore: current.score,
      reasons: current.reasons,
    };
  }

  const improvement = bestLater.score - current.score;
  if (improvement >= 15) {
    return {
      kind: 'later',
      targetTime: bestLater.time,
      improvement,
      currentScore: current.score,
      targetScore: bestLater.score,
      reasons: current.reasons,
    };
  }

  if (current.score - bestLater.score >= 10 || current.score >= 85) {
    return {
      kind: 'now',
      targetTime: current.time,
      improvement: current.score - bestLater.score,
      currentScore: current.score,
      targetScore: bestLater.score,
      reasons: bestLater.reasons,
    };
  }

  return {
    kind: 'similar',
    targetTime: bestLater.time,
    improvement: Math.max(0, improvement),
    currentScore: current.score,
    targetScore: bestLater.score,
    reasons: current.reasons,
  };
};

export const buildDailyPlan = ({ weather, hourly, airQuality }: BuildDailyPlanInput): DailyPlan => {
  const source = hourly.slice(0, 8);
  const slots = source.length
    ? source.map(point =>
        scoreWeatherWindow({
          time: point.time,
          temperature: point.temp,
          precipitationProbability: point.pop,
          windSpeed: point.windSpeed,
          airQualityIndex: airQuality?.aqi,
        })
      )
    : [
        scoreWeatherWindow({
          time: weather.timestamp,
          temperature: weather.temperature,
          precipitationProbability: 0,
          windSpeed: weather.windSpeed,
          airQualityIndex: airQuality?.aqi,
        }),
      ];

  const scoringWindow = slots.slice(0, 6);
  const averageScore = average(scoringWindow.map(slot => slot.score));
  const worstScore = Math.min(...scoringWindow.map(slot => slot.score));
  // A day with one materially difficult period should not look perfect just because the rest is calm.
  const score = Math.round(averageScore * 0.65 + worstScore * 0.35);
  const bestWindow = slots.reduce<ScoredWeatherWindow | undefined>(
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
  };
};
