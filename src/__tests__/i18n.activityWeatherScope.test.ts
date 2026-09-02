import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import { tr } from '../i18n/locales/tr';

describe('activity timing weather scope', () => {
  it('keeps best activity timing explicitly scoped to weather evidence', () => {
    expect(en.hava81.activities.bestTime).toContain('Best weather time');
    expect(en.hava81.activities.bestRange).toContain('Best weather range');
    expect(tr.hava81.activities.bestTime).toContain('Hava açısından en iyi saat');
    expect(tr.hava81.activities.bestRange).toContain('Hava açısından en uygun aralık');
  });
});
