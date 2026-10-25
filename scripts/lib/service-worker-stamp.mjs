import { createHash } from 'node:crypto';

/**
 * Give every distinct service-worker implementation its own cache namespace.
 * Hash the template before replacing the placeholder to avoid a self-referential ID.
 */
export function buildServiceWorkerCacheId({ indexHtml, manifest, assetFiles, swSource }) {
  return createHash('sha256')
    .update(indexHtml)
    .update(manifest)
    .update([...assetFiles].sort().join('\n'))
    .update(swSource)
    .digest('hex')
    .slice(0, 12);
}
