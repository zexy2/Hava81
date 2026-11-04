// NOAA general solar position (https://gml.noaa.gov/grad/solcalc/solareqns.PDF). Accurate to
// about a minute at Turkish latitudes, which is all the day/night icon and the daily sun
// times need, and it saves one upstream request per location and day.

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
// Apparent sunrise/sunset: the solar disc's upper limb on the horizon, refraction included.
const SUNRISE_ZENITH_DEG = 90.833;

const toRad = (degrees: number) => (degrees * Math.PI) / 180;
const toDeg = (radians: number) => (radians * 180) / Math.PI;

const dayOfYear = (utcMidnight: number) => {
  const year = new Date(utcMidnight).getUTCFullYear();
  return Math.round((utcMidnight - Date.UTC(year, 0, 1)) / DAY_MS) + 1;
};

const fractionalYear = (utcMidnight: number) => {
  const year = new Date(utcMidnight).getUTCFullYear();
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS;
  return ((2 * Math.PI) / days) * (dayOfYear(utcMidnight) - 1);
};

const equationOfTimeMinutes = (gamma: number) =>
  229.18 *
  (0.000075 +
    0.001868 * Math.cos(gamma) -
    0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) -
    0.040849 * Math.sin(2 * gamma));

const declinationRad = (gamma: number) =>
  0.006918 -
  0.399912 * Math.cos(gamma) +
  0.070257 * Math.sin(gamma) -
  0.006758 * Math.cos(2 * gamma) +
  0.000907 * Math.sin(2 * gamma) -
  0.002697 * Math.cos(3 * gamma) +
  0.00148 * Math.sin(3 * gamma);

const utcMidnightOf = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/**
 * Sunrise and sunset for the UTC calendar day containing `date`. Either is `null` on a polar
 * day or night, when the sun never crosses the horizon.
 */
export const sunTimes = (
  lat: number,
  lon: number,
  date: Date
): { sunrise: Date | null; sunset: Date | null } => {
  const midnight = utcMidnightOf(date);
  const gamma = fractionalYear(midnight);
  const declination = declinationRad(gamma);
  const eqTime = equationOfTimeMinutes(gamma);
  const cosHourAngle =
    Math.cos(toRad(SUNRISE_ZENITH_DEG)) / (Math.cos(toRad(lat)) * Math.cos(declination)) -
    Math.tan(toRad(lat)) * Math.tan(declination);
  if (cosHourAngle < -1 || cosHourAngle > 1) return { sunrise: null, sunset: null };
  const hourAngle = toDeg(Math.acos(cosHourAngle));
  const sunriseMinutes = 720 - 4 * (lon + hourAngle) - eqTime;
  const sunsetMinutes = 720 - 4 * (lon - hourAngle) - eqTime;
  return {
    sunrise: new Date(midnight + sunriseMinutes * MINUTE_MS),
    sunset: new Date(midnight + sunsetMinutes * MINUTE_MS),
  };
};

/** Sun elevation above the horizon in degrees at `instant`; negative below it. */
export const solarElevationDeg = (lat: number, lon: number, instant: Date): number => {
  const gamma = fractionalYear(utcMidnightOf(instant));
  const declination = declinationRad(gamma);
  const minutesUtc =
    instant.getUTCHours() * 60 + instant.getUTCMinutes() + instant.getUTCSeconds() / 60;
  const trueSolarMinutes = minutesUtc + equationOfTimeMinutes(gamma) + 4 * lon;
  const hourAngle = toRad(trueSolarMinutes / 4 - 180);
  const cosZenith =
    Math.sin(toRad(lat)) * Math.sin(declination) +
    Math.cos(toRad(lat)) * Math.cos(declination) * Math.cos(hourAngle);
  return 90 - toDeg(Math.acos(Math.max(-1, Math.min(1, cosZenith))));
};

/**
 * Daylight for an hour slot labelled by its start: true when the sun is above the apparent
 * horizon at the middle of the hour, so the dawn and dusk hours follow the larger share.
 */
export const isDaylightHour = (lat: number, lon: number, hourStart: Date): boolean =>
  solarElevationDeg(lat, lon, new Date(hourStart.getTime() + 30 * MINUTE_MS)) >
  90 - SUNRISE_ZENITH_DEG;
