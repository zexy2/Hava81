import { describe, expect, it } from 'vitest';
import {
  buildCriticalFontPreloads,
  injectCriticalFontPreloads,
} from '../../scripts/lib/font-preloads.mjs';

const assets = [
  'index-abc123.js',
  'ibm-plex-sans-latin-wght-normal-IvpUvPa2.woff2',
  'ibm-plex-sans-latin-ext-wght-normal-CIII54If.woff2',
];

describe('critical font preloads', () => {
  it('resolves exactly the hashed IBM Plex Sans Latin font assets', () => {
    expect(buildCriticalFontPreloads(assets)).toEqual([
      '<link rel="preload" href="/assets/ibm-plex-sans-latin-wght-normal-IvpUvPa2.woff2" as="font" type="font/woff2" crossorigin />',
      '<link rel="preload" href="/assets/ibm-plex-sans-latin-ext-wght-normal-CIII54If.woff2" as="font" type="font/woff2" crossorigin />',
    ]);
  });

  it('fails closed if either expected font is missing or ambiguous', () => {
    expect(() => buildCriticalFontPreloads(['index-abc123.js'])).toThrow(/IBM Plex Sans Latin/);
    expect(() =>
      buildCriticalFontPreloads([...assets, 'ibm-plex-sans-latin-wght-normal-duplicate.woff2'])
    ).toThrow(/exactly one IBM Plex Sans Latin asset/);
  });

  it('places preload links before the module entry and is idempotent', () => {
    const html =
      '<html><head><script type="module" src="/assets/index-abc123.js"></script></head><body></body></html>';
    const injected = injectCriticalFontPreloads(html, assets);
    expect(injected.indexOf('rel="preload"')).toBeLessThan(injected.indexOf('type="module"'));
    expect(injected.match(/rel="preload"/g)).toHaveLength(2);
    expect(injected).toContain('\n    <link rel="preload"');
    expect(injected).not.toContain('\\n    <link rel="preload"');
    expect(injectCriticalFontPreloads(injected, assets)).toBe(injected);
  });

  it('requires a complete HTML head instead of silently skipping preloads', () => {
    expect(() => injectCriticalFontPreloads('<html><body></body></html>', assets)).toThrow(
      /no <\/head>/
    );
  });
});
