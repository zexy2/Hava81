#!/usr/bin/env node
// Faz 4: renders one 1200×630 Open Graph card per province into public/og/<slug>.jpg,
// plus the home page card (public/hava81-social-card.png) from the same template.
// `--home-only` renders just the home card. The cards are committed (the Pages build only checks they exist), so re-run this only
// when the card design or the province list changes:
//   npx playwright install chromium && node scripts/generate-og-images.mjs
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { escapeHtml, parseProvinces } from './lib/city-pages.mjs';

const root = new URL('..', import.meta.url).pathname;
const outDir = join(root, 'public', 'og');
const provinces = parseProvinces(await readFile(join(root, 'src/constants/cities.ts'), 'utf8'));
const font = join(
  root,
  'node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-ext-wght-normal.woff2'
);
const fontLatin = join(
  root,
  'node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2'
);

const REGION_EN = {
  Marmara: 'Marmara',
  Ege: 'Aegean',
  Akdeniz: 'Mediterranean',
  'İç Anadolu': 'Central Anatolia',
  Karadeniz: 'Black Sea',
  'Doğu Anadolu': 'Eastern Anatolia',
  'Güneydoğu Anadolu': 'Southeastern Anatolia',
};

const regionLabel = region =>
  REGION_EN[region] && REGION_EN[region] !== region ? `${region} · ${REGION_EN[region]}` : region;

// Blue premium palette of the live app (navy → ocean gradient, light ink).
const card = (province, home = false) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Plex; src: url('file://${fontLatin}') format('woff2'); font-weight: 100 700; unicode-range: U+0000-00FF; }
@font-face { font-family: Plex; src: url('file://${font}') format('woff2'); font-weight: 100 700; }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; font-family: Plex, sans-serif; color: #f2f9ff;
  background: radial-gradient(ellipse at 88% -10%, rgba(63,207,232,.35), transparent 55%),
    linear-gradient(118deg, #0b264b, #10476c 62%, #116c81); overflow: hidden; position: relative; }
.grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px); background-size: 75px 75px; }
.wrap { position: absolute; inset: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 16px; font-size: 30px; font-weight: 700; letter-spacing: .02em; }
.brand b { display: inline-grid; place-items: center; width: 56px; height: 56px; border-radius: 16px;
  background: linear-gradient(140deg, #f9fdff, #d5efff); color: #123c66; font-size: 26px; }
.kicker { font-size: 26px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: #9fdcff; }
h1 { font-size: ${province.name.length > 12 ? 104 : 128}px; line-height: 1; font-weight: 700; letter-spacing: -.035em; margin-top: 14px; }
.sub { margin-top: 22px; font-size: 32px; color: #d5ebf6; }
.foot { display: flex; justify-content: space-between; align-items: flex-end; font-size: 26px; color: #bfe6ff; }
.plate { display: inline-flex; align-items: stretch; border: 3px solid #f2f9ff; border-radius: 12px; overflow: hidden;
  font-size: 44px; font-weight: 700; letter-spacing: .04em; }
.plate i { font-style: normal; background: #1f5fbf; color: #fff; font-size: 22px; padding: 10px 10px; display: grid; place-items: end center; }
.plate span { background: #f9fdff; color: #0b264b; padding: 4px 22px; }
</style></head><body><div class="grid"></div><div class="wrap">
<div class="brand"><b>81</b>Hava81</div>
${home ? `<div><p class="kicker">81 İL · 81 PROVINCES</p>
<h1 style="font-size:92px;line-height:1.04">Havayı değil,<br>gününü planla</h1>
<p class="sub">Hava durumu ve gün planı · Plan your day, not just the weather</p></div>` : `<div><p class="kicker">${escapeHtml(regionLabel(province.region))}</p>
<h1>${escapeHtml(province.name)}</h1>
<p class="sub">Hava durumu ve gün planı · Weather &amp; day plan</p></div>`}
<div class="foot"><span>hava81.zekiakgul.dev</span>
<span class="plate"><i>TR</i><span>${String(province.plateCode).padStart(2, '0')}</span></span></div>
</div></body></html>`;

const homeOnly = process.argv.includes('--home-only');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(card({ name: 'Hava81', plateCode: 81 }, true), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, 'public', 'hava81-social-card.png'), type: 'png' });
  for (const province of homeOnly ? [] : provinces) {
    await page.setContent(card(province), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: join(outDir, `${province.slug}.jpg`),
      type: 'jpeg',
      quality: 82,
    });
  }
} finally {
  await browser.close();
}
console.log(
  homeOnly
    ? 'Rendered the home OG card into public/hava81-social-card.png.'
    : `Rendered the home card and ${provinces.length} province OG cards into public/og/.`
);
