import type { DailyForecast, HourlyForecast } from '../../../types';

/** An hourly sample prepared for display (converted unit, 0-1 rain chance). */
export type HourlyDatum = HourlyForecast & {
  timestamp: number;
  convertedTemp: number;
  precipitation: number;
};

/** A daily row prepared for display (converted and rounded temperatures). */
export type DailyDatum = DailyForecast & {
  timestamp: number;
  convertedMinExact: number;
  convertedMaxExact: number;
  convertedMin: number;
  convertedMax: number;
  precipitation: number;
};

/**
 * Location-time helpers shared by every Forecast Atlas section: the forecast
 * reads in the city's own wall clock, not the browser's.
 */
export interface ForecastAtlasClock {
  locale: string;
  temperatureSymbol: string;
  atLocationTime: (date: Date) => Date;
  formatDay: (date: Date) => string;
  timeFormatter: Intl.DateTimeFormat;
  hourTileFormatter: Intl.DateTimeFormat;
  currentLocationDateKey: string;
  currentLocationHourKey: string;
}
