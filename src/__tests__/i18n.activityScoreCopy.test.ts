import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import { tr } from '../i18n/locales/tr';

describe('activity score comparison copy', () => {
  it('names both sides of the baseline-to-activity score comparison', () => {
    expect(tr.hava81.activities.score.activityImpact).toBe('Genel hava skoru → aktivite skoru: {{value}}');
    expect(en.hava81.activities.score.activityImpact).toBe('General weather score → activity score: {{value}}');
  });
});
