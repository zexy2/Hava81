import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Behaviour assertions for responsive layout.
 *
 * These deliberately avoid exact pixels, radii, borders or row counts. They
 * answer user-facing questions instead: can I read it (nothing clipped), can
 * I reach it (in the viewport, not covered), does the page scroll sideways,
 * does decoration cover content, is focus visible. Exact look is covered by
 * the few `@visual` screenshot comparisons in visual.spec.ts.
 */

export const WIDTHS = { tiny: 320, phone: 390, tablet: 768, laptop: 1024, desktop: 1280 } as const;

/** Simulates browser/system text zoom (WCAG 1.4.4 Resize Text) by scaling the root font size. */
export async function setTextScale(page: Page, percent: 100 | 200) {
  await page.evaluate(
    value => {
      document.documentElement.style.fontSize = value;
    },
    percent === 100 ? '' : `${percent}%`
  );
}

export async function setWidth(page: Page, width: number, height = 900) {
  await page.setViewportSize({ width, height });
}

/** The document never scrolls horizontally (WCAG 1.4.10 Reflow). */
export async function expectNoHorizontalScroll(page: Page, context = '') {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${context} page must not scroll horizontally`.trim()).toBeLessThanOrEqual(
    clientWidth
  );
}

/**
 * Lists text inside `root` that is cut off: a block that holds text (directly
 * or through inline children) whose content is wider than its box, or taller
 * than a box that hides overflow. Intentional scroll rails, form fields,
 * visually hidden helpers and SVG art are ignored.
 */
export async function findClippedText(root: Locator, ignore = ''): Promise<string[]> {
  return root.evaluate((element, ignoreSelector) => {
    const clipped: string[] = [];
    const isScrollable = (style: CSSStyleDeclaration) =>
      ['auto', 'scroll'].includes(style.overflowX) || ['auto', 'scroll'].includes(style.overflowY);
    const describe = (node: HTMLElement) =>
      `${node.tagName.toLowerCase()}${node.className && typeof node.className === 'string' ? `.${node.className.trim().split(/\s+/).join('.')}` : ''} "${(node.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;

    const candidates = [element, ...Array.from(element.querySelectorAll('*'))];
    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) continue;
      if (
        ['INPUT', 'SELECT', 'TEXTAREA', 'OPTION', 'SCRIPT', 'STYLE', 'svg'].includes(
          candidate.tagName
        )
      )
        continue;
      const style = getComputedStyle(candidate);
      // checkVisibility() also skips content of closed <details> (content-visibility: hidden).
      if (
        !candidate.checkVisibility({ visibilityProperty: true }) ||
        style.display.startsWith('inline')
      )
        continue;
      if (style.position === 'absolute' && style.clip !== 'auto' && style.clip !== '') continue;
      const rect = candidate.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue; // visually hidden helpers
      if (candidate.closest('[aria-hidden="true"]')) continue;
      if (ignoreSelector && candidate.matches(ignoreSelector)) continue;
      if (isScrollable(style)) continue;
      const nodes = Array.from(candidate.childNodes);
      const holdsText =
        nodes.some(
          node => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== ''
        ) ||
        (candidate.children.length > 0 &&
          (candidate.textContent ?? '').trim() !== '' &&
          Array.from(candidate.children).every(child =>
            getComputedStyle(child).display.startsWith('inline')
          ));
      if (!holdsText) continue;
      const hidesOverflowY = ['hidden', 'clip'].includes(style.overflowY);
      if (candidate.scrollWidth > candidate.clientWidth + 1)
        clipped.push(`${describe(candidate)} (yatay)`);
      else if (hidesOverflowY && candidate.scrollHeight > candidate.clientHeight + 1) {
        clipped.push(`${describe(candidate)} (dikey)`);
      }
    }
    return clipped;
  }, ignore);
}

/**
 * Every text in `root` is fully readable (not clipped, not overflowing its box).
 * `ignore` is a selector for known, documented gaps (see docs/IYILESTIRME_PLANI.md 3.x).
 */
export async function expectTextNotClipped(root: Locator, context = '', ignore = '') {
  expect(await findClippedText(root, ignore), `${context} clipped text`.trim()).toEqual([]);
}

/** The element is horizontally inside the viewport (nothing cut off at the screen edge). */
export async function expectWithinViewportWidth(locator: Locator, context = '') {
  const box = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewport: document.documentElement.clientWidth };
  });
  expect(box.left, `${context} starts inside the viewport`.trim()).toBeGreaterThanOrEqual(-1);
  expect(box.right, `${context} ends inside the viewport`.trim()).toBeLessThanOrEqual(
    box.viewport + 1
  );
}

/**
 * The region is readable: visible, inside the viewport width, no clipped text,
 * no horizontal page scroll. This is the core 200% text-size check.
 */
export async function expectReadable(page: Page, region: Locator, context = '', ignore = '') {
  await region.scrollIntoViewIfNeeded();
  await expect(region, `${context} visible`.trim()).toBeVisible();
  await expectWithinViewportWidth(region, context);
  await expectTextNotClipped(region, context, ignore);
  await expectNoHorizontalScroll(page, context);
}

/** `inner` is contained by `outer` (e.g. a score stays inside its card). `axis: 'x'` for scrolling containers. */
export async function expectContainedIn(
  inner: Locator,
  outer: Locator,
  context = '',
  axis: 'both' | 'x' = 'both'
) {
  const [innerHandle, outerHandle] = await Promise.all([
    inner.elementHandle(),
    outer.elementHandle(),
  ]);
  expect(innerHandle, `${context} inner box`).not.toBeNull();
  expect(outerHandle, `${context} outer box`).not.toBeNull();
  if (!innerHandle || !outerHandle) return;

  // Read both DOMRects in one browser task. Separate boundingBox() calls can
  // straddle resize/text-reflow scroll anchoring and compare different frames.
  const { a, b } = await inner.evaluate((element, outerElement) => {
    const toBox = (rect: DOMRect) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
    return {
      a: toBox(element.getBoundingClientRect()),
      b: toBox((outerElement as Element).getBoundingClientRect()),
    };
  }, outerHandle);
  const insideX = a.x >= b.x - 1 && a.x + a.width <= b.x + b.width + 1;
  const insideY = a.y >= b.y - 1 && a.y + a.height <= b.y + b.height + 1;
  const contained = axis === 'x' ? insideX : insideX && insideY;
  const boxes = `inner=${JSON.stringify(a)} outer=${JSON.stringify(b)}`;
  expect(contained, `${context} must stay inside its container (${boxes})`.trim()).toBe(true);
}

/** Two visible elements do not cover each other (decoration never hides content). */
export async function expectNoOverlap(a: Locator, b: Locator, context = '') {
  const [first, second] = await Promise.all([a.boundingBox(), b.boundingBox()]);
  if (!first || !second) return; // one of them is not rendered: nothing can overlap
  const width =
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
  const height =
    Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y);
  expect(
    Math.max(0, width) * Math.max(0, height),
    `${context} must not overlap`.trim()
  ).toBeLessThanOrEqual(1);
}

/** The element is what a pointer actually hits at its centre (not covered by another layer). */
export async function expectReachable(locator: Locator, context = '') {
  await expect
    .poll(
      () =>
        locator.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          );
          return hit === element || element.contains(hit);
        }),
      { message: `${context} must be reachable by pointer`.trim() }
    )
    .toBe(true);
}

/** WCAG 2.5.5 target size: interactive controls are at least 44×44 CSS px. */
export async function expectTouchTarget(locator: Locator, context = '') {
  const box = await locator.boundingBox();
  expect(box, `${context} rendered`).not.toBeNull();
  expect(box!.width, `${context} target width`.trim()).toBeGreaterThanOrEqual(44);
  expect(box!.height, `${context} target height`.trim()).toBeGreaterThanOrEqual(44);
}

/** Visible, interactive controls inside `root` that are smaller than 44×44. */
export async function findUndersizedTargets(root: Locator) {
  return root
    .locator('button, a, input, select, textarea, summary, [role="button"]')
    .evaluateAll(elements =>
      elements
        .map(element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            label:
              element.getAttribute('aria-label') ||
              element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60) ||
              element.tagName,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            visible:
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden',
          };
        })
        .filter(target => target.visible && (target.width < 44 || target.height < 44))
        .map(({ label, width, height }) => `${label} (${width}×${height})`)
    );
}

/**
 * Keyboard focus is visible: a real outline of at least 2px. With
 * `insideClippingRail`, the ring must be drawn inward so a scroll rail or
 * clipped card cannot cut it off.
 */
export async function expectVisibleFocusRing(
  locator: Locator,
  options: { insideClippingRail?: boolean } = {}
) {
  // A key press switches the browser to keyboard modality so :focus-visible applies.
  await locator.page().keyboard.press('Shift');
  await locator.focus();
  await expect(locator).toBeFocused();
  const ring = await locator.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      offset: Number.parseFloat(style.outlineOffset),
    };
  });
  expect(ring.style, 'focus outline style').not.toBe('none');
  expect(ring.width, 'focus outline width').toBeGreaterThanOrEqual(2);
  if (options.insideClippingRail)
    expect(ring.offset, 'focus outline drawn inward').toBeLessThanOrEqual(0);
}

/**
 * In forced-colors mode the selected control must stay distinguishable from
 * an unselected sibling through an underline, outline or border change.
 */
export async function expectSelectedStateDistinct(
  selected: Locator,
  unselected: Locator,
  context = ''
) {
  const read = (locator: Locator) =>
    locator.evaluate(element => {
      const style = getComputedStyle(element);
      return {
        forced: matchMedia('(forced-colors: active)').matches,
        decoration: style.textDecorationLine,
        outline:
          style.outlineStyle === 'none' ? 'none' : `${style.outlineStyle} ${style.outlineWidth}`,
        border: style.borderColor,
        background: style.backgroundColor,
      };
    });
  await expect(selected).toBeVisible();
  await expect(unselected).toBeVisible();
  // Poll: state styles can settle a frame after the attribute flips (transitions).
  await expect
    .poll(
      async () => {
        const [a, b] = await Promise.all([read(selected), read(unselected)]);
        if (!a.forced) return 'forced colors not emulated';
        const distinct =
          (a.decoration.includes('underline') && !b.decoration.includes('underline')) ||
          a.outline !== b.outline ||
          a.border !== b.border ||
          a.background !== b.background;
        return distinct ? 'distinct' : `same: ${JSON.stringify(a)}`;
      },
      { message: `${context} selected state must stay visible in forced colors`.trim() }
    )
    .toBe('distinct');
}

/** `first` comes before `second` in DOM (reading / keyboard) order. */
export async function expectBeforeInDom(first: Locator, second: Locator, context = '') {
  const handle = await second.elementHandle();
  const ordered = await first.evaluate(
    (a, b) => Boolean(b && a.compareDocumentPosition(b as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
    handle
  );
  expect(ordered, `${context} reading order`.trim()).toBe(true);
}
