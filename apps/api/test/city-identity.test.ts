import assert from 'node:assert/strict';
import test from 'node:test';
import { weatherCityIdentity } from '../src/modules/weather/city-identity';

test('weather city identity is stable across Turkish and ASCII provider spellings', () => {
  assert.equal(weatherCityIdentity('İstanbul'), 'istanbul');
  assert.equal(weatherCityIdentity('Istanbul'), 'istanbul');
  assert.equal(weatherCityIdentity('Çanakkale'), 'canakkale');
  assert.equal(weatherCityIdentity('Canakkale'), 'canakkale');
});

test('weather city identity normalizes spacing and punctuation for cache keys', () => {
  assert.equal(weatherCityIdentity('  Şanlıurfa  '), 'sanliurfa');
  assert.equal(weatherCityIdentity('New York'), 'new-york');
});
