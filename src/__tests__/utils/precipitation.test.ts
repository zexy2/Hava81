import { formatPrecipitationAmount, normalizePrecipitationProbability } from '../../utils/precipitation';

describe('normalizePrecipitationProbability', () => {
  it.each([
    [0.25, 0.25],
    [1, 0.01],
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


describe('formatPrecipitationAmount', () => {
  it('uses locale-aware decimal separators and preserves trace amounts', () => {
    expect(formatPrecipitationAmount(0.8, 'tr-TR')).toBe('0,8 mm');
    expect(formatPrecipitationAmount(0.8, 'en-US')).toBe('0.8 mm');
    expect(formatPrecipitationAmount(0.04, 'tr-TR')).toBe('<0,1 mm');
  });

  it('omits zero, negative, missing and invalid amounts', () => {
    expect(formatPrecipitationAmount(0, 'tr-TR')).toBeNull();
    expect(formatPrecipitationAmount(-0.1, 'tr-TR')).toBeNull();
    expect(formatPrecipitationAmount(undefined, 'tr-TR')).toBeNull();
    expect(formatPrecipitationAmount(Number.NaN, 'tr-TR')).toBeNull();
  });
});
