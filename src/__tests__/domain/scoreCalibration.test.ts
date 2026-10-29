import { describe, expect, it } from 'vitest';
import { aggregateHorizonScore, weightHorizonSlots } from '../../domain/decision/aggregateHorizon';
import {
  scoreWeatherWindow,
  type ScoreWeatherWindowInput,
} from '../../domain/decision/scoreWeatherWindow';
import type { Hava81ScoreBand } from '../../domain/decision/types';

/**
 * The bands a daily user expects for ordinary situations. Written from the review that found
 * steady rain, poor air and fog reading as "Uygun": if a curve is softened again, this fails.
 */
const HOUR_MS = 3_600_000;
const t0 = new Date('2026-08-28T09:00:00Z');
const calm: ScoreWeatherWindowInput = {
  time: t0,
  temperature: 20,
  apparentTemperature: 20,
  humidity: 60,
  windSpeed: 2,
  windGust: 4,
  uvIndex: 2,
  visibility: 20000,
  precipitationProbability: 0.05,
  precipitationMm: 0,
  weatherCode: 1,
};
const score = (overrides: Partial<ScoreWeatherWindowInput>) =>
  scoreWeatherWindow({ ...calm, ...overrides });

const expected: Array<[string, Partial<ScoreWeatherWindowInput>, Hava81ScoreBand]> = [
  ['a calm 20 °C hour', {}, 'excellent'],
  [
    'steady light rain (80 %, 1 mm/h)',
    { precipitationProbability: 0.8, precipitationMm: 1, weatherCode: 61 },
    'caution',
  ],
  [
    'moderate rain (90 %, 3 mm/h)',
    { precipitationProbability: 0.9, precipitationMm: 3, weatherCode: 63 },
    'difficult',
  ],
  [
    'a downpour (95 %, 6 mm/h)',
    { precipitationProbability: 0.95, precipitationMm: 6, weatherCode: 65 },
    'difficult',
  ],
  ['strong wind (13 m/s, gusts 18)', { windSpeed: 13, windGust: 18 }, 'caution'],
  ['feels like 33 °C', { temperature: 31, apparentTemperature: 33 }, 'caution'],
  ['feels like 38 °C', { temperature: 35, apparentTemperature: 38 }, 'difficult'],
  ['poor air quality (AQI 4)', { airQualityIndex: 4 }, 'caution'],
  ['fog (800 m)', { visibility: 800, weatherCode: 45 }, 'caution'],
  ['midday UV 9 (mitigable)', { uvIndex: 9 }, 'good'],
];

describe('score calibration: the band a daily user expects', () => {
  it.each(expected)('%s', (_name, overrides, band) => {
    expect(score(overrides).band).toBe(band);
  });

  it('treats a thunderstorm hour as a hazard, not a caution hour', () => {
    expect(
      score({ precipitationProbability: 0.7, precipitationMm: 2, weatherCode: 95 }).score
    ).toBeLessThanOrEqual(25);
  });

  it('never shows a named warning inside the top band, but keeps the order between hours', () => {
    const breezy = score({ windSpeed: 8.5, windGust: 12 });
    const windier = score({ windSpeed: 10, windGust: 14 });
    expect(breezy.reasons.length).toBeGreaterThan(0);
    expect(breezy.band).not.toBe('excellent');
    expect(breezy.score).toBeGreaterThan(windier.score);
  });

  it('calls a whole day of steady rain a caution day, not a good one', () => {
    const hours = Array.from({ length: 12 }, (_, index) =>
      score({
        time: new Date(t0.getTime() + index * HOUR_MS),
        precipitationProbability: 0.8,
        precipitationMm: 1,
        weatherCode: 61,
      })
    );
    const day = aggregateHorizonScore(
      weightHorizonSlots(hours, t0.getTime() + 12 * HOUR_MS, HOUR_MS)
    );
    expect(day).toBeLessThan(70);
  });

  it('weighs the step in progress only for the part still ahead', () => {
    const [weighted] = weightHorizonSlots(
      [score({}), score({ time: new Date(t0.getTime() + HOUR_MS) })],
      t0.getTime() + 12 * HOUR_MS,
      HOUR_MS,
      t0.getTime() + 50 * 60_000
    );
    expect(weighted.weightHours).toBeCloseTo(10 / 60, 2);
  });

  it('does not count wind chill twice in the cold', () => {
    const chilled = score({ temperature: 4, apparentTemperature: 0, windSpeed: 7 });
    const sameWindNoChill = score({ temperature: 4, apparentTemperature: 4, windSpeed: 7 });
    expect(chilled.penalties!.wind).toBeLessThan(sameWindNoChill.penalties!.wind);
  });
});
