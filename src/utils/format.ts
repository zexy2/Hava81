/**
 * Single source for user-visible number, date and time formatting (Faz 1.4).
 * Every surface should format through these helpers so TR always reads "1,6 m/s"
 * and EN uses one date style.
 */

export type FormatLanguage = string | undefined;

export const localeFor = (language: FormatLanguage): string =>
  language?.toLowerCase().startsWith('en') ? 'en-GB' : 'tr-TR';

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
const numberFormatter = (locale: string, options: Intl.NumberFormatOptions) => {
  const key = `n|${locale}|${JSON.stringify(options)}`;
  let formatter = cache.get(key) as Intl.NumberFormat | undefined;
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    cache.set(key, formatter);
  }
  return formatter;
};
const dateFormatter = (locale: string, options: Intl.DateTimeFormatOptions) => {
  const key = `d|${locale}|${JSON.stringify(options)}`;
  let formatter = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    cache.set(key, formatter);
  }
  return formatter;
};

/** Number with up to `maxDigits` decimals (default 1), locale decimal separator. */
export const formatNumber = (value: number, language: FormatLanguage, maxDigits = 1): string =>
  Number.isFinite(value)
    ? numberFormatter(localeFor(language), { maximumFractionDigits: maxDigits }).format(value)
    : '—';

/** Number with a fixed number of decimals (replacement for `toFixed`). */
export const formatFixed = (value: number, language: FormatLanguage, digits = 1): string =>
  Number.isFinite(value)
    ? numberFormatter(localeFor(language), {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value)
    : '—';

/** Value + unit, e.g. "1,6 m/s". */
export const formatWithUnit = (
  value: number,
  unit: string,
  language: FormatLanguage,
  maxDigits = 1
): string => `${formatNumber(value, language, maxDigits)} ${unit}`;

/**
 * Local wall-clock time "HH:mm" for a city whose UTC offset is `offsetSeconds`.
 */
export const formatCityTime = (
  date: Date | undefined | null,
  offsetSeconds: number,
  language: FormatLanguage
): string =>
  date
    ? dateFormatter(localeFor(language), {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'UTC',
      }).format(new Date(date.getTime() + offsetSeconds * 1000))
    : '—';

/** Short city-local date, e.g. "21 Eki Sal" / "Tue 21 Oct". */
export const formatCityDate = (
  date: Date,
  offsetSeconds: number,
  language: FormatLanguage
): string =>
  dateFormatter(localeFor(language), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(date.getTime() + offsetSeconds * 1000));
