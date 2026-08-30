import { describe, expect, it } from 'vitest';
import { cityFromPathname, cityPath, citySlug, nearestTurkishProvince } from '../../utils/cityRoute';

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

  it('accepts localized provider spellings for canonical province routes', () => {
    expect(cityPath('Istanbul')).toBe('/istanbul/');
    expect(cityPath('Canakkale')).toBe('/canakkale/');
  });

  it('rejects non-canonical nested deep links instead of treating them as a city page', () => {
    expect(cityFromPathname('/istanbul/anything')).toBeUndefined();
    expect(cityFromPathname('/istanbul/')).toEqual(expect.objectContaining({ name: 'İstanbul' }));
  });

  it('does not invent routes for provider-only locations', () => {
    expect(cityPath('London')).toBeNull();
  });

  it('maps Turkish coordinates to the nearest canonical province identity', () => {
    expect(nearestTurkishProvince(39.9334, 32.8597)?.name).toBe('Ankara');
    expect(nearestTurkishProvince(36.5444, 31.9954)?.name).toBe('Antalya');
    expect(nearestTurkishProvince(36.6217, 29.1164)?.name).toBe('Muğla');
  });

  it('rejects invalid coordinates instead of inventing a province', () => {
    expect(nearestTurkishProvince(Number.NaN, 32)).toBeUndefined();
    expect(nearestTurkishProvince(95, 32)).toBeUndefined();
  });
});
