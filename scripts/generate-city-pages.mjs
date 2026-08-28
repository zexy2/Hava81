#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const source = await readFile(join(root, 'src/constants/cities.ts'), 'utf8');
const baseHtml = await readFile(join(dist, 'index.html'), 'utf8');
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
const baseUrl = 'https://hava81.zekiakgul.dev';
const apiBaseUrl = 'https://api.hava81.zekiakgul.dev/api/v1';
const weatherCacheMaxAgeMs = 5 * 60 * 1000;

const safeJson = value => JSON.stringify(value).replace(/</g, '\u003c');
const bootstrapWeatherScript = (cityName, expectedPath) => `    <script>
      (() => {
        const city = ${safeJson(cityName)};
        const expectedPath = ${safeJson(expectedPath)};
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
            cacheAge < ${weatherCacheMaxAgeMs} &&
            cacheLanguage === lang &&
            cacheCity.toLocaleLowerCase('tr-TR') === city.toLocaleLowerCase('tr-TR')
          ) {
            return;
          }
        } catch {}

        const url = new URL(${safeJson(apiBaseUrl + '/weather/current')});
        url.searchParams.set('city', city);
        url.searchParams.set('units', 'metric');
        url.searchParams.set('lang', lang);
        const promise = window
          .fetch(url.toString(), { headers: { Accept: 'application/json' } })
          .then(response => (response.ok ? response.json() : null))
          .catch(() => null);
        window.__HAVA81_BOOTSTRAP_WEATHER__ = { city, lang, units: 'metric', promise };
      })();
    </script>`;

const injectBootstrapWeather = (html, cityName, expectedPath) => {
  const moduleScriptIndex = html.indexOf('    <script type="module"');
  if (moduleScriptIndex < 0) throw new Error('Production HTML is missing the Vite module entry script');
  const script = bootstrapWeatherScript(cityName, expectedPath);
  const output = `${html.slice(0, moduleScriptIndex)}${script}
${html.slice(moduleScriptIndex)}`;
  if (output.indexOf('__HAVA81_BOOTSTRAP_WEATHER__') > output.indexOf('    <script type="module"')) {
    throw new Error('Weather bootstrap must precede the application module script');
  }
  return output;
};

for (const name of names) {
  const slug = slugify(name);
  const title = `${name} hava durumu ve gün planı — Hava81`;
  const description = `${name} için güncel hava, 3 saatlik tahmin, Hava81 Skoru, en iyi dışarı çıkma saati, yağmur-rüzgâr-hava kalitesi ve günlük karar önerileri.`;
  const canonical = `${baseUrl}/${slug}/`;
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
      /<meta name="twitter:title" content="[^"]+" \/>/,
      `<meta name="twitter:title" content="${title}" />`
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
      `<meta name="twitter:description" content="${description}" />`
    );

  const requiredSingleTags = [
    ['canonical', /<link rel="canonical" /g],
    ['og:url', /<meta property="og:url" /g],
    ['og:title', /<meta property="og:title" /g],
    ['og:description', /<meta property="og:description" /g],
    ['twitter:title', /<meta name="twitter:title" /g],
    ['twitter:description', /<meta name="twitter:description" /g],
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
