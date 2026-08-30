import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import {
  ACTIVITY_COMFORT_RANGES_C,
  buildActivityPlan,
} from '../../domain/activity/buildActivityPlan';
import type { ActivityKind } from '../../domain/activity/types';
import type { DecisionReasonCode } from '../../domain/decision/types';
import { useDecisionProfile } from '../../hooks/useDecisionProfile';
import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../../types';
import { formatPrecipitationAmount } from '../../utils/precipitation';
import './ActivityPlanner.css';

interface Props {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
}

const activities: ActivityKind[] = ['walk', 'run', 'picnic', 'children', 'motorcycle', 'laundry'];
const reasonKey: Record<DecisionReasonCode, string> = {
  'extreme-heat': 'extremeHeat',
  heat: 'heat',
  freezing: 'freezing',
  cold: 'cold',
  'heavy-rain': 'heavyRain',
  'rain-risk': 'rainRisk',
  'strong-wind': 'strongWind',
  windy: 'windy',
  'gusty-wind': 'gustyWind',
  'poor-air-quality': 'poorAirQuality',
  'sensitive-air-quality': 'sensitiveAirQuality',
  'high-uv': 'highUv',
  'low-visibility': 'lowVisibility',
  'severe-weather': 'severeWeather',
};

export function ActivityPlanner({ weather, hourly, airQuality }: Props) {
  const { t, i18n } = useTranslation();
  const { convertTemperature, convertWindSpeed, getTemperatureSymbol, getWindSpeedSymbol } =
    useSettings();
  const {
    profile,
    toggleActivity,
    setTemperatureSensitivity,
    setActivityWindow,
    clearActivityWindow,
  } = useDecisionProfile();
  const plans = useMemo(
    () =>
      profile.activities.map(activity =>
        buildActivityPlan({
          activity,
          weather,
          hourly,
          airQuality,
          sensitivity: profile.temperatureSensitivity,
          preferredStart: profile.activityStart,
          preferredEnd: profile.activityEnd,
        })
      ),
    [
      airQuality,
      hourly,
      profile.activities,
      profile.activityEnd,
      profile.activityStart,
      profile.temperatureSensitivity,
      weather,
    ]
  );
  const offset = (weather.meta.timezoneOffsetSeconds ?? 0) * 1000;
  const formatTime = (date?: Date) =>
    date
      ? new Date(date.getTime() + offset).toLocaleTimeString(i18n.language, {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        })
      : '—';
  const hasWindow = Boolean(profile.activityStart && profile.activityEnd);
  const temperatureSymbol = getTemperatureSymbol();
  const sensitivityShift = Math.round(Math.abs(convertTemperature(3) - convertTemperature(0)));

  const formatComfortCriteria = (activity: ActivityKind) => {
    const range = ACTIVITY_COMFORT_RANGES_C[activity];
    if (!range) return t(`hava81.activities.criteria.${activity}`);
    const [minimum, maximum] = range;
    return t(`hava81.activities.criteria.${activity}`, {
      minimum: Math.round(convertTemperature(minimum)),
      maximum: Math.round(convertTemperature(maximum)),
      unit: temperatureSymbol,
    });
  };

  return (
    <section className="activity-planner" aria-labelledby="activity-planner-title">
      <header className="activity-planner__header">
        <div>
          <span className="atlas-kicker">{t('hava81.activities.eyebrow')}</span>
          <h2 id="activity-planner-title">{t('hava81.activities.title')}</h2>
          <p>{t('hava81.activities.subtitle')}</p>
        </div>
        <label className="activity-planner__sensitivity">
          <span>{t('hava81.activities.sensitivity.label')}</span>
          <select
            value={profile.temperatureSensitivity}
            onChange={event =>
              setTemperatureSensitivity(event.target.value as 'cold' | 'balanced' | 'heat')
            }
          >
            <option value="cold">{t('hava81.activities.sensitivity.cold')}</option>
            <option value="balanced">{t('hava81.activities.sensitivity.balanced')}</option>
            <option value="heat">{t('hava81.activities.sensitivity.heat')}</option>
          </select>
          <small>
            {t(`hava81.activities.sensitivity.help.${profile.temperatureSensitivity}`, {
              value: sensitivityShift,
              unit: temperatureSymbol,
            })}
          </small>
        </label>
      </header>

      <div
        className="activity-planner__window"
        role="group"
        aria-label={t('hava81.activities.window.label')}
      >
        <div className="activity-planner__window-copy">
          <strong>{t('hava81.activities.window.title')}</strong>
          <span>{t('hava81.activities.window.help')}</span>
        </div>
        <label>
          <span>{t('hava81.activities.window.start')}</span>
          <input
            type="time"
            value={profile.activityStart ?? ''}
            onChange={event => setActivityWindow('start', event.target.value || undefined)}
          />
        </label>
        <label>
          <span>{t('hava81.activities.window.end')}</span>
          <input
            type="time"
            value={profile.activityEnd ?? ''}
            onChange={event => setActivityWindow('end', event.target.value || undefined)}
          />
        </label>
        {profile.activityStart || profile.activityEnd ? (
          <button type="button" className="atlas-text-button" onClick={clearActivityWindow}>
            {t('hava81.activities.window.clear')}
          </button>
        ) : null}
      </div>

      <div
        className="activity-planner__chips"
        role="group"
        aria-label={t('hava81.activities.choose')}
        aria-describedby={profile.activities.length >= 3 ? 'activity-selection-limit' : undefined}
      >
        {activities.map(activity => {
          const active = profile.activities.includes(activity);
          const disabled = !active && profile.activities.length >= 3;
          return (
            <button
              key={activity}
              type="button"
              aria-pressed={active}
              className={active ? 'is-active' : ''}
              disabled={disabled}
              onClick={() => toggleActivity(activity)}
            >
              {t(`hava81.activities.names.${activity}`)}
            </button>
          );
        })}
      </div>
      {profile.activities.length >= 3 ? (
        <p id="activity-selection-limit" className="activity-planner__selection-limit">
          {t('hava81.activities.limitReached')}
        </p>
      ) : null}

      {plans.length > 0 ? (
        <>
          <details className="activity-planner__score-explanation">
            <summary>{t('hava81.activities.score.explanationTitle')}</summary>
            <p>{t('hava81.activities.score.explanation')}</p>
          </details>
          <div className="activity-planner__cards">
            {plans.map(plan => {
              const best = plan.bestWindow;
              const bestRange = plan.bestWindowRange;
              const precipitation = best ? Math.round(best.precipitationProbability * 100) : 0;
              const precipitationAmount = formatPrecipitationAmount(
                best?.precipitationMm,
                i18n.language
              );
              const rainText = precipitationAmount
                ? precipitation > 0
                  ? t('hava81.activities.conditions.rainWithAmount', {
                      value: precipitation,
                      amount: precipitationAmount,
                    })
                  : t('hava81.activities.conditions.rainAmount', { amount: precipitationAmount })
                : precipitation === 0
                  ? t('hava81.activities.conditions.dry')
                  : t('hava81.activities.conditions.rain', { value: precipitation });
              const scoreLabel = hasWindow
                ? t('hava81.activities.score.filtered', {
                    start: profile.activityStart,
                    end: profile.activityEnd,
                  })
                : t('hava81.activities.score.default');
              return (
                <article
                  key={plan.activity}
                  className={`activity-card activity-card--${plan.band}`}
                >
                  <header>
                    <h3>{t(`hava81.activities.names.${plan.activity}`)}</h3>
                    <div className="activity-card__score">
                      <small>{scoreLabel}</small>
                      <strong>
                        {plan.windowUnavailable ? '—' : plan.score}
                        <span>/100</span>
                      </strong>
                    </div>
                  </header>
                  <p>
                    {bestRange
                      ? bestRange.start.time.getTime() === bestRange.end.time.getTime()
                        ? t('hava81.activities.bestTime', { time: formatTime(bestRange.peak.time) })
                        : t('hava81.activities.bestRange', {
                            start: formatTime(bestRange.start.time),
                            end: formatTime(bestRange.end.time),
                          })
                      : t('hava81.activities.noWindow')}
                  </p>
                  {best ? (
                    <div className="activity-card__conditions">
                      <span>
                        {t('hava81.activities.conditions.feelsLike', {
                          value: Math.round(convertTemperature(best.apparentTemperature)),
                          unit: getTemperatureSymbol(),
                        })}
                      </span>
                      <span>{rainText}</span>
                      <span>
                        {t('hava81.activities.conditions.wind', {
                          value: convertWindSpeed(best.windSpeed),
                          unit: getWindSpeedSymbol(),
                        })}
                      </span>
                    </div>
                  ) : null}
                  {plan.reasons[0] ? (
                    <small className="activity-card__risk">
                      {t('hava81.activities.mainRisk', {
                        risk: t(`hava81.dailyPlan.reasons.${reasonKey[plan.reasons[0]]}`),
                      })}
                    </small>
                  ) : null}
                  <details className="activity-card__details">
                    <summary>{t('hava81.activities.score.detailsTitle')}</summary>
                    <div className="activity-card__details-body">
                      <small className="activity-card__impact">
                        {t('hava81.activities.score.activityImpact', {
                          value: `${plan.baselineScore} → ${plan.score} (${plan.activityImpact > 0 ? `+${plan.activityImpact}` : plan.activityImpact})`,
                        })}
                      </small>
                      <small className="activity-card__criteria">
                        {formatComfortCriteria(plan.activity)}
                      </small>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <p className="activity-planner__empty">{t('hava81.activities.empty')}</p>
      )}
      <p className="activity-planner__note">{t('hava81.activities.note')}</p>
    </section>
  );
}

export default ActivityPlanner;
