import { citySlug } from './cityRoute';

const marineCitySlugs = new Set(
  [
    'İstanbul',
    'İzmir',
    'Antalya',
    'Mersin',
    'Samsun',
    'Trabzon',
    'Rize',
    'Ordu',
    'Giresun',
    'Sinop',
    'Zonguldak',
    'Bartın',
    'Çanakkale',
    'Tekirdağ',
    'Yalova',
    'Kocaeli',
    'Muğla',
    'Aydın',
    'Balıkesir',
    'Hatay',
  ].map(citySlug)
);

export const supportsMarineContext = (cityName?: string) =>
  Boolean(cityName && marineCitySlugs.has(citySlug(cityName)));
