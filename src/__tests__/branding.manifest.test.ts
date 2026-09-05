import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

interface ManifestIcon {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
}

interface ManifestShortcut {
  description?: string;
  icons?: ManifestIcon[];
}

interface WebManifest {
  icons?: ManifestIcon[];
  shortcuts?: ManifestShortcut[];
}

describe('PWA branding manifest', () => {
  it('uses Hava81-specific raster icon URLs that exist in public assets', () => {
    const publicDir = resolve(cwd(), 'public');
    const manifest = JSON.parse(
      readFileSync(resolve(publicDir, 'manifest.json'), 'utf8')
    ) as WebManifest;
    const rasterSources = (manifest.icons ?? [])
      .filter(icon => icon.type === 'image/png')
      .map(icon => icon.src);

    expect(rasterSources).toEqual(
      expect.arrayContaining(['hava81-icon-192.png', 'hava81-icon-512.png'])
    );
    expect(rasterSources).not.toContain('logo192.png');
    expect(rasterSources).not.toContain('logo512.png');
    for (const source of rasterSources) {
      expect(source).toMatch(/^hava81-/);
      expect(existsSync(resolve(publicDir, source))).toBe(true);
    }
  });

  it('uses an explicit raster icon for installable app shortcuts', () => {
    const publicDir = resolve(cwd(), 'public');
    const manifest = JSON.parse(
      readFileSync(resolve(publicDir, 'manifest.json'), 'utf8')
    ) as WebManifest;

    expect(manifest.shortcuts?.length).toBeGreaterThan(0);
    for (const shortcut of manifest.shortcuts ?? []) {
      expect(shortcut.description).toContain('günlük kararlara çevir');
      expect(shortcut.icons).toEqual([
        expect.objectContaining({
          src: 'hava81-icon-192.png',
          type: 'image/png',
          sizes: '192x192',
          purpose: 'any',
        }),
      ]);
      expect(existsSync(resolve(publicDir, 'hava81-icon-192.png'))).toBe(true);
    }
  });

  it('keeps adaptive masking on a dedicated padded 512px icon', () => {
    const publicDir = resolve(cwd(), 'public');
    const manifest = JSON.parse(
      readFileSync(resolve(publicDir, 'manifest.json'), 'utf8')
    ) as WebManifest;
    const icons = manifest.icons ?? [];
    const maskableIcons = icons.filter(icon => icon.purpose?.split(/\s+/).includes('maskable'));

    expect(maskableIcons).toEqual([
      expect.objectContaining({
        src: 'hava81-maskable-512.png',
        type: 'image/png',
        sizes: '512x512',
        purpose: 'maskable',
      }),
    ]);
    expect(existsSync(resolve(publicDir, 'hava81-maskable-512.png'))).toBe(true);
    expect(
      icons
        .filter(icon => icon.src !== 'hava81-maskable-512.png')
        .some(icon => icon.purpose?.split(/\s+/).includes('maskable'))
    ).toBe(false);
  });
});
