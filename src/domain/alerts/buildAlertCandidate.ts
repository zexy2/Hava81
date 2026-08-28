import type { DailyPlan } from '../decision/types';

export interface AlertCandidate {
  kind: 'rain' | 'wait' | 'difficult';
  titleKey: string;
  bodyKey: string;
  data: Record<string, string | number>;
  signature: string;
}

export const buildAlertCandidate = (cityName: string, plan: DailyPlan): AlertCandidate | null => {
  if (plan.umbrella === 'yes') {
    return {
      kind: 'rain',
      titleKey: 'hava81.alerts.rainTitle',
      bodyKey: 'hava81.alerts.rainBody',
      data: { city: cityName },
      signature: `${cityName}:rain:${plan.score}`,
    };
  }
  if (plan.nowOrLater.kind === 'later' && (plan.nowOrLater.improvement ?? 0) >= 20) {
    return {
      kind: 'wait',
      titleKey: 'hava81.alerts.waitTitle',
      bodyKey: 'hava81.alerts.waitBody',
      data: { city: cityName, improvement: plan.nowOrLater.improvement ?? 0 },
      signature: `${cityName}:wait:${plan.nowOrLater.targetTime?.toISOString() ?? 'later'}`,
    };
  }
  if (plan.score < 50) {
    return {
      kind: 'difficult',
      titleKey: 'hava81.alerts.difficultTitle',
      bodyKey: 'hava81.alerts.difficultBody',
      data: { city: cityName, score: plan.score },
      signature: `${cityName}:difficult:${plan.score}`,
    };
  }
  return null;
};
