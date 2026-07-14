import { TURKISH_CITIES, type TurkishCity } from './cities';

const normalizeCityName = (value: string): string =>
  value
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]/g, '');

const CITY_METADATA_BY_NAME = new Map<string, TurkishCity>(
  TURKISH_CITIES.map(city => [normalizeCityName(city.name), city])
);

/**
 * Resolves API city names against the canonical 81-province dataset.
 * Diacritic-free values such as "Istanbul" and "Sanliurfa" are supported.
 */
export const getCityMetadata = (cityName: string): TurkishCity | undefined =>
  CITY_METADATA_BY_NAME.get(normalizeCityName(cityName));
