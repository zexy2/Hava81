import { citySlug } from '../../utils/cityRoute';
import type { DailyPlan } from '../decision/types';

export interface AlertCandidate {
  kind: 'rain' | 'wind' | 'air-quality' | 'wait' | 'difficult';
  titleKey: string;
  bodyKey: string;
  data: Record<string, string | number>;
  signature: string;
}

export const buildAlertCandidate = (cityName: string, plan: DailyPlan): AlertCandidate | null => {
  const signatureCity = citySlug(cityName) || cityName.trim().toLocaleLowerCase('tr-TR');

  if (plan.umbrella === 'yes') {
    return {
      kind: 'rain',
      titleKey: 'hava81.alerts.rainTitle',
      bodyKey: 'hava81.alerts.rainBody',
      data: { city: cityName },
      signature: `${signatureCity}:rain`,
    };
  }
  if (plan.wind === 'strong') {
    return {
      kind: 'wind',
      titleKey: 'hava81.alerts.windTitle',
      bodyKey: 'hava81.alerts.windBody',
      data: { city: cityName },
      signature: `${signatureCity}:wind`,
    };
  }
  if (plan.airQuality === 'poor') {
    return {
      kind: 'air-quality',
      titleKey: 'hava81.alerts.airTitle',
      bodyKey: 'hava81.alerts.airBody',
      data: { city: cityName },
      signature: `${signatureCity}:air-quality`,
    };
  }
  if (plan.nowOrLater.kind === 'later' && (plan.nowOrLater.improvement ?? 0) >= 20) {
    return {
      kind: 'wait',
      titleKey: 'hava81.alerts.waitTitle',
      bodyKey: 'hava81.alerts.waitBody',
      data: { city: cityName, improvement: plan.nowOrLater.improvement ?? 0 },
      signature: `${signatureCity}:wait:${plan.nowOrLater.targetTime?.toISOString() ?? 'later'}`,
    };
  }
  if (plan.score < 50) {
    return {
      kind: 'difficult',
      titleKey: 'hava81.alerts.difficultTitle',
      bodyKey: 'hava81.alerts.difficultBody',
      data: { city: cityName, score: plan.score },
      signature: `${signatureCity}:difficult`,
    };
  }
  return null;
};
