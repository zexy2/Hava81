import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildDailyPlan } from '../../domain/decision/buildDailyPlan';
import { getCurrentWeatherFreshness } from '../../utils/currentWeatherFreshness';
import { getForecastFreshness } from '../../utils/forecastFreshness';
import type { AirQuality, ForecastMeta, HourlyForecast, NormalizedWeatherData } from '../../types';
import './DecisionGlance.css';

interface Props {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  forecastMeta: ForecastMeta | null;
}

export function DecisionGlance({ weather, hourly, airQuality, forecastMeta }: Props) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timeoutId: number | undefined;
    const refresh = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      const remaining = [
        30_000,
        getCurrentWeatherFreshness(weather.meta, currentTime).expiresInMs,
        getForecastFreshness(forecastMeta, currentTime).expiresInMs,
      ].filter((value): value is number => value !== null);
      timeoutId = window.setTimeout(refresh, Math.max(100, Math.min(...remaining)));
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      refresh();
    };
    refresh();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [weather.meta, forecastMeta]);

  const evidenceFresh =
    getCurrentWeatherFreshness(weather.meta, now).fresh &&
    getForecastFreshness(forecastMeta, now).fresh;
  const plan = useMemo(
    () => (evidenceFresh && hourly.length ? buildDailyPlan({ weather, hourly, airQuality }) : null),
    [evidenceFresh, weather, hourly, airQuality]
  );
  const localTime = (time: Date) =>
    new Date(time.getTime() + weather.meta.timezoneOffsetSeconds * 1000).toLocaleTimeString(
      i18n.language,
      { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }
    );
  const bestRange = plan?.bestWindowRange;
  const bestHours = bestRange
    ? bestRange.start.time.getTime() === bestRange.end.time.getTime()
      ? localTime(bestRange.peak.time)
      : `${localTime(bestRange.start.time)}–${localTime(bestRange.end.time)}`
    : null;

  const guidance = !plan
    ? t('hava81.glance.loading')
    : plan.nowOrLater.kind === 'later'
      ? t('hava81.glance.later')
      : plan.nowOrLater.kind === 'now'
        ? t('hava81.glance.now')
        : t('hava81.glance.similar');

  return (
    <section
      className="decision-glance"
      aria-label={t('hava81.glance.title')}
      data-testid="decision-glance"
    >
      <div className="decision-glance__main">
        <span className="atlas-kicker">{t('hava81.glance.title')}</span>
        <strong className="decision-glance__message">{guidance}</strong>
        {plan && bestHours ? (
          <p className="decision-glance__window">
            {t('hava81.glance.bestHours', { hours: bestHours })}
          </p>
        ) : null}
      </div>
      <div className="decision-glance__side">
        {plan ? (
          <>
            <div className={`decision-glance__score decision-glance__score--${plan.band}`}>
              <strong>
                {plan.score}
                <span>/100</span>
              </strong>
              <small>{t('hava81.glance.score')}</small>
            </div>
            <p className="decision-glance__umbrella">
              {t('hava81.glance.umbrella', {
                advice: t(`hava81.dailyPlan.quick.umbrella.${plan.umbrella}`),
              })}
            </p>
            <a className="decision-glance__details" href="#daily-plan-title">
              {t('hava81.glance.details')} <span aria-hidden="true">↗</span>
            </a>
          </>
        ) : (
          <span className="decision-glance__pending" role="status">
            {t('hava81.glance.pending')}
          </span>
        )}
      </div>
    </section>
  );
}

export default DecisionGlance;
