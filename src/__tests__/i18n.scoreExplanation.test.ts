import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import { tr } from '../i18n/locales/tr';

describe('Hava81 score explanation copy', () => {
  it('clarifies that displayed factor impacts are averages rather than direct deductions', () => {
    expect(tr.hava81.dailyPlan.explain.method).toContain('12 saatlik ağırlıklı ortalama etkidir');
    expect(tr.hava81.dailyPlan.explain.method).toContain("100’den birebir çıkarılan");
    expect(en.hava81.dailyPlan.explain.method).toContain('12-hour weighted-average impacts');
    expect(en.hava81.dailyPlan.explain.method).toContain('subtracted one-for-one from 100');
  });

  it('scopes favorable risk language to weather rather than general safety', () => {
    expect(tr.hava81.dailyPlan.reasons.clear).toContain('hava riski');
    expect(en.hava81.dailyPlan.reasons.clear).toContain('weather risk');
    expect(tr.hava81.decision.actions.stable).toContain('hava riski');
    expect(en.hava81.decision.actions.stable).toContain('weather risk');
    expect(tr.hava81.dailyPlan.reasons.clear).toContain('görünmüyor');
    expect(tr.hava81.decision.compactActions.stable).toContain('görünmüyor');
    expect(en.hava81.dailyPlan.reasons.clear).toContain('stands out');
    expect(en.hava81.decision.compactActions.stable).toContain('stands out');
    expect(tr.hava81.dailyPlan.explain.stable).toContain('öne çıkmıyor');
    expect(en.hava81.dailyPlan.explain.stable).toContain('stands out');
  });
});
