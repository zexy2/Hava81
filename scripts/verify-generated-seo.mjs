#!/usr/bin/env node
// Validate all pre-rendered city SEO metadata before publishing GitHub Pages.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.HAVA81_SOURCE_ROOT || fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const base = 'https://hava81.zekiakgul.dev';
const citySource = await readFile(join(root, 'src/constants/cities.ts'), 'utf8');
const provinces = [...citySource.matchAll(/\{ name: '([^']+)'/g)].map(match => match[1]);
if (provinces.length !== 81 || new Set(provinces).size !== 81) {
  throw new Error('Expected 81 unique province names in city source');
}

const slugify = name => name.replace(/ı/g, 'i').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tags = (html, type) => [...html.matchAll(new RegExp('<' + type + '\\b[^>]*>', 'gi'))].map(match => match[0]);
const attribute = (tag, name) => tag.match(new RegExp('\\b' + name + '="([^"]*)"', 'i'))?.[1] ?? null;
const meta = (html, kind, key) => {
  const candidates = tags(html, 'meta').filter(tag => attribute(tag, kind) === key);
  if (candidates.length !== 1) throw new Error('Expected one meta ' + key + ', found ' + candidates.length);
  return attribute(candidates[0], 'content');
};
const canonical = html => {
  const candidates = tags(html, 'link').filter(tag => attribute(tag, 'rel') === 'canonical');
  if (candidates.length !== 1) throw new Error('Expected exactly one canonical link');
  return attribute(candidates[0], 'href');
};
const titleOf = html => html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? null;
const structuredData = html => {
  const scripts = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  if (scripts.length !== 1) throw new Error('Expected exactly one JSON-LD block');
  return JSON.parse(scripts[0][1]);
};
const eq = (actual, expected, label, page) => {
  if (actual !== expected) throw new Error(page + ': ' + label + ' is ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected));
};

const knownUrls = new Set([base + '/']);
const knownTitles = new Set();
const knownDescriptions = new Set();
for (const name of provinces) {
  const slug = slugify(name);
  const url = base + '/' + slug + '/';
  const html = await readFile(join(dist, slug, 'index.html'), 'utf8');
  const title = name + ' hava durumu ve gün planı — Hava81';
  const desc = name + ' için güncel hava, saatlik ve günlük tahmin, Hava81 Skoru, hava açısından en iyi dışarı çıkma penceresi, yağmur-rüzgâr-hava kalitesi ve günlük karar önerileri.';
  eq(titleOf(html), title, 'title', slug);
  eq(canonical(html), url, 'canonical', slug);
  eq(meta(html, 'name', 'description'), desc, 'description', slug);
  for (const kind of ['og:url']) eq(meta(html, 'property', kind), url, kind, slug);
  for (const kind of ['og:title']) eq(meta(html, 'property', kind), title, kind, slug);
  for (const kind of ['twitter:title']) eq(meta(html, 'name', kind), title, kind, slug);
  for (const kind of ['og:description']) eq(meta(html, 'property', kind), desc, kind, slug);
  for (const kind of ['twitter:description']) eq(meta(html, 'name', kind), desc, kind, slug);
  eq(meta(html, 'property', 'og:image:alt'), title, 'og:image:alt', slug);
  eq(meta(html, 'name', 'twitter:image:alt'), title, 'twitter:image:alt', slug);
  const ld = structuredData(html);
  eq(ld.url, url, 'JSON-LD url', slug);
  eq(ld.name, title, 'JSON-LD name', slug);
  eq(ld.description, desc, 'JSON-LD description', slug);
  eq(ld.about?.name, name, 'JSON-LD province', slug);
  knownUrls.add(url); knownTitles.add(title); knownDescriptions.add(desc);
}
eq(knownUrls.size, 82, 'distinct SEO URLs', 'all cities');
eq(knownTitles.size, 81, 'distinct city titles', 'all cities');
eq(knownDescriptions.size, 81, 'distinct city descriptions', 'all cities');

const home = await readFile(join(dist, 'index.html'), 'utf8');
eq(canonical(home), base + '/', 'homepage canonical', 'homepage');
eq(meta(home, 'property', 'og:url'), base + '/', 'homepage Open Graph URL', 'homepage');
const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
eq(sitemapUrls.length, 82, 'sitemap entry count', 'sitemap');
eq(new Set(sitemapUrls).size, 82, 'sitemap uniqueness', 'sitemap');
for (const url of sitemapUrls) if (!knownUrls.has(url)) throw new Error('Unexpected sitemap URL: ' + url);
console.log('Verified 81 province pages + homepage: canonical, social metadata, JSON-LD and sitemap.');
