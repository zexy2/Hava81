import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import { tr } from '../i18n/locales/tr';

describe('Hava81 product positioning tagline', () => {
  it('describes decision guidance rather than a generic weather atlas', () => {
    expect(tr.hava81.tagline).toBe('Havaya göre ne yapacağını söyleyen 81 il rehberi');
    expect(en.hava81.tagline).toBe('Decision-first weather guidance for all 81 provinces');
  });
});
