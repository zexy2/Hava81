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
