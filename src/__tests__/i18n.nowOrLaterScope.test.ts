import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import { tr } from '../i18n/locales/tr';

describe('now-or-later guidance scope', () => {
  it('keeps comparative outing guidance explicitly weather-based', () => {
    expect(en.hava81.dailyPlan.nowOrLater.later).toContain('Weather conditions');
    expect(en.hava81.dailyPlan.nowOrLater.now).toContain('Weather conditions');
    expect(en.hava81.dailyPlan.nowOrLater.similar).toContain('weather advantage');
    expect(tr.hava81.dailyPlan.nowOrLater.later).toContain('hava koşulları');
    expect(tr.hava81.dailyPlan.nowOrLater.now).toContain('Hava koşulları');
    expect(tr.hava81.dailyPlan.nowOrLater.similar).toContain('hava açısından');
  });
});
