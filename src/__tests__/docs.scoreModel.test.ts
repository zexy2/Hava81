/**
 * Plan v3 Faz 0.6 — docs/SCORE_MODEL.md bands must match the code (L10).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getScoreBand } from '../domain/decision/scoreWeatherWindow';
import type { Hava81ScoreBand } from '../domain/decision/types';

const doc = readFileSync('docs/SCORE_MODEL.md', 'utf8');
const bandByLabel: Record<string, Hava81ScoreBand> = {
  'Very good': 'excellent',
  Good: 'good',
  Caution: 'caution',
  Difficult: 'difficult',
};

describe('docs/SCORE_MODEL.md bands', () => {
  const section = doc.slice(doc.indexOf('Current bands'));
  const rows = [...section.matchAll(/^- (\d+)–(\d+): ([A-Za-z ]+?)(?: \/|\s\(|$)/gm)].slice(0, 4);

  it('lists four bands that tile 0–100', () => {
    expect(rows).toHaveLength(4);
    const ranges = rows.map(row => [Number(row[1]), Number(row[2])]).sort((a, b) => a[0] - b[0]);
    expect(ranges[0][0]).toBe(0);
    expect(ranges[3][1]).toBe(100);
    for (let index = 1; index < ranges.length; index += 1) {
      expect(ranges[index][0]).toBe(ranges[index - 1][1] + 1);
    }
  });

  it('uses the same boundaries as getScoreBand', () => {
    for (const row of rows) {
      const [low, high, label] = [Number(row[1]), Number(row[2]), row[3].trim()];
      const band = bandByLabel[label];
      expect(band, label).toBeDefined();
      expect(getScoreBand(low)).toBe(band);
      expect(getScoreBand(high)).toBe(band);
    }
  });
});
