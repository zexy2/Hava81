import { describe, expect, it } from 'vitest';
import { getCityByName, normalizeCitySearchText, searchCities } from '../../constants/cities';

describe('Turkish city search normalization', () => {
  it('normalizes dotted and dotless I plus Turkish diacritics consistently', () => {
    expect(normalizeCitySearchText(' IĞDIR ')).toBe('igdir');
    expect(normalizeCitySearchText('ığdır')).toBe('igdir');
    expect(normalizeCitySearchText('İZMİR')).toBe('izmir');
  });

  it('resolves Iğdır from Turkish and ASCII case variants', () => {
    expect(getCityByName('ığdır')?.name).toBe('Iğdır');
    expect(getCityByName('IGDIR')?.name).toBe('Iğdır');
  });

  it('finds Turkish provinces from ASCII partial queries', () => {
    expect(searchCities('ig').map(city => city.name)).toContain('Iğdır');
    expect(searchCities('sanli').map(city => city.name)).toContain('Şanlıurfa');
  });
});
