import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import { tr } from '../i18n/locales/tr';

describe('decision alert title scope', () => {
  it('keeps wait-improvement notification titles explicitly weather-based', () => {
    expect(en.hava81.alerts.waitTitle).toContain('Weather');
    expect(tr.hava81.alerts.waitTitle).toContain('Hava açısından');
  });
});
