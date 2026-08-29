import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('service worker notification navigation', () => {
  it('keeps notification click targets on the Hava81 origin', () => {
    const source = readFileSync('public/sw.js', 'utf8');

    expect(source).toContain("self.addEventListener('notificationclick'");
    expect(source).toContain('new URL(event.notification.data?.url ||');
    expect(source).toContain('candidate.origin === self.location.origin');
    expect(source).toContain("let url = '/';");
  });

  it('keeps navigations network-fresh across GitHub Pages deploys', () => {
    const source = readFileSync('public/sw.js', 'utf8');

    expect(source).toContain("const CACHE_NAME = 'hava81-shell-__HAVA81_BUILD_ID__'");
    expect(source).toContain("LEGACY_RELOAD_CACHE_NAMES = new Set(['hava81-shell-v1', 'hava81-shell-v2'])");
    expect(source).toContain("fetch(request, { cache: 'no-store' })");
    expect(source).toContain("fetch(path, { cache: 'no-store' })");
    expect(source).toContain("client.navigate(client.url)");
  });

  it('caches any visited hashed application asset for resilient repeat/offline use', () => {
    const source = readFileSync('public/sw.js', 'utf8');

    expect(source).toContain("url.pathname.startsWith('/assets/')");
    expect(source).toContain("['script', 'style', 'font', 'image'].includes(request.destination)");
    expect(source).not.toContain('CORE_SCRIPT_PATTERN');
  });
});
