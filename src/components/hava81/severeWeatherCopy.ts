import type { TFunction } from 'i18next';
import type { DailyWeatherRisk } from '../../domain/alerts/dailyRisk';

const DAY_MS = 86_400_000;

interface RiskCopyOptions {
  t: TFunction;
  language: string;
  now: number;
  timezoneOffsetSeconds: number;
}

/** Today / tomorrow / weekday label for a daily row keyed by the city's calendar date. */
export const riskDayLabel = (
  risk: DailyWeatherRisk,
  { t, language, now, timezoneOffsetSeconds }: RiskCopyOptions
): string => {
  const todayKey = new Date(now + timezoneOffsetSeconds * 1000).toISOString().slice(0, 10);
  const tomorrowKey = new Date(Date.parse(`${todayKey}T00:00:00.000Z`) + DAY_MS)
    .toISOString()
    .slice(0, 10);
  const dayKey = risk.date.toISOString().slice(0, 10);
  if (dayKey === todayKey) return t('hava81.severe.today');
  if (dayKey === tomorrowKey) return t('hava81.severe.tomorrow');
  const weekday = new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'tr-TR', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(risk.date);
  return t('hava81.severe.weekday', { weekday });
};

/** One line: "Thunderstorm expected tomorrow · 90% · 83 mm". */
export const formatDailyRisk = (risk: DailyWeatherRisk, options: RiskCopyOptions): string => {
  const { t, language } = options;
  const locale = language === 'en' ? 'en-GB' : 'tr-TR';
  const headline = t(`hava81.severe.${risk.kind}`, { day: riskDayLabel(risk, options) });
  const parts = [headline];
  if (risk.pop > 0) parts.push(t('hava81.severe.percent', { percent: Math.round(risk.pop * 100) }));
  if (risk.mm > 0)
    parts.push(
      `${new Intl.NumberFormat(locale, { maximumFractionDigits: risk.mm < 10 ? 1 : 0 }).format(risk.mm)} mm`
    );
  return parts.join(' · ');
};
