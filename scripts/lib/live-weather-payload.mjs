import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const MAX_FUTURE_OBSERVATION_SKEW_MS = 5 * 60 * 1000;
const MAX_FUTURE_FETCH_SKEW_MS = 60 * 1000;
const MAX_FRESHNESS_SECONDS = 24 * 60 * 60;
const MAX_OBSERVED_AT_DIFFERENCE_MS = 60 * 1000;

function parseTimestamp(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty ISO timestamp`);
  }
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) {
    throw new Error(`${label} must be a timezone-qualified ISO date-time`);
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const daysInMonth = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;
  if (
    day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59
  ) {
    throw new Error(`${label} must be a valid timestamp`);
  }
  if (zone !== 'Z') {
    const offset = /[+-](\d{2}):(\d{2})$/.exec(zone);
    if (!offset || Number(offset[1]) > 23 || Number(offset[2]) > 59) {
      throw new Error(`${label} must be a valid timestamp`);
    }
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new Error(`${label} must be a valid timestamp`);
  }
  return milliseconds;
}

/** Validate a real current-weather payload without inventing or rewriting observations. */
export function validateLiveWeatherPayload(payload, { now = Date.now(), expectedCity = 'Istanbul' } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('payload must be a JSON object');
  }
  if (typeof expectedCity !== 'string' || expectedCity.trim() === '') {
    throw new Error('expectedCity must be a non-empty string');
  }
  if (
    typeof payload.cityName !== 'string' ||
    payload.cityName.trim().toLowerCase() !== expectedCity.trim().toLowerCase()
  ) {
    throw new Error(`cityName must match the requested city (${expectedCity})`);
  }

  // The Lighthouse preflight is intentionally anchored to the Istanbul route. A matching
  // display name alone is insufficient if a malformed/misrouted response carries other coordinates.
  if (expectedCity.trim().toLowerCase() === 'istanbul') {
    if (payload.country !== 'TR') {
      throw new Error('country must be TR for Istanbul');
    }
    const coordinates = payload.coordinates;
    if (!coordinates || typeof coordinates !== 'object' || Array.isArray(coordinates)) {
      throw new Error('coordinates must identify the Istanbul location');
    }
    const { lat, lon } = coordinates;
    if (
      typeof lat !== 'number' ||
      !Number.isFinite(lat) ||
      lat < 40 ||
      lat > 42 ||
      typeof lon !== 'number' ||
      !Number.isFinite(lon) ||
      lon < 27 ||
      lon > 30
    ) {
      throw new Error('coordinates must fall within the Istanbul location envelope');
    }
  }

  if (
    typeof payload.temperature !== 'number' ||
    !Number.isFinite(payload.temperature) ||
    payload.temperature < -100 ||
    payload.temperature > 100
  ) {
    throw new Error('temperature must be finite and within [-100, 100] °C');
  }

  const observedAtMs = parseTimestamp(payload.timestamp, 'timestamp');
  if (observedAtMs > now + MAX_FUTURE_OBSERVATION_SKEW_MS) {
    throw new Error('timestamp is materially in the future');
  }

  const meta = payload.meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    throw new Error('meta must be an object');
  }
  if (meta.provider !== 'OpenWeather') {
    throw new Error('provider must identify the configured live OpenWeather source');
  }

  const fetchedAtMs = parseTimestamp(meta.fetchedAt, 'meta.fetchedAt');
  if (fetchedAtMs > now + MAX_FUTURE_FETCH_SKEW_MS) {
    throw new Error('meta.fetchedAt is materially in the future');
  }
  const freshForSeconds = meta.freshForSeconds;
  if (
    typeof freshForSeconds !== 'number' ||
    !Number.isFinite(freshForSeconds) ||
    freshForSeconds <= 0 ||
    freshForSeconds > MAX_FRESHNESS_SECONDS
  ) {
    throw new Error('meta.freshForSeconds must be finite and within (0, 86400]');
  }

  if (meta.observedAt !== undefined) {
    const explicitObservedAtMs = parseTimestamp(meta.observedAt, 'meta.observedAt');
    if (explicitObservedAtMs > now + MAX_FUTURE_OBSERVATION_SKEW_MS) {
      throw new Error('meta.observedAt is materially in the future');
    }
    if (Math.abs(explicitObservedAtMs - observedAtMs) > MAX_OBSERVED_AT_DIFFERENCE_MS) {
      throw new Error('meta.observedAt must agree with timestamp within 60 seconds');
    }
  }

  return {
    cityName: payload.cityName.trim(),
    temperature: payload.temperature,
    provider: meta.provider,
    observedAt: new Date(observedAtMs).toISOString(),
    fetchedAt: new Date(fetchedAtMs).toISOString(),
    freshForSeconds,
  };
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error('usage: node scripts/lib/live-weather-payload.mjs <response.json>');
  const payload = JSON.parse(await readFile(inputPath, 'utf8'));
  const validated = validateLiveWeatherPayload(payload);
  process.stdout.write(
    `Live weather preflight: ${validated.cityName}, provider=${validated.provider}, ` +
    `observedAt=${validated.observedAt}, fetchedAt=${validated.fetchedAt}, ` +
    `freshForSeconds=${validated.freshForSeconds}\n`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    process.stderr.write(`Live weather preflight failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
