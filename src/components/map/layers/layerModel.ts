import type { ProvinceTemperature } from '../../../api/weatherService';

export type MapLayer = 'precipitation' | 'temperature' | 'wind' | 'cloud';
export const MAP_LAYERS: readonly MapLayer[] = ['precipitation', 'temperature', 'wind', 'cloud'];

/** Hours on the time scrubber; 0 is the current reading. */
export const LAYER_HOURS = [0, 3, 6] as const;
export type LayerHour = (typeof LAYER_HOURS)[number];

/** Layers with a forecast outlook; wind and cloud are current readings only. */
export const layerHasOutlook = (layer: MapLayer) =>
  layer === 'precipitation' || layer === 'temperature';

export interface LayerSample {
  lat: number;
  lon: number;
  value: number;
}

/**
 * What the precipitation layer reads. The chance of rain (%) when the provider reports it;
 * otherwise the hourly amount (mm), which MET Norway publishes for Türkiye but not a chance.
 */
export type PrecipitationMeasure = 'chance' | 'amount';

export const precipitationMeasure = (
  provinces: Iterable<ProvinceTemperature>
): PrecipitationMeasure => {
  for (const province of provinces) {
    if (typeof province.precipitationProbability === 'number') return 'chance';
    if (province.outlook?.some(point => typeof point.precipitationProbability === 'number')) {
      return 'chance';
    }
  }
  return 'amount';
};

/**
 * One province's value for a layer at an hour, or null when the reading is missing.
 * Precipitation reads the chance (%) or the amount (mm/h); temperature °C; cloud %; wind m/s.
 */
export const layerValue = (
  province: ProvinceTemperature,
  layer: MapLayer,
  hour: LayerHour,
  measure: PrecipitationMeasure = 'chance'
): number | null => {
  if (hour !== 0 && layerHasOutlook(layer)) {
    const point = province.outlook?.find(item => item.hourOffset === hour);
    if (!point) return null;
    const value =
      layer === 'precipitation'
        ? measure === 'amount'
          ? point.precipitation
          : point.precipitationProbability
        : point.temperature;
    return typeof value === 'number' ? value : null;
  }
  switch (layer) {
    case 'precipitation':
      return (measure === 'amount' ? province.precipitation : province.precipitationProbability) ?? null;
    case 'temperature':
      return province.temperature;
    case 'cloud':
      return province.cloudCover ?? null;
    case 'wind':
      return province.windSpeed ?? null;
  }
};

export const layerSamples = (
  provinces: Iterable<ProvinceTemperature>,
  layer: MapLayer,
  hour: LayerHour,
  measure: PrecipitationMeasure = 'chance'
): LayerSample[] => {
  const samples: LayerSample[] = [];
  for (const province of provinces) {
    const value = layerValue(province, layer, hour, measure);
    if (value !== null) samples.push({ lat: province.lat, lon: province.lon, value });
  }
  return samples;
};

/**
 * Inverse-distance weighting with power 2: a smooth field between stations that still
 * passes exactly through each one. Distances are in degrees, scaled for longitude so a
 * degree east weighs the same ground distance as a degree north at Türkiye's latitude.
 */
export const interpolate = (samples: readonly LayerSample[], lat: number, lon: number) => {
  if (samples.length === 0) return null;
  const lonScale = Math.cos((lat * Math.PI) / 180);
  let weighted = 0;
  let weights = 0;
  for (const sample of samples) {
    const dx = (sample.lon - lon) * lonScale;
    const dy = sample.lat - lat;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < 1e-9) return sample.value;
    const weight = 1 / distanceSquared;
    weighted += weight * sample.value;
    weights += weight;
  }
  return weighted / weights;
};

/** Web Mercator y for a latitude, so canvas rows land where Leaflet draws them. */
export const mercatorY = (lat: number) => {
  const radians = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
};

export const latFromMercatorY = (y: number) => (Math.atan(Math.sinh(y)) * 180) / Math.PI;

export const pointInRing = (
  lon: number,
  lat: number,
  ring: ReadonlyArray<readonly [number, number]>
) => {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

/** Meteorological direction is where the wind comes from; the arrow points downwind. */
export const downwindRotation = (direction: number) =>
  Math.round((((direction + 180) % 360) + 360) % 360);

type Stop = readonly [value: number, rgba: readonly [number, number, number, number]];

/**
 * Colour ramps per layer. Alpha carries meaning too: dry, clear or calm areas fade out
 * so the base map stays readable and the eye goes to where weather is happening.
 */
export const LAYER_RAMPS: Record<MapLayer, readonly Stop[]> = {
  precipitation: [
    [0, [70, 140, 220, 0]],
    [15, [70, 150, 230, 0.12]],
    [35, [52, 132, 226, 0.36]],
    [60, [36, 98, 210, 0.55]],
    [85, [70, 48, 190, 0.68]],
    [100, [118, 34, 170, 0.75]],
  ],
  temperature: [
    [-15, [62, 70, 196, 0.62]],
    [0, [56, 140, 226, 0.6]],
    [8, [52, 182, 206, 0.58]],
    [14, [96, 196, 140, 0.58]],
    [20, [236, 196, 64, 0.6]],
    [27, [240, 128, 48, 0.64]],
    [35, [214, 52, 52, 0.68]],
    [42, [150, 24, 80, 0.72]],
  ],
  wind: [
    [0, [80, 180, 170, 0.06]],
    [3, [80, 186, 170, 0.26]],
    [8, [60, 150, 210, 0.44]],
    [14, [110, 90, 210, 0.56]],
    [22, [196, 60, 140, 0.66]],
  ],
  cloud: [
    [0, [120, 130, 145, 0]],
    [30, [120, 130, 145, 0.12]],
    [70, [110, 118, 132, 0.38]],
    [100, [95, 102, 116, 0.55]],
  ],
};

/**
 * Hourly amount (mm/h), on the usual intensity bands: trace 0.1, light 1, moderate 4,
 * heavy 10 and very heavy 25+. Dry ground stays transparent, as on the chance ramp.
 */
export const PRECIPITATION_AMOUNT_RAMP: readonly Stop[] = [
  [0, [70, 140, 220, 0]],
  [0.1, [70, 150, 230, 0.14]],
  [1, [52, 132, 226, 0.38]],
  [4, [36, 98, 210, 0.56]],
  [10, [70, 48, 190, 0.68]],
  [25, [118, 34, 170, 0.75]],
];

export const rampColor = (
  layer: MapLayer,
  value: number,
  measure: PrecipitationMeasure = 'chance'
) => {
  const stops =
    layer === 'precipitation' && measure === 'amount' ? PRECIPITATION_AMOUNT_RAMP : LAYER_RAMPS[layer];
  if (value <= stops[0][0]) return stops[0][1];
  for (let index = 1; index < stops.length; index += 1) {
    const [upper, upperColor] = stops[index];
    if (value <= upper) {
      const [lower, lowerColor] = stops[index - 1];
      const share = (value - lower) / (upper - lower);
      return lowerColor.map((channel, channelIndex) =>
        channelIndex === 3
          ? channel + (upperColor[channelIndex] - channel) * share
          : Math.round(channel + (upperColor[channelIndex] - channel) * share)
      ) as unknown as readonly [number, number, number, number];
    }
  }
  return stops[stops.length - 1][1];
};

/** Legend steps per layer: the value shown and the colour it maps to. */
export const PRECIPITATION_AMOUNT_LEGEND_STEPS: readonly number[] = [0.5, 1, 4, 10, 25];

export const LEGEND_STEPS: Record<MapLayer, readonly number[]> = {
  precipitation: [10, 30, 50, 70, 90],
  temperature: [0, 10, 20, 30, 40],
  wind: [2, 5, 10, 15, 20],
  cloud: [10, 30, 50, 70, 90],
};
