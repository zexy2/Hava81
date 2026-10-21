import { z } from 'zod';

/**
 * Türkiye'yi (ve kıyı sularını) kapsayan, küçük paylı sınır kutusu.
 * Türkiye: enlem ~35.8–42.1, boylam ~25.6–44.8.
 * Bu kutunun dışındaki koordinatlar upstream kotasını korumak için reddedilir.
 */
export const TURKEY_BOUNDS = { minLat: 35.5, maxLat: 42.5, minLon: 25.5, maxLon: 45 } as const;

const OUTSIDE = 'Koordinat Türkiye sınırları dışında.';

export const turkeyLatitudeSchema = z.coerce
  .number()
  .min(TURKEY_BOUNDS.minLat, OUTSIDE)
  .max(TURKEY_BOUNDS.maxLat, OUTSIDE);
export const turkeyLongitudeSchema = z.coerce
  .number()
  .min(TURKEY_BOUNDS.minLon, OUTSIDE)
  .max(TURKEY_BOUNDS.maxLon, OUTSIDE);

export const turkeyLatJsonSchema = {
  type: 'number',
  minimum: TURKEY_BOUNDS.minLat,
  maximum: TURKEY_BOUNDS.maxLat,
} as const;
export const turkeyLonJsonSchema = {
  type: 'number',
  minimum: TURKEY_BOUNDS.minLon,
  maximum: TURKEY_BOUNDS.maxLon,
} as const;

/** Cache anahtarı için koordinatı 2 ondalık haneye (~1 km) yuvarlar. */
export const coordinateCacheKey = (lat: number, lon: number): string =>
  `${lat.toFixed(2)}:${lon.toFixed(2)}`;
