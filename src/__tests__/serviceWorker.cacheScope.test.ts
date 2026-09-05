import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('public/sw.js', 'utf8');

describe('service worker cache cleanup scope', () => {
  it('deletes only versioned Hava81 shell caches during activation', () => {
    expect(source).toContain("key.startsWith('hava81-shell-') && key !== CACHE_NAME");
    expect(source).not.toContain("key.startsWith('hava81-') && key !== CACHE_NAME");
  });
});
