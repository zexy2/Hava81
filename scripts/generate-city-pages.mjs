#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const source = await readFile(join(root, 'src/constants/cities.ts'), 'utf8');
const sourceBaseHtml = await readFile(join(dist, 'index.html'), 'utf8');
const buildRevision = (process.env.HAVA81_BUILD_REVISION || process.env.GITHUB_SHA || '').trim();
if (process.env.GITHUB_ACTIONS === 'true' && !/^[0-9a-f]{40}$/i.test(buildRevision)) {
  throw new Error('GitHub Actions production build is missing a full 40-character build revision');
}
const baseHtml = buildRevision
  ? sourceBaseHtml.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta name="hava81-build-revision" content="${buildRevision}" />`
    )
  : sourceBaseHtml;
if (buildRevision && !baseHtml.includes(`name="hava81-build-revision" content="${buildRevision}"`)) {
  throw new Error('Failed to stamp production HTML with the build revision');
}
const names = [...source.matchAll(/\{ name: '([^']+)'/g)].map(match => match[1]);
const ascii = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  İ: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
};
const slugify = name =>
  [...name]
    .map(ch => ascii[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const expectedProvinceCount = 81;
const uniqueNames = new Set(names);
const slugs = names.map(slugify);
const uniqueSlugs = new Set(slugs);
if (names.length !== expectedProvinceCount || uniqueNames.size !== expectedProvinceCount) {
  throw new Error(
    `Expected exactly ${expectedProvinceCount} unique Turkish provinces, found ${names.length} entries / ${uniqueNames.size} unique names`
  );
}
if (uniqueSlugs.size !== expectedProvinceCount || slugs.some(slug => !slug)) {
  throw new Error(
    `Expected exactly ${expectedProvinceCount} non-empty unique city slugs, found ${uniqueSlugs.size}`
  );
}

const baseUrl = 'https://hava81.zekiakgul.dev';
const apiBaseUrl = 'https://api.hava81.zekiakgul.dev/api/v1';
const weatherCacheMaxAgeMs = 5 * 60 * 1000;
const weatherCacheFutureSkewMs = 60 * 1000;
const bootstrapTimeoutMs = 10_000;

const safeJson = value => JSON.stringify(value).replace(/</g, '\u003c');
const bootstrapWeatherScript = (cityName, expectedPath) => `    <script>
      (() => {
        const city = ${safeJson(cityName)};
        const cityKey = ${safeJson(slugify(cityName))};
        const expectedPath = ${safeJson(expectedPath)};
        const cityAscii = ${safeJson(ascii)};
        const normalizeCity = value =>
          [...value]
            .map(char => cityAscii[char] || char)
            .join('')
            .normalize('NFD')
            .replace(/[\\u0300-\\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        if (window.location.pathname !== expectedPath) return;

        let lang = 'tr';
        try {
          const settings = JSON.parse(window.localStorage.getItem('user-settings') || 'null');
          if (settings?.language === 'en') lang = 'en';
        } catch {}

        try {
          const cached = JSON.parse(window.localStorage.getItem('weather_cache') || 'null');
          const cacheCity = cached?.data?.cityName;
          const cacheLanguage = cached?.language || 'tr';
          const cacheAge = Date.now() - Number(cached?.timestamp || 0);
          if (
            cacheCity &&
            cacheAge >= -${weatherCacheFutureSkewMs} &&
            cacheAge < ${weatherCacheMaxAgeMs} &&
            cacheLanguage === lang &&
            normalizeCity(cacheCity) === cityKey
          ) {
            return;
          }
        } catch {}

        const url = new URL(${safeJson(apiBaseUrl + '/weather/current')});
        url.searchParams.set('city', city);
        url.searchParams.set('units', 'metric');
        url.searchParams.set('lang', lang);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), ${bootstrapTimeoutMs});
        const promise = window
          .fetch(url.toString(), {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          })
          .then(response => (response.ok ? response.json() : null))
          .catch(() => null)
          .finally(() => window.clearTimeout(timeoutId));
        const hourlyPromise = promise.then(current => {
          const lat = Number(current?.coordinates?.lat);
          const lon = Number(current?.coordinates?.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

          const hourlyUrl = new URL(${safeJson(apiBaseUrl + '/weather/hourly')});
          hourlyUrl.searchParams.set('lat', String(lat));
          hourlyUrl.searchParams.set('lon', String(lon));
          hourlyUrl.searchParams.set('lang', lang);
          const hourlyController = new AbortController();
          const hourlyTimeoutId = window.setTimeout(
            () => hourlyController.abort(),
            ${bootstrapTimeoutMs}
          );
          return window
            .fetch(hourlyUrl.toString(), {
              headers: { Accept: 'application/json' },
              signal: hourlyController.signal,
            })
            .then(response => (response.ok ? response.json() : null))
            .then(response => (response ? { lat, lon, response } : null))
            .catch(() => null)
            .finally(() => window.clearTimeout(hourlyTimeoutId));
        });
        window.__HAVA81_BOOTSTRAP_WEATHER__ = { city, lang, units: 'metric', promise };
        window.__HAVA81_BOOTSTRAP_HOURLY__ = { lang, promise: hourlyPromise };
      })();
    </script>`;

const injectBootstrapWeather = (html, cityName, expectedPath) => {
  const moduleScriptIndex = html.indexOf('    <script type="module"');
  if (moduleScriptIndex < 0) throw new Error('Production HTML is missing the Vite module entry script');
  const script = bootstrapWeatherScript(cityName, expectedPath);
  const output = `${html.slice(0, moduleScriptIndex)}${script}\n${html.slice(moduleScriptIndex)}`;
  if (
    output.indexOf('__HAVA81_BOOTSTRAP_WEATHER__') > output.indexOf('    <script type="module"') ||
    output.indexOf('__HAVA81_BOOTSTRAP_HOURLY__') > output.indexOf('    <script type="module"')
  ) {
    throw new Error('Weather bootstraps must precede the application module script');
  }
  return output;
};

for (const name of names) {
  const slug = slugify(name);
  const title = `${name} hava durumu ve gün planı — Hava81`;
  const description = `${name} için güncel hava, saatlik ve günlük tahmin, Hava81 Skoru, hava açısından en iyi dışarı çıkma penceresi, yağmur-rüzgâr-hava kalitesi ve günlük karar önerileri.`;
  const canonical = `${baseUrl}/${slug}/`;
  const structuredData = safeJson({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'Hava81', url: `${baseUrl}/` },
    about: {
      '@type': 'City',
      name,
      address: { '@type': 'PostalAddress', addressCountry: 'TR' },
    },
    inLanguage: ['tr', 'en'],
  });
  let html = baseHtml
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*("\s*\/?>)/, `$1${description}$2`);
  html = html
    .replace(
      /<link rel="canonical" href="[^"]+" \/>/,
      `<link rel="canonical" href="${canonical}" />`
    )
    .replace(
      /<meta property="og:url" content="[^"]+" \/>/,
      `<meta property="og:url" content="${canonical}" />`
    )
    .replace(
      /<meta property="og:title" content="[^"]+" \/>/,
      `<meta property="og:title" content="${title}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:description" content="${description}" />`
    )
    .replace(
      /<meta property="og:image:alt" content="[^"]+" \/>/,
      `<meta property="og:image:alt" content="${title}" />`
    )
    .replace(
      /<meta name="twitter:title" content="[^"]+" \/>/,
      `<meta name="twitter:title" content="${title}" />`
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
      `<meta name="twitter:description" content="${description}" />`
    )
    .replace(
      /<meta name="twitter:image:alt" content="[^"]+" \/>/,
      `<meta name="twitter:image:alt" content="${title}" />`
    );
  html = html.replace(
    /(<script type="application\/ld\+json">\s*)\{.*?\}(\s*<\/script>)/s,
    `$1${structuredData}$2`
  );

  const requiredSingleTags = [
    ['canonical', /<link rel="canonical" /g],
    ['og:url', /<meta property="og:url" /g],
    ['og:title', /<meta property="og:title" /g],
    ['og:description', /<meta property="og:description" /g],
    ['og:image:alt', /<meta property="og:image:alt" /g],
    ['twitter:title', /<meta name="twitter:title" /g],
    ['twitter:description', /<meta name="twitter:description" /g],
    ['twitter:image:alt', /<meta name="twitter:image:alt" /g],
    ['structured data', /<script type="application\/ld\+json">/g],
  ];
  for (const [label, pattern] of requiredSingleTags) {
    const count = html.match(pattern)?.length ?? 0;
    if (count !== 1) throw new Error(`${name}: expected exactly one ${label}, found ${count}`);
  }
  html = injectBootstrapWeather(html, name, `/${slug}/`);
  await mkdir(join(dist, slug), { recursive: true });
  await writeFile(join(dist, slug, 'index.html'), html);
}

await writeFile(join(dist, 'index.html'), injectBootstrapWeather(baseHtml, 'İstanbul', '/'));

const urls = [`${baseUrl}/`, ...names.map(name => `${baseUrl}/${slugify(name)}/`)];
await writeFile(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`
);
await writeFile(
  join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`
);
console.log(`Generated ${names.length} city entry pages plus sitemap.`);
