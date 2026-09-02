import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('generated city-page metadata', () => {
  it('keeps the static outing recommendation scoped to weather', () => {
    const generator = readFileSync('scripts/generate-city-pages.mjs', 'utf8');
    expect(generator).toContain('hava açısından en iyi dışarı çıkma penceresi');
    expect(generator).not.toContain('Hava81 Skoru, en iyi dışarı çıkma saati');
  });
});
