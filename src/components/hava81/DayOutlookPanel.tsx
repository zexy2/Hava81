import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { TEMPERATURE_SCALE_DARK, temperatureColor } from './forecastAtlas/temperatureColor';
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
import { useSettings } from '../../context';
import { formatCityTime } from '../../utils/format';
import { WeatherSymbol } from './WeatherSymbol';
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
  const { convertTemperature } = useSettings();
  const { profile } = useDecisionProfile();
  const [intent, setIntent] = useState<ActivityKind | 'general'>('general');
  const [, setFreshnessRevision] = useState(0);
  const freshness = getForecastFreshness(forecastMeta);
  const fresh = freshness.fresh;

  useEffect(() => {
    const resyncFreshness = () => setFreshnessRevision(revision => revision + 1);
    const timeout =
      freshness.expiresInMs === null
        ? undefined
        : window.setTimeout(resyncFreshness, freshness.expiresInMs);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') resyncFreshness();
    };

    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [forecastMeta, freshness.expiresInMs]);
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
  const degrees = (value: number) => `${Math.round(convertTemperature(value))}°`;
  // One temperature scale across the listed days, so each bar sits where its day really is.
  const tempValues = days.flatMap(day =>
    day.tempMin !== undefined && day.tempMax !== undefined ? [day.tempMin, day.tempMax] : []
  );
  const scaleLow = tempValues.length ? Math.min(...tempValues) : 0;
  const scaleSpan = tempValues.length ? Math.max(Math.max(...tempValues) - scaleLow, 1) : 1;
  const rangeStyle = (low: number, high: number) =>
    ({
      '--range-from': `${((low - scaleLow) / scaleSpan) * 100}%`,
      '--range-to': `${((high - scaleLow) / scaleSpan) * 100}%`,
      '--range-cold': temperatureColor(low, TEMPERATURE_SCALE_DARK),
      '--range-warm': temperatureColor(high, TEMPERATURE_SCALE_DARK),
    }) as CSSProperties;

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
                aria-label={t('hava81.outlook.intentAria', {
                  name:
                    option === 'general'
                      ? t('hava81.outlook.general')
                      : t(`hava81.activities.names.${option}`),
                })}
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
          <li
            key={day.dateKey}
            className={`day-outlook__day is-${day.band}${day.thunderHours.length ? ' has-thunder' : ''}`}
          >
            {day.icon ? <WeatherSymbol code={day.icon} className="day-outlook__symbol" /> : null}
            <span className="day-outlook__name">{t(outlookDayLabelKey(day, offsetSeconds))}</span>
            {day.tempMax !== undefined && day.tempMin !== undefined ? (
              <span
                className="day-outlook__temps"
                aria-label={t('hava81.outlook.tempRange', {
                  low: degrees(day.tempMin),
                  high: degrees(day.tempMax),
                })}
              >
                <span className="day-outlook__lo" aria-hidden="true">
                  {degrees(day.tempMin)}
                </span>
                <span
                  className="day-outlook__range"
                  aria-hidden="true"
                  style={rangeStyle(day.tempMin, day.tempMax)}
                />
                <span className="day-outlook__hi" aria-hidden="true">
                  {degrees(day.tempMax)}
                </span>
              </span>
            ) : null}
            <strong className="day-outlook__score">
              {day.score}
              <small>/100 · {t(`hava81.dailyPlan.bands.${day.band}`)}</small>
            </strong>
            <span className="day-outlook__window">
              {/* Say whose best time this is: the general score and an activity can differ. */}
              {day.bestWindowRange
                ? activity
                  ? t('hava81.outlook.windowFor', {
                      activity: t(`hava81.activities.names.${activity}`),
                      start: time(day.bestWindowRange.start.time),
                      end: time(day.bestWindowRange.endTime),
                    })
                  : t('hava81.outlook.windowGeneral', {
                      start: time(day.bestWindowRange.start.time),
                      end: time(day.bestWindowRange.endTime),
                    })
                : t('hava81.outlook.noWindow')}
            </span>
            {day.thunderHours.length ? (
              <span className="day-outlook__thunder" role="note">
                {t('hava81.outlook.thunder', {
                  times: day.thunderHours.map(time).join(', '),
                })}
              </span>
            ) : null}
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
