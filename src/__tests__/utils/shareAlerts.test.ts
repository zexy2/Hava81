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
  impacts: [],
  confidence: 'basic',
  ...overrides,
});

describe('sharing and alerts', () => {
  it('creates a shareable canonical city decision', () => {
    const result = buildDecisionShare({
      cityName: 'Şanlıurfa',
      score: 72,
      band: 'caution',
      bestTime: '19:00',
      umbrella: 'no',
      recommendation: 'Şimdi çıkmak daha iyi',
      language: 'tr',
    });
    expect(result.url).toContain('/sanliurfa');
    expect(result.text).toContain('72/100 · Dikkat');
    expect(result.text).toContain('En uygun zaman: 19:00');
    expect(result.text).toContain('Öneri: Şimdi çıkmak daha iyi');
    expect(result.text).not.toContain(result.url);
    expect(result.clipboardText).toContain(result.url);
  });

  it('does not turn missing precipitation guidance into a no-umbrella claim', () => {
    const tr = buildDecisionShare({
      cityName: 'İzmir',
      score: 80,
      band: 'good',
      umbrella: 'unknown',
      language: 'tr',
    });
    const en = buildDecisionShare({
      cityName: 'Izmir',
      score: 80,
      band: 'good',
      umbrella: 'unknown',
      language: 'en',
    });
    expect(tr.text).toContain('Şemsiye: Veri yok');
    expect(tr.text).not.toContain('Şemsiye: Gerekmez');
    expect(en.text).toContain('Umbrella: No data');
    expect(en.text).not.toContain('Umbrella: Not needed');
  });

  it('localizes the shared score meaning in English', () => {
    const result = buildDecisionShare({
      cityName: 'Ankara',
      score: 98,
      band: 'excellent',
      umbrella: 'no',
      language: 'en',
    });
    expect(result.title).toContain('98/100 · Very suitable');
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
