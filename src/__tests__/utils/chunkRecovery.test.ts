import { describe, expect, it } from 'vitest';
import {
  isRecentChunkRecoveryAttempt,
  mostRecentChunkRecoveryAttempt,
} from '../../utils/chunkRecovery';

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

describe('isRecentChunkRecoveryAttempt', () => {
  it('keeps a recovery guard only inside the bounded past window', () => {
    expect(isRecentChunkRecoveryAttempt(9_500, 10_000, 1_000)).toBe(true);
    expect(isRecentChunkRecoveryAttempt(9_000, 10_000, 1_000)).toBe(false);
  });

  it('rejects future-skewed guards so clock changes cannot suppress recovery', () => {
    expect(isRecentChunkRecoveryAttempt(10_001, 10_000, 60_000)).toBe(false);
  });

  it('rejects malformed guard inputs', () => {
    expect(isRecentChunkRecoveryAttempt(0, 10_000, 60_000)).toBe(false);
    expect(isRecentChunkRecoveryAttempt(Number.NaN, 10_000, 60_000)).toBe(false);
    expect(isRecentChunkRecoveryAttempt(9_500, Number.NaN, 60_000)).toBe(false);
    expect(isRecentChunkRecoveryAttempt(9_500, 10_000, 0)).toBe(false);
  });
});
