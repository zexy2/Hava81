const marineCityNames = new Set([
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
]);

export const supportsMarineContext = (cityName?: string) =>
  Boolean(cityName && marineCityNames.has(cityName));
