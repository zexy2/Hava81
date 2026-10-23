const CRITICAL_FONT_ASSETS = [
  {
    name: 'IBM Plex Sans Latin',
    pattern: /^ibm-plex-sans-latin-wght-normal-[A-Za-z0-9_-]+\.woff2$/,
  },
  {
    name: 'IBM Plex Sans Latin Extended',
    pattern: /^ibm-plex-sans-latin-ext-wght-normal-[A-Za-z0-9_-]+\.woff2$/,
  },
];

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Resolve hashed, build-output font assets to deterministic early preload tags. */
export function buildCriticalFontPreloads(assetNames) {
  const names = [...assetNames];
  return CRITICAL_FONT_ASSETS.map(({ name, pattern }) => {
    const matches = names.filter(asset => pattern.test(asset));
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one ${name} asset, found ${matches.length}`);
    }
    return `<link rel="preload" href="/assets/${matches[0]}" as="font" type="font/woff2" crossorigin />`;
  });
}

/** Insert preloads before the module entry so font discovery can overlap app boot. */
export function injectCriticalFontPreloads(html, assetNames) {
  if (!/<\/head\s*>/i.test(html)) throw new Error('HTML document has no </head>');
  const links = buildCriticalFontPreloads(assetNames);
  const missing = links.filter(link => {
    const href = link.match(/href="([^"]+)"/)?.[1];
    if (!href) return true;
    const escapedHref = escapeRegExp(href);
    const existingPreload = new RegExp(
      `<link\\b(?=[^>]*\\brel=["']preload["'])(?=[^>]*\\bhref=["']${escapedHref}["'])[^>]*>`,
      'i'
    );
    return !existingPreload.test(html);
  });
  if (missing.length === 0) return html;
  const insertion = `${missing.join('\n    ')}\n    `;
  const moduleScript = /<script\s+type=["']module["'][^>]*>/i;
  if (moduleScript.test(html)) return html.replace(moduleScript, `${insertion}$&`);
  return html.replace(/<\/head\s*>/i, `${insertion}</head>`);
}
