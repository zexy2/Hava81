import process from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLiveWeatherPayload } from './lib/live-weather-payload.mjs';

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 500, 502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function isRetryableNetworkError(error) {
  const code = error?.cause?.code ?? error?.code;
  const name = error?.name ?? error?.cause?.name;
  return name === 'TimeoutError' || name === 'AbortError' || RETRYABLE_NETWORK_CODES.has(code);
}

/** Retry only transient transport/5xx failures; never synthesize or relax weather validation. */
export async function fetchLiveWeatherPreflight(url, {
  fetchImpl = fetch,
  sleepImpl = sleep,
  validate = validateLiveWeatherPayload,
  attempts = 2,
  timeoutMs = 20_000,
  retryDelayMs = 1_500,
  onRetry = details => process.stderr.write(
    `Transient live-weather preflight failure (attempt ${details.attempt}/${attempts}, ${details.reason}); retrying.\n`,
  ),
} = {}) {
  if (typeof url !== 'string' || url.trim() === '') throw new Error('a live-weather URL is required');
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) {
    throw new Error('attempts must be an integer in [1, 3]');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be positive');
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) throw new Error('retryDelayMs must be non-negative');

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (attempt < attempts && isRetryableNetworkError(error)) {
        onRetry({ attempt, reason: error?.cause?.code ?? error?.name ?? 'transient transport error' });
        await sleepImpl(retryDelayMs);
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`live-weather request failed after ${attempt} attempt(s): ${message}`, { cause: error });
    }

    if (!response || !Number.isInteger(response.status)) {
      throw new Error('live-weather request returned an invalid response object');
    }
    if (!response.ok) {
      if (attempt < attempts && RETRYABLE_HTTP_STATUSES.has(response.status)) {
        onRetry({ attempt, reason: `HTTP ${response.status}` });
        await sleepImpl(retryDelayMs);
        continue;
      }
      throw new Error(`live-weather request returned HTTP ${response.status} after ${attempt} attempt(s)`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error('live-weather response was not valid JSON; refusing a synthetic fallback', { cause: error });
    }
    // Payload integrity is not retried: a malformed successful response is a contract failure.
    return validate(payload);
  }

  throw new Error(`live-weather request failed after ${attempts} attempt(s)`);
}

async function main() {
  const url = process.argv[2];
  if (!url) throw new Error('usage: node scripts/lighthouse-live-weather-preflight.mjs <local-weather-url>');
  const validated = await fetchLiveWeatherPreflight(url);
  process.stdout.write(
    `Live weather preflight: ${validated.cityName}, provider=${validated.provider}, ` +
    `observedAt=${validated.observedAt}, fetchedAt=${validated.fetchedAt}, ` +
    `freshForSeconds=${validated.freshForSeconds}\n`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    process.stderr.write(`Live weather preflight failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
