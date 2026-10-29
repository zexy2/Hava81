import { ANATOLIA, THRACE, TURKEY_BOUNDS } from '../../hava81/instruments/turkeyOutline';
import {
  interpolate,
  latFromMercatorY,
  mercatorY,
  pointInRing,
  rampColor,
  type LayerSample,
  type MapLayer,
} from './layerModel';

/** Lat/lon corners of the drawn field, in Leaflet's [[south, west], [north, east]] order. */
export const FIELD_BOUNDS: [[number, number], [number, number]] = [
  [TURKEY_BOUNDS.south, TURKEY_BOUNDS.west],
  [TURKEY_BOUNDS.north, TURKEY_BOUNDS.east],
];

const FIELD_WIDTH = 520;

/**
 * Paints one layer as a soft field clipped to Türkiye's outline and returns it as a PNG
 * data URL. Rows are sampled in Web Mercator so the image sits exactly on Leaflet's map;
 * pixels outside the country stay transparent. Returns null when there is nothing to draw
 * or no canvas (tests, very old browsers).
 */
export function renderField(samples: readonly LayerSample[], layer: MapLayer): string | null {
  if (samples.length === 0 || typeof document === 'undefined') return null;
  const top = mercatorY(TURKEY_BOUNDS.north);
  const bottom = mercatorY(TURKEY_BOUNDS.south);
  const lonSpanRadians = ((TURKEY_BOUNDS.east - TURKEY_BOUNDS.west) * Math.PI) / 180;
  const height = Math.max(1, Math.round((FIELD_WIDTH * (top - bottom)) / lonSpanRadians));

  const canvas = document.createElement('canvas');
  canvas.width = FIELD_WIDTH;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.createImageData(FIELD_WIDTH, height);

  for (let row = 0; row < height; row += 1) {
    const lat = latFromMercatorY(top - ((row + 0.5) / height) * (top - bottom));
    for (let column = 0; column < FIELD_WIDTH; column += 1) {
      const lon =
        TURKEY_BOUNDS.west +
        ((column + 0.5) / FIELD_WIDTH) * (TURKEY_BOUNDS.east - TURKEY_BOUNDS.west);
      if (!pointInRing(lon, lat, ANATOLIA) && !pointInRing(lon, lat, THRACE)) continue;
      const value = interpolate(samples, lat, lon);
      if (value === null) continue;
      const [red, green, blue, alpha] = rampColor(layer, value);
      const offset = (row * FIELD_WIDTH + column) * 4;
      image.data[offset] = red;
      image.data[offset + 1] = green;
      image.data[offset + 2] = blue;
      image.data[offset + 3] = Math.round(alpha * 255);
    }
  }
  context.putImageData(image, 0, 0);
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
