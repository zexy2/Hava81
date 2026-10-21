import postcss from 'postcss';
import tokens from '../../styles/tokens.css?inline';

/**
 * Real-cascade style helpers for jsdom (Faz 3.4).
 *
 * Stylesheets are imported with Vite's `?inline` suffix and mounted as `<style>` elements, so
 * tests read the browser-computed value through `getComputedStyle` instead of matching the
 * source text. jsdom's cascade has a few gaps that are emulated here:
 *
 * - it ignores rules inside `@layer` blocks → the layer wrappers are unwrapped in source order
 *   (tokens.css is always mounted first, matching the declared layer order);
 * - it does not evaluate `@media` → each query is evaluated against `viewport` (default
 *   1280×800, screen) and the requested `features` (e.g. reduced motion); matching blocks are
 *   unwrapped, the rest dropped;
 * - it never matches `:hover` / `:active` / `:focus-visible` → states listed in `force` are
 *   stripped from selectors, like Playwright's forced element states;
 * - it does not substitute `var()` → `computed()` resolves custom properties on the element
 *   and its ancestors.
 */
export interface MountOptions {
  viewport?: { width: number; height: number };
  /** Media features that match, e.g. `{ 'prefers-reduced-motion': 'reduce' }`. */
  features?: Record<string, string>;
  force?: string[];
}

export const MOBILE = { width: 390, height: 844 };
export const NARROW = { width: 320, height: 640 };
export const TABLET = { width: 768, height: 1024 };
export const DESKTOP = { width: 1280, height: 800 };
export const REDUCED_MOTION = { 'prefers-reduced-motion': 'reduce' };

const toPx = (value: string): number => {
  const number = Number.parseFloat(value);
  return value.trim().endsWith('rem') || value.trim().endsWith('em') ? number * 16 : number;
};

/** Evaluates a media query list (`,` = or, `and` = and) for the emulated environment. */
export function matchesMedia(
  query: string,
  { viewport = DESKTOP, features = {} }: Pick<MountOptions, 'viewport' | 'features'> = {}
): boolean {
  return query.split(',').some(part =>
    part
      .trim()
      .split(/\s+and\s+/)
      .every(term => {
        const condition = term.trim();
        if (condition === 'screen' || condition === 'all') return true;
        if (condition === 'print') return false;
        const match = condition.match(/^\(\s*([\w-]+)\s*(?::\s*([^)]+))?\)$/);
        if (!match) return false;
        const [, name, rawValue = ''] = match;
        const value = rawValue.trim();
        switch (name) {
          case 'min-width':
            return viewport.width >= toPx(value);
          case 'max-width':
            return viewport.width <= toPx(value);
          case 'min-height':
            return viewport.height >= toPx(value);
          case 'max-height':
            return viewport.height <= toPx(value);
          case 'orientation':
            return (viewport.width > viewport.height ? 'landscape' : 'portrait') === value;
          case 'pointer':
            return (features.pointer ?? 'fine') === value;
          default:
            return features[name] === value;
        }
      })
  );
}

export function prepareCss(css: string, options: MountOptions = {}): string {
  const { force = [] } = options;
  const root = postcss.parse(css);
  let changed = true;
  while (changed) {
    changed = false;
    root.walkAtRules(rule => {
      if (rule.name === 'layer' || (rule.name === 'media' && matchesMedia(rule.params, options))) {
        if (rule.nodes?.length) rule.replaceWith(rule.nodes);
        else rule.remove();
        changed = true;
      } else if (rule.name === 'media' || rule.name === 'keyframes' || rule.name === 'import') {
        rule.remove();
        changed = true;
      }
    });
  }
  if (force.length) {
    root.walkRules(rule => {
      rule.selectors = rule.selectors.map(selector =>
        force.reduce((current, state) => current.split(state).join(''), selector)
      );
    });
  }
  return root.toString();
}

const mounted: HTMLStyleElement[] = [];

/** Mounts tokens.css plus the given stylesheets (in order). Returns an unmount function. */
export function mountStyles(sheets: string[], options: MountOptions = {}): () => void {
  unmountStyles();
  for (const css of [tokens, ...sheets]) {
    const style = document.createElement('style');
    style.textContent = prepareCss(css, options);
    document.head.appendChild(style);
    mounted.push(style);
  }
  return unmountStyles;
}

export function unmountStyles(): void {
  while (mounted.length) mounted.pop()?.remove();
}

/** Renders static markup into the document body. */
export function markup(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

export function el(selector: string, root: ParentNode = document): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`No element for ${selector}`);
  return found;
}

function customProperty(element: Element, name: string): string {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const value = getComputedStyle(node).getPropertyValue(name).trim();
    if (value) return value;
  }
  return '';
}

/** Resolves `var(--x, fallback)` against the element and its ancestors. */
export function resolveVars(element: Element, value: string, depth = 0): string {
  if (depth > 10 || !value.includes('var(')) return value;
  const resolved = value.replace(
    /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g,
    (_match, name: string, fallback?: string) =>
      customProperty(element, name) || (fallback ?? '').trim()
  );
  return resolveVars(element, resolved, depth + 1);
}

/** Browser-computed value of `property` with custom properties substituted. */
export function computed(element: Element, property: string): string {
  const style = getComputedStyle(element);
  const raw = property.startsWith('--')
    ? customProperty(element, property)
    : style.getPropertyValue(property);
  return resolveVars(element, raw.trim());
}

/** Computed font size in CSS pixels (1rem = 16px in jsdom). */
export function fontSizePx(element: Element): number {
  return Number.parseFloat(computed(element, 'font-size'));
}

/** 13px = 0.8125rem: the functional-copy floor used across the product. */
export const FUNCTIONAL_COPY_FLOOR_PX = 13;

const hexToRgb = (value: string): [number, number, number] => {
  const hex = value.replace('#', '');
  const full = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex.slice(0, 6);
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Parses `#rgb`, `#rrggbb`, `rgb()` and `rgba()` (alpha ignored). */
export function parseColor(value: string): [number, number, number] {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'white') return [255, 255, 255];
  if (trimmed.startsWith('#')) return hexToRgb(trimmed);
  const match = trimmed.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (!match) throw new Error(`Unsupported colour: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

const luminance = ([r, g, b]: [number, number, number]) => {
  const [lr, lg, lb] = [r, g, b].map(channel => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

/** WCAG contrast ratio between two colours. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(parseColor(a)), luminance(parseColor(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
