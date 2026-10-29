import { useRoutines } from '../../hooks/useRoutines';
import { RoutineList } from './RoutineList';
import { ActivityGlyph } from './activityGlyphs';
import { ACTIVITY_GROUPS, groupOf } from './activityGroups';
import { buildCalendarEvent } from '../../utils/calendarEvent';
import {
  addPendingPlan,
  duePendingPlan,
  planTrackRecord,
  readPlanFeedback,
  recordPlanFeedback,
  removePendingPlan,
} from '../../utils/planFeedback';
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
  const routineStore = useRoutines();
  const [duePlan, setDuePlan] = useState(() => duePendingPlan(Date.now()));
  const [track, setTrack] = useState(() => planTrackRecord(readPlanFeedback()));
  const answerDuePlan = (good: boolean) => {
    if (!duePlan) return;
    const entries = recordPlanFeedback({
      id: duePlan.id,
      activity: duePlan.activity,
      score: duePlan.score,
      good,
      answeredAt: Date.now(),
    });
    removePendingPlan(duePlan.id);
    setTrack(planTrackRecord(entries));
    setDuePlan(duePendingPlan(Date.now()));
  };
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

  // Calendar: the reminder lives in the user's own calendar app, also when Hava81 is closed.
  const addToCalendar = (
    activity: ActivityKind,
    score: number,
    range: NonNullable<(typeof plans)[number]['bestWindowRange']>
  ) => {
    const startMs = range.start.time.getTime();
    const endMs = range.endTime.getTime();
    const id = `${activity}:${startMs}`;
    const name = t(`hava81.activities.names.${activity}`);
    const ics = buildCalendarEvent({
      title: t('hava81.activities.calendar.title', { name }),
      description: t('hava81.activities.calendar.body', { score }),
      location: weather.cityName,
      start: range.start.time,
      end: range.endTime,
      uid: `${id}@hava81`,
    });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `hava81-${activity}.ics`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    addPendingPlan({ id, activity, score, startMs, endMs });
  };

  // "+" keeps the suggestion as a one-off plan on that day, at the suggested time.
  const saveSuggestion = (plan: (typeof suggestions)[number]) => {
    const range = plan.bestWindowRange;
    if (!range) return;
    const localStart = new Date(range.start.time.getTime() + offset);
    const clock = (date: Date) =>
      `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
    routineStore.addRoutine({
      activity: plan.activity,
      schedule: {
        kind: 'fixed',
        days: [],
        date: localStart.toISOString().slice(0, 10),
        start: clock(localStart),
        durationMinutes: plan.durationMinutes,
      },
    });
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
              onClick={() => saveSuggestion(plan)}
              aria-label={t('hava81.activities.suggest.add', {
                name: t(`hava81.activities.names.${plan.activity}`),
              })}
            >
              +
            </button>
          </li>
        ))}
      </ol>
    </section>
  ) : (
    <p className="activity-planner__empty">
      {freshness.fresh ? t('hava81.activities.suggest.none') : t('hava81.activities.empty')}
    </p>
  );

  return (
    <>
      <RoutineList
        weather={weather}
        hourly={hourly}
        airQuality={airQuality}
        airQualityHourly={airQualityHourly}
        contextSignals={contextSignals}
        sensitivity={profile.temperatureSensitivity}
        tolerance={toleranceOf(profile)}
        availableActivities={availableActivities}
        fresh={freshness.fresh}
        store={routineStore}
      />
      <section className="activity-planner" aria-labelledby="activity-planner-title">
        <header className="activity-planner__header">
          <div>
            <span className="atlas-kicker">{t('hava81.activities.eyebrow')}</span>
            <h2 id="activity-planner-title">{t('hava81.activities.title')}</h2>
          </div>
        </header>

        {duePlan ? (
          <div className="plan-feedback" role="group" aria-labelledby="plan-feedback-question">
            <p id="plan-feedback-question">
              {t('hava81.activities.feedback.question', {
                name: t(`hava81.activities.names.${duePlan.activity}`),
                start: formatDayTime(new Date(duePlan.startMs)),
                end: formatTime(new Date(duePlan.endMs)),
              })}
            </p>
            <button type="button" onClick={() => answerDuePlan(true)}>
              {t('hava81.activities.feedback.good')}
            </button>
            <button type="button" onClick={() => answerDuePlan(false)}>
              {t('hava81.activities.feedback.bad')}
            </button>
          </div>
        ) : track.total >= 3 ? (
          <p className="plan-feedback__record">
            {t('hava81.activities.feedback.record', { good: track.good, total: track.total })}
          </p>
        ) : null}

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
        {/* Two cards already sit side by side; the strip earns its place from three on. */}
        {plans.length > 2 ? (
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
                            (plan.activity === 'beach'
                              ? seaNote
                              : t('hava81.activities.noWindow')))}
                      {bestRange && !plan.windowUnavailable ? (
                        <button
                          type="button"
                          className="activity-card__calendar"
                          onClick={() => addToCalendar(plan.activity, plan.score, bestRange)}
                        >
                          {t('hava81.activities.calendar.add')}
                        </button>
                      ) : null}
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
                              range =>
                                `${formatTime(range.start.time)}–${formatTime(range.endTime)}`
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
    </>
  );
}

export default ActivityPlanner;
