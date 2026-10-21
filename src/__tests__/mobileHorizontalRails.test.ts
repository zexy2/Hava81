import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

describe('mobile activity choices', () => {
  it('overrides the former horizontal chip rail with fully visible wrapping choices', () => {
    const css = readCss('src/components/hava81/ActivityPlanner.css');
    expect(css).toMatch(/\.app \.activity-planner__chips\s*\{[\s\S]*?flex-wrap:\s*wrap;/);
    expect(css).toMatch(/\.app \.activity-planner__chips\s*\{[\s\S]*?overflow:\s*visible;/);
    expect(css).toMatch(/\.app \.activity-planner__chips button\s*\{[\s\S]*?max-width:\s*100%;/);
  });
});
