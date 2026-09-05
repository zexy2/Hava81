import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/hava81/ComparePanel.tsx', 'utf8');

describe('ComparePanel best-time semantics', () => {
  it('exposes single and range best-window instants through time elements', () => {
    expect(source).toContain(
      '<time dateTime={row.plan.bestWindowRange.peak.time.toISOString()}>'
    );
    expect(source).toContain(
      '<time dateTime={row.plan.bestWindowRange.start.time.toISOString()}>'
    );
    expect(source).toContain('<time dateTime={row.plan.bestWindowRange.end.time.toISOString()}>');
  });
});
