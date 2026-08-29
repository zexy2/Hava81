import { describe, expect, it } from 'vitest';
import { findBestWindowRange } from '../../domain/decision/bestWindowRange';
import type { ScoredWeatherWindow } from '../../domain/decision/types';

const slot = (hour: number, score: number): ScoredWeatherWindow => ({
  time: new Date(Date.UTC(2026, 7, 29, hour)),
  score,
  band: score >= 97 ? 'excellent' : score >= 75 ? 'good' : score >= 55 ? 'caution' : 'difficult',
  temperature: 24,
  apparentTemperature: 24,
  precipitationProbability: 0,
  windSpeed: 3,
  reasons: [],
  impacts: [],
});

describe('findBestWindowRange', () => {
  it('groups adjacent near-peak hours instead of inventing one uniquely best clock tick', () => {
    const range = findBestWindowRange([
      slot(17, 88),
      slot(18, 92),
      slot(19, 95),
      slot(20, 93),
      slot(21, 87),
    ]);

    expect(range?.peak.time.toISOString()).toBe('2026-08-29T19:00:00.000Z');
    expect(range?.start.time.toISOString()).toBe('2026-08-29T18:00:00.000Z');
    expect(range?.end.time.toISOString()).toBe('2026-08-29T20:00:00.000Z');
  });

  it('does not extend a risk-free best range into a neighboring slot with a surfaced risk', () => {
    const cleanPeak = slot(22, 98);
    const cleanNeighbor = slot(23, 97);
    const rainyNeighbor = { ...slot(0, 96), reasons: ['rain-risk' as const] };
    rainyNeighbor.time = new Date(Date.UTC(2026, 7, 30, 0));

    const range = findBestWindowRange([cleanPeak, cleanNeighbor, rainyNeighbor]);

    expect(range?.start.time.toISOString()).toBe('2026-08-29T22:00:00.000Z');
    expect(range?.end.time.toISOString()).toBe('2026-08-29T23:00:00.000Z');
  });

  it('does not bridge a forecast gap just because both sides have similar scores', () => {
    const range = findBestWindowRange([
      slot(18, 94),
      slot(19, 96),
      slot(23, 95),
    ]);

    expect(range?.start.time.toISOString()).toBe('2026-08-29T18:00:00.000Z');
    expect(range?.end.time.toISOString()).toBe('2026-08-29T19:00:00.000Z');
  });

  it('supports three-hour forecast cadence and keeps a single slot when neighbors are materially worse', () => {
    const range = findBestWindowRange([slot(12, 80), slot(15, 91), slot(18, 84)]);
    expect(range?.start.time.toISOString()).toBe('2026-08-29T15:00:00.000Z');
    expect(range?.end.time.toISOString()).toBe('2026-08-29T15:00:00.000Z');
  });

  it('caps a long flat near-best period to a practical four-hour recommendation', () => {
    const range = findBestWindowRange([
      slot(17, 97),
      slot(18, 97),
      slot(19, 97),
      slot(20, 97),
      slot(21, 97),
      slot(22, 97),
      slot(23, 97),
    ]);

    expect(range?.peak.time.toISOString()).toBe('2026-08-29T17:00:00.000Z');
    expect(range?.start.time.toISOString()).toBe('2026-08-29T17:00:00.000Z');
    expect(range?.end.time.toISOString()).toBe('2026-08-29T21:00:00.000Z');
  });

  it('chooses the stronger side of a peak when three-hour cadence cannot fit both neighbors', () => {
    const range = findBestWindowRange([slot(12, 94), slot(15, 96), slot(18, 95)]);

    expect(range?.start.time.toISOString()).toBe('2026-08-29T15:00:00.000Z');
    expect(range?.end.time.toISOString()).toBe('2026-08-29T18:00:00.000Z');
  });
});
