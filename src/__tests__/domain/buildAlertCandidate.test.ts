import { describe, expect, it } from 'vitest';
import { buildAlertCandidate } from '../../domain/alerts/buildAlertCandidate';
import type { DailyPlan } from '../../domain/decision/types';

const rainPlan: DailyPlan = {
  score: 80,
  band: 'good',
  slots: [],
  umbrella: 'yes',
  wind: 'normal',
  airQuality: 'good',
  nowOrLater: {
    kind: 'similar',
    currentScore: 80,
    targetScore: 80,
    reasons: [],
  },
  impacts: [],
  confidence: 'high',
};

describe('buildAlertCandidate', () => {
  it('keeps dedupe signatures stable across localized provider city spellings', () => {
    const turkish = buildAlertCandidate('İstanbul', rainPlan);
    const english = buildAlertCandidate('Istanbul', rainPlan);

    expect(turkish?.signature).toBe('istanbul:rain');
    expect(english?.signature).toBe(turkish?.signature);
    expect(turkish?.data.city).toBe('İstanbul');
    expect(english?.data.city).toBe('Istanbul');
  });
});
