import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { findDailyWeatherRisk } from '../../domain/alerts/dailyRisk';
import type { DailyForecast } from '../../types';
import { formatDailyRisk } from './severeWeatherCopy';
import './SevereWeatherBanner.css';

interface Props {
  daily: readonly DailyForecast[];
  timezoneOffsetSeconds: number;
  /** Reference instant (ms); defaults to the wall clock. */
  now?: number;
}

/** Calm, non-interrupting notice for the first upcoming stormy or very wet day. */
export const SevereWeatherBanner = memo(function SevereWeatherBanner({
  daily,
  timezoneOffsetSeconds,
  now = Date.now(),
}: Props) {
  const { t, i18n } = useTranslation();
  const risk = findDailyWeatherRisk(daily, now, timezoneOffsetSeconds);
  if (!risk) return null;
  return (
    <div
      className="severe-weather-banner"
      data-severity={risk.severity}
      data-kind={risk.kind}
      role="status"
      data-testid="severe-weather-banner"
    >
      <span className="severe-weather-banner__icon" aria-hidden="true">
        ⚠
      </span>
      <span className="severe-weather-banner__label">{t('hava81.severe.label')}</span>
      <strong className="severe-weather-banner__text">
        {formatDailyRisk(risk, {
          t,
          language: i18n.language,
          now,
          timezoneOffsetSeconds,
        })}
      </strong>
    </div>
  );
});

export default SevereWeatherBanner;
