import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import { tr } from '../i18n/locales/tr';

type TranslationCatalog = Record<string, unknown>;

function collectLeafStrings(
  value: TranslationCatalog,
  prefix = '',
  output = new Map<string, string>()
): Map<string, string> {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? prefix + '.' + key : key;
    if (typeof child === 'string') {
      output.set(path, child);
    } else if (child && typeof child === 'object' && !Array.isArray(child)) {
      collectLeafStrings(child as TranslationCatalog, path, output);
    } else {
      throw new Error('Unexpected non-string translation leaf at ' + path);
    }
  }
  return output;
}

function interpolationNames(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)]
    .map(match => match[1].trim())
    .sort();
}

const english = collectLeafStrings(en);
const turkish = collectLeafStrings(tr);

describe('Turkish and English translation catalogs', () => {
  it('keep the same complete set of translation keys', () => {
    expect([...turkish.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it('keep interpolation names aligned across both locales', () => {
    for (const key of [...english.keys()].sort()) {
      expect(interpolationNames(turkish.get(key)!), 'placeholder mismatch for ' + key).toEqual(
        interpolationNames(english.get(key)!)
      );
    }
  });
});
