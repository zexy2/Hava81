import type { SkyScene, SunPosition } from './skyScene';

/** Sky colours for the hero: chosen by the sun's elevation and the condition. */

export type Rgb = readonly [number, number, number];

export interface Palette {
  zenith: Rgb;
  horizon: Rgb;
  lit: Rgb;
  shade: Rgb;
}

// Clear-sky colour by sun elevation. Morning and evening twilight differ (dawn is cooler
// and rosier, dusk warmer and redder). Highlights stay well below white so the white type
// on top stays readable at noon.
type Stop = readonly [elevation: number, palette: Palette];
const P = (zenith: Rgb, horizon: Rgb, lit: Rgb, shade: Rgb): Palette => ({
  zenith,
  horizon,
  lit,
  shade,
});
const NIGHT = P([6, 12, 30], [20, 34, 66], [70, 84, 112], [16, 22, 40]);
const DAWN_TWILIGHT = P([28, 40, 92], [140, 104, 138], [172, 146, 168], [66, 66, 106]);
const DUSK_TWILIGHT = P([24, 30, 78], [160, 90, 92], [190, 124, 116], [66, 52, 92]);
const SUNRISE = P([46, 72, 136], [226, 146, 110], [238, 184, 156], [104, 92, 126]);
const SUNSET = P([38, 50, 114], [228, 116, 78], [240, 154, 116], [96, 70, 106]);
const GOLDEN = P([44, 92, 160], [200, 152, 106], [226, 196, 160], [104, 112, 144]);
const MORNING = P([30, 86, 162], [84, 140, 200], [178, 198, 224], [92, 118, 156]);
const NOON = P([16, 76, 168], [70, 136, 206], [184, 204, 230], [96, 124, 164]);

const clearStops = (evening: boolean): readonly Stop[] => [
  [-0.6, NIGHT],
  [-0.22, evening ? DUSK_TWILIGHT : DAWN_TWILIGHT],
  [0, evening ? SUNSET : SUNRISE],
  [0.16, GOLDEN],
  [0.42, MORNING],
  [0.85, NOON],
];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const mixPalette = (a: Palette, b: Palette, t: number): Palette => ({
  zenith: mix(a.zenith, b.zenith, t),
  horizon: mix(a.horizon, b.horizon, t),
  lit: mix(a.lit, b.lit, t),
  shade: mix(a.shade, b.shade, t),
});
export const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export const clearSkyAt = ({ elevation, azimuth }: SunPosition): Palette => {
  const stops = clearStops(azimuth > 0.5);
  if (elevation <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i += 1) {
    const [e1, p1] = stops[i];
    if (elevation <= e1) {
      const [e0, p0] = stops[i - 1];
      return mixPalette(p0, p1, smooth(0, 1, (elevation - e0) / (e1 - e0)));
    }
  }
  return stops[stops.length - 1][1];
};

// Overcast: one grey that brightens with the sun and warms slightly near the horizon.
export const overcastAt = ({ elevation }: SunPosition): Palette => {
  const light = smooth(-0.5, 0.5, elevation);
  const warm = Math.exp(-(elevation * elevation) / 0.02) * 0.28;
  const tint = (value: Rgb): Rgb => mix(value, [150, 100, 88], warm);
  return {
    zenith: mix([14, 18, 28], [58, 70, 88], light),
    horizon: tint(mix([30, 36, 50], [96, 108, 124], light)),
    lit: tint(mix([80, 88, 104], [146, 156, 170], light)),
    shade: mix([22, 26, 36], [58, 68, 84], light),
  };
};

export const paletteFor = (scene: SkyScene, sun: SunPosition): Palette => {
  const grey = scene.condition === 'clear' ? 0 : scene.condition === 'partly' ? 0.15 : 1;
  const base = mixPalette(clearSkyAt(sun), overcastAt(sun), grey);
  // Storm skies are heavier and darker than plain rain, so they read as a storm even
  // between lightning flashes.
  if (scene.condition !== 'storm') return base;
  const tone = (value: Rgb): Rgb => [value[0] * 0.58, value[1] * 0.58, value[2] * 0.58];
  return {
    zenith: tone(base.zenith),
    horizon: tone(base.horizon),
    lit: tone(base.lit),
    shade: tone(base.shade),
  };
};
