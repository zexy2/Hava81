export const mostRecentChunkRecoveryAttempt = (
  urlAttempt: number,
  storedAttemptValue: string | null
): number => {
  const normalizedUrlAttempt = Number.isFinite(urlAttempt) && urlAttempt > 0 ? urlAttempt : 0;
  const storedAttempt = Number(storedAttemptValue ?? 0);
  const normalizedStoredAttempt =
    Number.isFinite(storedAttempt) && storedAttempt > 0 ? storedAttempt : 0;

  return Math.max(normalizedUrlAttempt, normalizedStoredAttempt);
};

export const isRecentChunkRecoveryAttempt = (
  attempt: number,
  now: number,
  recoveryWindowMs: number
): boolean => {
  if (!Number.isFinite(attempt) || attempt <= 0) return false;
  if (!Number.isFinite(now) || !Number.isFinite(recoveryWindowMs) || recoveryWindowMs <= 0) {
    return false;
  }

  const age = now - attempt;
  return age >= 0 && age < recoveryWindowMs;
};
