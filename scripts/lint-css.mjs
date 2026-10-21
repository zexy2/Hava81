#!/usr/bin/env node
/**
 * CSS lint (Faz 2.1): tasarım değerleri yalnız src/styles/tokens.css'ten gelsin.
 *
 * Kurallar (tokens.css hariç tüm src/**\/*.css):
 *   color-no-hex       Ham hex renk (#fff, #1765d8, #0000) yasak. Rengi tokens.css'te tanımla, var() ile kullan.
 *   radius-allowed     border-radius yalnız var(--radius-*), 0, 50%, 999px/9999px (hap), inherit olabilir.
 *   breakpoint-allowed @media genişlik/yükseklik değerleri yalnız BREAKPOINTS listesindekiler olabilir.
 *
 * Mevcut ihlaller bir "temel çizgi" dosyasında (scripts/css-lint-baseline.json) dosya + değer
 * bazında kayıtlıdır; bunlar kademeli olarak tokenlara taşınacak eski değerlerdir. Temel çizgide
 * olmayan YENİ bir ham değer lint'i kırar. Bir eski değer kaldırılınca temel çizgiyi daraltmak için:
 *
 *   npm run lint:css -- --update-baseline
 *
 * (--update-baseline yalnız mevcut kayıtları daraltır; yeni ihlali temel çizgiye eklemez.
 *  Bilinçli yeni istisna için --allow-new ile birlikte çalıştır ve PR'da gerekçesini yaz.)
 *
 * Not: Stylelint, CI'daki `npm audit --audit-level=high` adımını kıran ve düzeltmesi olmayan
 * bir bağımlılık zinciri (micromatch → braces) getirdiği için şimdilik postcss ile yazıldı.
 * Kural adları stylelint karşılıklarına (color-no-hex, declaration-property-value-allowed-list,
 * media-feature-name-value-allowed-list) denk düşer; geçiş yapılırsa temel çizgi korunabilir.
 */
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASELINE_PATH = join(ROOT, 'scripts', 'css-lint-baseline.json');
const SRC = join(ROOT, 'src');

/** Ham değerlerin serbest olduğu dosyalar. */
const EXEMPT_FILES = new Set(['src/styles/tokens.css']);

/**
 * İzinli breakpoint'ler. Ölçek: 24rem (dar telefon), 40rem, 48rem (tablet), 64rem (masaüstü), 80rem.
 * max-width tarafında aynı sınırın 0.01rem eksiği kullanılır (ör. 47.99rem), çakışma olmasın diye.
 * max-height: 28rem yatay telefon (kısa ekran) içindir.
 */
const BREAKPOINT_SCALE = ['24rem', '40rem', '48rem', '64rem', '80rem'];
const BREAKPOINTS = {
  'min-width': BREAKPOINT_SCALE,
  'max-width': [...BREAKPOINT_SCALE.map(v => `${(parseFloat(v) - 0.01).toFixed(2)}rem`), '24rem'],
  'max-height': ['28rem'],
};

const RADIUS_PROPS = /^border(-(top|bottom|start|end)-(left|right|start|end))?-radius$/;
const RADIUS_OK = /^(0|50%|999px|9999px|inherit|initial|unset|var\(--radius-[\w-]+(,\s*[^)]*)?\))$/;
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const MEDIA_FEATURE = /\(\s*((?:min|max)-(?:width|height))\s*:\s*([^)]+?)\s*\)/g;

function listCss(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : listCss(path);
    return name.endsWith('.css') ? [path] : [];
  });
}

/** Ana değişkenlerini temizleyip boşlukla ayrılmış parçaları döndürür (var(--x, 4px) bir parça sayılır). */
function radiusParts(value) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of value.replace(/\s*\/\s*/g, ' ')) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (current) parts.push(current);
      current = '';
    } else current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

function lintFile(path) {
  const file = relative(ROOT, path).split(sep).join('/');
  const found = [];
  const root = postcss.parse(readFileSync(path, 'utf8'), { from: path });
  root.walkDecls(decl => {
    // Yorumlar ve url(data:...) içindeki %23 kodlu renkler kapsam dışı; url(#id) hex değildir.
    const value = decl.value.replace(/url\([^)]*\)/g, 'url()');
    for (const m of value.matchAll(HEX))
      found.push({ rule: 'color-no-hex', value: m[0].toLowerCase(), line: decl.source.start.line });
    if (RADIUS_PROPS.test(decl.prop)) {
      for (const part of radiusParts(decl.value)) {
        if (!RADIUS_OK.test(part))
          found.push({ rule: 'radius-allowed', value: part, line: decl.source.start.line });
      }
    }
  });
  root.walkAtRules('media', rule => {
    for (const m of rule.params.matchAll(MEDIA_FEATURE)) {
      const [, feature, value] = m;
      if (!(BREAKPOINTS[feature] ?? []).includes(value)) {
        found.push({
          rule: 'breakpoint-allowed',
          value: `(${feature}: ${value})`,
          line: rule.source.start.line,
        });
      }
    }
    // Aralık sözdizimi (width >= 48rem) de aynı ölçeğe bağlı.
    for (const m of rule.params.matchAll(/\b(width|height)\s*(<=?|>=?)\s*([\d.]+[a-z%]+)/g)) {
      const allowed =
        m[1] === 'width'
          ? [...BREAKPOINTS['min-width'], ...BREAKPOINTS['max-width']]
          : BREAKPOINTS['max-height'];
      if (!allowed.includes(m[3]))
        found.push({ rule: 'breakpoint-allowed', value: m[0], line: rule.source.start.line });
    }
  });
  return { file, found };
}

const args = new Set(process.argv.slice(2));
const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const results = listCss(SRC)
  .map(lintFile)
  .filter(r => !EXEMPT_FILES.has(r.file));

const errors = [];
const stale = [];
const next = {};
for (const { file, found } of results) {
  const counts = {};
  for (const f of found) {
    const key = `${f.rule} ${f.value}`;
    (counts[key] ||= []).push(f.line);
  }
  const allowed = baseline.files?.[file] ?? {};
  for (const [key, lines] of Object.entries(counts)) {
    const limit = allowed[key] ?? 0;
    if (lines.length > limit) {
      errors.push(
        `${file}:${lines[limit]}  ${key}  (${lines.length} kullanım, temel çizgide ${limit})`
      );
    }
    const keep = args.has('--allow-new') ? lines.length : Math.min(lines.length, limit);
    if (keep) (next[file] ||= {})[key] = keep;
  }
  for (const [key, limit] of Object.entries(allowed)) {
    const used = counts[key]?.length ?? 0;
    if (used < limit) stale.push(`${file}  ${key}  (temel çizgi ${limit}, kullanım ${used})`);
  }
}

if (args.has('--update-baseline')) {
  const sorted = Object.fromEntries(
    Object.keys(next)
      .sort()
      .map(f => [f, Object.fromEntries(Object.entries(next[f]).sort())])
  );
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ ...baseline, files: sorted }, null, 2)}\n`);
  const total = Object.values(next).reduce(
    (sum, f) => sum + Object.values(f).reduce((a, b) => a + b, 0),
    0
  );
  console.log(`css-lint: temel çizgi güncellendi (${total} eski ihlal kayıtlı).`);
  if (!args.has('--allow-new') && errors.length) process.exitCode = 1;
} else if (stale.length) {
  console.log(
    `css-lint: ${stale.length} temel çizgi kaydı artık fazla; "npm run lint:css -- --update-baseline" ile daralt:`
  );
  for (const s of stale.slice(0, 20)) console.log(`  ${s}`);
}

if (errors.length && !args.has('--allow-new')) {
  console.error(`css-lint: ${errors.length} yeni ihlal (tokens.css'teki tokenları kullan):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exitCode = 1;
} else if (!args.has('--update-baseline')) {
  console.log(`css-lint: ${results.length} dosya temiz (yeni ham renk/radius/breakpoint yok).`);
}
