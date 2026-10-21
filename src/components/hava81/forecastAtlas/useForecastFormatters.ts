import { useMemo } from 'react';

/**
 * Intl formatters for the Forecast Atlas. Kept local (not `utils/format`) on
 * purpose: English hour tiles use en-US "9 PM", while `format.ts` uses en-GB.
 */
export function useForecastFormatters(locale: string, language: string) {
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
    [locale]
  );
  // Hourly tiles are narrow on phones. English 9 PM is clearer than 09:00 PM;
  // the forecast samples are on whole hours, and full time remains in detail text.
  const hourTileFormatter = useMemo(
    () =>
      language === 'en'
        ? new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: 'UTC' })
        : timeFormatter,
    [locale, language, timeFormatter]
  );
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
