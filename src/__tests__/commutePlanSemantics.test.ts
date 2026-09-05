import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/hava81/CommutePlanPanel.tsx', 'utf8');

describe('CommutePlan semantic time contract', () => {
  it('exposes each resolved commute target as machine-readable time', () => {
    expect(source).toContain('<time dateTime={window.targetTime.toISOString()}>{window.targetClock}</time>');
  });
});
