import { describe, expect, it } from 'vitest';
import { buildCalendarEvent } from '../../utils/calendarEvent';
import {
  addPendingPlan,
  duePendingPlan,
  planTrackRecord,
  readPlanFeedback,
  recordPlanFeedback,
} from '../../utils/planFeedback';

const memoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
};

describe('calendar event', () => {
  const ics = buildCalendarEvent({
    title: 'Koşu, akşam; sahil',
    location: 'İzmir',
    start: new Date(Date.UTC(2026, 9, 29, 15, 0)),
    end: new Date(Date.UTC(2026, 9, 29, 16, 0)),
    uid: 'run:1@hava81',
    now: new Date(Date.UTC(2026, 9, 29, 10, 0)),
  });

  it('uses UTC times, escapes text and reminds 15 minutes before', () => {
    expect(ics).toContain('DTSTART:20261029T150000Z\r\n');
    expect(ics).toContain('DTEND:20261029T160000Z\r\n');
    expect(ics).toContain('SUMMARY:Koşu\\, akşam\\; sahil\r\n');
    expect(ics).toContain('TRIGGER:-PT15M');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('folds lines above 75 octets', () => {
    const long = buildCalendarEvent({
      title: 'ş'.repeat(80),
      start: new Date(0),
      end: new Date(3_600_000),
      uid: 'x',
    });
    for (const line of long.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});

describe('plan feedback', () => {
  const plan = { id: 'run:1', activity: 'run', score: 84, startMs: 1_000, endMs: 5_000 };

  it('asks only after the window ended, and only once', () => {
    const storage = memoryStorage();
    addPendingPlan(plan, storage);
    expect(duePendingPlan(4_000, storage)).toBeUndefined();
    expect(duePendingPlan(6_000, storage)?.id).toBe('run:1');
    recordPlanFeedback(
      { id: 'run:1', activity: 'run', score: 84, good: true, answeredAt: 6_000 },
      storage
    );
    expect(duePendingPlan(7_000, storage)).toBeUndefined();
  });

  it('counts only recommended windows in the track record', () => {
    const storage = memoryStorage();
    recordPlanFeedback({ id: 'a', activity: 'run', score: 90, good: true, answeredAt: 1 }, storage);
    recordPlanFeedback(
      { id: 'b', activity: 'run', score: 80, good: false, answeredAt: 2 },
      storage
    );
    recordPlanFeedback({ id: 'c', activity: 'run', score: 50, good: true, answeredAt: 3 }, storage);
    expect(planTrackRecord(readPlanFeedback(storage))).toEqual({ total: 2, good: 1 });
  });

  it('survives a corrupted store', () => {
    const storage = memoryStorage();
    storage.setItem('hava81.planFeedback.v1', '{not json');
    expect(readPlanFeedback(storage)).toEqual([]);
  });
});
