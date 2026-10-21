import { describe, expect, it } from 'vitest';
import { readCss } from './readCss';

describe('decision controls reduced motion', () => {
  it('keeps Activity Planner hover feedback stationary when reduced motion is requested', () => {
    const css = readCss('src/components/hava81/ActivityPlanner.css');
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.activity-planner__chips button:hover\s*\{[\s\S]*?transform:\s*none;/
    );
  });

  it('keeps Daily Plan share feedback stationary when reduced motion is requested', () => {
    const css = readCss('src/components/hava81/DailyPlanPanel.css');
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.daily-plan__share:active\s*\{[\s\S]*?transform:\s*none;/
    );
  });

  it('keeps Environment Rail press feedback stationary when reduced motion is requested', () => {
    const css = readCss('src/components/hava81/EnvironmentRail.css');
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.environment-rail__module--action:active\s*\{[\s\S]*?transform:\s*none;/
    );
  });

  it('keeps bottom navigation press feedback stationary when reduced motion is requested', () => {
    const css = readCss('src/components/hava81/AtlasBottomNav.css');
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.atlas-bottom-nav__button:active \.atlas-bottom-nav__icon\s*\{[\s\S]*?transform:\s*none;/
    );
  });
});
