/**
 * A request timed out before its response body was fully decoded.
 * @param {number} timeoutMs
 */
export class RequestTimeoutError extends Error {
  constructor(timeoutMs) {
    super('request timed out after ' + timeoutMs + 'ms');
    this.name = 'RequestTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Fetch and decode one JSON response with a bounded end-to-end timeout.
 * The caller owns status-specific policy (including Retry-After handling).
 *
 * @param {string} url
 * @param {{ timeoutMs?: number, fetchImpl?: (url: string, init: RequestInit) => Promise<Response> }} [options]
 * @returns {Promise<{ response: Response, body: unknown }>}
 */
export async function fetchJsonResponse(url, { timeoutMs = 10_000, fetchImpl = fetch } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new RangeError('timeoutMs must be between 1 and 60000');
  }

  const controller = new AbortController();
  const timeoutError = new RequestTimeoutError(timeoutMs);
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      (async () => {
        let response;
        try {
          response = await fetchImpl(url, {
            headers: { accept: 'application/json' },
            signal: controller.signal,
          });
        } catch (error) {
          if (controller.signal.aborted) throw timeoutError;
          throw error;
        }

        let body;
        try {
          body = await response.json();
        } catch (error) {
          if (controller.signal.aborted) throw timeoutError;
          body = null;
        }
        return { response, body };
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}
