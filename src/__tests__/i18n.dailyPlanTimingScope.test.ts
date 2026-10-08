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
    expect(buildDecisionShare({ ...common, language: 'en' }).text).toContain('Best weather window in the next 12 hours: 18:00–20:00');
    expect(buildDecisionShare({ ...common, language: 'tr' }).text).toContain('Önümüzdeki 12 saatte en uygun hava penceresi: 18:00–20:00');
  });
  it('explains the 6-hour now-or-later recommendation versus the 12-hour peak', () => {
    for (const locale of [tr, en]) {
      expect(locale.hava81.dailyPlan.nowOrLater.later).toContain('6');
      expect(locale.hava81.dailyPlan.bestWindow).toContain('12');
      expect(locale.hava81.dailyPlan.bestRange).toContain('12');
      expect(locale.hava81.glance.bestHours).toContain('12');
    }
    // Keep translation placeholders intact, so both visible and shared
    // recommendations continue to include their actual local times.
    for (const locale of [tr, en]) {
      expect(locale.hava81.dailyPlan.nowOrLater.later).toContain('{{time}}');
      expect(locale.hava81.dailyPlan.bestWindow).toContain('{{time}}');
      expect(locale.hava81.dailyPlan.bestRange).toContain('{{start}}–{{end}}');
      expect(locale.hava81.glance.bestHours).toContain('{{hours}}');
    }
  });

});
