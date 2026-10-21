import { describe, expect, it } from 'vitest';
import {
  cityFromPathname,
  cityPath,
  citySlug,
  homePath,
  isHomePathname,
  isUnknownPathname,
  languageFromPathname,
  nearestTurkishProvince,
  suggestProvincesForPath,
} from '../../utils/cityRoute';

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
    expect(cityPath('Şanlıurfa Province')).toBe('/sanliurfa/');
    expect(cityPath('Izmir Province')).toBe('/izmir/');
    expect(cityPath('Urla Province')).toBeNull();
    expect(cityPath('Şanlıurfa District')).toBeNull();
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

  describe('English edition and 404 (Faz 4)', () => {
    it('resolves /en/<il>/ to the same province and builds locale-aware paths', () => {
      expect(cityFromPathname('/en/istanbul/')?.name).toBe('İstanbul');
      expect(cityFromPathname('/en/')).toBeUndefined();
      expect(cityFromPathname('/en/istanbul/extra')).toBeUndefined();
      expect(cityPath('Şanlıurfa', 'en')).toBe('/en/sanliurfa/');
      expect(cityPath('Şanlıurfa')).toBe('/sanliurfa/');
      expect(homePath('en')).toBe('/en/');
      expect(homePath('tr')).toBe('/');
    });

    it('reads the language and the home pages from the URL', () => {
      expect(languageFromPathname('/en/ankara/')).toBe('en');
      expect(languageFromPathname('/en')).toBe('en');
      expect(languageFromPathname('/ankara/')).toBeNull();
      expect(isHomePathname('/')).toBe(true);
      expect(isHomePathname('/en/')).toBe(true);
      expect(isHomePathname('/en')).toBe(true);
      expect(isHomePathname('/ankara/')).toBe(false);
    });

    it('flags only paths the app does not serve as unknown', () => {
      expect(isUnknownPathname('/istanbl/')).toBe(true);
      expect(isUnknownPathname('/en/nowhere/')).toBe(true);
      expect(isUnknownPathname('/istanbul/kadikoy')).toBe(true);
      expect(isUnknownPathname('/')).toBe(false);
      expect(isUnknownPathname('/en/')).toBe(false);
      expect(isUnknownPathname('/izmir/')).toBe(false);
      expect(isUnknownPathname('/en/izmir/')).toBe(false);
      expect(isUnknownPathname('/index.html')).toBe(false);
    });

    it('suggests the closest provinces for a mistyped address', () => {
      expect(suggestProvincesForPath('/istanbl/')[0]?.name).toBe('İstanbul');
      expect(suggestProvincesForPath('/en/ankra/')[0]?.name).toBe('Ankara');
      expect(suggestProvincesForPath('/%C5%9Fanl%C4%B1urfa-x/')[0]?.name).toBe('Şanlıurfa');
      expect(suggestProvincesForPath('/izmr/', 2)).toHaveLength(2);
      expect(suggestProvincesForPath('/%E0%A4%A/')).toHaveLength(3);
      expect(suggestProvincesForPath('/')).toEqual([]);
    });
  });
});
