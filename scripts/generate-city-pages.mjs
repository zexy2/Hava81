#!/usr/bin/env node
// Writes the pre-rendered pages into dist/ (Faz 4): 81 Turkish + 81 English province pages,
// the TR and /en/ home pages, the real 404 page, sitemap.xml and robots.txt.
// The page builders live in ./lib/city-pages.mjs (unit-tested).
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { injectCriticalFontPreloads } from './lib/font-preloads.mjs';
import {
  BASE_URL,
  buildCityPage,
  buildHomePage,
  buildNotFoundPage,
  buildSitemap,
  ogImagePath,
  parseProvinces,
  stampBuildRevision,
} from './lib/city-pages.mjs';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const provinces = parseProvinces(await readFile(join(root, 'src/constants/cities.ts'), 'utf8'));
const buildRevision = (process.env.HAVA81_BUILD_REVISION || process.env.GITHUB_SHA || '').trim();
if (process.env.GITHUB_ACTIONS === 'true' && !/^[0-9a-f]{40}$/i.test(buildRevision)) {
  throw new Error('GitHub Actions production build is missing a full 40-character build revision');
}
const assetNames = await readdir(join(dist, 'assets'));
const stampedHtml = stampBuildRevision(await readFile(join(dist, 'index.html'), 'utf8'), buildRevision);
const baseHtml = injectCriticalFontPreloads(stampedHtml, assetNames);

for (const province of provinces) {
  // Per-province OG images are committed under public/og/ (scripts/generate-og-images.mjs).
  await access(join(dist, ogImagePath(province.slug))).catch(() => {
    throw new Error(`Missing OG image for ${province.name}: public${ogImagePath(province.slug)}`);
  });
  for (const lang of ['tr', 'en']) {
    const dir = lang === 'en' ? join(dist, 'en', province.slug) : join(dist, province.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), buildCityPage(baseHtml, province, provinces, lang));
  }
}

await writeFile(join(dist, 'index.html'), buildHomePage(baseHtml, 'tr'));
await mkdir(join(dist, 'en'), { recursive: true });
await writeFile(join(dist, 'en', 'index.html'), buildHomePage(baseHtml, 'en'));
await writeFile(join(dist, '404.html'), buildNotFoundPage(baseHtml));
await writeFile(join(dist, 'sitemap.xml'), buildSitemap(provinces));
await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`);
console.log(
  `Generated ${provinces.length} TR + ${provinces.length} EN province pages, 2 home pages, 404 and sitemap.`
);
