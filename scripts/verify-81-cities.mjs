#!/usr/bin/env node
import { provinceNamesBySlug, cityCenterDistanceKm } from './lib/live-audit-city-catalog.mjs';

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:4001/api/v1').replace(/\/$/, '');
const delayMs = Number(process.env.DELAY_MS || 1100);
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

async function getJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    let body;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return body;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`request timed out after ${requestTimeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

const failures = [];
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

if (failures.length) {
  console.log(`Failures: ${failures.length}`);
  for (const item of failures) console.log(`- ${item.city}: ${item.message}`);
  process.exit(1);
}

console.log('RESULT: PASS 81/81');