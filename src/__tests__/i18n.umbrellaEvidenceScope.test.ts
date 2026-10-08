import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import { tr } from '../i18n/locales/tr';
import { buildDecisionShare } from '../utils/shareDecision';

describe('umbrella guidance evidence scope', () => {
  it('phrases a no-umbrella result as a forecast indication, not a universal guarantee', () => {
    expect(en.hava81.dailyPlan.quick.umbrella.no).toBe("Forecast suggests no need");
    expect(tr.hava81.dailyPlan.quick.umbrella.no).toBe('Tahmine göre gerek görünmüyor');
    expect(en.hava81.commute.umbrella.no).toBe("Forecast suggests no need");
    expect(tr.hava81.commute.umbrella.no).toBe('Tahmine göre gerek görünmüyor');

    const common = { cityName: 'İstanbul', score: 80, band: 'good' as const, umbrella: 'no' as const };
    expect(buildDecisionShare({ ...common, language: 'en' }).text).toContain(
      "Umbrella: Forecast suggests no need"
    );
    expect(buildDecisionShare({ ...common, language: 'tr' }).text).toContain(
      'Şemsiye: Tahmine göre gerek görünmüyor'
    );
  });
});
