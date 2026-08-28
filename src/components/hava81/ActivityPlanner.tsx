import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { buildActivityPlan } from '../../domain/activity/buildActivityPlan';
import type { ActivityKind } from '../../domain/activity/types';
import type { DecisionReasonCode } from '../../domain/decision/types';
import { useDecisionProfile } from '../../hooks/useDecisionProfile';
import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../../types';
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
  'poor-air-quality': 'poorAirQuality',
  'sensitive-air-quality': 'sensitiveAirQuality',
};

export function ActivityPlanner({ weather, hourly, airQuality }: Props) {
  const { t, i18n } = useTranslation();
  const { profile, toggleActivity, setTemperatureSensitivity } = useDecisionProfile();
  const plans = useMemo(
    () =>
      profile.activities.map(activity =>
        buildActivityPlan({
          activity,
          weather,
          hourly,
          airQuality,
          sensitivity: profile.temperatureSensitivity,
        })
      ),
    [airQuality, hourly, profile.activities, profile.temperatureSensitivity, weather]
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
        </label>
      </header>

      <div
        className="activity-planner__chips"
        role="group"
        aria-label={t('hava81.activities.choose')}
      >
        {activities.map(activity => {
          const active = profile.activities.includes(activity);
          return (
            <button
              key={activity}
              type="button"
              aria-pressed={active}
              className={active ? 'is-active' : ''}
              onClick={() => toggleActivity(activity)}
            >
              {t(`hava81.activities.names.${activity}`)}
            </button>
          );
        })}
      </div>

      {plans.length > 0 ? (
        <div className="activity-planner__cards">
          {plans.map(plan => (
            <article key={plan.activity} className={`activity-card activity-card--${plan.band}`}>
              <header>
                <h3>{t(`hava81.activities.names.${plan.activity}`)}</h3>
                <strong>
                  {plan.score}
                  <span>/100</span>
                </strong>
              </header>
              <p>
                {plan.bestWindow
                  ? t('hava81.activities.bestTime', { time: formatTime(plan.bestWindow.time) })
                  : t('hava81.activities.noWindow')}
              </p>
              <small>
                {plan.reasons[0]
                  ? t(`hava81.dailyPlan.reasons.${reasonKey[plan.reasons[0]]}`)
                  : t('hava81.dailyPlan.reasons.clear')}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <p className="activity-planner__empty">{t('hava81.activities.empty')}</p>
      )}
      <p className="activity-planner__note">{t('hava81.activities.note')}</p>
    </section>
  );
}

export default ActivityPlanner;
