import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REASON_I18N_KEY } from '../../domain/decision/reasonKeys';
import type { ActivityKind } from '../../domain/activity/types';
import { buildDayOutlook, outlookDayLabelKey } from '../../domain/plan/dayOutlook';
import { useDecisionProfile } from '../../hooks/useDecisionProfile';
import type {
  AirQuality,
  AirQualityHourly,
  ContextSignals,
  ForecastMeta,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { formatCityTime } from '../../utils/format';
import { getForecastFreshness } from '../../utils/forecastFreshness';
import './DayOutlookPanel.css';

interface Props {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  airQualityHourly?: AirQualityHourly;
  contextSignals?: ContextSignals | null;
  forecastMeta: ForecastMeta | null;
}

/** Today, tomorrow and the days after, from the same engine as the live plan. */
export function DayOutlookPanel({
  weather,
  hourly,
  airQuality,
  airQualityHourly,
  contextSignals,
  forecastMeta,
}: Props) {
  const { t, i18n } = useTranslation();
  const { profile } = useDecisionProfile();
  const [intent, setIntent] = useState<ActivityKind | 'general'>('general');
  const fresh = getForecastFreshness(forecastMeta).fresh;
  const offsetSeconds = weather.meta.timezoneOffsetSeconds;
  const activity =
    intent === 'general' || !profile.activities.includes(intent) ? undefined : intent;
  const { windTolerance, rainTolerance, pollenAllergy } = profile;
  // Only the tolerance fields matter; the rest of the profile must not rebuild the outlook.
  const tolerance = useMemo(
    () => ({ wind: windTolerance, rain: rainTolerance, pollenAllergy: pollenAllergy === true }),
    [windTolerance, rainTolerance, pollenAllergy]
  );

  const days = useMemo(
    () =>
      fresh
        ? buildDayOutlook({
            weather,
            hourly,
            airQuality,
            airQualityHourly,
            contextSignals,
            activity,
            tolerance,
            now: new Date(),
          })
        : [],
    [fresh, weather, hourly, airQuality, airQualityHourly, contextSignals, activity, tolerance]
  );
  if (days.length < 2) return null;

  const time = (date: Date) => formatCityTime(date, offsetSeconds, i18n.language);

  return (
    <section className="day-outlook" aria-labelledby="day-outlook-title">
      <header className="day-outlook__header">
        <h2 id="day-outlook-title">{t('hava81.outlook.title')}</h2>
        {profile.activities.length ? (
          <div
            className="day-outlook__intents"
            role="group"
            aria-label={t('hava81.outlook.intentLabel')}
          >
            {(['general', ...profile.activities] as const).map(option => (
              <button
                key={option}
                type="button"
                aria-pressed={(activity ?? 'general') === option}
                onClick={() => setIntent(option)}
              >
                {option === 'general'
                  ? t('hava81.outlook.general')
                  : t(`hava81.activities.names.${option}`)}
              </button>
            ))}
          </div>
        ) : null}
      </header>
      <ol className="day-outlook__days">
        {days.map(day => (
          <li key={day.dateKey} className={`day-outlook__day is-${day.band}`}>
            <span className="day-outlook__name">{t(outlookDayLabelKey(day, offsetSeconds))}</span>
            <strong className="day-outlook__score">
              {day.score}
              <small>/100 · {t(`hava81.dailyPlan.bands.${day.band}`)}</small>
            </strong>
            <span className="day-outlook__window">
              {day.bestWindowRange
                ? t('hava81.outlook.window', {
                    start: time(day.bestWindowRange.start.time),
                    end: time(day.bestWindowRange.endTime),
                  })
                : t('hava81.outlook.noWindow')}
            </span>
            <span className="day-outlook__meta">
              {day.reasons[0]
                ? t(`hava81.dailyPlan.reasons.${REASON_I18N_KEY[day.reasons[0]]}`)
                : t('hava81.dailyPlan.reasons.clear')}
              {day.confidence !== 'high'
                ? ` · ${t(`hava81.outlook.confidence.${day.confidence}`)}`
                : ''}
            </span>
            {day.scoreRange ? (
              <span className="day-outlook__meta">
                {t('hava81.dailyPlan.scoreRange', {
                  low: day.scoreRange.low,
                  high: day.scoreRange.high,
                })}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="day-outlook__note">{t('hava81.outlook.note')}</p>
    </section>
  );
}

export default DayOutlookPanel;
