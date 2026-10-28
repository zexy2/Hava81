import { useMemo } from 'react';

import { formatCityClock } from '../../../utils/format';

export interface ClockFormatter {
  format: (date: Date) => string;
}

/**
 * Formatters for the Forecast Atlas. Dates are already shifted to location
 * time, so the shared clock is applied with a zero offset.
 */
export function useForecastFormatters(locale: string, language: string) {
  const timeFormatter = useMemo<ClockFormatter>(
    () => ({ format: date => formatCityClock(date, { language, timezoneOffsetSeconds: 0 }) }),
    [language]
  );
  const hourTileFormatter = timeFormatter;
  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }),
    [locale]
  );
  const preciseTemperatureFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [locale]
  );

  return { timeFormatter, hourTileFormatter, dayFormatter, preciseTemperatureFormatter };
}
