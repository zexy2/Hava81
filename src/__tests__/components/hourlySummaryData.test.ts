import { describe, expect, it } from 'vitest';
import { buildHourlySummary } from '../../components/hava81/forecastAtlas/hourlySummaryData';
import type { HourlyDatum } from '../../components/hava81/forecastAtlas/types';

const hour = (
  h: number,
  pop: number | undefined,
  mm: number | undefined,
  temp = 10
): HourlyDatum => {
  const time = new Date(Date.UTC(2026, 9, 21, h));
  return {
    time,
    timestamp: time.getTime(),
    temp,
    convertedTemp: temp,
    icon: '10d',
    pop: pop ?? 0,
    precipitation: pop,
    precipitationMm: mm,
    windSpeed: 2,
  };
};

describe('buildHourlySummary', () => {
  it('returns null for no hours', () => {
    expect(buildHourlySummary([])).toBeNull();
  });

  it('picks the hour with the highest probability', () => {
    const summary = buildHourlySummary([hour(7, 0.33, 1.0), hour(8, 0.38, 0.5)]);
    expect(summary?.peakPrecipitation.time.getUTCHours()).toBe(8);
    expect(summary?.peakPrecipitation.precipitation).toBe(0.38);
  });

  it('breaks probability ties with the larger amount', () => {
    const summary = buildHourlySummary([hour(7, 0.4, 0.2), hour(8, 0.4, 1.4), hour(9, 0.4, 0.1)]);
    expect(summary?.peakPrecipitation.time.getUTCHours()).toBe(8);
  });

  it('falls back to the largest amount when no probability is present', () => {
    const summary = buildHourlySummary([
      hour(7, undefined, 0.3),
      hour(8, 0, 2),
      hour(9, undefined, 1),
    ]);
    expect(summary?.peakPrecipitation.time.getUTCHours()).toBe(8);
  });

  it('anchors min and max temperatures to their first hours', () => {
    const summary = buildHourlySummary([hour(7, 0, 0, 5), hour(8, 0, 0, 9), hour(9, 0, 0, 5)]);
    expect(summary).toMatchObject({ min: 5, max: 9 });
    expect(summary?.minHour?.time.getUTCHours()).toBe(7);
  });
});
