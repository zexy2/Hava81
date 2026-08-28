import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

interface ManifestIcon {
  src: string;
  sizes?: string;
  type?: string;
}

interface WebManifest {
  icons?: ManifestIcon[];
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
});
