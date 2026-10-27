#!/usr/bin/env node
/* global process, fetch, AbortSignal, setTimeout, console */
// Check what GitHub Pages actually serves, not just the locally generated dist.
import { provinceNamesBySlug } from './lib/live-audit-city-catalog.mjs';
import { cityCopy } from './lib/city-pages.mjs';

const HOME_SEO = {
  tr: {
    path: '/',
    title: 'Hava81 — Havayı değil, gününü planla',
    description: "Hava81, Türkiye'nin 81 ili için hava durumunu günlük kararlara çevirir: Hava81 Skoru, hava açısından en iyi zaman, aktivite planları ve yerel hava riskleri.",
    socialDescription: "Türkiye'nin 81 ili için hava durumunu günlük kararlara çevir: Hava81 Skoru, hava açısından en iyi zaman, aktivite planları ve yerel hava riskleri.",
  },
  en: {
    path: '/en/',
    title: 'Hava81 — Plan your day, not just the weather',
    description: 'Hava81 turns the weather for all 81 provinces of Türkiye into daily decisions: Hava81 Score, best weather window, activity plans and local weather risks.',
    socialDescription: 'Turn the weather for all 81 provinces of Türkiye into daily decisions: Hava81 Score, best weather window, activity plans and local weather risks.',
  },
};

// Faz 4: every province is published in Turkish (/<il>/) and English (/en/<il>/).
const cityTitle = (name, lang) =>
  lang === 'en' ? name + ' weather and day plan — Hava81' : name + ' hava durumu ve gün planı — Hava81';
const cityPathFor = (slug, lang) => (lang === 'en' ? '/en/' + slug + '/' : '/' + slug + '/');

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
function metaContent(html, attributeName, expectedValue) {
  const matches = tags(html, 'meta').filter(tag => attribute(tag, attributeName) === expectedValue);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one meta ${attributeName}="${expectedValue}"`);
  }
  return attribute(matches[0], 'content');
}
function alternateHref(html, language) {
  const matches = tags(html, 'link').filter(
    tag => attribute(tag, 'rel') === 'alternate' && attribute(tag, 'hreflang') === language
  );
  if (matches.length !== 1) throw new Error(`Expected exactly one ${language} hreflang link`);
  return attribute(matches[0], 'href');
}
function verifyHome(lang, html) {
  const expected = HOME_SEO[lang];
  const url = origin + expected.path;
  const htmlTags = tags(html, 'html');
  if (canonical(html) !== url) throw new Error('Homepage canonical mismatch');
  if (pageTitle(html) !== expected.title) throw new Error('Homepage title mismatch');
  if (htmlTags.length !== 1 || attribute(htmlTags[0], 'lang') !== lang) {
    throw new Error('Homepage language mismatch');
  }
  if (metaContent(html, 'name', 'description') !== expected.description) {
    throw new Error('Homepage meta description mismatch');
  }
  if (metaContent(html, 'property', 'og:url') !== url ||
      metaContent(html, 'property', 'og:title') !== expected.title ||
      metaContent(html, 'property', 'og:description') !== expected.socialDescription ||
      metaContent(html, 'name', 'twitter:title') !== expected.title ||
      metaContent(html, 'name', 'twitter:description') !== expected.socialDescription) {
    throw new Error('Homepage social metadata mismatch');
  }
  if (alternateHref(html, 'tr') !== origin + '/' ||
      alternateHref(html, 'en') !== origin + '/en/' ||
      alternateHref(html, 'x-default') !== origin + '/') {
    throw new Error('Homepage hreflang mismatch');
  }
  const homeImage = origin + '/hava81-social-card.png?v=20261022';
  if (metaContent(html, 'property', 'og:image') !== homeImage ||
      metaContent(html, 'property', 'og:image:type') !== 'image/png' ||
      metaContent(html, 'property', 'og:image:width') !== '1200' ||
      metaContent(html, 'property', 'og:image:height') !== '630' ||
      metaContent(html, 'property', 'og:image:alt') !== expected.title ||
      metaContent(html, 'name', 'twitter:card') !== 'summary_large_image' ||
      metaContent(html, 'name', 'twitter:image') !== homeImage ||
      metaContent(html, 'name', 'twitter:image:alt') !== expected.title) {
    throw new Error('Homepage social image metadata mismatch');
  }
  const ld = structuredData(html);
  if (ld['@type'] !== 'WebSite' || ld.name !== 'Hava81' || ld.url !== url ||
      ld.inLanguage !== lang || ld.description !== expected.description) {
    throw new Error('Homepage JSON-LD mismatch');
  }
}
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
function verifyCity(slug, name, lang, html) {
  const url = origin + cityPathFor(slug, lang);
  const trUrl = origin + cityPathFor(slug, 'tr');
  const enUrl = origin + cityPathFor(slug, 'en');
  const expectedTitle = cityTitle(name, lang);
  const copy = cityCopy({ name, region: '' }, lang);
  const image = origin + '/og/' + slug + '.jpg';
  const htmlTags = tags(html, 'html');
  if (canonical(html) !== url) throw new Error('Canonical URL mismatch');
  if (pageTitle(html) !== expectedTitle) throw new Error('City title mismatch');
  if (htmlTags.length !== 1 || attribute(htmlTags[0], 'lang') !== lang) {
    throw new Error('City language mismatch');
  }
  if (metaContent(html, 'name', 'description') !== copy.description) {
    throw new Error('City meta description mismatch');
  }
  if (metaContent(html, 'property', 'og:url') !== url ||
      metaContent(html, 'property', 'og:title') !== expectedTitle ||
      metaContent(html, 'property', 'og:description') !== copy.description ||
      metaContent(html, 'name', 'twitter:title') !== expectedTitle ||
      metaContent(html, 'name', 'twitter:description') !== copy.description) {
    throw new Error('City social metadata mismatch');
  }
  if (metaContent(html, 'property', 'og:image') !== image ||
      metaContent(html, 'property', 'og:image:type') !== 'image/jpeg' ||
      metaContent(html, 'property', 'og:image:width') !== '1200' ||
      metaContent(html, 'property', 'og:image:height') !== '630' ||
      metaContent(html, 'property', 'og:image:alt') !== expectedTitle ||
      metaContent(html, 'name', 'twitter:card') !== 'summary_large_image' ||
      metaContent(html, 'name', 'twitter:image') !== image ||
      metaContent(html, 'name', 'twitter:image:alt') !== expectedTitle) {
    throw new Error('City social image metadata mismatch');
  }
  if (alternateHref(html, 'tr') !== trUrl ||
      alternateHref(html, 'en') !== enUrl ||
      alternateHref(html, 'x-default') !== trUrl) {
    throw new Error('City hreflang mismatch');
  }
  const ld = structuredData(html);
  const homeUrl = origin + (lang === 'en' ? '/en/' : '/');
  if (ld['@type'] !== 'WebPage' || ld.url !== url || ld.name !== expectedTitle ||
      ld.description !== copy.description || ld.about?.name !== name ||
      ld.inLanguage !== lang || ld.isPartOf?.url !== homeUrl) {
    throw new Error('JSON-LD province, title, description, language or URL mismatch');
  }
}
const provinces = [...provinceNamesBySlug.entries()];
if (provinces.length !== 81) throw new Error('Expected 81 provinces, found ' + provinces.length);
const failures = [];
const jobs = provinces.flatMap(([slug, name]) => ['tr', 'en'].map(lang => [slug, name, lang]));
let index = 0;
async function worker() {
  while (index < jobs.length) {
    const [slug, name, lang] = jobs[index++];
    const path = cityPathFor(slug, lang);
    try { verifyCity(slug, name, lang, await getText(path)); }
    catch (error) { failures.push(path + ': ' + error.message); }
  }
}
await Promise.all(Array.from({ length: 6 }, () => worker()));
for (const lang of ['tr', 'en']) {
  const path = HOME_SEO[lang].path;
  try { verifyHome(lang, await getText(path)); }
  catch (error) { failures.push((path === '/' ? 'homepage' : path) + ': ' + error.message); }
}
try {
  const xml = await getText('/sitemap.xml');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  const expected = new Set([
    origin + '/',
    origin + '/en/',
    ...jobs.map(([slug, , lang]) => origin + cityPathFor(slug, lang)),
  ]);
  if (urls.length !== expected.size || new Set(urls).size !== expected.size ||
      urls.some(url => !expected.has(url))) {
    throw new Error('Sitemap does not contain exactly the ' + expected.size + ' canonical URLs');
  }
} catch (error) { failures.push('sitemap: ' + error.message); }
if (failures.length) {
  console.error('Published SEO validation failed (' + failures.length + ' errors):\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Verified live SEO: 81 province pages in TR + EN, both homepages and sitemap (164 canonical URLs).');
}
