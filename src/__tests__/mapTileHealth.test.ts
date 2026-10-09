import { describe, expect, it } from 'vitest';
import { shouldFailTileProvider } from '../utils/mapTileHealth';

describe('map tile provider health', () => {
  it('keeps a provider when some tiles load even if neighboring tiles fail', () => {
    expect(shouldFailTileProvider(8, 1)).toBe(false);
    expect(shouldFailTileProvider(1, 8)).toBe(false);
  });

  it('fails a provider only when a completed tile batch has errors and no successes', () => {
    expect(shouldFailTileProvider(0, 1)).toBe(true);
    expect(shouldFailTileProvider(0, 12)).toBe(true);
  });

  it('does not infer an outage before any tile error has occurred', () => {
    expect(shouldFailTileProvider(0, 0)).toBe(false);
  });
});
