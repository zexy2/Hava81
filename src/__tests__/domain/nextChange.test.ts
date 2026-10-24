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
  it('reports rain stopping from a fresh wet current observation', () => {
    const change = getNextChange(hours([[15, 0.2], [15, 0.1]]), 15, now, true);
    expect(change.kind).toBe('rainStops');
    expect(change.time?.toISOString()).toBe('2026-10-21T13:00:00.000Z');
  });

  it('reports rain starting at the first forecast hour from a fresh dry observation', () => {
    const change = getNextChange(hours([[15, 0.8], [15, 0.9]]), 15, now, false);
    expect(change.kind).toBe('rainStarts');
    expect(change.time?.toISOString()).toBe('2026-10-21T13:00:00.000Z');
  });

  it('does not infer a dry hour from an invalid precipitation probability', () => {
    const forecast = hours([[15, 0.8], [15, 0.2]]);
    forecast[0]!.pop = Number.NaN;
    const change = getNextChange(forecast, 15, now, true);
    expect(change.kind).toBe('rainStops');
    expect(change.time?.toISOString()).toBe('2026-10-21T14:00:00.000Z');
  });
  it('uses valid amount-only evidence when precipitation probability is unavailable', () => {
    const forecast = hours([[15, 0], [15, 0]]);
    forecast[0]!.pop = Number.NaN;
    forecast[1]!.pop = Number.NaN;
    forecast[0]!.precipitationMm = 0;
    forecast[1]!.precipitationMm = 0.4;

    const change = getNextChange(forecast, 15, now, false);
    expect(change.kind).toBe('rainStarts');
    expect(change.time?.toISOString()).toBe('2026-10-21T14:00:00.000Z');
  });

  it('does not let a below-threshold probability hide a positive amount', () => {
    const forecast = hours([[15, 0], [15, 0]]);
    forecast[0]!.precipitationMm = 0;
    forecast[1]!.precipitationMm = 0.2;

    const change = getNextChange(forecast, 15, now, false);
    expect(change.kind).toBe('rainStarts');
    expect(change.time?.toISOString()).toBe('2026-10-21T14:00:00.000Z');
  });

  it('uses a valid zero amount as dry evidence and ignores invalid amounts', () => {
    const forecast = hours([[15, 0], [15, 0]]);
    forecast[0]!.pop = Number.NaN;
    forecast[1]!.pop = Number.NaN;
    forecast[0]!.precipitationMm = 0.4;
    forecast[1]!.precipitationMm = 0;

    const change = getNextChange(forecast, 15, now, true);
    expect(change.kind).toBe('rainStops');
    expect(change.time?.toISOString()).toBe('2026-10-21T14:00:00.000Z');

    forecast[0]!.precipitationMm = -0.1;
    forecast[1]!.precipitationMm = Number.NaN;
    expect(getNextChange(forecast, 15, now, true).kind).toBe('steady');
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
  it('sorts out-of-order forecast samples before choosing the first change', () => {
    const chronological = hours([
      [20, 0],
      [20, 0.1],
      [19, 0.6],
    ]);
    const change = getNextChange(
      [chronological[2]!, chronological[0]!, chronological[1]!],
      20,
      now
    );

    expect(change.kind).toBe('rainStarts');
    expect(change.time?.toISOString()).toBe('2026-10-21T15:00:00.000Z');
  });

  it('does not report a change beyond the next 24 elapsed hours when data is sparse', () => {
    const sparse = [
      { ...hours([[20, 0]])[0]!, time: new Date(now.getTime() + 60 * 60 * 1000) },
      { ...hours([[19, 0.8]])[0]!, time: new Date(now.getTime() + 26 * 60 * 60 * 1000) },
    ];

    expect(getNextChange(sparse, 20, now)).toEqual({ kind: 'steady', time: null, temp: null });
  });

  it('ignores invalid timestamps instead of letting them contaminate ordering', () => {
    const invalid = { ...hours([[10, 0.9]])[0]!, time: new Date(Number.NaN) };
    const valid = hours([[20, 0]])[0]!;

    expect(getNextChange([invalid, valid], 20, now).kind).toBe('steady');
  });

  it('is steady when valid future samples show no meaningful change', () => {
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
  });

  it('is unavailable when no usable future samples remain', () => {
    const past = hours([[20, 0]])[0]!;
    past.time = new Date(now.getTime() - 60_000);
    const invalidTime = { ...hours([[20, 0]])[0]!, time: new Date(Number.NaN) };

    expect(getNextChange([], 20, now)).toEqual({ kind: 'unavailable', time: null, temp: null });
    expect(getNextChange([past], 20, now).kind).toBe('unavailable');
    expect(getNextChange([invalidTime], 20, now).kind).toBe('unavailable');
  });
});
