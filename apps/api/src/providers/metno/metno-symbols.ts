// MET Norway symbol codes (https://github.com/metno/weathericons/blob/main/weather/legend.csv)
// mapped onto the WMO weather codes the rest of the API already describes and draws.
// Matching is by keyword rather than an exact table: the official legend itself contains
// spellings like `lightssleetshowersandthunder`, and new variants should degrade gracefully.

/** Removes the `_day`, `_night` or `_polartwilight` variant suffix. */
const baseSymbol = (symbol: string) => symbol.trim().toLowerCase().replace(/_(day|night|polartwilight)$/, '');

const intensity = (symbol: string): 'light' | 'heavy' | 'moderate' =>
  symbol.startsWith('light') ? 'light' : symbol.startsWith('heavy') ? 'heavy' : 'moderate';

export const weatherCodeForSymbol = (symbol: string): number => {
  const base = baseSymbol(symbol);
  if (base === 'clearsky') return 0;
  if (base === 'fair') return 1;
  if (base === 'partlycloudy') return 2;
  if (base === 'cloudy') return 3;
  if (base === 'fog') return 45;
  if (base.includes('thunder')) return 95;

  const level = intensity(base);
  const showers = base.includes('showers');
  if (base.includes('sleet')) return level === 'heavy' ? 67 : 66;
  if (base.includes('snow')) {
    if (showers) return level === 'heavy' ? 86 : 85;
    return level === 'light' ? 71 : level === 'heavy' ? 75 : 73;
  }
  if (base.includes('rain')) {
    if (showers) return level === 'heavy' ? 82 : 80;
    return level === 'light' ? 61 : level === 'heavy' ? 65 : 63;
  }
  // Unknown future symbol: say "overcast" rather than inventing precipitation.
  return 3;
};

/** True when the symbol itself reports falling precipitation. */
export const symbolHasPrecipitation = (symbol: string): boolean => {
  const code = weatherCodeForSymbol(symbol);
  return code >= 51;
};
