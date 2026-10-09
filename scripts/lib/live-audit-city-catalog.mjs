import { readFileSync } from 'node:fs';

// The page generator and the client route lookup both derive province names
// from this single canonical list. Do not maintain a separate audit allowlist.
const source = readFileSync(new URL('../../src/constants/cities.ts', import.meta.url), 'utf8');
// Extract province name and coordinates from the single source of truth.
const records = [...source.matchAll(
  /\{\s*name:\s*'([^']+)'[^\n]*?coordinates:\s*\{\s*lat:\s*(-?\d+(?:\.\d+)?),\s*lon:\s*(-?\d+(?:\.\d+)?)\s*\}/g
)].map(match => ({
  name: match[1],
  lat: Number(match[2]),
  lon: Number(match[3]),
}));
const names = records.map(record => record.name);

const ascii = { ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u' };
const slug = name => [...name]
  .map(character => ascii[character] ?? character)
  .join('')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

export const provinceNamesBySlug = new Map(names.map(name => [slug(name), name]));
export const provinceCentersBySlug = new Map(records.map(record => [
  slug(record.name),
  { lat: record.lat, lon: record.lon },
]));

if (names.length !== 81 || provinceNamesBySlug.size !== 81 || provinceCentersBySlug.size !== 81) {
  throw new Error(`Province catalog expected 81 unique names and coordinates, got ${names.length} records / ${provinceNamesBySlug.size} slugs`);
}

// A city provider may use a different spelling (e.g. Izmit/Kocaeli). Check
// that its actual weather coordinates are near the requested province instead.
export function cityCenterDistanceKm(provinceSlug, coordinates) {
  const center = provinceCentersBySlug.get(provinceSlug);
  if (!center || !coordinates ||
      !Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lon) ||
      Math.abs(coordinates.lat) > 90 || Math.abs(coordinates.lon) > 180) {
    return Number.POSITIVE_INFINITY;
  }
  const toRadians = Math.PI / 180;
  const latitudeDelta = (coordinates.lat - center.lat) * toRadians;
  const longitudeDelta = (coordinates.lon - center.lon) * toRadians;
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(center.lat * toRadians) * Math.cos(coordinates.lat * toRadians) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 12_742 * Math.asin(Math.min(1, Math.sqrt(a)));
}
