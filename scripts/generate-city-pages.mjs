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
      '</head>',
      `    <meta property="og:type" content="website" />\n    <meta property="og:site_name" content="Hava81" />\n    <meta property="og:title" content="${title}" />\n    <meta property="og:description" content="${description}" />\n    <meta name="twitter:card" content="summary" />\n  </head>`
    );
  await mkdir(join(dist, slug), { recursive: true });
  await writeFile(join(dist, slug, 'index.html'), html);
}

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
