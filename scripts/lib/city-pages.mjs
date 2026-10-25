// Faz 4: pure builders for the pre-rendered province pages (TR + /en/), the home pages,
// the real 404 page and the sitemap. `scripts/generate-city-pages.mjs` only does file I/O;
// everything here is unit-tested from src/__tests__/scripts.cityPages.test.ts.

export const BASE_URL = 'https://hava81.zekiakgul.dev';
export const API_BASE_URL = 'https://api.hava81.zekiakgul.dev/api/v1';
export const EXPECTED_PROVINCE_COUNT = 81;
export const LANGUAGES = ['tr', 'en'];

const ascii = { ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u' };

export const slugify = name =>
  [...name]
    .map(ch => ascii[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Reads `{ name, plateCode, region, coordinates }` records from src/constants/cities.ts. */
export function parseProvinces(source) {
  const provinces = [
    ...source.matchAll(
      /\{\s*name:\s*'([^']+)',\s*plateCode:\s*(\d+),\s*region:\s*'([^']+)',\s*coordinates:\s*\{\s*lat:\s*(-?\d+(?:\.\d+)?),\s*lon:\s*(-?\d+(?:\.\d+)?)\s*\}/g
    ),
  ].map(([, name, plate, region, lat, lon]) => ({
    name,
    slug: slugify(name),
    plateCode: Number(plate),
    region,
    lat: Number(lat),
    lon: Number(lon),
  }));
  const names = new Set(provinces.map(p => p.name));
  const slugs = new Set(provinces.map(p => p.slug));
  if (
    provinces.length !== EXPECTED_PROVINCE_COUNT ||
    names.size !== EXPECTED_PROVINCE_COUNT ||
    slugs.size !== EXPECTED_PROVINCE_COUNT ||
    provinces.some(p => !p.slug)
  ) {
    throw new Error(
      `Expected exactly ${EXPECTED_PROVINCE_COUNT} unique Turkish provinces and slugs, found ${provinces.length} entries / ${names.size} names / ${slugs.size} slugs`
    );
  }
  return provinces;
}

export const cityPath = (slug, lang) => (lang === 'en' ? `/en/${slug}/` : `/${slug}/`);
export const homePath = lang => (lang === 'en' ? '/en/' : '/');
export const ogImagePath = slug => `/og/${slug}.jpg`;

const REGION_EN = {
  Marmara: 'Marmara',
  Ege: 'Aegean',
  Akdeniz: 'Mediterranean',
  'İç Anadolu': 'Central Anatolia',
  Karadeniz: 'Black Sea',
  'Doğu Anadolu': 'Eastern Anatolia',
  'Güneydoğu Anadolu': 'Southeastern Anatolia',
};

/** Static copy per language. TR strings are the published (verified) ones; EN mirrors en.ts. */
export function cityCopy(province, lang) {
  const { name } = province;
  if (lang === 'en') {
    return {
      title: `${name} weather and day plan — Hava81`,
      description: `Current weather, hourly and daily forecast, Hava81 Score, best weather window to go out, rain-wind-air quality signals and daily decision guidance for ${name}.`,
      heading: `${name} weather`,
      region: `${REGION_EN[province.region] ?? province.region} region`,
      locale: 'en_US',
      alternateLocale: 'tr_TR',
    };
  }
  return {
    title: `${name} hava durumu ve gün planı — Hava81`,
    description: `${name} için güncel hava, saatlik ve günlük tahmin, Hava81 Skoru, hava açısından en iyi dışarı çıkma penceresi, yağmur-rüzgâr-hava kalitesi ve günlük karar önerileri.`,
    heading: `${name} hava durumu`,
    region: `${province.region} Bölgesi`,
    locale: 'tr_TR',
    alternateLocale: 'en_US',
  };
}

export const HOME_COPY = {
  tr: {
    title: 'Hava81 — Havayı değil, gününü planla',
    description:
      "Hava81, Türkiye'nin 81 ili için hava durumunu günlük kararlara çevirir: Hava81 Skoru, hava açısından en iyi zaman, aktivite planları ve yerel hava riskleri.",
    socialDescription:
      "Türkiye'nin 81 ili için hava durumunu günlük kararlara çevir: Hava81 Skoru, hava açısından en iyi zaman, aktivite planları ve yerel hava riskleri.",
  },
  en: {
    title: 'Hava81 — Plan your day, not just the weather',
    description:
      'Hava81 turns the weather for all 81 provinces of Türkiye into daily decisions: Hava81 Score, best weather window, activity plans and local weather risks.',
    socialDescription:
      'Turn the weather for all 81 provinces of Türkiye into daily decisions: Hava81 Score, best weather window, activity plans and local weather risks.',
  },
};

export const NOT_FOUND_COPY = {
  title: 'Sayfa bulunamadı — Hava81',
  heading: 'Bu adreste bir il yok',
  body: 'Aradığın adres Hava81’deki 81 ilden biriyle eşleşmiyor. İl adını kontrol et ya da ana sayfadan ara.',
  home: 'Ana sayfaya dön',
  enHeading: 'There is no province at this address',
  enHome: 'Go to the English home page',
};

const EARTH_RADIUS_KM = 6371;
export function distanceKm(a, b) {
  const rad = v => (v * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export const nearestProvinces = (province, provinces, count = 5) =>
  provinces
    .filter(candidate => candidate.slug !== province.slug)
    .map(candidate => ({ candidate, distance: distanceKm(province, candidate) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map(({ candidate }) => candidate);

export const escapeHtml = value =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');

const formatCoordinate = (value, lang) =>
  new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const STATIC_STYLE =
  'max-width:46rem;margin:0 auto;padding:2.5rem 1.25rem;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.55;color:#0b264b';

/** Crawlable province summary rendered into #root at build time; React replaces it on boot. */
export function staticCitySummary(province, provinces, lang) {
  const copy = cityCopy(province, lang);
  const plate = String(province.plateCode).padStart(2, '0');
  const lat = formatCoordinate(province.lat, lang);
  const lon = formatCoordinate(province.lon, lang);
  const neighbours = nearestProvinces(province, provinces);
  const other = lang === 'en' ? 'tr' : 'en';
  const t =
    lang === 'en'
      ? {
          kicker: 'Hava81 · decision-first weather guidance for all 81 provinces',
          facts: `${province.name} (plate ${plate}) is in Türkiye’s ${copy.region}; the provincial centre is at ${lat}° N, ${lon}° E.`,
          body: `This page shows the current weather, hourly and daily forecast, the Hava81 Score and the best weather window to go out in ${province.name}. Live data loads with the app.`,
          nearby: 'Nearby provinces',
          switchLabel: 'Türkçe',
        }
      : {
          kicker: 'Hava81 · Türkiye’nin 81 ili için karar odaklı hava rehberi',
          facts: `${province.name} (plaka ${plate}) ${copy.region}’nde; il merkezi ${lat}° K, ${lon}° D.`,
          body: `Bu sayfa ${province.name} için güncel havayı, saatlik ve günlük tahmini, Hava81 Skorunu ve hava açısından en iyi dışarı çıkma penceresini gösterir. Canlı veriler uygulama açılınca gelir.`,
          nearby: 'Yakındaki iller',
          switchLabel: 'English',
        };
  const links = neighbours
    .map(n => `<li><a href="${cityPath(n.slug, lang)}">${escapeHtml(n.name)}</a></li>`)
    .join('');
  return (
    `<main class="hava81-static-summary" data-static-summary="${province.slug}" style='${STATIC_STYLE}'>` +
    `<p style="margin:0;font-size:.8125rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#10476c">${escapeHtml(t.kicker)}</p>` +
    `<h1 style="margin:.5rem 0 1rem;font-size:2.25rem;line-height:1.15">${escapeHtml(copy.heading)}</h1>` +
    `<p>${escapeHtml(t.facts)}</p>` +
    `<p>${escapeHtml(t.body)}</p>` +
    `<nav aria-label="${escapeHtml(t.nearby)}"><h2 style="font-size:1.125rem;margin:1.5rem 0 .5rem">${escapeHtml(t.nearby)}</h2>` +
    `<ul style="display:flex;flex-wrap:wrap;gap:.5rem 1rem;padding:0;margin:0;list-style:none">${links}</ul></nav>` +
    `<p style="margin-top:1.5rem"><a href="${cityPath(province.slug, other)}" hreflang="${other}" lang="${other}">${t.switchLabel}</a></p>` +
    `</main>`
  );
}

const bootstrapWeatherScript = (cityName, expectedPath, forcedLang) => `    <script>
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

        let lang = ${forcedLang ? safeJson(forcedLang) : "'tr'"};
        ${
          forcedLang
            ? '// The /en/ URL decides the language (Faz 4).'
            : `try {
          const settings = JSON.parse(window.localStorage.getItem('user-settings') || 'null');
          if (settings?.language === 'en') lang = 'en';
        } catch {}`
        }

        try {
          const cached = JSON.parse(window.localStorage.getItem('weather_cache') || 'null');
          const cacheCity = cached?.data?.cityName;
          const cacheLanguage = cached?.language || 'tr';
          const cacheAge = Date.now() - Number(cached?.timestamp || 0);
          if (
            cacheCity &&
            cacheAge >= -60000 &&
            cacheAge < 300000 &&
            cacheLanguage === lang &&
            normalizeCity(cacheCity) === cityKey
          ) {
            return;
          }
        } catch {}

        const url = new URL(${safeJson(API_BASE_URL + '/weather/current')});
        url.searchParams.set('city', city);
        url.searchParams.set('units', 'metric');
        url.searchParams.set('lang', lang);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 10000);
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

          const hourlyUrl = new URL(${safeJson(API_BASE_URL + '/weather/hourly')});
          hourlyUrl.searchParams.set('lat', String(lat));
          hourlyUrl.searchParams.set('lon', String(lon));
          hourlyUrl.searchParams.set('lang', lang);
          const hourlyController = new AbortController();
          const hourlyTimeoutId = window.setTimeout(() => hourlyController.abort(), 10000);
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

const API_CONNECTION_HINTS =
  '    <link rel="dns-prefetch" href="//api.hava81.zekiakgul.dev" />\n    <link rel="preconnect" href="https://api.hava81.zekiakgul.dev" crossorigin />';

function replaceOnce(html, pattern, replacement, label) {
  const matches = html.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'));
  if (!matches || matches.length !== 1) {
    throw new Error(`Expected exactly one ${label} in the base HTML, found ${matches?.length ?? 0}`);
  }
  return html.replace(pattern, replacement);
}

const insertBefore = (html, marker, insertion, label) => {
  const index = html.indexOf(marker);
  if (index < 0) throw new Error(`Base HTML is missing ${label}`);
  return `${html.slice(0, index)}${insertion}\n${html.slice(index)}`;
};

export const alternateLinks = (trPath, enPath) =>
  [
    `    <link rel="alternate" hreflang="tr" href="${BASE_URL}${trPath}" />`,
    `    <link rel="alternate" hreflang="en" href="${BASE_URL}${enPath}" />`,
    `    <link rel="alternate" hreflang="x-default" href="${BASE_URL}${trPath}" />`,
  ].join('\n');

/** Shared head rewrite: language, title, description, canonical, social tags, hreflang. */
function applyHead(baseHtml, { lang, title, description, socialDescription = description, canonicalPath, trPath, enPath, imagePath, imageType, imageAlt = title, structuredData }) {
  const canonical = `${BASE_URL}${canonicalPath}`;
  const locale = lang === 'en' ? 'en_US' : 'tr_TR';
  const alternateLocale = lang === 'en' ? 'tr_TR' : 'en_US';
  let html = baseHtml;
  html = replaceOnce(html, /<html lang="[^"]*">/, `<html lang="${lang}">`, 'html lang');
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`, 'title');
  html = replaceOnce(html, /(<meta\s+name="description"\s+content=")[^"]*("\s*\/?>)/, `$1${escapeHtml(description)}$2`, 'description');
  html = replaceOnce(html, /<link rel="canonical" href="[^"]+" \/>/, `<link rel="canonical" href="${canonical}" />`, 'canonical');
  html = replaceOnce(html, /<meta property="og:url" content="[^"]+" \/>/, `<meta property="og:url" content="${canonical}" />`, 'og:url');
  html = replaceOnce(html, /<meta property="og:locale" content="[^"]+" \/>/, `<meta property="og:locale" content="${locale}" />`, 'og:locale');
  html = replaceOnce(html, /<meta property="og:locale:alternate" content="[^"]+" \/>/, `<meta property="og:locale:alternate" content="${alternateLocale}" />`, 'og:locale:alternate');
  html = replaceOnce(html, /<meta property="og:title" content="[^"]+" \/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`, 'og:title');
  html = replaceOnce(html, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(socialDescription)}" />`, 'og:description');
  html = replaceOnce(html, /<meta property="og:image:alt" content="[^"]+" \/>/, `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`, 'og:image:alt');
  html = replaceOnce(html, /<meta name="twitter:title" content="[^"]+" \/>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`, 'twitter:title');
  html = replaceOnce(html, /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${escapeHtml(socialDescription)}" />`, 'twitter:description');
  html = replaceOnce(html, /<meta name="twitter:image:alt" content="[^"]+" \/>/, `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`, 'twitter:image:alt');
  if (imagePath) {
    const image = `${BASE_URL}${imagePath}`;
    html = replaceOnce(html, /(<meta\s+property="og:image"\s+content=")[^"]*("\s*\/>)/, `$1${image}$2`, 'og:image');
    html = replaceOnce(html, /(<meta\s+name="twitter:image"\s+content=")[^"]*("\s*\/>)/, `$1${image}$2`, 'twitter:image');
    html = replaceOnce(html, /<meta property="og:image:type" content="[^"]+" \/>/, `<meta property="og:image:type" content="${imageType}" />`, 'og:image:type');
  }
  if (structuredData) {
    html = replaceOnce(html, /(<script type="application\/ld\+json">\s*)\{.*?\}(\s*<\/script>)/s, `$1${safeJson(structuredData)}$2`, 'structured data');
  }
  if (trPath && enPath) {
    html = insertBefore(html, '    <link rel="canonical"', alternateLinks(trPath, enPath), 'its canonical link');
  }
  return html;
}

const withRootContent = (html, content) =>
  replaceOnce(html, /<div id="root"><\/div>/, `<div id="root">${content}</div>`, 'empty #root');

export function buildCityPage(baseHtml, province, provinces, lang) {
  const copy = cityCopy(province, lang);
  const path = cityPath(province.slug, lang);
  let html = applyHead(baseHtml, {
    lang,
    title: copy.title,
    description: copy.description,
    canonicalPath: path,
    trPath: cityPath(province.slug, 'tr'),
    enPath: cityPath(province.slug, 'en'),
    imagePath: ogImagePath(province.slug),
    imageType: 'image/jpeg',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: copy.title,
      description: copy.description,
      url: `${BASE_URL}${path}`,
      isPartOf: { '@type': 'WebSite', name: 'Hava81', url: `${BASE_URL}${homePath(lang)}` },
      about: {
        '@type': 'AdministrativeArea',
        name: province.name,
        containedInPlace: { '@type': 'Country', name: 'Türkiye' },
      },
      inLanguage: lang,
    },
  });
  html = insertBefore(html, '    <link rel="canonical"', API_CONNECTION_HINTS, 'its canonical link');
  html = insertBefore(html, '    <script type="module"', bootstrapWeatherScript(province.name, path, lang === 'en' ? 'en' : null), 'the Vite module entry script');
  return withRootContent(html, staticCitySummary(province, provinces, lang));
}

export function buildHomePage(baseHtml, lang) {
  const copy = HOME_COPY[lang];
  return applyHead(baseHtml, {
    lang,
    title: copy.title,
    description: copy.description,
    socialDescription: copy.socialDescription,
    canonicalPath: homePath(lang),
    trPath: homePath('tr'),
    enPath: homePath('en'),
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Hava81',
      url: `${BASE_URL}${homePath(lang)}`,
      inLanguage: lang,
      description: copy.description,
    },
  });
}

/** GitHub Pages serves this with HTTP 404 for every unknown path; the SPA adds suggestions. */
export function buildNotFoundPage(baseHtml) {
  let html = replaceOnce(baseHtml, /<title>[^<]*<\/title>/, `<title>${NOT_FOUND_COPY.title}</title>`, 'title');
  html = replaceOnce(html, /\s*<link rel="canonical" href="[^"]+" \/>/, '', 'canonical');
  html = insertBefore(html, '    <title>', '    <meta name="robots" content="noindex" />', 'its title');
  const content =
    `<main class="hava81-static-summary hava81-static-summary--not-found" style='${STATIC_STYLE}'>` +
    `<p style="margin:0;font-size:.8125rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#10476c">404</p>` +
    `<h1 style="margin:.5rem 0 1rem;font-size:2.25rem;line-height:1.15">${NOT_FOUND_COPY.heading}</h1>` +
    `<p>${NOT_FOUND_COPY.body}</p>` +
    `<p><a href="/">${NOT_FOUND_COPY.home}</a></p>` +
    `<p lang="en">${NOT_FOUND_COPY.enHeading}. <a href="/en/">${NOT_FOUND_COPY.enHome}</a></p>` +
    `</main>`;
  return withRootContent(html, content);
}

export function sitemapEntries(provinces) {
  const pairs = [
    [homePath('tr'), homePath('en')],
    ...provinces.map(p => [cityPath(p.slug, 'tr'), cityPath(p.slug, 'en')]),
  ];
  return pairs.flatMap(([tr, en]) => [
    { loc: `${BASE_URL}${tr}`, tr: `${BASE_URL}${tr}`, en: `${BASE_URL}${en}` },
    { loc: `${BASE_URL}${en}`, tr: `${BASE_URL}${tr}`, en: `${BASE_URL}${en}` },
  ]);
}

export const buildRobotsTxt = () => `User-agent: *
Allow: /
Sitemap: ${BASE_URL}/sitemap.xml
`;

export function buildSitemap(provinces) {
  const urls = sitemapEntries(provinces)
    .map(
      ({ loc, tr, en }) =>
        `  <url><loc>${loc}</loc>` +
        `<xhtml:link rel="alternate" hreflang="tr" href="${tr}"/>` +
        `<xhtml:link rel="alternate" hreflang="en" href="${en}"/>` +
        `<xhtml:link rel="alternate" hreflang="x-default" href="${tr}"/></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

export function stampBuildRevision(sourceHtml, revision) {
  if (!revision) return sourceHtml;
  const html = sourceHtml.replace(
    '<meta charset="UTF-8" />',
    `<meta charset="UTF-8" />\n    <meta name="hava81-build-revision" content="${revision}" />`
  );
  if (!html.includes(`name="hava81-build-revision" content="${revision}"`)) {
    throw new Error('Failed to stamp production HTML with the build revision');
  }
  return html;
}
