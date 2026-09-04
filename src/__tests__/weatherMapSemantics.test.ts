import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/WeatherMap.tsx', 'utf8');

describe('Weather Map semantics', () => {
  it('names the interactive map region from its visible heading', () => {
    expect(source).toContain('const mapTitleId = useId();');
    expect(source).toContain('<h3 id={mapTitleId} className="weather-map__title">');
    expect(source).toContain('className="weather-map__container" role="region" aria-labelledby={mapTitleId}');
  });
});
