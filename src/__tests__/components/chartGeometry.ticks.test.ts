import { describe, expect, it } from 'vitest';
import {
  buildNiceTicks,
  rainGaugeLevel,
} from '../../components/hava81/forecastAtlas/chartGeometry';

describe('buildNiceTicks', () => {
  it('spaces ticks evenly instead of max/mid/min', () => {
    const ticks = buildNiceTicks(13, 18);
    expect(ticks).toEqual([18, 16, 14]);
    const gaps = ticks.slice(1).map((value, index) => ticks[index] - value);
    expect(new Set(gaps).size).toBe(1);
  });

  it('keeps every tick inside the plotted range', () => {
    for (const [min, max] of [
      [13.4, 18.7],
      [-3, 4],
      [0, 37],
    ] as const) {
      const ticks = buildNiceTicks(min, max);
      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks.length).toBeLessThanOrEqual(4);
      for (const tick of ticks) {
        expect(tick).toBeGreaterThanOrEqual(min);
        expect(tick).toBeLessThanOrEqual(max);
      }
    }
  });

  it('returns one tick for a flat series', () => {
    expect(buildNiceTicks(15, 15)).toEqual([15]);
  });
});

describe('rainGaugeLevel', () => {
  it('stays empty without chance or amount', () => {
    expect(rainGaugeLevel(0, 0)).toBe(0);
    expect(rainGaugeLevel(0.02, undefined)).toBe(0);
  });

  it('uses the chance level for light amounts', () => {
    expect(rainGaugeLevel(0.38, 0.5)).toBe(2);
    expect(rainGaugeLevel(0.9, 0.1)).toBe(5);
  });

  it('lets a heavy amount outrank a modest chance', () => {
    expect(rainGaugeLevel(0.2, 6)).toBe(4);
    expect(rainGaugeLevel(0.2, 12)).toBe(5);
  });

  it('lights one cell for measurable rain at a rounded 0% chance', () => {
    expect(rainGaugeLevel(0, 0.2)).toBe(1);
  });
});
