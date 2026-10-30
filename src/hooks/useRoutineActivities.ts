import { useEffect, useState } from 'react';
import type { ActivityKind } from '../domain/activity/types';
import { ROUTINES_CHANGED_EVENT, ROUTINES_KEY, loadRoutines } from '../storage/routineStore';

const read = () => [...new Set(loadRoutines().map(routine => routine.activity))];

/** Activities of the saved plans, in plan order, kept in sync with edits here and in other tabs. */
export function useRoutineActivities(): ActivityKind[] {
  const [activities, setActivities] = useState<ActivityKind[]>(read);
  useEffect(() => {
    const sync = () => setActivities(read());
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
  return activities;
}
