import assert from 'node:assert/strict';
import process from 'node:process';
import { validateLiveWeatherPayload } from './lib/live-weather-payload.mjs';

const now = Date.parse('2026-10-27T13:00:00.000Z');
const validPayload = () => ({
  cityName: 'Istanbul',
  country: 'TR',
  coordinates: { lat: 41.0351, lon: 28.9833 },
  temperature: 14,
  timestamp: '2026-10-27T12:58:00.000Z',
  meta: {
    provider: 'OpenWeather',
    fetchedAt: '2026-10-27T13:00:00.000Z',
    freshForSeconds: 300,
  },
});

const validated = validateLiveWeatherPayload(validPayload(), { now });
assert.deepEqual(validated, {
  cityName: 'Istanbul',
  temperature: 14,
  provider: 'OpenWeather',
  observedAt: '2026-10-27T12:58:00.000Z',
  fetchedAt: '2026-10-27T13:00:00.000Z',
  freshForSeconds: 300,
});

const invalidCases = [
  ['non-object payload', null, /payload must be a JSON object/],
  ['wrong city response', { ...validPayload(), cityName: 'Ankara' }, /cityName must match/],
  ['non-finite temperature', { ...validPayload(), temperature: Number.NaN }, /temperature must be finite/],
  ['temperature above provider sanity envelope', { ...validPayload(), temperature: 100.1 }, /temperature must be finite and within/],
  ['temperature below provider sanity envelope', { ...validPayload(), temperature: -100.1 }, /temperature must be finite and within/],
  ['wrong country for Istanbul', { ...validPayload(), country: 'US' }, /country must be TR for Istanbul/],
  ['missing Istanbul coordinates', { ...validPayload(), coordinates: undefined }, /coordinates must identify the Istanbul location/],
  ['coordinates for another city', { ...validPayload(), coordinates: { lat: 39.93, lon: 32.86 } }, /coordinates must fall within the Istanbul location envelope/],
  ['non-finite coordinates', { ...validPayload(), coordinates: { lat: Number.NaN, lon: 28.98 } }, /coordinates must fall within the Istanbul location envelope/],
  ['missing observation timestamp', { ...validPayload(), timestamp: undefined }, /timestamp must be a non-empty ISO timestamp/],
  ['invalid observation timestamp', { ...validPayload(), timestamp: 'not-a-date' }, /timestamp must be a timezone-qualified ISO date-time/],
  ['observation timestamp without timezone', { ...validPayload(), timestamp: '2026-10-27T12:58:00' }, /timestamp must be a timezone-qualified ISO date-time/],
  ['invalid calendar day', { ...validPayload(), timestamp: '2026-02-30T12:00:00.000Z' }, /timestamp must be a valid timestamp/],
  ['future observation timestamp', { ...validPayload(), timestamp: '2026-10-27T13:06:00.000Z' }, /timestamp is materially in the future/],
  ['wrong provider', { ...validPayload(), meta: { ...validPayload().meta, provider: 'fixture' } }, /provider must identify/],
  ['invalid fetch timestamp', { ...validPayload(), meta: { ...validPayload().meta, fetchedAt: 'not-a-date' } }, /meta.fetchedAt must be a timezone-qualified ISO date-time/],
  ['fetch timestamp without timezone', { ...validPayload(), meta: { ...validPayload().meta, fetchedAt: '2026-10-27T13:00:00' } }, /meta.fetchedAt must be a timezone-qualified ISO date-time/],
  ['future fetch timestamp', { ...validPayload(), meta: { ...validPayload().meta, fetchedAt: '2026-10-27T13:02:00.000Z' } }, /meta.fetchedAt is materially in the future/],
  ['missing freshness window', { ...validPayload(), meta: { provider: 'OpenWeather', fetchedAt: '2026-10-27T13:00:00.000Z' } }, /freshForSeconds must be finite/],
  ['zero freshness window', { ...validPayload(), meta: { ...validPayload().meta, freshForSeconds: 0 } }, /freshForSeconds must be finite/],
  ['unbounded freshness window', { ...validPayload(), meta: { ...validPayload().meta, freshForSeconds: 86401 } }, /freshForSeconds must be finite/],
  ['invalid explicit observation time', { ...validPayload(), meta: { ...validPayload().meta, observedAt: 'not-a-date' } }, /meta.observedAt must be a timezone-qualified ISO date-time/],
  ['future explicit observation time', { ...validPayload(), meta: { ...validPayload().meta, observedAt: '2026-10-27T13:06:00.000Z' } }, /meta.observedAt is materially in the future/],
  ['inconsistent explicit observation time', { ...validPayload(), meta: { ...validPayload().meta, observedAt: '2026-10-27T12:56:59.000Z' } }, /meta.observedAt must agree with timestamp within 60 seconds/],
];
for (const [label, payload, expected] of invalidCases) {
  assert.throws(() => validateLiveWeatherPayload(payload, { now }), expected, label);
}

const withinConsistencyWindow = validPayload();
withinConsistencyWindow.meta.observedAt = '2026-10-27T12:59:00.000Z';
assert.equal(
  validateLiveWeatherPayload(withinConsistencyWindow, { now }).observedAt,
  withinConsistencyWindow.timestamp,
  'an explicit observedAt within 60 seconds of the top-level timestamp is accepted'
);

// An older provider observation is still a real observation; this contract validates
// timestamp integrity while the app's existing freshness state decides how to present it.
const olderObservation = validPayload();
olderObservation.timestamp = '2026-10-20T12:00:00.000Z';
assert.equal(validateLiveWeatherPayload(olderObservation, { now }).observedAt, olderObservation.timestamp);

process.stdout.write(`Live weather payload integrity contract: PASS (${invalidCases.length} negative cases)\n`);
