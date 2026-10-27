import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BASE_URL,
  HOME_COPY,
  buildCityPage,
  buildRobotsTxt,
  buildHomePage,
  buildNotFoundPage,
  buildSitemap,
  cityCopy,
  nearestProvinces,
  parseProvinces,
  slugify,
  stampBuildRevision,
} from '../../scripts/lib/city-pages.mjs';
import { TURKISH_CITIES } from '../constants/cities';
import { citySlug } from '../utils/cityRoute';
import { ROOT_DOCUMENT_METADATA, ROOT_DOCUMENT_METADATA_EN } from '../utils/rootDocumentMetadata';
import i18n from '../i18n';

/**
 * Faz 4 (+3.4): the page generator is tested through its output, parsed as real documents,
 * instead of searching the generator's source text.
 */
const provinces = parseProvinces(readFileSync('src/constants/cities.ts', 'utf8'));
// Mirrors the Vite output shape: the root index.html with the module entry script.
const baseHtml = readFileSync('index.html', 'utf8').replace(
  '<script type="module" src="/src/index.tsx"></script>',
  '<script type="module" crossorigin src="/assets/index-abc.js"></script>'
);
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const istanbul = provinces.find(p => p.name === 'İstanbul')!;
const attr = (doc: Document, selector: string, name = 'content') =>
  doc.querySelector(selector)?.getAttribute(name) ?? null;

describe('root document critical connections', () => {
  it('preconnects to the production weather API once before the app module', () => {
    const doc = parse(baseHtml);
    const preconnect = doc.querySelector<HTMLLinkElement>('link[rel="preconnect"]');

    expect(attr(doc, 'link[rel="preconnect"]', 'href')).toBe('https://api.hava81.zekiakgul.dev');
    expect(preconnect?.hasAttribute('crossorigin')).toBe(true);
    expect(doc.querySelectorAll('link[rel="preconnect"]')).toHaveLength(1);
    expect(baseHtml.indexOf('rel="preconnect"')).toBeLessThan(baseHtml.indexOf('type="module"'));
  });
});

describe('province catalogue', () => {
  it('reads all 81 provinces with the same slugs as the client router', () => {
    expect(provinces).toHaveLength(81);
    expect(provinces.map(p => p.name)).toEqual(TURKISH_CITIES.map(city => city.name));
    for (const province of provinces) expect(province.slug).toBe(citySlug(province.name));
    expect(slugify('Şanlıurfa')).toBe('sanliurfa');
  });

  it('fails closed unless all 81 province names and slugs remain unique', () => {
    const source = readFileSync('src/constants/cities.ts', 'utf8');
    const duplicated = source.replace("{ name: 'Adana'", "{ name: 'Ankara'");
    expect(() => parseProvinces(duplicated)).toThrow(/Expected exactly 81/);
  });

  it('suggests geographically nearest provinces for internal links', () => {
    expect(nearestProvinces(istanbul, provinces, 3).map((p: { name: string }) => p.name)).toContain(
      'Kocaeli'
    );
    expect(
      nearestProvinces(istanbul, provinces).every((p: { slug: string }) => p.slug !== 'istanbul')
    ).toBe(true);
  });
});

describe.each(['tr', 'en'] as const)('%s province page', lang => {
  const html = buildCityPage(baseHtml, istanbul, provinces, lang);
  const doc = parse(html);
  const path = lang === 'en' ? '/en/istanbul/' : '/istanbul/';
  const copy = cityCopy(istanbul, lang);

  it('declares its language, title, canonical and social metadata', () => {
    expect(doc.documentElement.lang).toBe(lang);
    expect(doc.title).toBe(copy.title);
    expect(attr(doc, 'link[rel="canonical"]', 'href')).toBe(`${BASE_URL}${path}`);
    expect(attr(doc, 'meta[name="description"]')).toBe(copy.description);
    expect(attr(doc, 'meta[property="og:url"]')).toBe(`${BASE_URL}${path}`);
    expect(attr(doc, 'meta[property="og:locale"]')).toBe(lang === 'en' ? 'en_US' : 'tr_TR');
    expect(attr(doc, 'meta[property="og:title"]')).toBe(copy.title);
    expect(attr(doc, 'meta[name="twitter:description"]')).toBe(copy.description);
  });

  it('links both language editions with hreflang (Turkish is x-default)', () => {
    expect(attr(doc, 'link[hreflang="tr"]', 'href')).toBe(`${BASE_URL}/istanbul/`);
    expect(attr(doc, 'link[hreflang="en"]', 'href')).toBe(`${BASE_URL}/en/istanbul/`);
    expect(attr(doc, 'link[hreflang="x-default"]', 'href')).toBe(`${BASE_URL}/istanbul/`);
  });

  it('uses the per-province OG card', () => {
    expect(attr(doc, 'meta[property="og:image"]')).toBe(`${BASE_URL}/og/istanbul.jpg`);
    expect(attr(doc, 'meta[name="twitter:image"]')).toBe(`${BASE_URL}/og/istanbul.jpg`);
    expect(attr(doc, 'meta[property="og:image:type"]')).toBe('image/jpeg');
  });

  it('describes the province as an administrative area in structured data', () => {
    const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(ld).toMatchObject({
      '@type': 'WebPage',
      url: `${BASE_URL}${path}`,
      name: copy.title,
      inLanguage: lang,
      about: {
        '@type': 'AdministrativeArea',
        name: 'İstanbul',
        containedInPlace: { '@type': 'Country', name: 'Türkiye' },
      },
    });
  });

  it('renders a crawlable static summary with nearby province links in the same language', () => {
    const summary = doc.querySelector('#root [data-static-summary="istanbul"]');
    expect(summary?.querySelector('h1')?.textContent).toBe(copy.heading);
    expect(summary?.textContent).toContain('34');
    const nearby = [...(summary?.querySelectorAll('nav a') ?? [])].map(a => a.getAttribute('href'));
    expect(nearby).toHaveLength(5);
    for (const href of nearby)
      expect(href).toMatch(lang === 'en' ? /^\/en\/[a-z-]+\/$/ : /^\/[a-z-]+\/$/);
    const other = summary?.querySelector(`a[hreflang="${lang === 'en' ? 'tr' : 'en'}"]`);
    expect(other?.getAttribute('href')).toBe(lang === 'en' ? '/istanbul/' : '/en/istanbul/');
  });

  it('starts the weather bootstrap before the app module, for this path only', () => {
    const scripts = [...doc.querySelectorAll('script')];
    const bootstrap = scripts.findIndex(s =>
      s.textContent?.includes('__HAVA81_BOOTSTRAP_WEATHER__')
    );
    const module = scripts.findIndex(s => s.getAttribute('type') === 'module');
    expect(bootstrap).toBeGreaterThanOrEqual(0);
    expect(bootstrap).toBeLessThan(module);
    expect(scripts[bootstrap].textContent).toContain(`const expectedPath = "${path}"`);
    expect(scripts[bootstrap].textContent).toContain(
      lang === 'en' ? 'let lang = "en"' : "let lang = 'tr'"
    );
    expect(attr(doc, 'link[rel="preconnect"]', 'href')).toBe('https://api.hava81.zekiakgul.dev');
    expect(doc.querySelectorAll('link[rel="preconnect"]')).toHaveLength(1);
  });

  it('keeps the outing recommendation scoped to weather', () => {
    expect(copy.description).toMatch(
      lang === 'en' ? /best weather window/ : /hava açısından en iyi/
    );
    expect(copy.description).not.toContain('Hava81 Skoru, en iyi dışarı çıkma saati');
  });
});

describe('English copy parity with the app', () => {
  it('matches the in-app English city description', () => {
    expect(cityCopy(istanbul, 'en').description).toBe(
      i18n.t('hava81.cityDocumentDescription', { city: 'İstanbul', lng: 'en' })
    );
    expect(cityCopy(istanbul, 'tr').description).toBe(
      i18n.t('hava81.cityDocumentDescription', { city: 'İstanbul', lng: 'tr' })
    );
  });

  it('matches the SPA home metadata in both languages', () => {
    expect(HOME_COPY.tr).toEqual({ ...ROOT_DOCUMENT_METADATA });
    expect(HOME_COPY.en).toEqual({ ...ROOT_DOCUMENT_METADATA_EN });
  });
});

describe('home, 404, sitemap and build stamp', () => {
  it.each(['tr', 'en'] as const)(
    'builds unique self-canonical SEO metadata for all 81 %s province pages',
    lang => {
      const titles = new Set<string>();
      for (const province of provinces) {
        const path = lang === 'en' ? `/en/${province.slug}/` : `/${province.slug}/`;
        const doc = parse(buildCityPage(baseHtml, province, provinces, lang));
        const copy = cityCopy(province, lang);
        const canonical = `${BASE_URL}${path}`;

        expect(doc.documentElement.lang).toBe(lang);
        expect(doc.title).toBe(copy.title);
        expect(titles.has(doc.title)).toBe(false);
        titles.add(doc.title);
        expect(attr(doc, 'link[rel="canonical"]', 'href')).toBe(canonical);
        expect(attr(doc, 'meta[name="description"]')).toBe(copy.description);
        expect(attr(doc, 'meta[property="og:url"]')).toBe(canonical);
        expect(attr(doc, 'meta[property="og:title"]')).toBe(copy.title);
        expect(attr(doc, 'meta[property="og:description"]')).toBe(copy.description);
        expect(attr(doc, 'link[hreflang="tr"]', 'href')).toBe(`${BASE_URL}/${province.slug}/`);
        expect(attr(doc, 'link[hreflang="en"]', 'href')).toBe(`${BASE_URL}/en/${province.slug}/`);
        expect(attr(doc, 'link[hreflang="x-default"]', 'href')).toBe(`${BASE_URL}/${province.slug}/`);
        expect(attr(doc, 'meta[property="og:image"]')).toBe(`${BASE_URL}/og/${province.slug}.jpg`);
        expect(doc.querySelector('script[type="application/ld+json"]')).not.toBeNull();
        expect(doc.querySelectorAll('link[rel="preconnect"]')).toHaveLength(1);
      }
      expect(titles.size).toBe(81);
    }
  );

  it('writes robots directives on separate lines and references the absolute sitemap URL', () => {
    const robots = buildRobotsTxt();
    expect(robots.split(/\r?\n/)).toEqual([
      'User-agent: *',
      'Allow: /',
      `Sitemap: ${BASE_URL}/sitemap.xml`,
      '',
    ]);
    expect(robots).not.toContain('\\n');
  });

  it.each(['tr', 'en'] as const)(
    'builds localized %s homepage metadata and WebSite structured data without weather bootstrap',
    lang => {
      const doc = parse(buildHomePage(baseHtml, lang));
      const copy = HOME_COPY[lang];
      const path = lang === 'en' ? '/en/' : '/';
      const canonical = `${BASE_URL}${path}`;
      const structured = JSON.parse(
        doc.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}'
      );

      expect(doc.documentElement.lang).toBe(lang);
      expect(doc.title).toBe(copy.title);
      expect(attr(doc, 'meta[name="description"]')).toBe(copy.description);
      expect(attr(doc, 'meta[property="og:description"]')).toBe(copy.socialDescription);
      expect(attr(doc, 'meta[name="twitter:description"]')).toBe(copy.socialDescription);
      expect(attr(doc, 'link[rel="canonical"]', 'href')).toBe(canonical);
      expect(attr(doc, 'meta[property="og:url"]')).toBe(canonical);
      expect(attr(doc, 'link[hreflang="tr"]', 'href')).toBe(`${BASE_URL}/`);
      expect(attr(doc, 'link[hreflang="en"]', 'href')).toBe(`${BASE_URL}/en/`);
      expect(structured).toMatchObject({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Hava81',
        url: canonical,
        inLanguage: lang,
        description: copy.description,
      });
      expect(doc.documentElement.innerHTML).not.toContain('__HAVA81_BOOTSTRAP_WEATHER__');
      expect(attr(doc, 'link[rel="preconnect"]', 'href')).toBe('https://api.hava81.zekiakgul.dev');
      expect(doc.querySelectorAll('link[rel="preconnect"]')).toHaveLength(1);
      expect(doc.querySelector('link[rel="preconnect"]')?.hasAttribute('crossorigin')).toBe(true);
    }
  );

  it('builds a real, non-indexed 404 page', () => {
    const doc = parse(buildNotFoundPage(baseHtml));
    expect(attr(doc, 'meta[name="robots"]')).toBe('noindex');
    expect(doc.querySelector('link[rel="canonical"]')).toBeNull();
    expect(doc.title).toBe('Sayfa bulunamadı — Hava81');
    expect(doc.querySelector('#root h1')?.textContent).toBe('Bu adreste bir il yok');
    expect(doc.querySelector('#root a[href="/"]')).not.toBeNull();
    expect(doc.querySelector('script[type="module"]')).not.toBeNull();
    expect(doc.querySelector('link[rel="preconnect"]')).toBeNull();
  });

  it('lists every TR and EN URL once in the sitemap with alternates', () => {
    const xml = new DOMParser().parseFromString(buildSitemap(provinces), 'application/xml');
    const locs = [...xml.getElementsByTagName('loc')].map(node => node.textContent);
    expect(locs).toHaveLength(164);
    expect(new Set(locs).size).toBe(164);
    expect(locs).toContain(`${BASE_URL}/en/izmir/`);
    expect(xml.getElementsByTagName('xhtml:link')).toHaveLength(164 * 3);
  });

  it('stamps the build revision or fails loudly', () => {
    const sha = 'a'.repeat(40);
    expect(stampBuildRevision(baseHtml, sha)).toContain(
      `<meta name="hava81-build-revision" content="${sha}" />`
    );
    expect(stampBuildRevision(baseHtml, '')).toBe(baseHtml);
    expect(() => stampBuildRevision('<html></html>', sha)).toThrow(/build revision/);
  });

  it('fails when the base HTML lacks a tag it must rewrite', () => {
    expect(() => buildHomePage(baseHtml.replace(/<title>[^<]*<\/title>/, ''), 'tr')).toThrow(
      /title/
    );
  });
});
