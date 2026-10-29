import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROUTINE_TEMPLATES, defaultDraft, useRoutines } from '../../hooks/useRoutines';
import { ROUTINES_KEY } from '../../storage/routineStore';

const empty = () =>
  localStorage.setItem(ROUTINES_KEY, JSON.stringify({ schemaVersion: 1, routines: [] }));

describe('useRoutines', () => {
  beforeEach(() => {
    localStorage.clear();
    empty();
  });

  it('adds, updates and removes a plan, and stores every change', () => {
    const { result } = renderHook(() => useRoutines());
    let id = '';
    act(() => {
      id = result.current.addRoutine(defaultDraft('run'));
    });
    expect(result.current.routines).toHaveLength(1);

    act(() => result.current.updateRoutine(id, { ...defaultDraft('run'), name: 'Sahil' }));
    expect(result.current.routines[0]).toMatchObject({ id, name: 'Sahil', activity: 'run' });
    expect(JSON.parse(localStorage.getItem(ROUTINES_KEY) ?? '{}').routines[0].name).toBe('Sahil');

    act(() => result.current.removeRoutine(id));
    expect(result.current.routines).toEqual([]);
  });

  it('a backup adds only plans it does not have, and says how many', () => {
    const { result } = renderHook(() => useRoutines());
    act(() => {
      result.current.addFromTemplate(ROUTINE_TEMPLATES[0]);
    });
    const backup = result.current.exportRoutines();

    let added = -1;
    act(() => {
      added = result.current.importRoutines(backup);
    });
    expect(added).toBe(0);

    const other = JSON.stringify({
      schemaVersion: 1,
      routines: [
        {
          id: 'from-phone',
          activity: 'dog',
          schedule: { kind: 'fixed', days: [1], start: '07:30', durationMinutes: 30 },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    act(() => {
      added = result.current.importRoutines(other);
    });
    expect(added).toBe(1);
    expect(result.current.routines.map(routine => routine.activity)).toEqual(['run', 'dog']);
  });

  it('a broken backup adds nothing', () => {
    const { result } = renderHook(() => useRoutines());
    let added = -1;
    act(() => {
      added = result.current.importRoutines('{not json');
    });
    expect(added).toBe(0);
    expect(result.current.routines).toEqual([]);
  });

  it('follows a change made in another tab', () => {
    const { result } = renderHook(() => useRoutines());
    const value = JSON.stringify({
      schemaVersion: 1,
      routines: [
        {
          id: 'other-tab',
          activity: 'walk',
          schedule: {
            kind: 'flexible',
            days: [0, 6],
            from: '10:00',
            to: '18:00',
            durationMinutes: 60,
          },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: ROUTINES_KEY, newValue: value }));
    });
    expect(result.current.routines.map(routine => routine.id)).toEqual(['other-tab']);

    // Unrelated keys are ignored; a cleared store means no plans.
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'something-else', newValue: '' }));
    });
    expect(result.current.routines).toHaveLength(1);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: ROUTINES_KEY, newValue: null }));
    });
    expect(result.current.routines).toEqual([]);
  });

  it('every activity gets a sensible default plan', () => {
    for (const activity of [
      'walk',
      'run',
      'bike',
      'dog',
      'picnic',
      'children',
      'beach',
      'garden',
      'photo',
      'motorcycle',
      'laundry',
    ] as const) {
      const draft = defaultDraft(activity);
      expect(draft.activity).toBe(activity);
      expect(draft.schedule.days.length).toBeGreaterThan(0);
      expect(draft.schedule.durationMinutes).toBeGreaterThanOrEqual(15);
    }
  });
});
