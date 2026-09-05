import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/hava81/ContextSignalsPanel.tsx', 'utf8');

describe('ContextSignalsPanel fetch time semantics', () => {
  it('exposes the provider fetch instant through a time element', () => {
    expect(source).toContain('<time dateTime={signals.fetchedAt.toISOString()}>');
    expect(source).toContain("{t('hava81.context.fetchedAt', { time: fetchedTime })}");
  });
});
