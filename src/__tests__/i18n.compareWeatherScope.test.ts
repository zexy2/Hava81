import { describe, expect, it } from 'vitest';
import en from '../i18n/locales/en';
import tr from '../i18n/locales/tr';

describe('city comparison weather scope', () => {
  it('keeps the best-time metric explicitly scoped to weather evidence', () => {
    expect(en.hava81.compare.bestTime).toBe('Best weather time');
    expect(tr.hava81.compare.bestTime).toBe('En iyi hava saati');
  });
});
