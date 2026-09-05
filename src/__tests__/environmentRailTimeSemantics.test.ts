import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/hava81/EnvironmentRail.tsx', 'utf8');

describe('EnvironmentRail daylight time semantics', () => {
  it('exposes valid sunrise and sunset instants through time elements', () => {
    expect(source).toContain('<time dateTime={weather.sunset.toISOString()}>{sunsetTime}</time>');
    expect(source).toContain('<time dateTime={weather.sunrise.toISOString()}>{sunriseTime}</time>');
  });
});
