import { getScoreBand } from '../../domain/decision/scoreWeatherWindow';
import { supportsMarineContext } from '../../utils/marineCities';
import { formatCityTime, formatNumber } from '../../utils/format';
import { REASON_I18N_KEY } from '../../domain/decision/reasonKeys';
import { getDailyPlanAirQualityEvidence } from '../../domain/decision/airQualityEvidence';
import { getOptionalEvidenceFreshness } from '../../utils/optionalEvidenceFreshness';
import { useEffect, useState } from 'react';
import {
  PLAN_PERIODS,
  rankActivityPlans,
  resolvePlanPeriod,
  type PlanPeriodId,
} from '../../domain/activity/periods';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import {
  ACTIVITY_COMFORT_RANGES_C,
  buildActivityPlan,
} from '../../domain/activity/buildActivityPlan';
import type { ActivityKind } from '../../domain/activity/types';
import { toleranceOf, useDecisionProfile } from '../../hooks/useDecisionProfile';
import type { WeatherTolerance } from '../../domain/plan/types';
import { useWindowWhy } from '../../hooks/useWindowWhy';
import type {
  AirQuality,
  AirQualityHourly,
  ContextSignals,
  ForecastMeta,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { getForecastFreshness } from '../../utils/forecastFreshness';
import { formatPrecipitationAmount } from '../../utils/precipitation';
import './ActivityPlanner.css';

interface Props {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  airQualityHourly?: AirQualityHourly;
  forecastMeta: ForecastMeta | null;
  /** Optional context (dust peak) for breathing-heavy activities. */
  contextSignals?: ContextSignals | null;
}

const groupOf = (activity: ActivityKind) =>
  ACTIVITY_GROUPS.find(group => group.activities.includes(activity))?.id;

/** Every activity, in its group order; the sea group appears only where there is a sea. */
const ACTIVITY_GROUPS: ReadonlyArray<{ id: string; activities: ActivityKind[] }> = [
  { id: 'move', activities: ['walk', 'run', 'bike', 'dog'] },
  { id: 'outdoors', activities: ['picnic', 'children', 'beach'] },
  { id: 'home', activities: ['garden', 'laundry'] },
  { id: 'photo', activities: ['photo'] },
  { id: 'road', activities: ['motorcycle'] },
];

/** A circle as a path, so every glyph is one list of strokes. */
const ring = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;

/**
 * Hava81's own activity set: one 24-unit grid, one 1.5 stroke, round ends, figures drawn
 * so that walking and running read apart at a glance (upright stride vs. forward lean).
 */
const GLYPHS: Record<ActivityKind, string[]> = {
  walk: [
    ring(12, 4.5, 1.75),
    'M12 7.25 11.5 12.5',
    'M11.5 12.5 9.25 16.25 8.5 20.25',
    'M11.5 12.5 13.75 16 15.25 20.25',
    'M11.9 8.75 9.25 11',
    'M11.9 8.75 14.75 11.25',
  ],
  run: [
    ring(16, 4.25, 1.75),
    'M15 6.75 11.75 12',
    'M11.75 12 14.75 15 13.25 20.25',
    'M11.75 12 8.25 14.25 5.25 13.25',
    'M14.25 8 17.25 9.25 18.75 7.5',
    'M13.75 8.25 10.75 9.5 9.25 8',
    'M2.75 9.75h3',
    'M2.25 12.75h2',
  ],
  bike: [
    ring(5.5, 16.5, 3.25),
    ring(18.5, 16.5, 3.25),
    'M5.5 16.5 9.5 9.5h6.25L18.5 16.5',
    'M9.5 9.5 12.25 16.5h-6.75',
    'M15.75 9.5 14.75 6.75h2.25',
    'M8.75 7.75h2',
  ],
  dog: [
    'M5.25 13.25h9.25l1.75-3.25 2.25.75 1.25 2-1.5 1.25-1.5-.25-1.5 2.75v4',
    'M7.25 13.25v7',
    'M10.5 16.25v4',
    'M5.25 13.25 3.5 10.75',
    'M17.75 9.5 18.5 7.75',
    'M14.5 13.25c-2-3.5-5-6.5-8.75-8.25',
  ],
  beach: [
    'M3.5 11.5a7.5 7.5 0 0 1 14.5-2.5Z',
    'M10.75 10.25 13.25 19',
    'M2.75 20.25c1.5-1.25 3-1.25 4.5 0s3 1.25 4.5 0 3-1.25 4.5 0 3 1.25 4.5 0',
    ring(19.25, 4.75, 1.5),
  ],
  garden: [
    'M12 20.25v-8',
    'M12 14c-3.75 0-5.5-2.5-5.5-5.75 3.5 0 5.5 2.25 5.5 5.75Z',
    'M12 12.25c0-3.25 1.75-5.5 5.25-5.5 0 3.25-2 5.5-5.25 5.5Z',
    'M4 20.25h16',
    'M19.25 20.25v-4.5',
    'M18 15.75h2.5',
  ],
  photo: [
    'M3.5 8.25h3.25l1.5-2.25h7.5l1.5 2.25h3.25v10.5h-17Z',
    ring(12, 13.25, 3.5),
    'M17.5 10.75h.01',
  ],
  picnic: [
    'M3 20.25 5.75 16.75h12.5l2.75 3.5Z',
    'M8 13h8l-1.25 3.75h-5.5Z',
    'M9.75 13c0-3.25 4.5-3.25 4.5 0',
    ring(18.75, 5.25, 1.5),
    'M18.75 1.75v.75',
    'M18.75 8v.75',
    'M15.25 5.25h.75',
    'M21.5 5.25h.75',
  ],
  children: [
    ring(8.5, 4.5, 1.75),
    'M8.5 7.25v6.75',
    'M8.5 14 7 20.25',
    'M8.5 14 10 20.25',
    'M8.5 9.25 12.75 12.25 15.75 12.75',
    ring(16.25, 10, 1.4),
    'M16.25 11.9v4.1',
    'M16.25 16 15.25 20.25',
    'M16.25 16 17.25 20.25',
  ],
  motorcycle: [
    ring(5.5, 16.75, 3),
    ring(18.5, 16.75, 3),
    'M5.5 16.75 8.75 12h5.5l1.5 2.5',
    'M8.75 12 7.75 9.75h5',
    'M9.5 14.5h4.25v2.25H9.5Z',
    'M18.5 16.75 15.75 9.25',
    'M14.5 9h2.75',
  ],
  laundry: [
    'M2.75 5.5Q12 8.5 21.25 5.5',
    'M8.25 7.25 5.75 10l2 1.5v8.75h8.5V11.5l2-1.5-2.5-2.75',
    'M8.25 7.25c.75 1.5 6.75 1.5 7.5 0',
    'M8.25 6v2',
    'M15.75 6v2',
  ],
};

function ActivityGlyph({ kind }: { kind: ActivityKind }) {
  return (
    <span className="activity-glyph" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GLYPHS[kind].map((shape, index) => (
          <path key={index} d={shape} />
        ))}
      </svg>
    </span>
  );
}
const reasonKey = REASON_I18N_KEY;

export function ActivityPlanner({
  weather,
  hourly,
  airQuality,
  airQualityHourly,
  forecastMeta,
  contextSignals,
}: Props) {
  const { t, i18n } = useTranslation();
  const { convertTemperature, convertWindSpeed, getTemperatureSymbol, getWindSpeedSymbol } =
    useSettings();
  const {
    profile,
    toggleActivity,
    setTemperatureSensitivity,
    setTolerance,
    setPollenAllergy,
    setActivityWindow,
    clearActivityWindow,
  } = useDecisionProfile();
  const [, setFreshnessRevision] = useState(0);
  const [periodId, setPeriodId] = useState<PlanPeriodId>('now');
  const freshness = getForecastFreshness(forecastMeta);
  const hourlyAqiFreshness = getOptionalEvidenceFreshness(airQualityHourly?.meta);
  const currentAqiFreshness = getOptionalEvidenceFreshness(airQuality?.meta);
  const contextFreshness = getOptionalEvidenceFreshness(contextSignals ?? undefined);
  const plannedHourTimes = hourly.length
    ? [...hourly]
        .sort((a, b) => a.time.getTime() - b.time.getTime())
        .slice(0, 48)
        .map(point => point.time)
    : [weather.timestamp];
  // Use the same resolver as the scorer: a matching timestamp is not enough when duplicate
  // provider samples disagree. In that case the conflicting AQI is deliberately unavailable.
  const hourlyAqiEvidence = getDailyPlanAirQualityEvidence({
    forecastTimes: plannedHourTimes,
    airQualityHourly,
  });
  const showHourlyAqiSource = Boolean(
    airQualityHourly && hourlyAqiFreshness.fresh && hourlyAqiEvidence.usesHourlyAqi
  );
  // The asked period; null when it has already ended today (evening after 23:00).
  const resolvedPeriod = resolvePlanPeriod(
    periodId,
    Date.now(),
    weather.meta.timezoneOffsetSeconds
  );
  const period = resolvedPeriod ?? undefined;
  const periodEnded = resolvedPeriod === null;
  const planFor = (activity: ActivityKind) =>
    buildActivityPlan({
      activity,
      weather,
      hourly,
      airQuality,
      airQualityHourly,
      sensitivity: profile.temperatureSensitivity,
      preferredStart: profile.activityStart,
      preferredEnd: profile.activityEnd,
      now: new Date(),
      contextSignals,
      tolerance: toleranceOf(profile),
      period,
    });
  const plans =
    freshness.fresh && !periodEnded
      ? profile.activities.map(activity =>
          buildActivityPlan({
            activity,
            weather,
            hourly,
            airQuality,
            airQualityHourly,
            sensitivity: profile.temperatureSensitivity,
            preferredStart: profile.activityStart,
            preferredEnd: profile.activityEnd,
            now: new Date(),
            contextSignals,
            tolerance: toleranceOf(profile),
            period,
          })
        )
      : [];
  // Why the beach has no window: name the sea values instead of a generic "no window".
  const marine = contextFreshness.fresh ? contextSignals?.marine : undefined;
  const seaNote =
    marine && Number.isFinite(marine.seaSurfaceTemperature)
      ? t('hava81.activities.seaNotSuitable', {
          sea: `${Math.round(convertTemperature(marine.seaSurfaceTemperature as number))}${getTemperatureSymbol()}`,
          wave: Number.isFinite(marine.waveHeight)
            ? t('hava81.activities.seaWave', { value: (marine.waveHeight as number).toFixed(1) })
            : '',
        })
      : t('hava81.activities.seaUnknown');
  // Sea plans need the marine context; inland cities do not offer them.
  const hasSea = supportsMarineContext(weather.cityName);
  const availableActivities = ACTIVITY_GROUPS.flatMap(group => group.activities).filter(
    activity => activity !== 'beach' || hasSea
  );
  // Nothing chosen yet: the page answers anyway with the three best activities for the period.
  const suggestions =
    profile.activities.length === 0 && freshness.fresh && !periodEnded
      ? rankActivityPlans(availableActivities.map(planFor))
          .filter(plan => !plan.windowUnavailable && plan.bestWindowRange)
          // A real choice: the best of each group first (move, outdoors, home, road).
          .map((plan, index, ranked) => ({
            plan,
            repeat: ranked
              .slice(0, index)
              .some(other => groupOf(other.activity) === groupOf(plan.activity)),
          }))
          .sort((x, y) => Number(x.repeat) - Number(y.repeat))
          .map(entry => entry.plan)
          .slice(0, 3)
      : [];
  // What the personal settings change: the same plans with the default preferences.
  const hasPersonalSettings =
    profile.temperatureSensitivity !== 'balanced' ||
    (profile.windTolerance ?? 'normal') !== 'normal' ||
    (profile.rainTolerance ?? 'normal') !== 'normal' ||
    profile.pollenAllergy === true;
  const defaultScoreOf = new Map(
    hasPersonalSettings && freshness.fresh
      ? plans.map(plan => [
          plan.activity,
          buildActivityPlan({
            activity: plan.activity,
            weather,
            hourly,
            airQuality,
            airQualityHourly,
            sensitivity: 'balanced',
            preferredStart: profile.activityStart,
            preferredEnd: profile.activityEnd,
            now: new Date(),
            contextSignals,
            period,
          }).score,
        ])
      : []
  );

  useEffect(() => {
    const resyncFreshness = () => setFreshnessRevision(value => value + 1);
    const expiries = [
      freshness.expiresInMs,
      hourlyAqiFreshness.expiresInMs,
      currentAqiFreshness.expiresInMs,
      contextFreshness.expiresInMs,
    ].filter((value): value is number => value !== null);
    const nextExpiryMs = expiries.length ? Math.min(...expiries) : null;
    const timeout =
      nextExpiryMs === null ? undefined : window.setTimeout(resyncFreshness, nextExpiryMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resyncFreshness();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    airQuality?.meta?.fetchedAt,
    airQuality?.meta?.freshForSeconds,
    airQualityHourly?.meta?.fetchedAt,
    airQualityHourly?.meta?.freshForSeconds,
    currentAqiFreshness.expiresInMs,
    contextFreshness.expiresInMs,
    contextSignals?.fetchedAt,
    contextSignals?.freshForSeconds,
    forecastMeta,
    freshness.expiresInMs,
    hourlyAqiFreshness.expiresInMs,
  ]);
  const offset = weather.meta.timezoneOffsetSeconds * 1000;
  const formatTime = (date?: Date) => formatCityTime(date, offset / 1000, i18n.language);
  // Suggestions beyond today name the day: "Cmt 10:00".
  const formatDayTime = (date: Date) => {
    const dayOf = (ms: number) => Math.floor((ms + offset) / 86_400_000);
    if (dayOf(date.getTime()) === dayOf(Date.now())) return formatTime(date);
    const weekday = new Intl.DateTimeFormat(i18n.language, {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date(date.getTime() + offset));
    return `${weekday} ${formatTime(date)}`;
  };
  const windowWhy = useWindowWhy(date => formatTime(date));
  const hasWindow = Boolean(profile.activityStart && profile.activityEnd);
  const hasPartialWindow = Boolean(profile.activityStart) !== Boolean(profile.activityEnd);
  const activityWindowStatusId = hasPartialWindow ? 'activity-window-incomplete' : undefined;
  const temperatureSymbol = getTemperatureSymbol();
  const sensitivityLabelId = 'activity-temperature-sensitivity-label';
  const sensitivityHelpId = 'activity-temperature-sensitivity-help';
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

  const preferenceSummary = [
    t(`hava81.activities.sensitivity.${profile.temperatureSensitivity}`),
    `${t('hava81.activities.tolerance.wind')} ${t(`hava81.activities.tolerance.${profile.windTolerance ?? 'normal'}`).toLocaleLowerCase(i18n.language)}`,
    `${t('hava81.activities.tolerance.rain')} ${t(`hava81.activities.tolerance.${profile.rainTolerance ?? 'normal'}`).toLocaleLowerCase(i18n.language)}`,
    profile.pollenAllergy ? t('hava81.activities.prefs.pollenOn') : null,
    profile.activityStart && profile.activityEnd
      ? `${profile.activityStart}–${profile.activityEnd}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Side by side: every row shows the same 24 clock hours from the first plan's first slot, so a
  // column means the same hour in each row.
  const compareStartMs = plans[0]?.slots[0]?.time.getTime();
  const compareSlots = (plan: (typeof plans)[number]) =>
    compareStartMs === undefined
      ? []
      : plan.slots.filter(
          slot =>
            slot.time.getTime() >= compareStartMs &&
            slot.time.getTime() < compareStartMs + 24 * 3_600_000
        );
  const inBest = (plan: (typeof plans)[number], slot: (typeof plans)[number]['slots'][number]) =>
    Boolean(
      plan.bestWindowRange &&
      !plan.windowUnavailable &&
      slot.time.getTime() >= plan.bestWindowRange.start.time.getTime() &&
      slot.time.getTime() < plan.bestWindowRange.endTime.getTime()
    );
  const compareAxis =
    compareStartMs === undefined
      ? []
      : [0, 6, 12, 18].map(hours => new Date(compareStartMs + hours * 3_600_000));

  // No window in the asked period: say when it does work, from the next three days.
  const nextWindowText = (activity: ActivityKind) => {
    const startMs = period?.endMs ?? Date.now() + 12 * 3_600_000;
    const later = buildActivityPlan({
      activity,
      weather,
      hourly,
      airQuality,
      airQualityHourly,
      sensitivity: profile.temperatureSensitivity,
      now: new Date(),
      contextSignals,
      tolerance: toleranceOf(profile),
      period: { startMs, endMs: startMs + 72 * 3_600_000 },
    });
    const range = later.windowUnavailable ? undefined : later.bestWindowRange;
    return range
      ? t('hava81.activities.nextWindow', {
          start: formatDayTime(range.start.time),
          end: formatTime(range.endTime),
        })
      : undefined;
  };

  const suggestionsView = periodEnded ? (
    <p className="activity-planner__empty" role="status">
      {t('hava81.activities.period.ended')}
    </p>
  ) : suggestions.length > 0 ? (
    <section className="activity-suggestions" aria-labelledby="activity-suggestions-title">
      <h3 id="activity-suggestions-title">{t(`hava81.activities.suggest.title.${periodId}`)}</h3>
      <ol>
        {suggestions.map(plan => (
          <li
            key={plan.activity}
            className={`activity-suggestion activity-suggestion--${plan.band}`}
          >
            <ActivityGlyph kind={plan.activity} />
            <span className="activity-suggestion__copy">
              <strong>{t(`hava81.activities.names.${plan.activity}`)}</strong>
              <span>
                {plan.bestWindowRange
                  ? `${formatDayTime(plan.bestWindowRange.start.time)}–${formatTime(plan.bestWindowRange.endTime)}`
                  : null}
              </span>
            </span>
            <span className="activity-suggestion__score">
              {plan.score}
              <small>{t(`hava81.dailyPlan.bands.${plan.band}`)}</small>
            </span>
            <button
              type="button"
              className="activity-suggestion__add"
              onClick={() => toggleActivity(plan.activity)}
              aria-label={t('hava81.activities.suggest.add', {
                name: t(`hava81.activities.names.${plan.activity}`),
              })}
            >
              +
            </button>
          </li>
        ))}
      </ol>
      <p className="activity-suggestions__hint">{t('hava81.activities.suggest.hint')}</p>
    </section>
  ) : (
    <p className="activity-planner__empty">
      {freshness.fresh ? t('hava81.activities.suggest.none') : t('hava81.activities.empty')}
    </p>
  );

  return (
    <section className="activity-planner" aria-labelledby="activity-planner-title">
      <header className="activity-planner__header">
        <div>
          <span className="atlas-kicker">{t('hava81.activities.eyebrow')}</span>
          <h2 id="activity-planner-title">{t('hava81.activities.title')}</h2>
          <p>{t('hava81.activities.subtitle')}</p>
        </div>
      </header>

      <div
        className="activity-planner__periods"
        role="group"
        aria-label={t('hava81.activities.period.label')}
      >
        {PLAN_PERIODS.map(id => (
          <button
            key={id}
            type="button"
            aria-pressed={periodId === id}
            onClick={() => setPeriodId(id)}
          >
            {t(`hava81.activities.period.${id}`)}
          </button>
        ))}
      </div>

      {profile.activities.length === 0 ? suggestionsView : null}

      <div
        className="activity-planner__chips"
        role="group"
        aria-label={t('hava81.activities.choose')}
      >
        {availableActivities.map(activity => {
          const active = profile.activities.includes(activity);
          const disabled = false;
          return (
            <button
              key={activity}
              type="button"
              aria-pressed={active}
              aria-describedby={disabled ? 'activity-selection-limit' : undefined}
              className={active ? 'is-active' : ''}
              disabled={disabled}
              onClick={() => toggleActivity(activity)}
            >
              <ActivityGlyph kind={activity} />
              <span>{t(`hava81.activities.names.${activity}`)}</span>
            </button>
          );
        })}
      </div>
      <details className="activity-planner__prefs">
        <summary>
          <span className="activity-planner__prefs-title">
            {t('hava81.activities.prefs.title')}
          </span>
          <span className="activity-planner__prefs-summary">{preferenceSummary}</span>
          <span className="activity-planner__prefs-edit" aria-hidden="true">
            {t('hava81.activities.prefs.edit')}
          </span>
        </summary>
        <div className="activity-planner__prefs-body">
          <label className="activity-planner__sensitivity">
            <span id={sensitivityLabelId}>{t('hava81.activities.sensitivity.label')}</span>
            <select
              value={profile.temperatureSensitivity}
              aria-labelledby={sensitivityLabelId}
              aria-describedby={sensitivityHelpId}
              onChange={event =>
                setTemperatureSensitivity(event.target.value as 'cold' | 'balanced' | 'heat')
              }
            >
              <option value="cold">{t('hava81.activities.sensitivity.cold')}</option>
              <option value="balanced">{t('hava81.activities.sensitivity.balanced')}</option>
              <option value="heat">{t('hava81.activities.sensitivity.heat')}</option>
            </select>
            <small id={sensitivityHelpId}>
              {t(`hava81.activities.sensitivity.help.${profile.temperatureSensitivity}`, {
                value: sensitivityShift,
                unit: temperatureSymbol,
              })}
            </small>
          </label>
          <div
            className="activity-planner__personal"
            role="group"
            aria-label={t('hava81.activities.tolerance.label')}
          >
            {(['wind', 'rain'] as const).map(kind => (
              <label key={kind} className="activity-planner__tolerance">
                <span>{t(`hava81.activities.tolerance.${kind}`)}</span>
                <select
                  value={
                    (kind === 'wind' ? profile.windTolerance : profile.rainTolerance) ?? 'normal'
                  }
                  onChange={event => setTolerance(kind, event.target.value as WeatherTolerance)}
                >
                  <option value="low">{t('hava81.activities.tolerance.low')}</option>
                  <option value="normal">{t('hava81.activities.tolerance.normal')}</option>
                  <option value="high">{t('hava81.activities.tolerance.high')}</option>
                </select>
              </label>
            ))}
            <label className="activity-planner__allergy">
              <input
                type="checkbox"
                checked={profile.pollenAllergy === true}
                onChange={event => setPollenAllergy(event.target.checked)}
              />
              <span>{t('hava81.activities.tolerance.pollenAllergy')}</span>
            </label>
            <small className="activity-planner__tolerance-note">
              {t('hava81.activities.tolerance.note')}
            </small>
          </div>

          <div
            className="activity-planner__window"
            role="group"
            aria-label={t('hava81.activities.window.label')}
          >
            <div className="activity-planner__window-copy">
              <strong>{t('hava81.activities.window.title')}</strong>
              <details className="activity-planner__window-help">
                <summary>{t('hava81.activities.window.helpTitle')}</summary>
                <p>{t('hava81.activities.window.help')}</p>
              </details>
            </div>
            <label>
              <span>{t('hava81.activities.window.start')}</span>
              <input
                type="time"
                value={profile.activityStart ?? ''}
                aria-describedby={activityWindowStatusId}
                onChange={event => setActivityWindow('start', event.target.value || undefined)}
              />
            </label>
            <label>
              <span>{t('hava81.activities.window.end')}</span>
              <input
                type="time"
                value={profile.activityEnd ?? ''}
                aria-describedby={activityWindowStatusId}
                onChange={event => setActivityWindow('end', event.target.value || undefined)}
              />
            </label>
            {hasPartialWindow ? (
              <p
                id="activity-window-incomplete"
                className="activity-planner__window-status"
                role="status"
              >
                {t('hava81.activities.window.incomplete')}
              </p>
            ) : null}
            {profile.activityStart || profile.activityEnd ? (
              <button type="button" className="atlas-text-button" onClick={clearActivityWindow}>
                {t('hava81.activities.window.clear')}
              </button>
            ) : null}
          </div>
        </div>
      </details>
      {plans.length > 1 ? (
        <section className="activity-compare" aria-labelledby="activity-compare-title">
          <h3 id="activity-compare-title">{t('hava81.activities.compare.title')}</h3>
          <ol>
            {rankActivityPlans(plans).map(plan => (
              <li key={plan.activity} className="activity-compare__row">
                <ActivityGlyph kind={plan.activity} />
                <span className="activity-compare__name">
                  {t(`hava81.activities.names.${plan.activity}`)}
                </span>
                <span className="activity-compare__strip" aria-hidden="true">
                  {compareSlots(plan).map(slot => (
                    <span
                      key={slot.time.getTime()}
                      className={[
                        'activity-compare__cell',
                        `activity-compare__cell--${slot.eligible === false ? 'off' : getScoreBand(slot.score)}`,
                        inBest(plan, slot) ? 'activity-compare__cell--best' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    />
                  ))}
                </span>
                <span className="activity-compare__range">
                  {plan.bestWindowRange && !plan.windowUnavailable
                    ? `${formatDayTime(plan.bestWindowRange.start.time)}–${formatTime(plan.bestWindowRange.endTime)}`
                    : t('hava81.activities.compare.none')}
                </span>
                <span className="activity-compare__score">{plan.score}</span>
              </li>
            ))}
          </ol>
          {compareAxis.length > 0 ? (
            <div className="activity-compare__row activity-compare__row--axis" aria-hidden="true">
              <span className="activity-compare__axis">
                {compareAxis.map(time => (
                  <span key={time.getTime()}>{formatDayTime(time)}</span>
                ))}
              </span>
            </div>
          ) : null}
        </section>
      ) : null}

      {!freshness.fresh && profile.activities.length > 0 ? (
        <p className="activity-planner__selection-limit" role="status">
          {t('hava81.activities.forecastStale')}
        </p>
      ) : plans.length > 0 ? (
        <>
          <details className="activity-planner__score-explanation">
            <summary>{t('hava81.activities.score.explanationTitle')}</summary>
            <p>{t('hava81.activities.score.explanation')}</p>
          </details>
          <div className="activity-planner__cards">
            {plans.map(plan => {
              const best = plan.bestWindow;
              const bestRange = plan.bestWindowRange;
              const precipitation = Number.isFinite(best?.precipitationProbability)
                ? Math.round((best?.precipitationProbability as number) * 100)
                : undefined;
              const precipitationAmount = formatPrecipitationAmount(
                best?.precipitationMm,
                i18n.language
              );
              const rainText = precipitationAmount
                ? (precipitation ?? 0) > 0
                  ? t('hava81.activities.conditions.rainWithAmount', {
                      value: precipitation,
                      amount: precipitationAmount,
                    })
                  : t('hava81.activities.conditions.rainAmount', { amount: precipitationAmount })
                : precipitation === undefined
                  ? t('hava81.activities.conditions.precipitationUnknown')
                  : precipitation === 0
                    ? t('hava81.activities.conditions.dry')
                    : t('hava81.activities.conditions.rain', { value: precipitation });
              const scoreLabel = hasWindow
                ? t('hava81.activities.score.filtered', {
                    start: profile.activityStart,
                    end: profile.activityEnd,
                  })
                : t('hava81.activities.score.default');
              const scoreBandLabel = t(`hava81.dailyPlan.bands.${plan.band}`);
              return (
                <article
                  key={plan.activity}
                  className={`activity-card activity-card--${plan.band}`}
                >
                  <header>
                    <div className="activity-card__identity">
                      <ActivityGlyph kind={plan.activity} />
                      <h3>{t(`hava81.activities.names.${plan.activity}`)}</h3>
                    </div>
                    <div className="activity-card__score">
                      <small>
                        <span className="activity-card__score-scope">
                          {t('hava81.scoreScope.activity')}
                        </span>
                        {scoreLabel} · {scoreBandLabel}
                      </small>
                      <strong>
                        {plan.windowUnavailable ? '—' : plan.score}
                        <span>/100</span>
                      </strong>
                    </div>
                  </header>
                  <p className="activity-card__answer">
                    {plan.suitableSpan
                      ? t('hava81.activities.anyTime', {
                          start: formatTime(plan.suitableSpan.start.time),
                          end: formatTime(plan.suitableSpan.endTime),
                        })
                      : bestRange
                        ? t('hava81.activities.bestRange', {
                            start: formatTime(bestRange.start.time),
                            end: formatTime(bestRange.endTime),
                          })
                        : (nextWindowText(plan.activity) ??
                          (plan.activity === 'beach' ? seaNote : t('hava81.activities.noWindow')))}
                  </p>
                  {(() => {
                    const baseline = defaultScoreOf.get(plan.activity);
                    const delta = baseline === undefined ? 0 : plan.score - baseline;
                    return Math.abs(delta) >= 2 && !plan.windowUnavailable ? (
                      <small className="activity-card__personal">
                        {t('hava81.activities.personalEffect', {
                          value: `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`,
                        })}
                      </small>
                    ) : null;
                  })()}
                  {!plan.windowUnavailable && Math.abs(plan.activityImpact) >= 3 ? (
                    <small className="activity-card__vs-general">
                      {t('hava81.activities.vsGeneral', {
                        delta:
                          plan.activityImpact > 0
                            ? `+${plan.activityImpact}`
                            : `${plan.activityImpact}`,
                        why: t(
                          `hava81.activities.vsGeneralWhy.${plan.activityImpact > 0 ? 'up' : 'down'}`
                        ),
                      })}
                    </small>
                  ) : null}
                  {plan.inDarkness && !plan.windowUnavailable ? (
                    <small className="activity-card__darkness">
                      {t('hava81.activities.darkness')}
                    </small>
                  ) : null}
                  {plan.scoreRange && !plan.windowUnavailable ? (
                    <small className="activity-card__range">
                      {t('hava81.dailyPlan.scoreRange', {
                        low: plan.scoreRange.low,
                        high: plan.scoreRange.high,
                      })}
                    </small>
                  ) : null}
                  {windowWhy(plan.explanation, plan.evenDay ? 'weak' : 'window') ? (
                    <small className="activity-card__why">
                      {windowWhy(plan.explanation, plan.evenDay ? 'weak' : 'window')}
                    </small>
                  ) : null}
                  {plan.bestWindowScore !== undefined ? (
                    <small className="activity-card__duration">
                      {t('hava81.activities.fullDuration', { minutes: plan.durationMinutes })}
                    </small>
                  ) : null}
                  {plan.alternativeWindows.length ? (
                    <small className="activity-card__alternatives">
                      {t('hava81.activities.alternatives', {
                        list: plan.alternativeWindows
                          .map(
                            range => `${formatTime(range.start.time)}–${formatTime(range.endTime)}`
                          )
                          .join(', '),
                      })}
                    </small>
                  ) : null}
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
                          value: formatNumber(convertWindSpeed(best.windSpeed), i18n.language),
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
      ) : null}
      <p className="activity-planner__note">{t('hava81.activities.note')}</p>
      {airQualityHourly && showHourlyAqiSource ? (
        <p className="activity-planner__note">
          {t('hava81.activities.hourlyAqiSource', {
            source: airQualityHourly.meta.attribution ?? airQualityHourly.meta.provider,
          })}
        </p>
      ) : null}
    </section>
  );
}

export default ActivityPlanner;
