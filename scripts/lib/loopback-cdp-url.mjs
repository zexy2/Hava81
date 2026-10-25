import { URL } from 'node:url';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Validate an operator-supplied Chrome DevTools endpoint before connecting to it.
 * Keep the endpoint loopback-only: this option is for a browser already running on
 * the same host, never for a remote debugging service or arbitrary URL.
 */
export function parseLoopbackCdpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('HAVA81_CHROMIUM_CDP_URL must be a valid loopback HTTP URL with an explicit port.');
  }

  if (
    url.protocol !== 'http:' ||
    !LOOPBACK_HOSTS.has(url.hostname) ||
    !url.port ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new Error('HAVA81_CHROMIUM_CDP_URL must be a loopback HTTP URL with an explicit port; remote CDP endpoints are not allowed.');
  }

  return url.origin;
}

export function resolveLoopbackCdpPort(value) {
  return Number(new URL(parseLoopbackCdpUrl(value)).port);
}
