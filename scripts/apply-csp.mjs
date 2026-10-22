#!/usr/bin/env node
/**
 * Adds a Content-Security-Policy <meta http-equiv> to every generated HTML page
 * in dist/ (plan 3.8). GitHub Pages cannot send custom response headers, but a
 * CSP delivered by <meta> is enforced by browsers (except frame-ancestors,
 * report-uri and sandbox, which only work as real headers).
 *
 * Origins (keep in sync when adding a third-party request):
 * - connect-src: the API (https://api.hava81.zekiakgul.dev, or the origin of
 *   VITE_API_BASE_URL when it is absolute). Relative /api/v1 stays 'self'.
 * - img-src: OpenStreetMap raster tiles used by the map (src/components/WeatherMap.tsx),
 *   data:/blob: for inline SVG backgrounds and generated share images.
 * - script-src: bundled modules from 'self' plus the per-page sha256 of each
 *   inline bootstrap script that scripts/lib/city-pages.mjs writes into the
 *   province pages. JSON-LD data blocks are not executed and need no hash.
 * - style-src: 'unsafe-inline' because the static province summary and
 *   Leaflet use style attributes. Fonts are self-hosted (@fontsource).
 *
 * Usage: node scripts/apply-csp.mjs [distDir]
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_API_ORIGIN = 'https://api.hava81.zekiakgul.dev';
export const MAP_TILE_ORIGINS = ['https://a.tile.openstreetmap.fr', 'https://a.tile.openstreetmap.de'];
const CSP_META_PATTERN = /\s*<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/gi;
const SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script[^>]*>/gi;
const NON_EXECUTABLE_TYPE = /\btype\s*=\s*["']?(?!module\b|text\/javascript\b|application\/javascript\b)[^"'\s>]+/i;

/** Returns the absolute API origin, or null for relative (same-origin) bases. */
export function apiOriginFrom(apiBaseUrl) {
  if (!apiBaseUrl || !/^https?:\/\//i.test(apiBaseUrl.trim())) return null;
  try {
    return new URL(apiBaseUrl.trim()).origin;
  } catch {
    return null;
  }
}

/** sha256 CSP sources for inline, executable scripts (no src, not a data block). */
export function inlineScriptHashes(html) {
  const hashes = [];
  for (const [, attributes, body] of html.matchAll(SCRIPT_PATTERN)) {
    if (/\bsrc\s*=/i.test(attributes)) continue;
    if (NON_EXECUTABLE_TYPE.test(attributes)) continue;
    if (body.trim() === '') continue;
    const digest = createHash('sha256').update(body, 'utf8').digest('base64');
    const source = `'sha256-${digest}'`;
    if (!hashes.includes(source)) hashes.push(source);
  }
  return hashes;
}

export function buildCsp({ scriptHashes = [], apiOrigin = null } = {}) {
  const connect = ["'self'", DEFAULT_API_ORIGIN];
  if (apiOrigin && !connect.includes(apiOrigin)) connect.push(apiOrigin);
  const directives = [
    ["default-src", ["'self'"]],
    ['script-src', ["'self'", ...scriptHashes]],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:', ...MAP_TILE_ORIGINS]],
    ['font-src', ["'self'", 'data:']],
    ['connect-src', connect],
    ['manifest-src', ["'self'"]],
    ['worker-src', ["'self'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
  ];
  return directives.map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}

/** Inserts (or replaces) the CSP meta right after <meta charset>, before any script. */
export function applyCspToHtml(html, { apiOrigin = null } = {}) {
  const withoutOld = html.replace(CSP_META_PATTERN, '');
  const csp = buildCsp({ scriptHashes: inlineScriptHashes(withoutOld), apiOrigin });
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
  const charset = /<meta\s+charset=["']?[^"'>\s]+["']?\s*\/?>/i;
  if (charset.test(withoutOld)) {
    return withoutOld.replace(charset, match => `${match}\n    ${meta}`);
  }
  if (/<head[^>]*>/i.test(withoutOld)) {
    return withoutOld.replace(/<head[^>]*>/i, match => `${match}\n    ${meta}`);
  }
  throw new Error('HTML document has no <head>; cannot apply CSP');
}

async function listHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return listHtmlFiles(path);
      return entry.name.endsWith('.html') ? [path] : [];
    })
  );
  return files.flat();
}

export async function applyCspToDist(distDir, { apiBaseUrl = process.env.VITE_API_BASE_URL } = {}) {
  const apiOrigin = apiOriginFrom(apiBaseUrl);
  const files = await listHtmlFiles(distDir);
  if (files.length === 0) throw new Error(`No HTML files found in ${distDir}`);
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    await writeFile(file, applyCspToHtml(html, { apiOrigin }));
  }
  return files.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const distDir = resolve(process.argv[2] ?? 'dist');
  const count = await applyCspToDist(distDir);
  console.log(`[csp] Content-Security-Policy meta applied to ${count} HTML files.`);
}
