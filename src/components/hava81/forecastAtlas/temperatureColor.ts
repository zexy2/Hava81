// Temperature colour scale (°C). The curve and its fill use the colour of the
// temperature they sit at: cold blues, a mild teal, warm saffron, hot orange.
// Light stops keep >=3:1 against white paper; dark stops against the night card.
// Stops are blended in OKLCH so the cold-to-warm turn stays vivid, not muddy.
type Rgb = readonly [number, number, number];
export type ColorStop = readonly [celsius: number, rgb: Rgb];
export const TEMPERATURE_SCALE_LIGHT: readonly ColorStop[] = [
  [-5, [72, 82, 212]],
  [6, [37, 99, 214]],
  [13, [8, 124, 166]],
  [21, [186, 122, 8]],
  [27, [204, 90, 14]],
  [34, [196, 52, 40]],
];
export const TEMPERATURE_SCALE_DARK: readonly ColorStop[] = [
  [-5, [150, 165, 255]],
  [6, [120, 178, 255]],
  [13, [90, 210, 220]],
  [21, [240, 192, 80]],
  [27, [255, 150, 80]],
  [34, [255, 120, 100]],
];

const toLinear = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (value: number) => {
  const clamped = Math.min(1, Math.max(0, value));
  const encoded = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
};
const rgbToOklch = ([r, g, b]: Rgb): [number, number, number] => {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
};
const oklchToRgb = ([L, C, h]: [number, number, number]): Rgb => {
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
};

export const temperatureColor = (celsius: number, scale: readonly ColorStop[]): string => {
  const first = scale[0];
  const last = scale[scale.length - 1];
  if (celsius <= first[0]) return `rgb(${first[1].join(' ')})`;
  if (celsius >= last[0]) return `rgb(${last[1].join(' ')})`;
  const upperIndex = scale.findIndex(stop => stop[0] >= celsius);
  const [lowC, low] = scale[upperIndex - 1];
  const [highC, high] = scale[upperIndex];
  const ratio = (celsius - lowC) / (highC - lowC);
  const from = rgbToOklch(low);
  const to = rgbToOklch(high);
  let hueDelta = to[2] - from[2];
  if (hueDelta > Math.PI) hueDelta -= 2 * Math.PI;
  if (hueDelta < -Math.PI) hueDelta += 2 * Math.PI;
  const mixed = oklchToRgb([
    from[0] + (to[0] - from[0]) * ratio,
    from[1] + (to[1] - from[1]) * ratio,
    from[2] + hueDelta * ratio,
  ]);
  return `rgb(${mixed.join(' ')})`;
};
