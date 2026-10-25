import { describe, expect, it } from 'vitest';
import { buildServiceWorkerCacheId } from '../../scripts/lib/service-worker-stamp.mjs';

describe('service worker cache namespace', () => {
  const input = {
    indexHtml: Buffer.from('<html><script src="/assets/index-a.js"></script></html>'),
    manifest: Buffer.from('{"name":"Hava81"}'),
    assetFiles: ['index-a.js', 'vendor-b.js'],
    swSource: "const CACHE_NAME = 'hava81-shell-__HAVA81_BUILD_ID__';",
  };

  it('changes when the worker implementation changes even if app assets do not', () => {
    const first = buildServiceWorkerCacheId(input);
    const changedWorker = buildServiceWorkerCacheId({
      ...input,
      swSource: input.swSource.replace('CACHE_NAME', 'CACHE_NAMESPACE'),
    });
    expect(changedWorker).not.toBe(first);
  });

  it('is deterministic when the asset directory returns entries in a different order', () => {
    const first = buildServiceWorkerCacheId(input);
    const reordered = buildServiceWorkerCacheId({ ...input, assetFiles: [...input.assetFiles].reverse() });
    expect(reordered).toBe(first);
  });
});
