#!/usr/bin/env node

import { buildServiceWorkerCacheId } from './lib/service-worker-stamp.mjs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const distDir = new URL('../dist/', import.meta.url);
const swUrl = new URL('sw.js', distDir);
const indexUrl = new URL('index.html', distDir);
const manifestUrl = new URL('manifest.json', distDir);
const assetsUrl = new URL('assets/', distDir);
const placeholder = '__HAVA81_BUILD_ID__';

const [indexHtml, manifest, assetFiles, swSource] = await Promise.all([
  readFile(indexUrl),
  readFile(manifestUrl),
  readdir(assetsUrl),
  readFile(swUrl, 'utf8'),
]);

if (!swSource.includes(placeholder)) {
  throw new Error(`Service worker cache placeholder ${placeholder} is missing`);
}

const buildId = buildServiceWorkerCacheId({ indexHtml, manifest, assetFiles, swSource });

const stamped = swSource.replaceAll(placeholder, buildId);
if (stamped.includes(placeholder)) {
  throw new Error('Service worker cache placeholder remained after stamping');
}

await writeFile(swUrl, stamped);
console.log(`[sw] cache namespace hava81-shell-${buildId}`);
