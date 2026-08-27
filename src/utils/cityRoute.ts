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

export const cityFromPathname = (pathname: string): TurkishCity | undefined => {
  const slug = pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
  return slug ? cityBySlug.get(slug) : undefined;
};

export const cityPath = (name: string): string | null => {
  const city = TURKISH_CITIES.find(
    candidate => candidate.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR')
  );
  return city ? `/${citySlug(city.name)}` : null;
};
