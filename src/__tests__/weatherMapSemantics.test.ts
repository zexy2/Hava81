import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/WeatherMap.tsx', 'utf8');

describe('Weather Map semantics', () => {
  it('names the interactive map region from its visible heading', () => {
    expect(source).toContain('const mapTitleId = useId();');
    expect(source).toContain('<h3 id={mapTitleId} className="weather-map__title">');
    expect(source).toContain('className="weather-map__container" role="region" aria-labelledby={mapTitleId}');
  });
  
  it('waits for a completed tile batch before switching providers', () => {
    expect(source).toContain('tileload: () => {');
    expect(source).toContain('tileCycleRef.current.successful += 1;');
    expect(source).toContain('tileCycleRef.current.failed += 1;');
    expect(source).toContain('shouldFailTileProvider(successful, failed)');
  });
});
