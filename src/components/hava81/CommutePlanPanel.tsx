import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trackProductEvent } from '../../analytics/productEvents';
import { buildCommutePlan, type CommuteAdviceCode } from '../../domain/commute/buildCommutePlan';
import { useSettings } from '../../context/SettingsContext';
import { useDecisionProfile } from '../../hooks/useDecisionProfile';
import type { ForecastMeta, HourlyForecast, NormalizedWeatherData } from '../../types';
import { getForecastFreshness } from '../../utils/forecastFreshness';
import { formatPrecipitationAmount } from '../../utils/precipitation';
import './CommutePlanPanel.css';

const COMMUTE_BOUNDARY_CUSHION_MS = 100;
const DAY_MS = 24 * 60 * 60_000;
const millisecondsUntilNextClock = (clock: string | undefined, timezoneOffsetSeconds: number) => {
  if (!clock) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(clock);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const shiftedNowMs = Date.now() + timezoneOffsetSeconds * 1000;
  const locationNow = new Date(shiftedNowMs);
  const dayStartMs = Date.UTC(
    locationNow.getUTCFullYear(),
    locationNow.getUTCMonth(),
    locationNow.getUTCDate()
  );
  let targetMs = dayStartMs + (hours * 60 + minutes) * 60_000;
  if (targetMs <= shiftedNowMs) targetMs += DAY_MS;
  return targetMs - shiftedNowMs + COMMUTE_BOUNDARY_CUSHION_MS;
};

interface Props {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  forecastMeta: ForecastMeta | null;
}

export function CommutePlanPanel({ weather, hourly, forecastMeta }: Props) {
  const { t, i18n } = useTranslation();
  const { convertTemperature, convertWindSpeed, getTemperatureSymbol, getWindSpeedSymbol } =
    useSettings();
  const { profile, setCommuteTime, clearCommuteTimes } = useDecisionProfile();
  const hasPartialCommuteTime = Boolean(profile.commuteStart) !== Boolean(profile.commuteEnd);
  const commuteIncompleteId = hasPartialCommuteTime ? 'commute-plan-incomplete' : undefined;
  const trackedPlanRef = useRef<string | null>(null);
  const [commuteClockRevision, setCommuteClockRevision] = useState(0);
  const [, setForecastFreshnessRevision] = useState(0);
  const timezoneOffsetSeconds = weather.meta.timezoneOffsetSeconds;
  const forecastFreshness = getForecastFreshness(forecastMeta);
  const forecastFresh = forecastFreshness.fresh;
  const plan = useMemo(() => {
    void commuteClockRevision;
    return forecastFresh
      ? buildCommutePlan({
          hourly,
          commuteStart: profile.commuteStart,
          commuteEnd: profile.commuteEnd,
          timezoneOffsetSeconds,
          temperatureSensitivity: profile.temperatureSensitivity,
        })
      : null;
  }, [
    forecastFresh,
    hourly,
    profile.commuteEnd,
    profile.commuteStart,
    profile.temperatureSensitivity,
    timezoneOffsetSeconds,
    commuteClockRevision,
  ]);

  useEffect(() => {
    const resyncFreshness = () => setForecastFreshnessRevision(value => value + 1);
    const delay = forecastFreshness.expiresInMs;
    const timeout = delay === null ? undefined : window.setTimeout(resyncFreshness, delay);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resyncFreshness();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [forecastMeta, forecastFreshness.expiresInMs]);

  useEffect(() => {
    const delay = millisecondsUntilNextClock(profile.commuteStart, timezoneOffsetSeconds);
    if (delay === null) return undefined;
    const timeout = window.setTimeout(() => setCommuteClockRevision(value => value + 1), delay);
    return () => window.clearTimeout(timeout);
  }, [commuteClockRevision, profile.commuteStart, timezoneOffsetSeconds]);

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
      primaryAdvice: plan.primaryAdvice,
    });
  }, [plan, profile.commuteEnd, profile.commuteStart, weather.cityName]);

  const formatLocalWindowTime = (date: Date) =>
    new Date(date.getTime() + timezoneOffsetSeconds * 1000).toLocaleString(i18n.language, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  const formatPrecipitation = (probability: number, amount?: number) => {
    const probabilityPercent = Math.round(probability * 100);
    const parts: string[] = [];
    if (probabilityPercent > 0) {
      parts.push(
        i18n.language.startsWith('en') ? `${probabilityPercent}%` : `%${probabilityPercent}`
      );
    }
    const amountText = formatPrecipitationAmount(amount, i18n.language);
    if (amountText) parts.push(amountText);
    return parts.length ? parts.join(' · ') : t('hava81.commute.noRain');
  };

  const changeText = plan
    ? t(`hava81.commute.change.${plan.change}`, {
        value: plan.changeValue,
      })
    : '';

  const adviceText = (code: CommuteAdviceCode) => {
    if (!plan) return '';
    return t(`hava81.commute.preparation.${code}`, {
      temperature: Math.round(convertTemperature(plan.summary.maxApparentTemperature)),
      coldTemperature: Math.round(convertTemperature(plan.summary.minApparentTemperature)),
      temperatureUnit: getTemperatureSymbol(),
      wind: convertWindSpeed(plan.summary.maxEffectiveWind),
      windUnit: getWindSpeedSymbol(),
    });
  };

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
            aria-describedby={commuteIncompleteId}
            onChange={event => setCommuteTime('start', event.target.value || undefined)}
          />
        </label>
        <label>
          <span>{t('hava81.commute.return')}</span>
          <input
            type="time"
            value={profile.commuteEnd ?? ''}
            aria-describedby={commuteIncompleteId}
            onChange={event => setCommuteTime('end', event.target.value || undefined)}
          />
        </label>
      </div>

      {plan ? (
        <>
          <div
            className="commute-plan__verdict"
            data-advice={plan.primaryAdvice}
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
            <strong>{adviceText(plan.primaryAdvice)}</strong>
            {plan.advice.length > 1 ? (
              <ul className="commute-plan__advice" aria-label={t('hava81.commute.adviceLabel')}>
                {plan.advice
                  .filter(code => code !== plan.primaryAdvice)
                  .slice(0, 3)
                  .map(code => (
                    <li key={code}>{adviceText(code)}</li>
                  ))}
              </ul>
            ) : null}
            <p>{changeText}</p>
          </div>

          <div
            className="commute-plan__windows"
            role="list"
            aria-label={t('hava81.commute.windowsLabel')}
          >
            {[['outbound', plan.outbound] as const, ['return', plan.return] as const].map(
              ([kind, window]) => (
                <article
                  className={`commute-window commute-window--${window.band}`}
                  role="listitem"
                  key={kind}
                >
                  <header>
                    <span>{t(`hava81.commute.${kind}`)}</span>
                    <strong>
                      <time dateTime={window.targetTime.toISOString()}>{window.targetClock}</time>
                    </strong>
                  </header>
                  <p>
                    {t('hava81.commute.forecastUsed', {
                      time: formatLocalWindowTime(window.forecastTime),
                    })}
                  </p>
                  <dl>
                    <div>
                      <dt>{t('hava81.commute.feelsLike')}</dt>
                      <dd>
                        {Math.round(convertTemperature(window.apparentTemperature))}
                        {getTemperatureSymbol()}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('hava81.commute.rain')}</dt>
                      <dd>
                        {formatPrecipitation(
                          window.precipitationProbability,
                          window.precipitationMm
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('hava81.commute.wind')}</dt>
                      <dd>
                        {convertWindSpeed(window.windSpeed)} {getWindSpeedSymbol()}
                      </dd>
                    </div>
                    <div>
                      <dt>Hava81</dt>
                      <dd>
                        {window.score}/100 · {t(`hava81.dailyPlan.bands.${window.band}`)}
                      </dd>
                    </div>
                  </dl>
                </article>
              )
            )}
          </div>
        </>
      ) : (
        <p
          id={commuteIncompleteId}
          className="commute-plan__empty"
          role={hasPartialCommuteTime ? 'status' : undefined}
        >
          {profile.commuteStart && profile.commuteEnd
            ? !forecastFresh
              ? t('hava81.commute.forecastStale')
              : t('hava81.commute.forecastUnavailable')
            : hasPartialCommuteTime
              ? t('hava81.commute.incomplete')
              : t('hava81.commute.empty')}
        </p>
      )}

      <p className="commute-plan__note">{t('hava81.commute.note')}</p>
    </section>
  );
}

export default CommutePlanPanel;
