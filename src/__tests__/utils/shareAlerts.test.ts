import { describe, expect, it } from 'vitest';
import { buildDecisionShare } from '../../utils/shareDecision';
import { buildAlertCandidate } from '../../domain/alerts/buildAlertCandidate';
import type { DailyPlan } from '../../domain/decision/types';

const plan = (overrides: Partial<DailyPlan> = {}): DailyPlan => ({
  score: 80,
  band: 'good',
  slots: [],
  umbrella: 'no',
  wind: 'normal',
  airQuality: 'good',
  nowOrLater: { kind: 'similar', currentScore: 80, targetScore: 82, reasons: [] },
  ...overrides,
});

describe('sharing and alerts', () => {
  it('creates a shareable canonical city decision', () => {
    const result = buildDecisionShare({
      cityName: 'Şanlıurfa',
      score: 72,
      bestTime: '19:00',
      umbrella: 'no',
      language: 'tr',
    });
    expect(result.url).toContain('/sanliurfa');
    expect(result.text).toContain('72/100');
    expect(result.text).toContain('19:00');
  });
  it('prioritizes rain alerts', () => {
    const candidate = buildAlertCandidate('İstanbul', plan({ umbrella: 'yes', score: 45 }));
    expect(candidate?.kind).toBe('rain');
  });
  it('keeps same-day rain and difficult alert signatures stable as scores change', () => {
    expect(buildAlertCandidate('İstanbul', plan({ umbrella: 'yes', score: 45 }))?.signature).toBe(
      buildAlertCandidate('İstanbul', plan({ umbrella: 'yes', score: 30 }))?.signature
    );
    expect(buildAlertCandidate('Ankara', plan({ score: 45 }))?.signature).toBe(
      buildAlertCandidate('Ankara', plan({ score: 30 }))?.signature
    );
  });

  it('prioritizes strong wind and poor air-quality thresholds before generic difficult-day alerts', () => {
    expect(buildAlertCandidate('Ankara', plan({ wind: 'strong', score: 40 }))?.kind).toBe('wind');
    expect(buildAlertCandidate('Ankara', plan({ airQuality: 'poor', score: 40 }))?.kind).toBe(
      'air-quality'
    );
  });

  it('alerts when waiting materially improves the plan', () => {
    const candidate = buildAlertCandidate(
      'İzmir',
      plan({
        nowOrLater: {
          kind: 'later',
          improvement: 25,
          currentScore: 50,
          targetScore: 75,
          reasons: [],
        },
      })
    );
    expect(candidate?.kind).toBe('wait');
  });
  it('does not spam on an ordinary good day', () => {
    expect(buildAlertCandidate('Ankara', plan())).toBeNull();
  });
});
