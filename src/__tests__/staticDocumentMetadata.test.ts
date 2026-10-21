import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOT_DOCUMENT_METADATA } from '../utils/rootDocumentMetadata';

/**
 * Faz 3.4: the static root shell is parsed as a real document (DOMParser) and the manifest as
 * JSON, instead of searching their text.
 */
const doc = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html');
const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as {
  description?: string;
};
const meta = (selector: string) => doc.head.querySelector<HTMLMetaElement>(selector)?.content;

describe('static root document metadata', () => {
  it('keeps the SPA root restoration aligned with the static root shell', () => {
    expect(doc.title).toBe(ROOT_DOCUMENT_METADATA.title);
    expect(meta('meta[name="description"]')).toBe(ROOT_DOCUMENT_METADATA.description);
    expect(meta('meta[property="og:description"]')).toBe(ROOT_DOCUMENT_METADATA.socialDescription);
    expect(meta('meta[name="twitter:description"]')).toBe(ROOT_DOCUMENT_METADATA.socialDescription);
    expect(meta('meta[property="og:title"]')).toBe(ROOT_DOCUMENT_METADATA.title);
  });

  it('describes decision guidance in the structured data, not a generic meteorological atlas', () => {
    const script = doc.head.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const structured = JSON.parse(script?.textContent ?? '{}') as { description?: string };
    expect(structured.description).toBe(
      'Türkiye’nin 81 ili için hava durumunu günlük kararlara dönüştüren karar odaklı hava rehberi.'
    );
  });

  it('qualifies best-time positioning as weather-based before hydration', () => {
    for (const description of [meta('meta[name="description"]'), manifest.description]) {
      expect(description).toContain('hava açısından en iyi zaman');
      expect(description).not.toMatch(/Hava81 Skoru, en iyi zaman/);
    }
  });
});
