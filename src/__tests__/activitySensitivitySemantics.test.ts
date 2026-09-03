import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/hava81/ActivityPlanner.tsx', 'utf8');

describe('Activity Planner sensitivity semantics', () => {
  it('separates the visible select label from its explanatory help', () => {
    expect(source).toContain("const sensitivityLabelId = 'activity-temperature-sensitivity-label'");
    expect(source).toContain("const sensitivityHelpId = 'activity-temperature-sensitivity-help'");
    expect(source).toContain('aria-labelledby={sensitivityLabelId}');
    expect(source).toContain('aria-describedby={sensitivityHelpId}');
    expect(source).toContain('<small id={sensitivityHelpId}>');
  });
});
