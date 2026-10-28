export const LEGACY_HOUR_LIMIT = 12;
export const REAL_HOURLY_HORIZON = 24;
export const MIN_CHART_WIDTH = 320;
export const MIN_DISPLAY_COLUMN_WIDTH = 72;
export const CHART_COLUMN_UNITS = 100;
// One plot, three stacked bands sharing the hour columns below it:
// annotations (0-30), the temperature curve (34-108) and rain chance (140-180).
export const CHART_HEIGHT = 184;
export const CHART_TOP = 36;
export const CHART_BOTTOM = 76;
export const AREA_BASELINE = 118;
export const RAIN_TOP = 140;
export const RAIN_BASELINE = 180;
// A fixed gutter keeps the sticky temperature axis clear of the first column.
export const TRACK_GUTTER = 44;
export const PRECIPITATION_THRESHOLD = 0.35;
export const HOUR_MS = 60 * 60_000;
export const OPEN_METEO_LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const RAIN_GAUGE_CELLS = 5;

/** Hourly rain becomes visible (gauge, label, summary) from this chance or amount (mm) up. */
export const HOURLY_RAIN_CHANCE = 0.2;
export const HOURLY_RAIN_MM = 0.2;
