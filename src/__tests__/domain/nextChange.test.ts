import { describe, expect, it } from 'vitest';
import { getNextChange } from '../../domain/decision/nextChange';
import type { HourlyForecast } from '../../types';

const now = new Date('2026-10-21T12:00:00Z');
const hours = (values: Array<[number, number]>): HourlyForecast[] =>
  values.map(([temp, pop], index) => ({
    time: new Date(now.getTime() + (index + 1) * 3_600_000),
    temp,
    pop,
    icon: '01d',
    windSpeed: 2,
  })) as HourlyForecast[];

describe('getNextChange', () => {
  it('reports rain starting first', () => {
    const change = getNextChange(
      hours([
        [20, 0],
        [20, 0.1],
        [19, 0.6],
      ]),
      20,
      now
    );
    expect(change.kind).toBe('rainStarts');
    expect(change.time?.toISOString()).toBe('2026-10-21T15:00:00.000Z');
  });
  it('reports rain stopping when it is wet now', () => {
    expect(
      getNextChange(
        hours([
          [15, 0.8],
          [15, 0.2],
        ]),
        15,
        now
      ).kind
    ).toBe('rainStops');
  });
  it('reports a cooling swing of 3 degrees', () => {
    const change = getNextChange(
      hours([
        [20, 0],
        [18, 0],
        [16.5, 0],
      ]),
      20,
      now
    );
    expect(change).toMatchObject({ kind: 'cooler', temp: 16.5 });
  });
  it('reports warming', () => {
    expect(
      getNextChange(
        hours([
          [12, 0],
          [16, 0],
        ]),
        12,
        now
      ).kind
    ).toBe('warmer');
  });
  it('is steady without change or data', () => {
    expect(
      getNextChange(
        hours([
          [20, 0],
          [21, 0],
        ]),
        20,
        now
      ).kind
    ).toBe('steady');
    expect(getNextChange([], 20, now).kind).toBe('steady');
  });
});
