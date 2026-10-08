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
  const dateLabel = new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-GB' : 'tr-TR', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(now + weather.meta.timezoneOffsetSeconds * 1000));
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

  const umbrellaAdvice = plan
    ? t(`hava81.dailyPlan.quick.umbrella.${plan.umbrella}`)
    : t('hava81.glance.pending');

  return (
    <section
      className="decision-glance"
      aria-label={t('hava81.glance.title')}
      data-testid="decision-glance"
    >
      <div className="decision-glance__atmosphere" aria-hidden="true">
        <div className="decision-glance__sun" />
        <div className="decision-glance__cloud decision-glance__cloud--one" />
        <div className="decision-glance__cloud decision-glance__cloud--two" />
        <div className="decision-glance__hills" />
      </div>
      <div className="decision-glance__main">
        <span className="atlas-kicker">{t('hava81.glance.title')}</span>
        <strong className="decision-glance__message">{guidance}</strong>
        {plan && bestHours ? (
          <p className="decision-glance__window">
            {t('hava81.glance.bestHours', { hours: bestHours })}
          </p>
        ) : null}
        <div className="decision-glance__quick-list">
          <div className="decision-glance__quick">
            <span
              className="decision-glance__quick-icon decision-glance__quick-icon--time"
              aria-hidden="true"
            >
              ◷
            </span>
            <span>
              <small>{t('hava81.glance.bestLabel')}</small>
              <strong>{bestHours ?? '—'}</strong>
            </span>
          </div>
          <div className="decision-glance__quick">
            <span
              className="decision-glance__quick-icon decision-glance__quick-icon--umbrella"
              aria-hidden="true"
            >
              ☂
            </span>
            <span>
              <small>{t('hava81.glance.umbrellaLabel')}</small>
              <strong>{umbrellaAdvice}</strong>
            </span>
          </div>
          <div className="decision-glance__quick">
            <span
              className="decision-glance__quick-icon decision-glance__quick-icon--weather"
              aria-hidden="true"
            >
              ☼
            </span>
            <span>
              <small>{t('hava81.glance.summaryLabel')}</small>
              <strong>{weather.description}</strong>
            </span>
          </div>
        </div>
      </div>
      <div className="decision-glance__side">
        <time className="decision-glance__date">{dateLabel}</time>
        {plan ? (
          <>
            <div
              className={`decision-glance__score decision-glance__score--${plan.band}`}
              style={{
                background: `conic-gradient(var(--decision-ring) ${plan.score}%, var(--decision-ring-track) 0)`,
              }}
            >
              <strong>
                {plan.score}
                <span>/100</span>
              </strong>
            </div>
            <small className="decision-glance__score-label">{t('hava81.glance.score')}</small>
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
