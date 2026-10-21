import { describe, expect, it } from 'vitest';
import { parseAtlasView, resolveAtlasView, withAtlasView } from '../../utils/atlasView';

describe('atlas view URL logic (Faz 2.3 / 2.5)', () => {
  it('reads map, compare and plan from ?view= and falls back to today', () => {
    expect(parseAtlasView('?view=plan')).toBe('plan');
    expect(parseAtlasView('?view=map')).toBe('map');
    expect(parseAtlasView('?view=compare')).toBe('compare');
    expect(parseAtlasView('?yer=Urla&view=plan')).toBe('plan');
    expect(parseAtlasView('')).toBe('today');
    expect(parseAtlasView('?view=today')).toBe('today');
    expect(parseAtlasView('?view=settings')).toBe('today');
  });

  it('only counts the map as the current view while its panel is open', () => {
    expect(resolveAtlasView('map', true)).toBe('map');
    expect(resolveAtlasView('map', false)).toBe('today');
    expect(resolveAtlasView('plan', false)).toBe('plan');
    expect(resolveAtlasView('compare', false)).toBe('compare');
    expect(resolveAtlasView('today', false)).toBe('today');
  });

  it('writes the view parameter and keeps other query parameters', () => {
    expect(withAtlasView('/istanbul/', 'plan')).toBe('/istanbul/?view=plan');
    expect(withAtlasView('/istanbul/?view=plan', 'today')).toBe('/istanbul/');
    expect(withAtlasView('/istanbul/?view=map', 'plan')).toBe('/istanbul/?view=plan');
    expect(withAtlasView('/?yer=Urla', 'plan')).toBe('/?yer=Urla&view=plan');
    expect(withAtlasView('/?yer=Urla&view=compare', 'today')).toBe('/?yer=Urla');
  });
});
