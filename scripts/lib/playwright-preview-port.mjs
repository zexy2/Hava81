import { createServer } from 'node:net';

const DEFAULT_PREVIEW_PORT = 4173;
const MIN_PORT = 1024;
const MAX_PORT = 65535;

function parsePort(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const port = Number(value);
  return Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT ? port : null;
}

function probePort(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', error => {
      if (error?.code === 'EADDRINUSE') {
        resolve(null);
        return;
      }
      reject(error);
    });
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address && typeof address !== 'string' ? address.port : null);
      });
    });
  });
}

/**
 * Prefer an explicitly configured port, or the historic default, when free.
 * Fall back to a loopback ephemeral port rather than colliding with another
 * active worktree's preview server. The caller passes the result to Playwright
 * so the preview URL and the server command stay in sync.
 */
export async function resolvePreviewPort(requestedValue, defaultPort = DEFAULT_PREVIEW_PORT) {
  const preferredPort = parsePort(requestedValue) ?? defaultPort;
  const preferred = await probePort(preferredPort);
  if (preferred !== null) return preferred;

  const fallback = await probePort(0);
  if (fallback === null) {
    throw new Error('Unable to allocate a loopback port for the Playwright preview.');
  }
  return fallback;
}
