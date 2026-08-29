import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { trackProductEvent } from '../../analytics/productEvents';
import { buildCommutePlan, type CommuteAdviceCode } from '../../domain/commute/buildCommutePlan';
import { useSettings } from '../../context/SettingsContext';
import { useDecisionProfile } from '../../hooks/useDecisionProfile';
import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../../types';
import './CommutePlanPanel.css';

interface Props {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
}

export function CommutePlanPanel({ weather, hourly, airQuality }: Props) {
  const { t, i18n } = useTranslation();
  const { convertTemperature, convertWindSpeed, getTemperatureSymbol, getWindSpeedSymbol } =
    useSettings();
  const { profile, setCommuteTime, clearCommuteTimes } = useDecisionProfile();
  const trackedPlanRef = useRef<string | null>(null);
  const timezoneOffsetSeconds = weather.meta.timezoneOffsetSeconds ?? 0;
  const precipitationFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [i18n.language]
  );
  const plan = useMemo(
    () =>
      buildCommutePlan({
        hourly,
        commuteStart: profile.commuteStart,
        commuteEnd: profile.commuteEnd,
        timezoneOffsetSeconds,
        airQualityIndex: airQuality?.aqi,
        temperatureSensitivity: profile.temperatureSensitivity,
      }),
    [
      airQuality?.aqi,
      hourly,
      profile.commuteEnd,
      profile.commuteStart,
      profile.temperatureSensitivity,
      timezoneOffsetSeconds,
    ]
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
    if (Number.isFinite(amount) && (amount ?? 0) > 0) {
      const value = amount as number;
      parts.push(
        value < 0.1
          ? `<${precipitationFormatter.format(0.1)} mm`
          : `${precipitationFormatter.format(value)} mm`
      );
    }
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
      aqi: plan.summary.airQualityIndex ?? '—',
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
                    <strong>{window.targetClock}</strong>
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
                      <dd>{window.score}/100</dd>
                    </div>
                  </dl>
                </article>
              )
            )}
          </div>
        </>
      ) : (
        <p className="commute-plan__empty">
          {profile.commuteStart && profile.commuteEnd
            ? t('hava81.commute.forecastUnavailable')
            : t('hava81.commute.empty')}
        </p>
      )}

      <p className="commute-plan__note">{t('hava81.commute.note')}</p>
    </section>
  );
}

export default CommutePlanPanel;
