import { useCallback, useEffect, useState } from 'react';
import type { ActivityKind } from '../domain/activity/types';
import { PLAN_PROFILES } from '../domain/plan/profiles';
import type { Weekday } from '../domain/routines/types';
import type { Routine } from '../domain/routines/types';
import {
  ROUTINES_KEY,
  loadRoutines,
  newRoutineId,
  parseRoutineDocument,
  saveRoutines,
  serializeRoutines,
} from '../storage/routineStore';

export interface RoutineTemplate {
  id: string;
  activity: ActivityKind;
  schedule: Routine['schedule'];
}

/** Ready plans for the first visit: one tap, then edit. */
export const ROUTINE_TEMPLATES: readonly RoutineTemplate[] = [
  {
    id: 'evening-run',
    activity: 'run',
    schedule: { kind: 'fixed', days: [1, 2, 3, 4, 5], start: '18:30', durationMinutes: 45 },
  },
  {
    id: 'morning-dog',
    activity: 'dog',
    schedule: { kind: 'fixed', days: [0, 1, 2, 3, 4, 5, 6], start: '07:30', durationMinutes: 30 },
  },
  {
    id: 'weekend-picnic',
    activity: 'picnic',
    schedule: { kind: 'flexible', days: [0, 6], from: '10:00', to: '18:00', durationMinutes: 120 },
  },
  {
    id: 'laundry-day',
    activity: 'laundry',
    schedule: {
      kind: 'flexible',
      days: [0, 1, 2, 3, 4, 5, 6],
      from: '09:00',
      to: '17:00',
      durationMinutes: 180,
    },
  },
];

export type RoutineDraft = Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>;

const PRESETS: Record<'every' | 'weekdays' | 'weekend', Weekday[]> = {
  every: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekend: [0, 6],
};

/** A sensible starting plan for each activity: what most people mean by it. */
export function defaultDraft(activity: ActivityKind): RoutineDraft {
  const durationMinutes = PLAN_PROFILES[activity].durationMinutes;
  switch (activity) {
    case 'run':
    case 'bike':
      return {
        activity,
        schedule: { kind: 'fixed', days: PRESETS.weekdays, start: '18:30', durationMinutes },
      };
    case 'walk':
      return {
        activity,
        schedule: { kind: 'fixed', days: PRESETS.every, start: '19:00', durationMinutes },
      };
    case 'dog':
      return {
        activity,
        schedule: { kind: 'fixed', days: PRESETS.every, start: '07:30', durationMinutes },
      };
    case 'motorcycle':
      return {
        activity,
        schedule: { kind: 'fixed', days: PRESETS.weekdays, start: '08:00', durationMinutes },
      };
    case 'photo':
      return {
        activity,
        schedule: {
          kind: 'flexible',
          days: PRESETS.every,
          from: '05:00',
          to: '21:00',
          durationMinutes,
        },
      };
    case 'laundry':
    case 'garden':
      return {
        activity,
        schedule: {
          kind: 'flexible',
          days: PRESETS.every,
          from: '09:00',
          to: '18:00',
          durationMinutes,
        },
      };
    default:
      return {
        activity,
        schedule: {
          kind: 'flexible',
          days: PRESETS.weekend,
          from: '10:00',
          to: '18:00',
          durationMinutes,
        },
      };
  }
}

export function useRoutines() {
  const [routines, setRoutines] = useState<Routine[]>(() => loadRoutines());

  const commit = useCallback((update: (current: Routine[]) => Routine[]) => {
    setRoutines(current => {
      const next = update(current);
      saveRoutines(next);
      return next;
    });
  }, []);

  // Another tab changed the plans: follow it.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== ROUTINES_KEY) return;
      setRoutines(parseRoutineDocument(event.newValue) ?? []);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addRoutine = useCallback(
    (draft: RoutineDraft) => {
      const now = Date.now();
      const routine: Routine = { ...draft, id: newRoutineId(), createdAt: now, updatedAt: now };
      commit(current => [...current, routine]);
      return routine.id;
    },
    [commit]
  );

  const updateRoutine = useCallback(
    (id: string, draft: RoutineDraft) =>
      commit(current =>
        current.map(routine =>
          routine.id === id ? { ...routine, ...draft, id, updatedAt: Date.now() } : routine
        )
      ),
    [commit]
  );

  const removeRoutine = useCallback(
    (id: string) => commit(current => current.filter(routine => routine.id !== id)),
    [commit]
  );

  const addFromTemplate = useCallback(
    (template: RoutineTemplate) =>
      addRoutine({ activity: template.activity, schedule: template.schedule }),
    [addRoutine]
  );

  const exportRoutines = useCallback(() => serializeRoutines(routines), [routines]);

  /** Adds the plans from a backup; returns how many were added. */
  const importRoutines = useCallback(
    (raw: string) => {
      const incoming = parseRoutineDocument(raw) ?? [];
      const known = new Set(routines.map(routine => routine.id));
      const fresh = incoming.filter(routine => !known.has(routine.id));
      if (fresh.length > 0) commit(current => [...current, ...fresh]);
      return fresh.length;
    },
    [commit, routines]
  );

  return {
    routines,
    addRoutine,
    updateRoutine,
    removeRoutine,
    addFromTemplate,
    exportRoutines,
    importRoutines,
  };
}
