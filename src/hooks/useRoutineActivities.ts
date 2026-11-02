import { useEffect, useState } from 'react';
import type { ActivityKind } from '../domain/activity/types';
import type { Routine } from '../domain/routines/types';
import { ROUTINES_CHANGED_EVENT, ROUTINES_KEY, loadRoutines } from '../storage/routineStore';

/** Saved plans, kept in sync with edits in this tab and in other tabs. */
export function useSavedRoutines(): Routine[] {
  const [routines, setRoutines] = useState<Routine[]>(loadRoutines);
  useEffect(() => {
    const sync = () => setRoutines(loadRoutines());
    const onStorage = (event: StorageEvent) => {
      if (event.key === ROUTINES_KEY) sync();
    };
    window.addEventListener(ROUTINES_CHANGED_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ROUTINES_CHANGED_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return routines;
}

/** Activities of the saved plans, each once, in plan order. */
export function useRoutineActivities(): ActivityKind[] {
  const routines = useSavedRoutines();
  return [...new Set(routines.map(routine => routine.activity))];
}
