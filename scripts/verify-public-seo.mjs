#!/usr/bin/env node
// Check what GitHub Pages actually serves, not just the locally generated dist.
import { provinceNamesBySlug } from './lib/live-audit-city-catalog.mjs';

const origin = (process.env.HAVA81_PUBLIC_URL || 'https://hava81.zekiakgul.dev').replace(/\/+$/, '');
const attempts = Number(process.env.HAVA81_PUBLIC_SEO_ATTEMPTS || 3);
const timeoutMs = Number(process.env.HAVA81_PUBLIC_SEO_TIMEOUT_MS || 12000);
if (!/^https?:\/\//.test(origin) || !Number.isInteger(attempts) || attempts < 1 || attempts > 6 ||
    !Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 60000) {
  throw new Error('Invalid published SEO smoke settings');
}

const attribute = (tag, name) => tag.match(new RegExp('\\b' + name + '="([^"]*)"', 'i'))?.[1] ?? null;
const tags = (html, name) => [...html.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'gi'))].map(m => m[0]);
function canonical(html) {
  const links = tags(html, 'link').filter(tag => attribute(tag, 'rel') === 'canonical');
  if (links.length !== 1) throw new Error('Expected exactly one canonical URL');
  return attribute(links[0], 'href');
}
const pageTitle = html => html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? null;
function structuredData(html) {
  const blocks = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  if (blocks.length !== 1) throw new Error('Expected exactly one JSON-LD block');
  return JSON.parse(blocks[0][1]);
}
async function getText(path) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(origin + path, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': 'Hava81-public-release-seo-smoke/1.0', 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 250 * attempt));
    }
  }
  throw lastError;
}
function verifyCity(slug, name, html) {
  const url = origin + '/' + slug + '/';
  const expectedTitle = name + ' hava durumu ve gün planı — Hava81';
  if (canonical(html) !== url) throw new Error('Canonical URL mismatch');
  if (pageTitle(html) !== expectedTitle) throw new Error('City title mismatch');
  const ld = structuredData(html);
  if (ld.url !== url || ld.name !== expectedTitle || ld.about?.name !== name) {
    throw new Error('JSON-LD province, title or URL mismatch');
  }
}
const provinces = [...provinceNamesBySlug.entries()];
if (provinces.length !== 81) throw new Error('Expected 81 provinces, found ' + provinces.length);
const failures = [];
let index = 0;
async function worker() {
  while (index < provinces.length) {
    const [slug, name] = provinces[index++];
    try { verifyCity(slug, name, await getText('/' + slug + '/')); }
    catch (error) { failures.push(slug + ': ' + error.message); }
  }
}
await Promise.all(Array.from({ length: 6 }, () => worker()));
try {
  if (canonical(await getText('/')) !== origin + '/') throw new Error('Homepage canonical mismatch');
} catch (error) { failures.push('homepage: ' + error.message); }
try {
  const xml = await getText('/sitemap.xml');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  const expected = new Set([origin + '/', ...provinces.map(([slug]) => origin + '/' + slug + '/')]);
  if (urls.length !== expected.size || new Set(urls).size !== expected.size ||
      urls.some(url => !expected.has(url))) {
    throw new Error('Sitemap does not contain exactly the 82 canonical URLs');
  }
} catch (error) { failures.push('sitemap: ' + error.message); }
if (failures.length) {
  console.error('Published SEO validation failed (' + failures.length + ' errors):\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Verified live SEO: 81 province pages + homepage and sitemap (82 canonical URLs).');
}
