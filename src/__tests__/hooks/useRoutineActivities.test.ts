import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRoutineActivities } from '../../hooks/useRoutineActivities';
import { ROUTINES_KEY, saveRoutines } from '../../storage/routineStore';
import type { Routine } from '../../domain/routines/types';

const routine = (id: string, activity: Routine['activity']): Routine => ({
  id,
  activity,
  schedule: { kind: 'fixed', days: [1], start: '08:00', durationMinutes: 30 },
  createdAt: 1,
  updatedAt: 1,
});

describe('useRoutineActivities', () => {
  afterEach(() => localStorage.clear());

  it('lists each planned activity once, in plan order, and follows edits', () => {
    saveRoutines([routine('a', 'run'), routine('b', 'dog'), routine('c', 'run')]);
    const { result } = renderHook(() => useRoutineActivities());
    expect(result.current).toEqual(['run', 'dog']);

    act(() => saveRoutines([routine('d', 'picnic')]));
    expect(result.current).toEqual(['picnic']);
  });

  it('follows edits made in another tab', () => {
    const { result } = renderHook(() => useRoutineActivities());
    expect(result.current).toEqual([]);
    localStorage.setItem(
      ROUTINES_KEY,
      JSON.stringify({ schemaVersion: 1, routines: [routine('a', 'bike')] })
    );
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'other' }));
    });
    expect(result.current).toEqual([]);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: ROUTINES_KEY }));
    });
    expect(result.current).toEqual(['bike']);
  });
});
