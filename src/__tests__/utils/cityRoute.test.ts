import { describe, expect, it } from 'vitest';
import { cityFromPathname, cityPath, citySlug } from '../../utils/cityRoute';

describe('city routes', () => {
  it('creates stable ASCII slugs for Turkish city names', () => {
    expect(citySlug('İstanbul')).toBe('istanbul');
    expect(citySlug('Şanlıurfa')).toBe('sanliurfa');
    expect(citySlug('Çanakkale')).toBe('canakkale');
  });

  it('resolves canonical city routes both ways', () => {
    expect(cityPath('İstanbul')).toBe('/istanbul/');
    expect(cityFromPathname('/sanliurfa')?.name).toBe('Şanlıurfa');
  });

  it('rejects non-canonical nested deep links instead of treating them as a city page', () => {
    expect(cityFromPathname('/istanbul/anything')).toBeUndefined();
    expect(cityFromPathname('/istanbul/')).toEqual(expect.objectContaining({ name: 'İstanbul' }));
  });

  it('does not invent routes for provider-only locations', () => {
    expect(cityPath('London')).toBeNull();
  });
});
