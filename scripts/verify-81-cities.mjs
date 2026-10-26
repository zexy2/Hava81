#!/usr/bin/env node
import { provinceNamesBySlug, cityCenterDistanceKm } from './lib/live-audit-city-catalog.mjs';

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4001/api/v1').replace(/\/$/, '');
// Two requests per province share the API's 60/min client budget; leave room for concurrent smoke checks.
const delayMs = Number(process.env.DELAY_MS || 1600);
const requestedTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 10000);
const requestTimeoutMs =
  Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs >= 1000 && requestedTimeoutMs <= 60000
    ? requestedTimeoutMs
    : 10000;

// The live UI audit and API release gate must use the same 81 canonical provinces.
const cities = [...provinceNamesBySlug.entries()];
const MAX_PROVINCE_DISTANCE_KM = 100;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const validDate = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));

class HttpResponseError extends Error {
  constructor(status, retryAfter) {
    super(`HTTP ${status}`);
    this.name = 'HttpResponseError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

class RequestTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`request timed out after ${timeoutMs}ms`);
    this.name = 'RequestTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

async function getJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    let body;
    try {
      body = await response.json();
    } catch (error) {
      // Do not turn an aborted body read into a normal invalid-payload failure.
      if (controller.signal.aborted) throw error;
      body = null;
    }
    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after')?.trim() || undefined;
      throw new HttpResponseError(response.status, retryAfter);
    }
    return body;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new RequestTimeoutError(requestTimeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

const failures = [];
let rateLimited = null;
let requestTimedOut = null;
let currentOk = 0;
let forecastOk = 0;
const startedAt = Date.now();

for (const [index, [provinceSlug, city]] of cities.entries()) {
  process.stdout.write(`[${String(index + 1).padStart(2, '0')}/81] ${city} ... `);
  try {
    const current = await getJson(`${baseUrl}/weather/current?city=${encodeURIComponent(city)}&lang=tr`);
    if (!current || typeof current.cityName !== 'string') throw new Error('current.cityName missing');
    if (!finite(current.temperature)) throw new Error('current.temperature invalid');
    if (!validDate(current.timestamp)) throw new Error('current.timestamp invalid');
    if (!finite(current.coordinates?.lat) || !finite(current.coordinates?.lon)) throw new Error('coordinates invalid');
    // A valid temperature is insufficient if a provider accidentally returns
    // another city's weather. Allow generous geocoding variation within a
    // province, but reject obviously mismatched coordinates.
    const distanceKm = cityCenterDistanceKm(provinceSlug, current.coordinates);
    if (distanceKm > MAX_PROVINCE_DISTANCE_KM) {
      throw new Error(`current coordinates are ${distanceKm.toFixed(1)}km from ${city} center (max ${MAX_PROVINCE_DISTANCE_KM}km)`);
    }
    currentOk += 1;

    await sleep(delayMs);

    const { lat, lon } = current.coordinates;
    const forecast = await getJson(`${baseUrl}/weather/forecast?lat=${lat}&lon=${lon}&lang=tr`);
    if (!Array.isArray(forecast?.hourly) || forecast.hourly.length === 0) throw new Error('forecast.hourly empty');
    if (!Array.isArray(forecast?.daily) || forecast.daily.length === 0) throw new Error('forecast.daily empty');
    if (forecast.meta?.intervalHours !== 3) throw new Error(`intervalHours=${forecast.meta?.intervalHours ?? 'missing'}`);
    if (!finite(forecast.meta?.timezoneOffsetSeconds)) throw new Error('timezoneOffsetSeconds missing');
    if (typeof forecast.meta?.provider !== 'string' || !forecast.meta.provider) throw new Error('provider metadata missing');
    if (!validDate(forecast.meta?.fetchedAt)) throw new Error('fetchedAt invalid');
    forecastOk += 1;

    console.log('OK');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof HttpResponseError && error.status === 429) {
      rateLimited = { city, retryAfter: error.retryAfter };
      console.log(`BLOCKED (${message})`);
      // Stop immediately: further cities would amplify a provider/API rate limit.
      break;
    }
    if (error instanceof RequestTimeoutError) {
      requestTimedOut = { city, message };
      failures.push({ city, message });
      console.log(`BLOCKED (${message})`);
      // A stalled request is a systemic gate failure; do not multiply its timeout by 81 cities.
      break;
    }
    failures.push({ city, message });
    console.log(`FAIL (${message})`);
  }
  await sleep(delayMs);
}

const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
console.log('\n=== Hava81 81-il release gate ===');
console.log(`Base URL: ${baseUrl}`);
console.log(`Request timeout: ${requestTimeoutMs}ms`);
console.log(`Current: ${currentOk}/81`);
console.log(`Forecast: ${forecastOk}/81`);
console.log(`Elapsed: ${elapsedSeconds}s`);

if (rateLimited) {
  console.log(`RESULT: BLOCKED (HTTP 429 rate limit at ${rateLimited.city})`);
  if (rateLimited.retryAfter) console.log(`Retry-After: ${rateLimited.retryAfter}`);
  process.exitCode = 2;
} else if (requestTimedOut) {
  console.log(`RESULT: BLOCKED (request timeout at ${requestTimedOut.city})`);
  console.log(`Failure: ${requestTimedOut.city}: ${requestTimedOut.message}`);
  process.exitCode = 1;
} else if (failures.length) {
  console.log(`Failures: ${failures.length}`);
  for (const item of failures) console.log(`- ${item.city}: ${item.message}`);
  process.exitCode = 1;
} else {
  console.log('RESULT: PASS 81/81');
}
