import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../../types';
import { getScoreBand, scoreWeatherWindow } from '../decision/scoreWeatherWindow';
import type { DecisionReasonCode } from '../decision/types';
import type {
  ActivityKind,
  ActivityPlan,
  ActivityWindowScore,
  TemperatureSensitivity,
} from './types';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const avg = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

interface ActivityAdjustmentInput {
  activity: ActivityKind;
  temperature: number;
  pop: number;
  wind: number;
  aqi?: number;
  humidity: number;
  sensitivity: TemperatureSensitivity;
}

const activityAdjustment = ({
  activity,
  temperature,
  pop,
  wind,
  aqi,
  humidity,
  sensitivity,
}: ActivityAdjustmentInput) => {
  let delta = 0;
  const reasons: DecisionReasonCode[] = [];

  const heatShift = sensitivity === 'heat' ? -3 : sensitivity === 'cold' ? 2 : 0;
  const coldShift = sensitivity === 'cold' ? 3 : sensitivity === 'heat' ? -2 : 0;
  const hot = temperature >= 30 + heatShift;
  const veryHot = temperature >= 34 + heatShift;
  const cold = temperature <= 7 + coldShift;

  switch (activity) {
    case 'run':
      if (veryHot) {
        delta -= 32;
        reasons.push('extreme-heat');
      } else if (hot) {
        delta -= 18;
        reasons.push('heat');
      }
      if (cold) {
        delta -= 10;
        reasons.push('cold');
      }
      if (pop >= 0.5) {
        delta -= 22;
        reasons.push('heavy-rain');
      } else if (pop >= 0.25) {
        delta -= 8;
        reasons.push('rain-risk');
      }
      if (wind >= 10.8) {
        delta -= 14;
        reasons.push('strong-wind');
      } else if (wind >= 8) {
        delta -= 5;
        reasons.push('windy');
      }
      if ((aqi ?? 0) >= 4) {
        delta -= 25;
        reasons.push('poor-air-quality');
      } else if ((aqi ?? 0) >= 3) {
        delta -= 12;
        reasons.push('sensitive-air-quality');
      }
      if (temperature >= 10 && temperature <= 24 && pop < 0.2 && wind < 8) delta += 8;
      break;
    case 'walk':
      if (veryHot) {
        delta -= 20;
        reasons.push('extreme-heat');
      } else if (hot) {
        delta -= 10;
        reasons.push('heat');
      }
      if (cold) {
        delta -= 8;
        reasons.push('cold');
      }
      if (pop >= 0.5) {
        delta -= 18;
        reasons.push('heavy-rain');
      }
      if (wind >= 10.8) {
        delta -= 10;
        reasons.push('strong-wind');
      }
      if ((aqi ?? 0) >= 4) {
        delta -= 16;
        reasons.push('poor-air-quality');
      }
      if (temperature >= 12 && temperature <= 27 && pop < 0.25) delta += 5;
      break;
    case 'picnic':
      if (pop >= 0.5) {
        delta -= 40;
        reasons.push('heavy-rain');
      } else if (pop >= 0.25) {
        delta -= 20;
        reasons.push('rain-risk');
      }
      if (wind >= 10.8) {
        delta -= 24;
        reasons.push('strong-wind');
      } else if (wind >= 8) {
        delta -= 10;
        reasons.push('windy');
      }
      if (veryHot) {
        delta -= 24;
        reasons.push('extreme-heat');
      } else if (hot) {
        delta -= 10;
        reasons.push('heat');
      }
      if (temperature <= 8) {
        delta -= 15;
        reasons.push('cold');
      }
      if ((aqi ?? 0) >= 4) {
        delta -= 14;
        reasons.push('poor-air-quality');
      }
      if (temperature >= 16 && temperature <= 28 && pop < 0.15 && wind < 8) delta += 10;
      break;
    case 'children':
      if (veryHot) {
        delta -= 35;
        reasons.push('extreme-heat');
      } else if (hot) {
        delta -= 20;
        reasons.push('heat');
      }
      if (temperature <= 6) {
        delta -= 18;
        reasons.push('cold');
      }
      if (pop >= 0.5) {
        delta -= 22;
        reasons.push('heavy-rain');
      }
      if (wind >= 10.8) {
        delta -= 16;
        reasons.push('strong-wind');
      }
      if ((aqi ?? 0) >= 4) {
        delta -= 30;
        reasons.push('poor-air-quality');
      } else if ((aqi ?? 0) >= 3) {
        delta -= 18;
        reasons.push('sensitive-air-quality');
      }
      if (temperature >= 14 && temperature <= 27 && pop < 0.2 && (aqi ?? 1) <= 2) delta += 7;
      break;
    case 'motorcycle':
      if (pop >= 0.5) {
        delta -= 38;
        reasons.push('heavy-rain');
      } else if (pop >= 0.25) {
        delta -= 22;
        reasons.push('rain-risk');
      }
      if (wind >= 17.2) {
        delta -= 45;
        reasons.push('strong-wind');
      } else if (wind >= 10.8) {
        delta -= 30;
        reasons.push('strong-wind');
      } else if (wind >= 8) {
        delta -= 15;
        reasons.push('windy');
      }
      if (temperature <= 5) {
        delta -= 16;
        reasons.push('cold');
      }
      if (temperature >= 38) {
        delta -= 12;
        reasons.push('extreme-heat');
      }
      break;
    case 'laundry':
      if (pop >= 0.5) {
        delta -= 55;
        reasons.push('heavy-rain');
      } else if (pop >= 0.25) {
        delta -= 32;
        reasons.push('rain-risk');
      }
      if (humidity >= 80) delta -= 18;
      else if (humidity <= 55) delta += 8;
      if (wind >= 17.2) {
        delta -= 15;
        reasons.push('strong-wind');
      } else if (wind >= 2 && wind <= 10.8) delta += 10;
      if (temperature >= 18 && temperature <= 34) delta += 10;
      if (temperature <= 5) {
        delta -= 12;
        reasons.push('cold');
      }
      break;
  }

  return { delta, reasons: [...new Set(reasons)] };
};

export interface BuildActivityPlanInput {
  activity: ActivityKind;
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  sensitivity?: TemperatureSensitivity;
}

export const buildActivityPlan = ({
  activity,
  weather,
  hourly,
  airQuality,
  sensitivity = 'balanced',
}: BuildActivityPlanInput): ActivityPlan => {
  const source = hourly.slice(0, 8);
  const points = source.length
    ? source
    : [
        {
          time: weather.timestamp,
          temp: weather.temperature,
          pop: 0,
          windSpeed: weather.windSpeed,
        } as HourlyForecast,
      ];
  const slots: ActivityWindowScore[] = points.map(point => {
    const base = scoreWeatherWindow({
      time: point.time,
      temperature: point.temp,
      precipitationProbability: point.pop,
      windSpeed: point.windSpeed,
      airQualityIndex: airQuality?.aqi,
    });
    const adj = activityAdjustment({
      activity,
      temperature: point.temp,
      pop: point.pop,
      wind: point.windSpeed ?? weather.windSpeed,
      aqi: airQuality?.aqi,
      humidity: weather.humidity,
      sensitivity,
    });
    const score = clamp(base.score + adj.delta);
    return {
      ...base,
      activity,
      score,
      band: getScoreBand(score),
      activityReasons: adj.reasons,
      reasons: [...new Set([...base.reasons, ...adj.reasons])],
    };
  });
  const bestWindow = slots.reduce<ActivityWindowScore | undefined>(
    (best, slot) => (!best || slot.score > best.score ? slot : best),
    undefined
  );
  const score = Math.round(avg(slots.slice(0, 6).map(slot => slot.score)));
  const reasonCounts = new Map<DecisionReasonCode, number>();
  slots
    .slice(0, 6)
    .forEach(slot =>
      slot.reasons.forEach(reason => reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1))
    );
  const reasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason]) => reason);
  return { activity, score, band: getScoreBand(score), bestWindow, slots, reasons };
};
