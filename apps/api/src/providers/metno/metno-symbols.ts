// MET Norway symbol codes (https://github.com/metno/weathericons/blob/main/weather/legend.csv)
// mapped onto the WMO weather codes the rest of the API already describes and draws.
// Matching is by keyword rather than an exact table: the official legend itself contains
// spellings like `lightssleetshowersandthunder`. A symbol the legend does not explain stays
// unknown (null): it is never guessed into a category that would read as dry or overcast.

/** Removes the `_day`, `_night` or `_polartwilight` variant suffix. */
const baseSymbol = (symbol: string) =>
  symbol
    .trim()
    .toLowerCase()
    .replace(/_(day|night|polartwilight)$/, '');

const intensity = (symbol: string): 'light' | 'heavy' | 'moderate' =>
  symbol.startsWith('light') ? 'light' : symbol.startsWith('heavy') ? 'heavy' : 'moderate';

/** Every precipitation word in the legend, so an unexpected word is caught, not guessed. */
const KNOWN_WORDS = /^(light|heavy)?s?(rain|sleet|snow)(showers)?(andthunder)?$/;

export const weatherCodeForSymbol = (symbol: string): number | null => {
  const base = baseSymbol(symbol);
  if (base === 'clearsky') return 0;
  if (base === 'fair') return 1;
  if (base === 'partlycloudy') return 2;
  if (base === 'cloudy') return 3;
  if (base === 'fog') return 45;
  if (!KNOWN_WORDS.test(base)) return null;
  if (base.includes('thunder')) return 95;

  const level = intensity(base);
  const showers = base.includes('showers');
  // Sleet is rain and snow mixed (WMO 68 slight, 69 moderate or heavy), not freezing rain.
  if (base.includes('sleet')) return level === 'heavy' ? 69 : 68;
  if (base.includes('snow')) {
    if (showers) return level === 'heavy' ? 86 : 85;
    return level === 'light' ? 71 : level === 'heavy' ? 75 : 73;
  }
  if (showers) return level === 'heavy' ? 82 : 80;
  return level === 'light' ? 61 : level === 'heavy' ? 65 : 63;
};

/** True when the symbol itself reports falling precipitation. */
export const symbolHasPrecipitation = (symbol: string): boolean => {
  const code = weatherCodeForSymbol(symbol);
  return code !== null && code >= 51;
};

// What the reader needs to know first, most consequential first. WMO codes are categories, not
// a scale: 80 (light showers) is not worse than 75 (heavy snow).
const SEVERITY: readonly number[] = [
  99, 96, 95, // thunderstorm (with hail)
  75, 86, 82, 65, 67, 69, // heavy snow, snow showers, rain showers, rain, freezing rain, sleet
  73, 85, 81, 63, 66, 68, 57, // moderate
  71, 77, 80, 61, 55, 56, 53, 51, // light
  48, 45, // fog
  3, 2, 1, 0, // cloud cover, clear last
];

/** The day's summary code: the most consequential known condition, or null when none is known. */
export const dailyCodeFor = (codes: readonly number[]): number | null => {
  let best: number | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const code of codes) {
    const rank = SEVERITY.indexOf(code);
    if (rank !== -1 && rank < bestRank) {
      best = code;
      bestRank = rank;
    }
  }
  return best;
};
