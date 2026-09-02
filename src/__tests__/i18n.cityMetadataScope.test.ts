import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import { tr } from '../i18n/locales/tr';

describe('city metadata guidance scope', () => {
  it('describes the recommended outing window as weather-based', () => {
    expect(tr.hava81.cityDocumentDescription).toContain('hava açısından');
    expect(en.hava81.cityDocumentDescription).toContain('weather window');
  });
});
