#!/usr/bin/env node
/** Read-only deploy drift diagnosis; never runs as a blocking CI gate. */
import { readFile } from 'node:fs/promises';

export function shellAssets(html) {
  const assets = new Set();
  for (const tag of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const raw = tag[0];
    const ref = raw.match(/\b(?:src|href)=["\']([^"\']+)["\']/i)?.[1];
    if (ref && /(?:^|\/)assets\/[^?#]+\.(?:js|css)(?:[?#]|$)/.test(ref)) assets.add(new URL(ref, 'https://placeholder.invalid/').pathname);
  }
  return [...assets].sort();
}

export function compareShells(localHtml, liveHtml) {
  const local = shellAssets(localHtml);
  const live = shellAssets(liveHtml);
  return { matches: JSON.stringify(local) === JSON.stringify(live), local, live };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const origin = process.env.HAVA81_AUDIT_BASE_URL || 'https://hava81.zekiakgul.dev';
  const localHtml = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const url = new URL('/istanbul/', origin);
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`Live shell HTTP ${response.status}`);
  const comparison = compareShells(localHtml, await response.text());
  console.log(JSON.stringify({ url: url.toString(), ...comparison }, null, 2));
  if (!comparison.matches) process.exitCode = 1;
}
