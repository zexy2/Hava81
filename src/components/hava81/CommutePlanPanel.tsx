import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { trackProductEvent } from '../../analytics/productEvents';
import { buildCommutePlan } from '../../domain/commute/buildCommutePlan';
import { useSettings } from '../../context/SettingsContext';
import { useDecisionProfile } from '../../hooks/useDecisionProfile';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';
import './CommutePlanPanel.css';

interface Props {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
}

export function CommutePlanPanel({ weather, hourly }: Props) {
  const { t, i18n } = useTranslation();
  const { convertTemperature, convertWindSpeed, getTemperatureSymbol, getWindSpeedSymbol } =
    useSettings();
  const { profile, setCommuteTime, clearCommuteTimes } = useDecisionProfile();
  const trackedPlanRef = useRef<string | null>(null);
  const timezoneOffsetSeconds = weather.meta.timezoneOffsetSeconds ?? 0;
  const plan = useMemo(
    () =>
      buildCommutePlan({
        hourly,
        commuteStart: profile.commuteStart,
        commuteEnd: profile.commuteEnd,
        timezoneOffsetSeconds,
      }),
    [hourly, profile.commuteEnd, profile.commuteStart, timezoneOffsetSeconds]
  );

  useEffect(() => {
    if (!plan) return;
    const key = `${weather.cityName}:${profile.commuteStart}:${profile.commuteEnd}:${plan.outbound.forecastTime.toISOString()}`;
    if (trackedPlanRef.current === key) return;
    trackedPlanRef.current = key;
    trackProductEvent('commute_plan_viewed', {
      city: weather.cityName,
      commuteStart: profile.commuteStart,
      commuteEnd: profile.commuteEnd,
      umbrella: plan.umbrella,
      change: plan.change,
    });
  }, [plan, profile.commuteEnd, profile.commuteStart, weather.cityName]);

  const formatLocalWindowTime = (date: Date) =>
    new Date(date.getTime() + timezoneOffsetSeconds * 1000).toLocaleString(i18n.language, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });

  const changeText = plan
    ? t(`hava81.commute.change.${plan.change}`, {
        value: plan.changeValue,
      })
    : '';

  return (
    <section className="commute-plan" aria-labelledby="commute-plan-title">
      <header className="commute-plan__header">
        <div>
          <span className="atlas-kicker">{t('hava81.commute.eyebrow')}</span>
          <h2 id="commute-plan-title">{t('hava81.commute.title')}</h2>
          <p>{t('hava81.commute.subtitle')}</p>
        </div>
        {profile.commuteStart || profile.commuteEnd ? (
          <button type="button" className="atlas-text-button" onClick={clearCommuteTimes}>
            {t('hava81.commute.reset')}
          </button>
        ) : null}
      </header>

      <div className="commute-plan__times" role="group" aria-label={t('hava81.commute.timesLabel')}>
        <label>
          <span>{t('hava81.commute.outbound')}</span>
          <input
            type="time"
            value={profile.commuteStart ?? ''}
            onChange={event => setCommuteTime('start', event.target.value || undefined)}
          />
        </label>
        <label>
          <span>{t('hava81.commute.return')}</span>
          <input
            type="time"
            value={profile.commuteEnd ?? ''}
            onChange={event => setCommuteTime('end', event.target.value || undefined)}
          />
        </label>
      </div>

      {plan ? (
        <>
          <div
            className="commute-plan__verdict"
            data-umbrella={plan.umbrella}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span>{t('hava81.commute.verdictLabel')}</span>
            <small className="commute-plan__verdict-window">
              {t('hava81.commute.planWindow', {
                outbound: formatLocalWindowTime(plan.outbound.targetTime),
                return: formatLocalWindowTime(plan.return.targetTime),
              })}
            </small>
            <strong>{t(`hava81.commute.umbrella.${plan.umbrella}`)}</strong>
            <p>{changeText}</p>
          </div>

          <div className="commute-plan__windows" role="list" aria-label={t('hava81.commute.windowsLabel')}>
            {[
              ['outbound', plan.outbound] as const,
              ['return', plan.return] as const,
            ].map(([kind, window]) => (
              <article className={`commute-window commute-window--${window.band}`} role="listitem" key={kind}>
                <header>
                  <span>{t(`hava81.commute.${kind}`)}</span>
                  <strong>{window.targetClock}</strong>
                </header>
                <p>
                  {t('hava81.commute.forecastUsed', { time: formatLocalWindowTime(window.forecastTime) })}
                </p>
                <dl>
                  <div>
                    <dt>{t('hava81.commute.temperature')}</dt>
                    <dd>
                      {Math.round(convertTemperature(window.temperature))}
                      {getTemperatureSymbol()}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('hava81.commute.rain')}</dt>
                    <dd>%{Math.round(window.precipitationProbability * 100)}</dd>
                  </div>
                  <div>
                    <dt>{t('hava81.commute.wind')}</dt>
                    <dd>
                      {convertWindSpeed(window.windSpeed)} {getWindSpeedSymbol()}
                    </dd>
                  </div>
                  <div>
                    <dt>Hava81</dt>
                    <dd>{window.score}/100</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="commute-plan__empty">{t('hava81.commute.empty')}</p>
      )}

      <p className="commute-plan__note">{t('hava81.commute.note')}</p>
    </section>
  );
}

export default CommutePlanPanel;
