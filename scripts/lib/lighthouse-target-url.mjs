const DEFAULT_PATH = '/';

/** Resolve an operator-selected Lighthouse path without permitting off-preview URLs. */
export function resolveLighthouseTargetUrl(requestedPath, origin) {
  const path = typeof requestedPath === 'string' && requestedPath.trim()
    ? requestedPath.trim()
    : DEFAULT_PATH;

  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('HAVA81_LIGHTHOUSE_PATH must be a same-origin absolute path such as /istanbul/');
  }

  const base = new URL(origin);
  const target = new URL(path, base);
  if (target.origin !== base.origin || target.hash) {
    throw new Error('HAVA81_LIGHTHOUSE_PATH must stay on the local preview origin and cannot include a fragment');
  }

  return target.toString();
}
