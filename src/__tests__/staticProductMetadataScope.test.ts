import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('static product metadata weather scope', () => {
  it('qualifies best-time positioning as weather-based before hydration', () => {
    const index = readFileSync('index.html', 'utf8');
    const manifest = readFileSync('public/manifest.json', 'utf8');

    expect(index).toContain('hava açısından en iyi zaman');
    expect(manifest).toContain('hava açısından en iyi zaman');
    expect(index).not.toMatch(/Hava81 Skoru, en iyi zaman/);
    expect(manifest).not.toMatch(/Hava81 Skoru, en iyi zaman/);
  });
});
