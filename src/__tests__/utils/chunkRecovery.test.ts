import { describe, expect, it } from 'vitest';
import { mostRecentChunkRecoveryAttempt } from '../../utils/chunkRecovery';

describe('mostRecentChunkRecoveryAttempt', () => {
  it('keeps the URL recovery guard when storage is empty', () => {
    expect(mostRecentChunkRecoveryAttempt(1_000, null)).toBe(1_000);
  });

  it('keeps the URL recovery guard when stored state is malformed', () => {
    expect(mostRecentChunkRecoveryAttempt(1_000, 'not-a-time')).toBe(1_000);
  });

  it('uses the newest valid guard across URL and storage state', () => {
    expect(mostRecentChunkRecoveryAttempt(1_000, '2000')).toBe(2_000);
    expect(mostRecentChunkRecoveryAttempt(3_000, '2000')).toBe(3_000);
  });

  it('ignores non-positive recovery timestamps', () => {
    expect(mostRecentChunkRecoveryAttempt(-1, '-5')).toBe(0);
  });
});
