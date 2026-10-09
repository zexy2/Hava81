import { readFileSync } from 'node:fs';

// The page generator and the client route lookup both derive province names
// from this single canonical list. Do not maintain a separate audit allowlist.
const source = readFileSync(new URL('../../src/constants/cities.ts', import.meta.url), 'utf8');
const names = [...source.matchAll(/\{ name: '([^']+)'/g)].map(match => match[1]);

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
if (names.length !== 81 || provinceNamesBySlug.size !== 81) {
  throw new Error(`Live audit expected 81 unique provinces, got ${names.length} records / ${provinceNamesBySlug.size} slugs`);
}
