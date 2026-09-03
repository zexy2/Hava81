/**
 * Turkish Cities Constants
 * All 81 provinces of Turkey with plate codes and coordinates
 */

export interface TurkishCity {
  readonly name: string;
  readonly plateCode: number;
  readonly region: TurkishRegion;
  readonly coordinates: {
    readonly lat: number;
    readonly lon: number;
  };
}

export type TurkishRegion = 
  | 'Marmara'
  | 'Ege'
  | 'Akdeniz'
  | 'İç Anadolu'
  | 'Karadeniz'
  | 'Doğu Anadolu'
  | 'Güneydoğu Anadolu';

/**
 * All 81 Turkish provinces with metadata
 */
export const TURKISH_CITIES: readonly TurkishCity[] = Object.freeze([
  { name: 'Adana', plateCode: 1, region: 'Akdeniz', coordinates: { lat: 37.0, lon: 35.32 } },
  { name: 'Adıyaman', plateCode: 2, region: 'Güneydoğu Anadolu', coordinates: { lat: 37.76, lon: 38.27 } },
  { name: 'Afyonkarahisar', plateCode: 3, region: 'Ege', coordinates: { lat: 38.75, lon: 30.54 } },
  { name: 'Ağrı', plateCode: 4, region: 'Doğu Anadolu', coordinates: { lat: 39.72, lon: 43.05 } },
  { name: 'Aksaray', plateCode: 68, region: 'İç Anadolu', coordinates: { lat: 38.37, lon: 34.02 } },
  { name: 'Amasya', plateCode: 5, region: 'Karadeniz', coordinates: { lat: 40.65, lon: 35.83 } },
  { name: 'Ankara', plateCode: 6, region: 'İç Anadolu', coordinates: { lat: 39.93, lon: 32.86 } },
  { name: 'Antalya', plateCode: 7, region: 'Akdeniz', coordinates: { lat: 36.88, lon: 30.70 } },
  { name: 'Ardahan', plateCode: 75, region: 'Doğu Anadolu', coordinates: { lat: 41.11, lon: 42.70 } },
  { name: 'Artvin', plateCode: 8, region: 'Karadeniz', coordinates: { lat: 41.18, lon: 41.82 } },
  { name: 'Aydın', plateCode: 9, region: 'Ege', coordinates: { lat: 37.85, lon: 27.85 } },
  { name: 'Balıkesir', plateCode: 10, region: 'Marmara', coordinates: { lat: 39.65, lon: 27.88 } },
  { name: 'Bartın', plateCode: 74, region: 'Karadeniz', coordinates: { lat: 41.64, lon: 32.34 } },
  { name: 'Batman', plateCode: 72, region: 'Güneydoğu Anadolu', coordinates: { lat: 37.89, lon: 41.13 } },
  { name: 'Bayburt', plateCode: 69, region: 'Karadeniz', coordinates: { lat: 40.26, lon: 40.22 } },
  { name: 'Bilecik', plateCode: 11, region: 'Marmara', coordinates: { lat: 40.15, lon: 29.98 } },
  { name: 'Bingöl', plateCode: 12, region: 'Doğu Anadolu', coordinates: { lat: 38.88, lon: 40.50 } },
  { name: 'Bitlis', plateCode: 13, region: 'Doğu Anadolu', coordinates: { lat: 38.40, lon: 42.12 } },
  { name: 'Bolu', plateCode: 14, region: 'Karadeniz', coordinates: { lat: 40.73, lon: 31.61 } },
  { name: 'Burdur', plateCode: 15, region: 'Akdeniz', coordinates: { lat: 37.72, lon: 30.29 } },
  { name: 'Bursa', plateCode: 16, region: 'Marmara', coordinates: { lat: 40.19, lon: 29.06 } },
  { name: 'Çanakkale', plateCode: 17, region: 'Marmara', coordinates: { lat: 40.15, lon: 26.40 } },
  { name: 'Çankırı', plateCode: 18, region: 'İç Anadolu', coordinates: { lat: 40.60, lon: 33.62 } },
  { name: 'Çorum', plateCode: 19, region: 'Karadeniz', coordinates: { lat: 40.55, lon: 34.95 } },
  { name: 'Denizli', plateCode: 20, region: 'Ege', coordinates: { lat: 37.77, lon: 29.09 } },
  { name: 'Diyarbakır', plateCode: 21, region: 'Güneydoğu Anadolu', coordinates: { lat: 37.91, lon: 40.24 } },
  { name: 'Düzce', plateCode: 81, region: 'Karadeniz', coordinates: { lat: 40.84, lon: 31.16 } },
  { name: 'Edirne', plateCode: 22, region: 'Marmara', coordinates: { lat: 41.67, lon: 26.56 } },
  { name: 'Elazığ', plateCode: 23, region: 'Doğu Anadolu', coordinates: { lat: 38.67, lon: 39.22 } },
  { name: 'Erzincan', plateCode: 24, region: 'Doğu Anadolu', coordinates: { lat: 39.75, lon: 39.49 } },
  { name: 'Erzurum', plateCode: 25, region: 'Doğu Anadolu', coordinates: { lat: 39.90, lon: 41.27 } },
  { name: 'Eskişehir', plateCode: 26, region: 'İç Anadolu', coordinates: { lat: 39.77, lon: 30.52 } },
  { name: 'Gaziantep', plateCode: 27, region: 'Güneydoğu Anadolu', coordinates: { lat: 37.07, lon: 37.38 } },
  { name: 'Giresun', plateCode: 28, region: 'Karadeniz', coordinates: { lat: 40.91, lon: 38.39 } },
  { name: 'Gümüşhane', plateCode: 29, region: 'Karadeniz', coordinates: { lat: 40.46, lon: 39.48 } },
  { name: 'Hakkari', plateCode: 30, region: 'Doğu Anadolu', coordinates: { lat: 37.58, lon: 43.74 } },
  { name: 'Hatay', plateCode: 31, region: 'Akdeniz', coordinates: { lat: 36.20, lon: 36.16 } },
  { name: 'Iğdır', plateCode: 76, region: 'Doğu Anadolu', coordinates: { lat: 39.92, lon: 44.04 } },
  { name: 'Isparta', plateCode: 32, region: 'Akdeniz', coordinates: { lat: 37.76, lon: 30.55 } },
  { name: 'İstanbul', plateCode: 34, region: 'Marmara', coordinates: { lat: 41.01, lon: 28.97 } },
  { name: 'İzmir', plateCode: 35, region: 'Ege', coordinates: { lat: 38.42, lon: 27.13 } },
  { name: 'Kahramanmaraş', plateCode: 46, region: 'Akdeniz', coordinates: { lat: 37.58, lon: 36.94 } },
  { name: 'Karabük', plateCode: 78, region: 'Karadeniz', coordinates: { lat: 41.20, lon: 32.62 } },
  { name: 'Karaman', plateCode: 70, region: 'İç Anadolu', coordinates: { lat: 37.18, lon: 33.22 } },
  { name: 'Kars', plateCode: 36, region: 'Doğu Anadolu', coordinates: { lat: 40.60, lon: 43.09 } },
  { name: 'Kastamonu', plateCode: 37, region: 'Karadeniz', coordinates: { lat: 41.39, lon: 33.78 } },
  { name: 'Kayseri', plateCode: 38, region: 'İç Anadolu', coordinates: { lat: 38.73, lon: 35.49 } },
  { name: 'Kırıkkale', plateCode: 71, region: 'İç Anadolu', coordinates: { lat: 39.85, lon: 33.51 } },
  { name: 'Kırklareli', plateCode: 39, region: 'Marmara', coordinates: { lat: 41.73, lon: 27.22 } },
  { name: 'Kırşehir', plateCode: 40, region: 'İç Anadolu', coordinates: { lat: 39.14, lon: 34.16 } },
  { name: 'Kilis', plateCode: 79, region: 'Güneydoğu Anadolu', coordinates: { lat: 36.72, lon: 37.12 } },
  { name: 'Kocaeli', plateCode: 41, region: 'Marmara', coordinates: { lat: 40.85, lon: 29.88 } },
  { name: 'Konya', plateCode: 42, region: 'İç Anadolu', coordinates: { lat: 37.87, lon: 32.48 } },
  { name: 'Kütahya', plateCode: 43, region: 'Ege', coordinates: { lat: 39.42, lon: 29.98 } },
  { name: 'Malatya', plateCode: 44, region: 'Doğu Anadolu', coordinates: { lat: 38.35, lon: 38.31 } },
  { name: 'Manisa', plateCode: 45, region: 'Ege', coordinates: { lat: 38.61, lon: 27.43 } },
  { name: 'Mardin', plateCode: 47, region: 'Güneydoğu Anadolu', coordinates: { lat: 37.31, lon: 40.73 } },
  { name: 'Mersin', plateCode: 33, region: 'Akdeniz', coordinates: { lat: 36.80, lon: 34.64 } },
  { name: 'Muğla', plateCode: 48, region: 'Ege', coordinates: { lat: 37.21, lon: 28.36 } },
  { name: 'Muş', plateCode: 49, region: 'Doğu Anadolu', coordinates: { lat: 38.75, lon: 41.51 } },
  { name: 'Nevşehir', plateCode: 50, region: 'İç Anadolu', coordinates: { lat: 38.62, lon: 34.71 } },
  { name: 'Niğde', plateCode: 51, region: 'İç Anadolu', coordinates: { lat: 37.97, lon: 34.68 } },
  { name: 'Ordu', plateCode: 52, region: 'Karadeniz', coordinates: { lat: 40.98, lon: 37.88 } },
  { name: 'Osmaniye', plateCode: 80, region: 'Akdeniz', coordinates: { lat: 37.07, lon: 36.25 } },
  { name: 'Rize', plateCode: 53, region: 'Karadeniz', coordinates: { lat: 41.02, lon: 40.52 } },
  { name: 'Sakarya', plateCode: 54, region: 'Marmara', coordinates: { lat: 40.69, lon: 30.40 } },
  { name: 'Samsun', plateCode: 55, region: 'Karadeniz', coordinates: { lat: 41.29, lon: 36.33 } },
  { name: 'Siirt', plateCode: 56, region: 'Güneydoğu Anadolu', coordinates: { lat: 37.93, lon: 41.94 } },
  { name: 'Sinop', plateCode: 57, region: 'Karadeniz', coordinates: { lat: 42.03, lon: 35.15 } },
  { name: 'Sivas', plateCode: 58, region: 'İç Anadolu', coordinates: { lat: 39.75, lon: 37.02 } },
  { name: 'Şanlıurfa', plateCode: 63, region: 'Güneydoğu Anadolu', coordinates: { lat: 37.16, lon: 38.79 } },
  { name: 'Şırnak', plateCode: 73, region: 'Güneydoğu Anadolu', coordinates: { lat: 37.52, lon: 42.46 } },
  { name: 'Tekirdağ', plateCode: 59, region: 'Marmara', coordinates: { lat: 40.98, lon: 27.51 } },
  { name: 'Tokat', plateCode: 60, region: 'Karadeniz', coordinates: { lat: 40.31, lon: 36.55 } },
  { name: 'Trabzon', plateCode: 61, region: 'Karadeniz', coordinates: { lat: 41.00, lon: 39.72 } },
  { name: 'Tunceli', plateCode: 62, region: 'Doğu Anadolu', coordinates: { lat: 39.11, lon: 39.55 } },
  { name: 'Uşak', plateCode: 64, region: 'Ege', coordinates: { lat: 38.68, lon: 29.41 } },
  { name: 'Van', plateCode: 65, region: 'Doğu Anadolu', coordinates: { lat: 38.50, lon: 43.38 } },
  { name: 'Yalova', plateCode: 77, region: 'Marmara', coordinates: { lat: 40.65, lon: 29.28 } },
  { name: 'Yozgat', plateCode: 66, region: 'İç Anadolu', coordinates: { lat: 39.82, lon: 34.80 } },
  { name: 'Zonguldak', plateCode: 67, region: 'Karadeniz', coordinates: { lat: 41.45, lon: 31.79 } },
]);

/**
 * Simple city name list for autocomplete (backward compatible)
 */
export const TURKIYE_SEHIRLERI: readonly string[] = Object.freeze(
  TURKISH_CITIES.map(city => city.name).sort((a, b) => a.localeCompare(b, 'tr'))
);

/** Normalize Turkish province names for case- and diacritic-insensitive matching. */
export const normalizeCitySearchText = (value: string): string =>
  value
    .trim()
    .replace(/[İIı]/g, 'i')
    .replace(/[Üü]/g, 'u')
    .replace(/[Öö]/g, 'o')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Çç]/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Get city by name
 */
export const getCityByName = (name: string): TurkishCity | undefined => {
  const normalizedName = normalizeCitySearchText(name);
  if (!normalizedName) return undefined;
  return TURKISH_CITIES.find(city => normalizeCitySearchText(city.name) === normalizedName);
};

/**
 * Get cities by region
 */
export const getCitiesByRegion = (region: TurkishRegion): readonly TurkishCity[] => {
  return TURKISH_CITIES.filter(city => city.region === region);
};

/**
 * Search cities by partial name
 */
export const searchCities = (query: string): readonly TurkishCity[] => {
  const normalizedQuery = normalizeCitySearchText(query);
  if (!normalizedQuery) return [];
  
  return TURKISH_CITIES.filter(city =>
    normalizeCitySearchText(city.name).includes(normalizedQuery)
  );
};

export default TURKIYE_SEHIRLERI;
