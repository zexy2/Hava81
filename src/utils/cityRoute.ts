import { TURKISH_CITIES, type TurkishCity } from '../constants/cities';

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
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
};

export const nearestTurkishProvince = (lat: number, lon: number): TurkishCity | undefined => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
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

export const cityFromPathname = (pathname: string): TurkishCity | undefined => {
  const segments = pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean);
  if (segments.length !== 1) return undefined;
  return cityBySlug.get(segments[0]);
};

export const cityPath = (name: string): string | null => {
  const city = cityBySlug.get(citySlug(name));
  return city ? `/${citySlug(city.name)}/` : null;
};
