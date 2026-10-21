import { describe, expect, it } from 'vitest';
import { suggestCity } from '../../utils/citySuggestion';

describe('suggestCity', () => {
  it('suggests the closest province for a typo', () => {
    expect(suggestCity('Istanbl')?.name).toBe('İstanbul');
    expect(suggestCity('ankra')?.name).toBe('Ankara');
    expect(suggestCity('izm')?.name).toBe('İzmir');
  });
  it('returns null for nonsense', () => {
    expect(suggestCity('xqzwplk')).toBeNull();
    expect(suggestCity('a')).toBeNull();
  });
});
