import { normalizePrecipitationProbability } from '../../utils/precipitation';

describe('normalizePrecipitationProbability', () => {
  it.each([
    [0.25, 0.25],
    [25, 0.25],
    [0, 0],
    [100, 1],
    [140, 1],
    [-5, 0],
    [Number.NaN, 0],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalizePrecipitationProbability(input)).toBe(expected);
  });
});
