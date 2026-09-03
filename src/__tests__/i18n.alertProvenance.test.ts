import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import { tr } from '../i18n/locales/tr';

describe('modeled alert provenance', () => {
  it('keeps safety-sensitive detached notification titles visibly tied to Hava81', () => {
    for (const title of [en.hava81.alerts.windTitle, en.hava81.alerts.airTitle, en.hava81.alerts.waitTitle, en.hava81.alerts.difficultTitle]) {
      expect(title).toContain('Hava81');
    }
    for (const title of [tr.hava81.alerts.windTitle, tr.hava81.alerts.airTitle, tr.hava81.alerts.waitTitle, tr.hava81.alerts.difficultTitle]) {
      expect(title).toContain('Hava81');
    }
  });

  it('calls the opt-in control notifications rather than implying official warnings', () => {
    expect(en.hava81.alerts.eyebrow).toBe('Hava81 notifications');
    expect(en.hava81.alerts.enable).toBe('Enable notifications');
    expect(tr.hava81.alerts.eyebrow).toBe('Hava81 bildirimleri');
    expect(tr.hava81.alerts.enable).toBe('Bildirimleri aç');
  });
});
