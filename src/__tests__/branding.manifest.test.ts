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

  it('keeps every install icon decodable and its declared PNG dimensions accurate', () => {
    const publicDir = resolve(cwd(), 'public');
    const manifest = JSON.parse(
      readFileSync(resolve(publicDir, 'manifest.json'), 'utf8')
    ) as WebManifest;
    const icons = [
      ...(manifest.icons ?? []),
      ...(manifest.shortcuts ?? []).flatMap(shortcut => shortcut.icons ?? []),
    ];
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      // Keep install-time resources within this project's static public assets.
      expect(icon.src).toMatch(/^hava81-[a-z0-9-]+\.(png|svg|ico)$/);
      const file = readFileSync(resolve(publicDir, icon.src));
      expect(file.length, `${icon.src} should not be empty`).toBeGreaterThan(24);

      if (icon.type === 'image/png') {
        const dimensions = /^(\d+)x(\d+)$/.exec(icon.sizes ?? '');
        expect(dimensions, `${icon.src} must declare dimensions`).not.toBeNull();
        expect(file.subarray(0, 8).equals(pngSignature), `${icon.src} PNG signature`).toBe(true);
        expect(file.toString('ascii', 12, 16), `${icon.src} first PNG chunk`).toBe('IHDR');
        expect(file.readUInt32BE(16), `${icon.src} width`).toBe(Number(dimensions?.[1]));
        expect(file.readUInt32BE(20), `${icon.src} height`).toBe(Number(dimensions?.[2]));
      } else if (icon.type === 'image/svg+xml') {
        expect(file.toString('utf8')).toContain('<svg');
      } else if (icon.type === 'image/x-icon') {
        expect(file.readUInt16LE(0), `${icon.src} ICO reserved bytes`).toBe(0);
        expect(file.readUInt16LE(2), `${icon.src} ICO format`).toBe(1);
      } else {
        throw new Error(`Unexpected manifest icon type: ${icon.type}`);
      }
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