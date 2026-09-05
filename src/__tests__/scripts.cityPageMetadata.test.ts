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

  it('describes province shells as administrative areas rather than municipalities', () => {
    const generator = readFileSync('scripts/generate-city-pages.mjs', 'utf8');
    expect(generator).toContain("'@type': 'AdministrativeArea'");
    expect(generator).toContain("containedInPlace: { '@type': 'Country', name: 'Türkiye' }");
    expect(generator).not.toContain("'@type': 'City'");
  });

  it('keeps eager weather bootstrap and API connection hints on province shells only', () => {
    const generator = readFileSync('scripts/generate-city-pages.mjs', 'utf8');
    const rootShell = readFileSync('index.html', 'utf8');
    expect(generator).toContain('html = injectApiConnectionHints(html);');
    expect(generator).toContain('html = injectBootstrapWeather(html, name, `/${slug}/`);');
    expect(generator).toContain('rel="preconnect" href="https://api.hava81.zekiakgul.dev"');
    expect(generator).toContain("await writeFile(join(dist, 'index.html'), baseHtml);");
    expect(generator).not.toContain("injectBootstrapWeather(baseHtml, 'İstanbul', '/')");
    expect(rootShell).not.toContain('rel="preconnect" href="https://api.hava81.zekiakgul.dev"');
    expect(rootShell).not.toContain('rel="dns-prefetch" href="//api.hava81.zekiakgul.dev"');
  });

  it('fails closed unless all 81 province names and slugs remain unique', () => {
    const generator = readFileSync('scripts/generate-city-pages.mjs', 'utf8');
    expect(generator).toContain('const expectedProvinceCount = 81;');
    expect(generator).toContain('uniqueNames.size !== expectedProvinceCount');
    expect(generator).toContain('uniqueSlugs.size !== expectedProvinceCount');
    expect(generator).toContain('slugs.some(slug => !slug)');
  });
});
