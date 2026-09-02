import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import { tr } from '../i18n/locales/tr';
import { buildDecisionShare } from '../utils/shareDecision';

describe('daily plan timing weather scope', () => {
  it('keeps primary and shared timing explicitly weather-based', () => {
    expect(en.hava81.dailyPlan.bestWindow).toContain('weather time');
    expect(en.hava81.dailyPlan.bestRange).toContain('weather range');
    expect(tr.hava81.dailyPlan.bestWindow).toContain('Hava açısından');
    expect(tr.hava81.dailyPlan.bestRange).toContain('Hava açısından');

    const common = {
      cityName: 'İstanbul', score: 80, band: 'good' as const, bestTime: '18:00–20:00',
      umbrella: 'maybe' as const,
    };
    expect(buildDecisionShare({ ...common, language: 'en' }).text).toContain('Best weather window: 18:00–20:00');
    expect(buildDecisionShare({ ...common, language: 'tr' }).text).toContain('En uygun hava penceresi: 18:00–20:00');
  });
});
