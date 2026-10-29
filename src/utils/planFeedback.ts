/**
 * "How was it?" answers for past recommended windows. Stored on this device only; nothing is
 * sent anywhere. The newest 50 are kept.
 */
export interface PlanFeedback {
  /** Activity and window start: one answer per recommendation. */
  id: string;
  activity: string;
  score: number;
  good: boolean;
  answeredAt: number;
}

const STORAGE_KEY = 'hava81.planFeedback.v1';
const MAX_ENTRIES = 50;

const isEntry = (value: unknown): value is PlanFeedback => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.activity === 'string' &&
    typeof entry.score === 'number' &&
    typeof entry.good === 'boolean' &&
    typeof entry.answeredAt === 'number'
  );
};

export function readPlanFeedback(storage: Storage | undefined = globalThis.localStorage) {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export function recordPlanFeedback(
  entry: PlanFeedback,
  storage: Storage | undefined = globalThis.localStorage
) {
  const next = [entry, ...readPlanFeedback(storage).filter(item => item.id !== entry.id)].slice(
    0,
    MAX_ENTRIES
  );
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full quota: the answer is simply not kept.
  }
  return next;
}

/** How often a recommended (score ≥ 70) window turned out good, over the last answers. */
export function planTrackRecord(entries: readonly PlanFeedback[], last = 10) {
  const recommended = entries.filter(entry => entry.score >= 70).slice(0, last);
  return {
    total: recommended.length,
    good: recommended.filter(entry => entry.good).length,
  };
}

/** A window the user put in their calendar; asked about once it has ended. */
export interface PendingPlan {
  id: string;
  activity: string;
  score: number;
  startMs: number;
  endMs: number;
}

const PENDING_KEY = 'hava81.planPending.v1';

const isPending = (value: unknown): value is PendingPlan => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.activity === 'string' &&
    typeof entry.score === 'number' &&
    typeof entry.startMs === 'number' &&
    typeof entry.endMs === 'number'
  );
};

export function readPendingPlans(storage: Storage | undefined = globalThis.localStorage) {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(PENDING_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isPending) : [];
  } catch {
    return [];
  }
}

const writePending = (plans: PendingPlan[], storage: Storage | undefined) => {
  try {
    storage?.setItem(PENDING_KEY, JSON.stringify(plans.slice(0, 20)));
  } catch {
    // Not kept; the question is simply not asked later.
  }
};

export function addPendingPlan(
  plan: PendingPlan,
  storage: Storage | undefined = globalThis.localStorage
) {
  writePending([plan, ...readPendingPlans(storage).filter(item => item.id !== plan.id)], storage);
}

export function removePendingPlan(
  id: string,
  storage: Storage | undefined = globalThis.localStorage
) {
  writePending(
    readPendingPlans(storage).filter(item => item.id !== id),
    storage
  );
}

/** The oldest ended plan from the last three days that has no answer yet. */
export function duePendingPlan(
  nowMs: number,
  storage: Storage | undefined = globalThis.localStorage
) {
  const answered = new Set(readPlanFeedback(storage).map(entry => entry.id));
  return readPendingPlans(storage)
    .filter(
      plan => plan.endMs <= nowMs && nowMs - plan.endMs < 3 * 86_400_000 && !answered.has(plan.id)
    )
    .sort((a, b) => a.endMs - b.endMs)[0];
}
