/**
 * Simplified Türkiye outline (Thrace and Anatolia, lon/lat) and an equirectangular
 * projection scaled by cos(39°) so the silhouette keeps its proportions.
 */
export const TURKEY_BOUNDS = { west: 26, east: 45, north: 42.15, south: 35.8 } as const;

const ASPECT = ((TURKEY_BOUNDS.east - TURKEY_BOUNDS.west) * Math.cos((39 * Math.PI) / 180)) /
  (TURKEY_BOUNDS.north - TURKEY_BOUNDS.south);

export const TURKEY_VIEWBOX = { width: Math.round(100 * ASPECT), height: 100 } as const;

const THRACE: ReadonlyArray<readonly [number, number]> = [
  [26.05, 40.72], [26.2, 40.08], [26.7, 40.45], [27.5, 40.97], [28.9, 40.98], [29.05, 41.1],
  [29.1, 41.24], [28.6, 41.5], [28.0, 41.98], [27.4, 42.05], [26.6, 41.65], [26.35, 41.25],
];

const ANATOLIA: ReadonlyArray<readonly [number, number]> = [
  [29.1, 41.2], [30.3, 41.2], [31.4, 41.3], [32.3, 41.73], [33.3, 42.0], [35.1, 42.02],
  [36.1, 41.7], [36.9, 41.35], [37.8, 41.1], [38.4, 40.95], [39.7, 41.0], [40.6, 41.1],
  [41.5, 41.5], [42.5, 41.45], [43.4, 41.1], [43.7, 40.7], [44.8, 39.7], [44.4, 39.4],
  [44.2, 38.9], [44.5, 38.3], [44.3, 37.9], [44.8, 37.3], [44.2, 37.2], [42.8, 37.35],
  [42.0, 37.1], [41.2, 37.08], [40.2, 37.1], [39.2, 36.7], [38.2, 36.9], [37.0, 36.65],
  [36.65, 36.2], [36.0, 35.82], [35.8, 36.3], [36.2, 36.6], [35.6, 36.6], [34.6, 36.8],
  [33.6, 36.2], [32.6, 36.1], [32.0, 36.5], [30.7, 36.85], [30.4, 36.3], [29.6, 36.2],
  [28.9, 36.7], [28.0, 36.6], [27.4, 37.0], [27.2, 37.9], [26.3, 38.3], [26.8, 38.7],
  [26.7, 39.3], [26.15, 39.5], [26.4, 40.0], [27.3, 40.4], [28.0, 40.4], [29.0, 40.4],
  [29.9, 40.72], [29.3, 40.85], [29.05, 41.0],
];

/** Share of the way across (x) and down (y) the bounds, both 0–1. */
export const projectTurkey = (lon: number, lat: number) => ({
  x: (lon - TURKEY_BOUNDS.west) / (TURKEY_BOUNDS.east - TURKEY_BOUNDS.west),
  y: (TURKEY_BOUNDS.north - lat) / (TURKEY_BOUNDS.north - TURKEY_BOUNDS.south),
});

const toPath = (ring: ReadonlyArray<readonly [number, number]>) =>
  ring
    .map(([lon, lat], index) => {
      const { x, y } = projectTurkey(lon, lat);
      const px = (x * TURKEY_VIEWBOX.width).toFixed(1);
      const py = (y * TURKEY_VIEWBOX.height).toFixed(1);
      return `${index === 0 ? 'M' : 'L'}${px} ${py}`;
    })
    .join(' ') + ' Z';

export const TURKEY_PATH = `${toPath(THRACE)} ${toPath(ANATOLIA)}`;
