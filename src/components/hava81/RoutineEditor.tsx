import { TimeField } from './TimeField';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActivityKind } from '../../domain/activity/types';
import type { WeatherTolerance } from '../../domain/plan/types';
import type { Routine, Weekday } from '../../domain/routines/types';
import { defaultDraft, type RoutineDraft } from '../../hooks/useRoutines';
import { ActivityGlyph } from './activityGlyphs';
import { ACTIVITY_GROUPS } from './activityGroups';

const WEEK: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const PRESETS: Record<'every' | 'weekdays' | 'weekend', Weekday[]> = {
  every: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekend: [0, 6],
};
const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const TOLERANCES: WeatherTolerance[] = ['low', 'normal', 'high'];

interface Props {
  initial?: Routine;
  availableActivities: readonly ActivityKind[];
  onSave: (draft: RoutineDraft) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function RoutineEditor({ initial, availableActivities, onSave, onCancel, onDelete }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState<RoutineDraft>(() =>
    initial
      ? {
          name: initial.name,
          activity: initial.activity,
          schedule: initial.schedule,
          place: initial.place,
          sensitivity: initial.sensitivity,
          windTolerance: initial.windTolerance,
          rainTolerance: initial.rainTolerance,
          remind: initial.remind,
        }
      : defaultDraft(availableActivities[0] ?? 'walk')
  );
  const schedule = draft.schedule;
  const setSchedule = (next: Partial<Routine['schedule']>) =>
    setDraft(current => ({
      ...current,
      schedule: { ...current.schedule, ...next } as Routine['schedule'],
    }));
  const toggleDay = (day: Weekday) =>
    setSchedule({
      date: undefined,
      days: schedule.days.includes(day)
        ? schedule.days.filter(item => item !== day)
        : [...schedule.days, day].sort(),
    });
  const sameDays = (days: Weekday[]) =>
    days.length === schedule.days.length && days.every(day => schedule.days.includes(day));
  const setKind = (kind: 'fixed' | 'flexible') => {
    if (kind === schedule.kind) return;
    const base = {
      days: schedule.days,
      date: schedule.date,
      durationMinutes: schedule.durationMinutes,
    };
    setDraft(current => ({
      ...current,
      schedule:
        kind === 'fixed'
          ? { kind, ...base, start: schedule.kind === 'flexible' ? schedule.from : '18:30' }
          : {
              kind,
              ...base,
              from: schedule.kind === 'fixed' ? schedule.start : '10:00',
              to: '20:00',
            },
    }));
  };
  const valid = schedule.days.length > 0 || Boolean(schedule.date);
  const weekdayName = (day: Weekday) => t(`hava81.routines.days.${day}`);

  return (
    <form
      className="routine-editor"
      aria-labelledby={`${id}-title`}
      onSubmit={event => {
        event.preventDefault();
        if (valid) onSave({ ...draft, name: draft.name?.trim() || undefined });
      }}
    >
      <h3 id={`${id}-title`}>
        {initial ? t('hava81.routines.editTitle') : t('hava81.routines.newTitle')}
      </h3>

      <fieldset className="routine-editor__activities">
        <legend>{t('hava81.routines.what')}</legend>
        {ACTIVITY_GROUPS.flatMap(group => group.activities)
          .filter(activity => availableActivities.includes(activity) || activity === draft.activity)
          .map(activity => (
            <button
              key={activity}
              type="button"
              aria-pressed={draft.activity === activity}
              onClick={() =>
                setDraft(current =>
                  initial
                    ? { ...current, activity }
                    : { ...defaultDraft(activity), name: current.name }
                )
              }
            >
              <ActivityGlyph kind={activity} />
              <span>{t(`hava81.activities.names.${activity}`)}</span>
            </button>
          ))}
      </fieldset>

      <fieldset className="routine-editor__when">
        <legend>{t('hava81.routines.when')}</legend>
        <div className="routine-editor__presets">
          {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map(preset => (
            <button
              key={preset}
              type="button"
              aria-pressed={sameDays(PRESETS[preset])}
              onClick={() => setSchedule({ days: PRESETS[preset], date: undefined })}
            >
              {t(`hava81.routines.presets.${preset}`)}
            </button>
          ))}
        </div>
        <div
          className="routine-editor__days"
          role="group"
          aria-label={t('hava81.routines.daysLabel')}
        >
          {WEEK.map(day => (
            <button
              key={day}
              type="button"
              aria-pressed={schedule.days.includes(day)}
              aria-label={t(`hava81.routines.daysLong.${day}`)}
              onClick={() => toggleDay(day)}
            >
              {weekdayName(day)}
            </button>
          ))}
        </div>

        <div
          className="routine-editor__kind"
          role="radiogroup"
          aria-label={t('hava81.routines.kindLabel')}
        >
          {(['fixed', 'flexible'] as const).map(kind => (
            <label key={kind}>
              <input
                type="radio"
                name={`${id}-kind`}
                checked={schedule.kind === kind}
                onChange={() => setKind(kind)}
              />
              <span>{t(`hava81.routines.kind.${kind}`)}</span>
            </label>
          ))}
        </div>

        <div className="routine-editor__times">
          {schedule.kind === 'fixed' ? (
            <label>
              <span>{t('hava81.routines.start')}</span>
              <TimeField
                value={schedule.start}
                required
                onChange={value => value && setSchedule({ start: value })}
              />
            </label>
          ) : (
            <>
              <label>
                <span>{t('hava81.routines.from')}</span>
                <TimeField
                  value={schedule.from}
                  required
                  onChange={value => value && setSchedule({ from: value })}
                />
              </label>
              <label>
                <span>{t('hava81.routines.to')}</span>
                <TimeField
                  value={schedule.to}
                  required
                  onChange={value => value && setSchedule({ to: value })}
                />
              </label>
            </>
          )}
          <label>
            <span>{t('hava81.routines.duration')}</span>
            <select
              value={schedule.durationMinutes}
              onChange={event => setSchedule({ durationMinutes: Number(event.target.value) })}
            >
              {[...new Set([...DURATIONS, schedule.durationMinutes])]
                .sort((a, b) => a - b)
                .map(minutes => (
                  <option key={minutes} value={minutes}>
                    {t('hava81.routines.minutes', { count: minutes })}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </fieldset>

      <details className="routine-editor__more">
        <summary>{t('hava81.routines.more')}</summary>
        <label className="routine-editor__name">
          <span>{t('hava81.routines.name')}</span>
          <input
            type="text"
            maxLength={40}
            value={draft.name ?? ''}
            placeholder={t(`hava81.activities.names.${draft.activity}`)}
            onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
          />
        </label>
        {(['windTolerance', 'rainTolerance'] as const).map(field => (
          <label key={field} className="routine-editor__tolerance">
            <span>{t(`hava81.routines.${field}`)}</span>
            <select
              value={draft[field] ?? ''}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  [field]: (event.target.value || undefined) as WeatherTolerance | undefined,
                }))
              }
            >
              <option value="">{t('hava81.routines.useGeneral')}</option>
              {TOLERANCES.map(value => (
                <option key={value} value={value}>
                  {t(`hava81.activities.tolerance.${value}`)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </details>

      {!valid ? (
        <p className="routine-editor__error" role="alert">
          {t('hava81.routines.pickDay')}
        </p>
      ) : null}

      <div className="routine-editor__actions">
        <button type="submit" className="routine-editor__save" disabled={!valid}>
          {t('hava81.routines.save')}
        </button>
        <button type="button" onClick={onCancel}>
          {t('hava81.routines.cancel')}
        </button>
        {onDelete ? (
          <button type="button" className="routine-editor__delete" onClick={onDelete}>
            {t('hava81.routines.delete')}
          </button>
        ) : null}
      </div>
    </form>
  );
}

export default RoutineEditor;
