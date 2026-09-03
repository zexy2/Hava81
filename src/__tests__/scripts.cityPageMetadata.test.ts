import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('generated city-page metadata', () => {
  it('keeps the static outing recommendation scoped to weather', () => {
    const generator = readFileSync('scripts/generate-city-pages.mjs', 'utf8');
    expect(generator).toContain('hava açısından en iyi dışarı çıkma penceresi');
    expect(generator).not.toContain('Hava81 Skoru, en iyi dışarı çıkma saati');
  });

  it('stamps GitHub Pages shells with the exact build revision', () => {
    const generator = readFileSync('scripts/generate-city-pages.mjs', 'utf8');
    const smoke = readFileSync('scripts/verify-public-shell.sh', 'utf8');
    expect(generator).toContain('hava81-build-revision');
    expect(generator).toContain('process.env.GITHUB_SHA');
    expect(generator).toContain('40-character build revision');
    expect(smoke).toContain('hava81-build-revision');
    expect(smoke).toContain('${GITHUB_SHA}');
  });

  it('fails closed unless all 81 province names and slugs remain unique', () => {
    const generator = readFileSync('scripts/generate-city-pages.mjs', 'utf8');
    expect(generator).toContain('const expectedProvinceCount = 81;');
    expect(generator).toContain('uniqueNames.size !== expectedProvinceCount');
    expect(generator).toContain('uniqueSlugs.size !== expectedProvinceCount');
    expect(generator).toContain('slugs.some(slug => !slug)');
  });
});
