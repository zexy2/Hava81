import { TURKISH_CITIES, type TurkishCity } from '../constants/cities';
import { getCityMetadata } from '../constants/cityMetadata';

const turkishAscii: Record<string, string> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  İ: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
};

export const citySlug = (name: string): string =>
  name
    .split('')
    .map(char => turkishAscii[char] ?? char)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const cityBySlug = new Map(TURKISH_CITIES.map(city => [citySlug(city.name), city]));

const EARTH_RADIUS_KM = 6_371;

const distanceKm = (latA: number, lonA: number, latB: number, lonB: number): number => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(latA);
  const lat2 = toRadians(latB);
  const deltaLat = toRadians(latB - latA);
  const deltaLon = toRadians(lonB - lonA);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
};

export const nearestTurkishProvince = (lat: number, lon: number): TurkishCity | undefined => {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return undefined;
  }

  let nearest: TurkishCity | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const city of TURKISH_CITIES) {
    const distance = distanceKm(lat, lon, city.coordinates.lat, city.coordinates.lon);
    if (distance < nearestDistance) {
      nearest = city;
      nearestDistance = distance;
    }
  }
  return nearest;
};

export type RouteLanguage = 'tr' | 'en';

const pathSegments = (pathname: string): string[] =>
  pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean);

/** `/en/…` URLs are the English edition (Faz 4); everything else is Turkish. */
export const languageFromPathname = (pathname: string): RouteLanguage | null =>
  pathSegments(pathname)[0] === 'en' ? 'en' : null;

/** `/` and `/en/` are the home pages. */
export const isHomePathname = (pathname: string): boolean => {
  const segments = pathSegments(pathname);
  return segments.length === 0 || (segments.length === 1 && segments[0] === 'en');
};

export const homePath = (language: string): string => (language === 'en' ? '/en/' : '/');

export const cityFromPathname = (pathname: string): TurkishCity | undefined => {
  const segments = pathSegments(pathname);
  const local = segments[0] === 'en' ? segments.slice(1) : segments;
  if (local.length !== 1) return undefined;
  return cityBySlug.get(local[0]);
};

export const cityPath = (name: string, language: string = 'tr'): string | null => {
  const city = getCityMetadata(name);
  if (!city) return null;
  const slug = citySlug(city.name);
  return language === 'en' ? `/en/${slug}/` : `/${slug}/`;
};

/** A path the app does not serve: not a home page, not a province page (Faz 4 404). */
export const isUnknownPathname = (pathname: string): boolean =>
  !isHomePathname(pathname) && !cityFromPathname(pathname) && pathname !== '/index.html';

const editDistance = (a: string, b: string): number => {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return previous[b.length];
};

/** Provinces whose slug is closest to the last segment of an unknown path. */
export const suggestProvincesForPath = (pathname: string, limit = 3): TurkishCity[] => {
  const segments = pathSegments(pathname).filter(segment => segment !== 'en');
  const last = segments[segments.length - 1] ?? '';
  let decoded = last;
  try {
    decoded = decodeURIComponent(last);
  } catch {
    // A malformed escape is matched as typed.
  }
  const query = citySlug(decoded);
  if (!query) return [];
  return TURKISH_CITIES.map(city => {
    const slug = citySlug(city.name);
    const prefixBonus = slug.startsWith(query.slice(0, 3)) ? -1 : 0;
    return { city, score: editDistance(query, slug) + prefixBonus };
  })
    .sort((a, b) => a.score - b.score || a.city.name.localeCompare(b.city.name, 'tr'))
    .slice(0, limit)
    .map(entry => entry.city);
};
