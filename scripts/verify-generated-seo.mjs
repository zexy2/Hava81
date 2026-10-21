#!/usr/bin/env node
// Validate all pre-rendered SEO metadata before publishing GitHub Pages (Faz 4: TR + /en/
// province pages with hreflang and per-province OG cards, both home pages, 404 and sitemap).
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE_URL as base,
  HOME_COPY,
  cityCopy,
  cityPath,
  homePath,
  ogImagePath,
  parseProvinces,
} from './lib/city-pages.mjs';

const root = process.env.HAVA81_SOURCE_ROOT || fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const provinces = parseProvinces(await readFile(join(root, 'src/constants/cities.ts'), 'utf8'));

const decode = value =>
  value?.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') ?? null;
const tags = (html, type) => [...html.matchAll(new RegExp('<' + type + '\\b[^>]*>', 'gi'))].map(match => match[0]);
const attribute = (tag, name) => decode(tag.match(new RegExp('\\b' + name + '="([^"]*)"', 'i'))?.[1] ?? null);
const meta = (html, kind, key) => {
  const candidates = tags(html, 'meta').filter(tag => attribute(tag, kind) === key);
  if (candidates.length !== 1) throw new Error('Expected one meta ' + key + ', found ' + candidates.length);
  return attribute(candidates[0], 'content');
};
const links = (html, rel) => tags(html, 'link').filter(tag => attribute(tag, 'rel') === rel);
const canonical = html => {
  const candidates = links(html, 'canonical');
  if (candidates.length !== 1) throw new Error('Expected exactly one canonical link');
  return attribute(candidates[0], 'href');
};
const alternates = html =>
  Object.fromEntries(links(html, 'alternate').map(tag => [attribute(tag, 'hreflang'), attribute(tag, 'href')]));
const titleOf = html => decode(html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? null);
const htmlLang = html => html.match(/<html lang="([^"]+)">/)?.[1] ?? null;
const structuredData = html => {
  const scripts = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  if (scripts.length !== 1) throw new Error('Expected exactly one JSON-LD block');
  return JSON.parse(scripts[0][1]);
};
const eq = (actual, expected, label, page) => {
  if (actual !== expected) throw new Error(page + ': ' + label + ' is ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected));
};
const expectAlternates = (html, trPath, enPath, page) => {
  const found = alternates(html);
  eq(found.tr, base + trPath, 'hreflang tr', page);
  eq(found.en, base + enPath, 'hreflang en', page);
  eq(found['x-default'], base + trPath, 'hreflang x-default', page);
};

const knownUrls = new Set();
const knownTitles = new Set();
for (const province of provinces) {
  await access(join(dist, ogImagePath(province.slug)));
  for (const lang of ['tr', 'en']) {
    const path = cityPath(province.slug, lang);
    const page = path;
    const url = base + path;
    const copy = cityCopy(province, lang);
    const html = await readFile(join(dist, path, 'index.html'), 'utf8');
    eq(htmlLang(html), lang, 'html lang', page);
    eq(titleOf(html), copy.title, 'title', page);
    eq(canonical(html), url, 'canonical', page);
    eq(meta(html, 'name', 'description'), copy.description, 'description', page);
    eq(meta(html, 'property', 'og:url'), url, 'og:url', page);
    eq(meta(html, 'property', 'og:title'), copy.title, 'og:title', page);
    eq(meta(html, 'name', 'twitter:title'), copy.title, 'twitter:title', page);
    eq(meta(html, 'property', 'og:description'), copy.description, 'og:description', page);
    eq(meta(html, 'name', 'twitter:description'), copy.description, 'twitter:description', page);
    eq(meta(html, 'property', 'og:image:alt'), copy.title, 'og:image:alt', page);
    eq(meta(html, 'name', 'twitter:image:alt'), copy.title, 'twitter:image:alt', page);
    eq(meta(html, 'property', 'og:locale'), copy.locale, 'og:locale', page);
    eq(meta(html, 'property', 'og:image'), base + ogImagePath(province.slug), 'og:image', page);
    eq(meta(html, 'name', 'twitter:image'), base + ogImagePath(province.slug), 'twitter:image', page);
    eq(meta(html, 'property', 'og:image:type'), 'image/jpeg', 'og:image:type', page);
    expectAlternates(html, cityPath(province.slug, 'tr'), cityPath(province.slug, 'en'), page);
    const ld = structuredData(html);
    eq(ld.url, url, 'JSON-LD url', page);
    eq(ld.name, copy.title, 'JSON-LD name', page);
    eq(ld.description, copy.description, 'JSON-LD description', page);
    eq(ld.about?.name, province.name, 'JSON-LD province', page);
    eq(ld.inLanguage, lang, 'JSON-LD language', page);
    if (!html.includes(`data-static-summary="${province.slug}"`)) throw new Error(page + ': static summary missing');
    knownUrls.add(url);
    knownTitles.add(copy.title);
  }
}
eq(knownTitles.size, 162, 'distinct city titles', 'all cities');

for (const lang of ['tr', 'en']) {
  const path = homePath(lang);
  const html = await readFile(join(dist, path, 'index.html'), 'utf8');
  eq(htmlLang(html), lang, 'html lang', path);
  eq(titleOf(html), HOME_COPY[lang].title, 'title', path);
  eq(canonical(html), base + path, 'canonical', path);
  eq(meta(html, 'property', 'og:url'), base + path, 'og:url', path);
  expectAlternates(html, homePath('tr'), homePath('en'), path);
  knownUrls.add(base + path);
}
eq(knownUrls.size, 164, 'distinct SEO URLs', 'all pages');

const notFound = await readFile(join(dist, '404.html'), 'utf8');
eq(meta(notFound, 'name', 'robots'), 'noindex', 'robots', '404');
eq(links(notFound, 'canonical').length, 0, 'canonical count', '404');
if (!notFound.includes('Bu adreste bir il yok')) throw new Error('404: missing "Bu adreste bir il yok" message');

const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
eq(sitemapUrls.length, 164, 'sitemap entry count', 'sitemap');
eq(new Set(sitemapUrls).size, 164, 'sitemap uniqueness', 'sitemap');
for (const url of sitemapUrls) if (!knownUrls.has(url)) throw new Error('Unexpected sitemap URL: ' + url);
console.log('Verified 81 TR + 81 EN province pages, 2 home pages, 404 and sitemap: canonical, hreflang, social metadata, OG cards, JSON-LD.');
