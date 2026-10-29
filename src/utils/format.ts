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

export interface CityClockOptions {
  language: FormatLanguage;
  timezoneOffsetSeconds: number;
}

const isEnglish = (language: FormatLanguage) => Boolean(language?.toLowerCase().startsWith('en'));
const shift = (date: Date, offsetSeconds: number) =>
  new Date(date.getTime() + offsetSeconds * 1000);

/**
 * The one homepage clock: TR "07:00" (24h), EN compact "7 AM" / "7:30 AM".
 */
export const formatCityClock = (
  date: Date | undefined | null,
  { language, timezoneOffsetSeconds }: CityClockOptions
): string => {
  if (!date || Number.isNaN(date.getTime())) return '—';
  const local = shift(date, timezoneOffsetSeconds);
  if (!isEnglish(language)) {
    return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
  }
  const hours = local.getUTCHours();
  const minutes = local.getUTCMinutes();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const period = hours < 12 ? 'AM' : 'PM';
  return minutes === 0
    ? `${hour12} ${period}`
    : `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
};

/** Clock range: TR "10:00–14:00", EN "10 AM–2 PM". */
export const formatCityClockRange = (
  start: Date | undefined | null,
  end: Date | undefined | null,
  options: CityClockOptions
): string => `${formatCityClock(start, options)}–${formatCityClock(end, options)}`;

/** Full date label: EN "Wednesday, Oct 28", TR "28 Ekim Çarşamba". */
export const formatCityDateLabel = (
  date: Date,
  { language, timezoneOffsetSeconds }: CityClockOptions
): string => {
  const local = shift(date, timezoneOffsetSeconds);
  if (isEnglish(language)) {
    return dateFormatter('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(local);
  }
  const dayMonth = dateFormatter('tr-TR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(local);
  const weekday = dateFormatter('tr-TR', { weekday: 'long', timeZone: 'UTC' }).format(local);
  return `${dayMonth} ${weekday}`;
};

/** Upper-cases only the first character, locale-aware ("ılık" → "Ilık" in TR). */
export const capitalizeFirst = (
  text: string | undefined | null,
  language: FormatLanguage
): string => {
  if (!text) return '';
  const first = text.charAt(0).toLocaleUpperCase(isEnglish(language) ? 'en-US' : 'tr-TR');
  return first + text.slice(1);
};

/**
 * Local wall-clock time for a city whose UTC offset is `offsetSeconds`.
 * Delegates to {@link formatCityClock} so every surface shares one clock style.
 */
export const formatCityTime = (
  date: Date | undefined | null,
  offsetSeconds: number,
  language: FormatLanguage
): string => formatCityClock(date, { language, timezoneOffsetSeconds: offsetSeconds });

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
