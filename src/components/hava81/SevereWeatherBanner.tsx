import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { findDailyWeatherRisk } from '../../domain/alerts/dailyRisk';
import type { DailyForecast } from '../../types';
import { riskDayLabel } from './severeWeatherCopy';
import { DropGlyph, StormGlyph } from './instruments/glyphs';
import './SevereWeatherBanner.css';

interface Props {
  daily: readonly DailyForecast[];
  timezoneOffsetSeconds: number;
  /** Reference instant (ms); defaults to the wall clock. */
  now?: number;
}

/** Calm, non-interrupting strip for the first upcoming stormy or very wet day. */
export const SevereWeatherBanner = memo(function SevereWeatherBanner({
  daily,
  timezoneOffsetSeconds,
  now = Date.now(),
}: Props) {
  const { t, i18n } = useTranslation();
  const risk = findDailyWeatherRisk(daily, now, timezoneOffsetSeconds);
  if (!risk) return null;
  const locale = i18n.language === 'en' ? 'en-GB' : 'tr-TR';
  const headline = t(`hava81.severe.${risk.kind}`, {
    day: riskDayLabel(risk, { t, language: i18n.language, now, timezoneOffsetSeconds }),
  });
  const amount = new Intl.NumberFormat(locale, {
    maximumFractionDigits: risk.mm < 10 ? 1 : 0,
  }).format(risk.mm);
  return (
    <div
      className="severe-weather-banner"
      data-severity={risk.severity}
      data-kind={risk.kind}
      role="status"
      data-testid="severe-weather-banner"
    >
      <span className="severe-weather-banner__icon" aria-hidden="true">
        {risk.kind === 'storm' ? <StormGlyph /> : <DropGlyph />}
      </span>
      <span className="severe-weather-banner__body">
        <span className="severe-weather-banner__label">
          {t('hava81.severe.label')} · {t(`hava81.severe.severity.${risk.severity}`)}
        </span>
        <strong className="severe-weather-banner__text" data-testid="severe-weather-day">
          {headline}
        </strong>
      </span>
      <span className="severe-weather-banner__metrics">
        {risk.pop > 0 ? (
          <span className="severe-weather-banner__metric" data-metric="pop">
            <b>{t('hava81.severe.percent', { percent: Math.round(risk.pop * 100) })}</b>
            <small>{t('hava81.severe.chanceLabel')}</small>
          </span>
        ) : null}
        {risk.mm > 0 ? (
          <span className="severe-weather-banner__metric" data-metric="mm">
            <b>{amount} mm</b>
            <small>{t('hava81.severe.amountLabel')}</small>
          </span>
        ) : null}
      </span>
    </div>
  );
});

export default SevereWeatherBanner;
