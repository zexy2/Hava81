import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('mobile activity choices', () => {
  it('overrides the former horizontal chip rail with fully visible wrapping choices', () => {
    const css = readFileSync('src/styles/DesignRefinement.css', 'utf8');
    expect(css).toMatch(/\.app \.activity-planner__chips\s*\{[\s\S]*?flex-wrap:\s*wrap;/);
    expect(css).toMatch(/\.app \.activity-planner__chips\s*\{[\s\S]*?overflow:\s*visible;/);
    expect(css).toMatch(/\.app \.activity-planner__chips button\s*\{[\s\S]*?max-width:\s*100%;/);
  });
});
