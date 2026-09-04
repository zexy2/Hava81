import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('mobile horizontal choice affordances', () => {
  it('keeps the Activity Planner chip rail scrollable with a visible thin scrollbar', () => {
    const css = readFileSync('src/components/hava81/ActivityPlanner.css', 'utf8');
    const mobileRule = css.match(
      /@media\s*\(max-width:\s*47\.99rem\)[\s\S]*?\.activity-planner__chips\s*\{([\s\S]*?)\}/
    )?.[1];

    expect(mobileRule).toContain('overflow-x: auto');
    expect(mobileRule).toContain('scrollbar-width: thin');
    expect(css).toMatch(/\.activity-planner__chips::-webkit-scrollbar\s*\{[\s\S]*?height:\s*0\.35rem;/);
  });
});
