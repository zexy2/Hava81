import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActivityKind, TemperatureSensitivity } from '../../domain/activity/types';
import { REASON_I18N_KEY } from '../../domain/decision/reasonKeys';
import type { PersonalTolerance } from '../../domain/plan/types';
import { evaluateRoutine, type RoutineEvaluation } from '../../domain/routines/evaluateRoutine';
import type { Routine } from '../../domain/routines/types';
import { ROUTINE_TEMPLATES, type RoutineDraft, type useRoutines } from '../../hooks/useRoutines';
import type {
  AirQuality,
  AirQualityHourly,
  ContextSignals,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { formatCityTime } from '../../utils/format';
import { ActivityGlyph } from './activityGlyphs';
import { RoutineEditor } from './RoutineEditor';

interface Props {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  airQualityHourly?: AirQualityHourly;
  contextSignals?: ContextSignals | null;
  sensitivity: TemperatureSensitivity;
  tolerance: PersonalTolerance;
  /** Activities this city offers (no beach inland). */
  availableActivities: readonly ActivityKind[];
  /** Whether the forecast is fresh enough to score; stale data shows no numbers. */
  fresh: boolean;
  /** One plan store for the whole Planla page. */
  store: ReturnType<typeof useRoutines>;
}

const DAY_MS = 86_400_000;

export function RoutineList({
  weather,
  hourly,
  airQuality,
  airQualityHourly,
  contextSignals,
  sensitivity,
  tolerance,
  availableActivities,
  fresh,
  store,
}: Props) {
  const { t, i18n } = useTranslation();
  const { routines, addRoutine, updateRoutine, removeRoutine, addFromTemplate } = store;
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const offset = weather.meta.timezoneOffsetSeconds;
  const now = new Date();

  const time = (ms: number) => formatCityTime(new Date(ms), offset, i18n.language);
  const dayLabel = (ms: number) => {
    const dayOf = (value: number) => Math.floor((value + offset * 1000) / DAY_MS);
    const diff = dayOf(ms) - dayOf(now.getTime());
    if (diff === 0) return t('hava81.routines.today');
    if (diff === 1) return t('hava81.routines.tomorrow');
    return new Intl.DateTimeFormat(i18n.language, { weekday: 'long', timeZone: 'UTC' }).format(
      new Date(ms + offset * 1000)
    );
  };

  const evaluations = routines.map(routine => ({
    routine,
    result: fresh
      ? evaluateRoutine(routine, {
          weather,
          hourly,
          airQuality,
          airQualityHourly,
          contextSignals,
          sensitivity,
          tolerance,
          now,
        })
      : ({ status: 'none' } as RoutineEvaluation),
  }));
  const startOf = (result: RoutineEvaluation) =>
    result.status === 'none' ? Number.POSITIVE_INFINITY : result.occurrence.startMs;
  evaluations.sort((a, b) => startOf(a.result) - startOf(b.result));

  const save = (draft: RoutineDraft) => {
    if (editing === 'new') addRoutine(draft);
    else if (editing) updateRoutine(editing, draft);
    setEditing(null);
  };

  const statusLine = (routine: Routine, result: RoutineEvaluation) => {
    if (result.status === 'pending') {
      return t('hava81.routines.pending', { count: result.daysUntilForecast });
    }
    if (result.status !== 'scored') return t('hava81.routines.noOccurrence');
    const { plan, better } = result;
    if (better) {
      return t('hava81.routines.better', {
        start: time(better.startMs),
        end: time(better.endMs),
        score: better.score,
      });
    }
    if (routine.schedule.kind === 'flexible' && plan.bestWindowRange && !plan.windowUnavailable) {
      return t('hava81.routines.bestInside', {
        start: time(plan.bestWindowRange.start.time.getTime()),
        end: time(plan.bestWindowRange.endTime.getTime()),
      });
    }
    if (plan.windowUnavailable) return t('hava81.routines.notSuitable');
    const reason = plan.reasons[0];
    return reason
      ? t(`hava81.dailyPlan.reasons.${REASON_I18N_KEY[reason]}`)
      : t('hava81.routines.clear');
  };

  const whenLine = (routine: Routine, result: RoutineEvaluation) => {
    if (result.status === 'none') return t('hava81.routines.noOccurrence');
    const { occurrence } = result;
    const range =
      routine.schedule.kind === 'fixed'
        ? `${time(occurrence.startMs)}–${time(occurrence.endMs)}`
        : t('hava81.routines.flexibleRange', {
            from: time(occurrence.startMs),
            to: time(occurrence.endMs),
          });
    return `${dayLabel(occurrence.startMs)} · ${range}`;
  };

  return (
    <section className="routine-list" aria-labelledby="routine-list-title">
      <header className="routine-list__header">
        <h2 id="routine-list-title">{t('hava81.routines.title')}</h2>
        {editing === null && routines.length > 0 ? (
          <button type="button" className="routine-list__add" onClick={() => setEditing('new')}>
            {t('hava81.routines.add')}
          </button>
        ) : null}
      </header>

      {editing === 'new' ? (
        <RoutineEditor
          availableActivities={availableActivities}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {routines.length === 0 && editing === null ? (
        <div className="routine-list__empty">
          <p>{t('hava81.routines.emptyLead')}</p>
          <ul className="routine-templates">
            {ROUTINE_TEMPLATES.filter(template =>
              availableActivities.includes(template.activity)
            ).map(template => (
              <li key={template.id}>
                <button type="button" onClick={() => addFromTemplate(template)}>
                  <ActivityGlyph kind={template.activity} />
                  <span>
                    <strong>{t(`hava81.routines.templates.${template.id}.name`)}</strong>
                    <small>{t(`hava81.routines.templates.${template.id}.when`)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="routine-list__custom" onClick={() => setEditing('new')}>
            {t('hava81.routines.custom')}
          </button>
        </div>
      ) : null}

      {routines.length > 0 ? (
        <ol className="routine-list__items">
          {evaluations.map(({ routine, result }) =>
            editing === routine.id ? (
              <li key={routine.id}>
                <RoutineEditor
                  initial={routine}
                  availableActivities={availableActivities}
                  onSave={save}
                  onCancel={() => setEditing(null)}
                  onDelete={() => {
                    removeRoutine(routine.id);
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li
                key={routine.id}
                className={`routine-row routine-row--${result.status === 'scored' ? result.plan.band : 'pending'}`}
              >
                <button
                  type="button"
                  className="routine-row__button"
                  onClick={() => setEditing(routine.id)}
                  aria-label={t('hava81.routines.editLabel', {
                    name: routine.name ?? t(`hava81.activities.names.${routine.activity}`),
                  })}
                >
                  <ActivityGlyph kind={routine.activity} />
                  <span className="routine-row__copy">
                    <strong>
                      {routine.name ?? t(`hava81.activities.names.${routine.activity}`)}
                    </strong>
                    <span className="routine-row__when">{whenLine(routine, result)}</span>
                    <span className="routine-row__status">{statusLine(routine, result)}</span>
                  </span>
                  <span className="routine-row__score">
                    {result.status === 'scored' ? (
                      <>
                        {result.plan.score}
                        <small>{t(`hava81.dailyPlan.bands.${result.plan.band}`)}</small>
                      </>
                    ) : (
                      <small>{t('hava81.routines.noScore')}</small>
                    )}
                  </span>
                </button>
              </li>
            )
          )}
        </ol>
      ) : null}
    </section>
  );
}

export default RoutineList;
