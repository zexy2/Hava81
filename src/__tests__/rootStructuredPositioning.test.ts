import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('root structured product positioning', () => {
  it('describes decision guidance rather than a generic meteorological atlas', () => {
    const html = readFileSync('index.html', 'utf8');
    const match = html.match(/<script type="application\/ld\+json">\s*(\{.*?\})\s*<\/script>/s);
    expect(match).not.toBeNull();
    const structured = JSON.parse(match?.[1] ?? '{}') as { description?: string };
    expect(structured.description).toBe(
      'Türkiye’nin 81 ili için hava durumunu günlük kararlara dönüştüren karar odaklı hava rehberi.'
    );
  });
});
