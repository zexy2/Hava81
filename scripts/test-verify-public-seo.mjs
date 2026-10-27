/* global URL, process */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { provinceNamesBySlug } from './lib/live-audit-city-catalog.mjs';
import { cityCopy, HOME_COPY } from './lib/city-pages.mjs';

const script = fileURLToPath(new URL('./verify-public-seo.mjs', import.meta.url));

async function runFixture({ wrongCanonical = false, badSitemap = false, temporaryFailure = false, wrongEnglishHomeJsonLd = false, wrongHomeSocialImage = false, wrongCityDescription = false, wrongCityHreflang = false, wrongCitySocialImage = false } = {}) {
  const attempts = new Map();
  let base;
  const server = createServer((req, res) => {
    const path = req.url?.split('?')[0] || '/';
    const seen = (attempts.get(path) || 0) + 1;
    attempts.set(path, seen);
    if (path === '/izmir/' && temporaryFailure && seen === 1) {
      res.writeHead(503);
      res.end('try again');
      return;
    }
    const document = (slug, name, url, lang = 'tr') => {
      const copy = cityCopy({ name, region: '' }, lang);
      const description = wrongCityDescription && slug === 'izmir' ? 'Incorrect city description' : copy.description;
      const image = wrongCitySocialImage && slug === 'izmir' ? base + '/og/missing.jpg' : base + '/og/' + slug + '.jpg';
      const trUrl = base + '/' + slug + '/';
      const enUrl = base + '/en/' + slug + '/';
      const enAlternate = wrongCityHreflang && slug === 'izmir' ? base + '/en/wrong/' : enUrl;
      const structured = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: copy.title,
        description: copy.description,
        url,
        isPartOf: { '@type': 'WebSite', name: 'Hava81', url: base + (lang === 'en' ? '/en/' : '/') },
        about: { '@type': 'AdministrativeArea', name, containedInPlace: { '@type': 'Country', name: 'Türkiye' } },
        inLanguage: lang,
      };
      return '<!doctype html><html lang="' + lang + '"><head>' +
        '<title>' + copy.title + '</title>' +
        '<meta name="description" content="' + description + '">' +
        '<link rel="canonical" href="' + url + '">' +
        '<link rel="alternate" hreflang="tr" href="' + trUrl + '">' +
        '<link rel="alternate" hreflang="en" href="' + enAlternate + '">' +
        '<link rel="alternate" hreflang="x-default" href="' + trUrl + '">' +
        '<meta property="og:url" content="' + url + '">' +
        '<meta property="og:title" content="' + copy.title + '">' +
        '<meta property="og:description" content="' + copy.description + '">' +
        '<meta property="og:image" content="' + image + '">' +
        '<meta property="og:image:type" content="image/jpeg">' +
        '<meta property="og:image:width" content="1200">' +
        '<meta property="og:image:height" content="630">' +
        '<meta property="og:image:alt" content="' + copy.title + '">' +
        '<meta name="twitter:card" content="summary_large_image">' +
        '<meta name="twitter:title" content="' + copy.title + '">' +
        '<meta name="twitter:description" content="' + copy.description + '">' +
        '<meta name="twitter:image" content="' + image + '">' +
        '<meta name="twitter:image:alt" content="' + copy.title + '">' +
        '<script type="application/ld+json">' + JSON.stringify(structured) + '</script>' +
        '</head><body>Weather</body></html>';
    };
    res.setHeader('Content-Type', path.endsWith('.xml') ? 'application/xml' : 'text/html; charset=utf-8');
    const homeDocument = (lang, url) => {
      const copy = HOME_COPY[lang];
      const homeImage = wrongHomeSocialImage && lang === 'tr' ? base + '/wrong-social-card.png' : base + '/hava81-social-card.png?v=20261022';
      const structured = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Hava81',
        url: wrongEnglishHomeJsonLd && lang === 'en' ? base + '/' : url,
        inLanguage: wrongEnglishHomeJsonLd && lang === 'en' ? 'tr' : lang,
        description: wrongEnglishHomeJsonLd && lang === 'en' ? HOME_COPY.tr.description : copy.description,
      };
      return '<!doctype html><html lang="' + lang + '"><head>' +
        '<title>' + copy.title + '</title>' +
        '<meta name="description" content="' + copy.description + '">' +
        '<link rel="canonical" href="' + url + '">' +
        '<link rel="alternate" hreflang="tr" href="' + base + '/">' +
        '<link rel="alternate" hreflang="en" href="' + base + '/en/">' +
        '<link rel="alternate" hreflang="x-default" href="' + base + '/">' +
        '<meta property="og:url" content="' + url + '">' +
        '<meta property="og:title" content="' + copy.title + '">' +
        '<meta property="og:description" content="' + copy.socialDescription + '">' +
        '<meta property="og:image" content="' + homeImage + '">' +
        '<meta property="og:image:type" content="image/png">' +
        '<meta property="og:image:width" content="1200">' +
        '<meta property="og:image:height" content="630">' +
        '<meta property="og:image:alt" content="' + copy.title + '">' +
        '<meta name="twitter:card" content="summary_large_image">' +
        '<meta name="twitter:title" content="' + copy.title + '">' +
        '<meta name="twitter:description" content="' + copy.socialDescription + '">' +
        '<meta name="twitter:image" content="' + homeImage + '">' +
        '<meta name="twitter:image:alt" content="' + copy.title + '">' +
        '<script type="application/ld+json">' + JSON.stringify(structured) + '</script>' +
        '</head><body>Home</body></html>';
    };
    if (path === '/') { res.end(homeDocument('tr', base + '/')); return; }
    if (path === '/en/') { res.end(homeDocument('en', base + '/en/')); return; }
    if (path === '/sitemap.xml') {
      const slugs = [...provinceNamesBySlug.keys()];
      const urls = [
        base + '/',
        base + '/en/',
        ...slugs.map(slug => base + '/' + slug + '/'),
        ...slugs.map(slug => base + '/en/' + slug + '/'),
      ];
      if (badSitemap) urls.pop();
      res.end('<urlset>' + urls.map(url => '<url><loc>' + url + '</loc></url>').join('') + '</urlset>');
      return;
    }
    const lang = path.startsWith('/en/') ? 'en' : 'tr';
    const prefix = lang === 'en' ? '/en/' : '/';
    const slug = path.slice(prefix.length, -1);
    const name = provinceNamesBySlug.get(slug);
    if (!name) { res.writeHead(404); res.end('missing'); return; }
    res.end(document(slug, name, base + prefix + (wrongCanonical && slug === 'izmir' ? 'wrong' : slug) + '/', lang));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port;
  try {
    const child = spawn(process.execPath, [script], { env: {
      ...process.env,
      HAVA81_PUBLIC_URL: base,
      HAVA81_PUBLIC_SEO_ATTEMPTS: '2',
      HAVA81_PUBLIC_SEO_TIMEOUT_MS: '2000',
    } });
    const chunks = [];
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', chunk => chunks.push(chunk.toString()));
    }
    const [exitCode] = await once(child, 'exit');
    return { exitCode, output: chunks.join(''), attempts };
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('validates 81 published provinces, homepage and sitemap', async () => {
  const result = await runFixture();
  assert.equal(result.exitCode, 0, result.output);
  assert.match(result.output, /81 province pages/);
  assert.equal(result.attempts.size, 165);
  assert.equal(result.attempts.get('/'), 1);
  assert.equal(result.attempts.get('/en/'), 1);
});
test('rejects a wrong published city canonical URL', async () => {
  const result = await runFixture({ wrongCanonical: true });
  assert.notEqual(result.exitCode, 0);
  assert.match(result.output, /\/izmir\/: Canonical URL mismatch/);
  assert.match(result.output, /\/en\/izmir\/: Canonical URL mismatch/);
});
test('rejects English homepage JSON-LD that points at the Turkish root', async () => {
  const result = await runFixture({ wrongEnglishHomeJsonLd: true });
  assert.notEqual(result.exitCode, 0);
  assert.match(result.output, /\/en\/: Homepage JSON-LD mismatch/);
});
test('rejects a missing published sitemap entry', async () => {
  const result = await runFixture({ badSitemap: true });
  assert.notEqual(result.exitCode, 0);
  assert.match(result.output, /sitemap:/);
});
test('retries a transient 503 without masking the result', async () => {
  const result = await runFixture({ temporaryFailure: true });
  assert.equal(result.exitCode, 0, result.output);
  assert.equal(result.attempts.get('/izmir/'), 2);
});

test('rejects a mismatched city meta description', async () => {
  const result = await runFixture({ wrongCityDescription: true });
  assert.notEqual(result.exitCode, 0);
  assert.ok(result.output.includes('/izmir/: City meta description mismatch'), result.output);
});

test('rejects city hreflang links that point to the wrong province', async () => {
  const result = await runFixture({ wrongCityHreflang: true });
  assert.notEqual(result.exitCode, 0);
  assert.ok(result.output.includes('/izmir/: City hreflang mismatch'), result.output);
});

test('rejects city social cards that point to another image', async () => {
  const result = await runFixture({ wrongCitySocialImage: true });
  assert.notEqual(result.exitCode, 0);
  assert.ok(result.output.includes('/izmir/: City social image metadata mismatch'), result.output);
});

test('rejects a homepage social card that points to the wrong asset', async () => {
  const result = await runFixture({ wrongHomeSocialImage: true });
  assert.notEqual(result.exitCode, 0);
  assert.ok(result.output.includes('homepage: Homepage social image metadata mismatch'), result.output);
});