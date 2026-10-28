/**
 * Planla UI acceptance criteria.
 *
 * Written once, before the redesign, and committed on its own. These tests define what
 * "done" means for the Planla interface and must not be edited to make an implementation
 * pass. They measure only the Planla view (`.atlas-plan-view`) with deterministic fixtures.
 */
import type { Page } from '@playwright/test';
import { DESKTOP, expect, test } from './helpers/test';
import { findUndersizedTargets, setTextScale } from './helpers/layout';

const PLAN = '/istanbul/?view=plan';

const openPlan = async (
  page: Page,
  {
    width,
    height = 900,
    theme = 'light',
  }: { width: number; height?: number; theme?: 'light' | 'dark' }
) => {
  await page.addInitScript(mode => {
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'metric',
        windSpeedUnit: 'ms',
        language: 'tr',
        themeMode: mode,
      })
    );
  }, theme);
  await page.setViewportSize({ width, height });
  await page.goto(PLAN);
  await expect(page.locator('.atlas-plan-view .daily-plan__slot').first()).toBeVisible();
  // Mount deferred panels, then return to the top.
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= total; y += Math.max(400, height - 100)) {
    await page.evaluate(top => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
};

test.describe('Planla UI acceptance', () => {
  test.use({ bypassCSP: true });

  test(
    'A1 · Planla renders without console errors on desktop and mobile',
    DESKTOP,
    async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(String(error)));
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await openPlan(page, { width: 1440 });
      await openPlan(page, { width: 390, height: 844 });
      expect(errors).toEqual([]);
    }
  );

  test('A2 · loading Planla causes no meaningful layout shift', DESKTOP, async ({ page }) => {
    await page.addInitScript(() => {
      const target = window as Window & { __planCls?: number };
      target.__planCls = 0;
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!shift.hadRecentInput)
            target.__planCls = (target.__planCls ?? 0) + (shift.value ?? 0);
        }
      }).observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
    });
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(`${PLAN}&cls=${width}`);
      await expect(page.locator('.atlas-plan-view .daily-plan__slot').first()).toBeVisible();
      await page.waitForTimeout(2500);
      const cls = await page.evaluate(
        () => (window as Window & { __planCls?: number }).__planCls ?? 0
      );
      expect(cls, `${width}px CLS`).toBeLessThan(0.02);
    }
  });

  test(
    'A3 · the page never scrolls sideways from 320 to 1440 px, also at 200% text',
    DESKTOP,
    async ({ page }) => {
      await openPlan(page, { width: 1440 });
      for (const [width, scale] of [
        [320, 100],
        [390, 100],
        [768, 100],
        [1024, 100],
        [1440, 100],
        [320, 200],
        [1440, 200],
      ] as const) {
        await page.setViewportSize({ width, height: 900 });
        await setTextScale(page, scale);
        await page.waitForTimeout(250);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow, `${width}px/${scale}%`).toBeLessThanOrEqual(1);
      }
    }
  );

  test('A4 · there is exactly one large dark hero surface', DESKTOP, async ({ page }) => {
    await openPlan(page, { width: 1440 });
    const dark = await page.locator('.atlas-plan-view').evaluate(root => {
      const parse = (value: string) => {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (!match) return null;
        const [r, g, b, a = '1'] = match[1].split(/[ ,/]+/).filter(Boolean);
        return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
      };
      const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
        const c = [r, g, b].map(v => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const darkFill = (style: CSSStyleDeclaration) => {
        const color = parse(style.backgroundColor);
        if (color && color.a >= 0.5 && lum(color) < 0.06) return true;
        const stops = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m => parse(m[0]));
        return stops.length > 0 && stops.every(stop => stop && stop.a >= 0.5 && lum(stop) < 0.06);
      };
      return [...root.querySelectorAll<HTMLElement>('*')].filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width * rect.height >= 40_000 && darkFill(getComputedStyle(el));
      }).length;
    });
    expect(dark).toBe(1);
  });

  test(
    'A5 · no boxes inside boxes: at most one large surface nested in a section',
    DESKTOP,
    async ({ page }) => {
      await openPlan(page, { width: 1440 });
      const nested = await page.locator('.atlas-plan-view').evaluate(root => {
        const isSurface = (el: Element) => {
          if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'svg', 'CANVAS'].includes(el.tagName))
            return false;
          const rect = el.getBoundingClientRect();
          if (rect.width * rect.height < 30_000) return false;
          const style = getComputedStyle(el);
          const alpha = (() => {
            const m = style.backgroundColor.match(/rgba?\(([^)]+)\)/);
            if (!m) return 0;
            const parts = m[1].split(/[ ,/]+/).filter(Boolean);
            return parts.length > 3 ? Number(parts[3]) : 1;
          })();
          const framed = ['Top', 'Right', 'Bottom', 'Left'].every(
            side => parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) >= 1
          );
          return alpha >= 0.08 || style.backgroundImage !== 'none' || framed;
        };
        const surfaces = [...root.querySelectorAll('*')].filter(isSurface);
        return surfaces
          .filter(el => {
            let parent = el.parentElement;
            while (parent && parent !== root) {
              if (surfaces.includes(parent)) return true;
              parent = parent.parentElement;
            }
            return false;
          })
          .map(el => el.className.toString().split(' ')[0]);
      });
      expect(nested.length, `nested surfaces: ${nested.join(', ')}`).toBeLessThanOrEqual(1);
    }
  );

  test('A6 · Planla has no axe violations in light and dark themes', DESKTOP, async ({ page }) => {
    for (const [width, theme] of [
      [1440, 'light'],
      [390, 'dark'],
    ] as const) {
      await openPlan(page, { width, height: 900, theme });
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const violations = await page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: {
              run: (
                context: unknown,
                options: unknown
              ) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }>;
            };
          }
        ).axe;
        const result = await axe.run(
          { include: [['.atlas-plan-view']] },
          {
            runOnly: {
              type: 'tag',
              values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
            },
          }
        );
        return result.violations.map(
          v =>
            `${v.id}: ${v.nodes
              .map(n => n.target.join(' '))
              .slice(0, 3)
              .join(' | ')}`
        );
      });
      expect(violations, `${width}px ${theme}`).toEqual([]);
    }
  });

  test('A7 · every Planla control is at least 44 px on phones', DESKTOP, async ({ page }) => {
    await openPlan(page, { width: 390, height: 844 });
    expect(await findUndersizedTargets(page.locator('.atlas-plan-view'))).toEqual([]);
  });

  test(
    'A8 · Planla has purposeful motion using only compositor-friendly properties',
    DESKTOP,
    async ({ page }) => {
      await openPlan(page, { width: 1440 });
      const motion = await page.locator('.atlas-plan-view').evaluate(root => {
        const names = new Set<string>();
        let animated = 0;
        for (const el of root.querySelectorAll('*')) {
          const value = getComputedStyle(el).animationName;
          if (value && value !== 'none') {
            animated += 1;
            value.split(',').forEach(name => names.add(name.trim()));
          }
        }
        const allowed = new Set([
          'transform',
          'translate',
          'scale',
          'rotate',
          'opacity',
          'clip-path',
          'filter',
        ]);
        const offending: string[] = [];
        const visit = (rules: CSSRuleList) => {
          for (const rule of Array.from(rules)) {
            if (rule instanceof CSSKeyframesRule && names.has(rule.name)) {
              for (const frame of Array.from(rule.cssRules) as CSSKeyframeRule[]) {
                for (const property of Array.from(frame.style)) {
                  if (!allowed.has(property) && !property.startsWith('--'))
                    offending.push(`${rule.name}:${property}`);
                }
              }
            } else if ('cssRules' in rule) {
              visit((rule as CSSGroupingRule).cssRules);
            }
          }
        };
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            visit(sheet.cssRules);
          } catch {
            /* cross-origin sheet */
          }
        }
        return { animated, offending };
      });
      expect(motion.animated, 'animated elements in Planla').toBeGreaterThanOrEqual(3);
      expect(motion.offending).toEqual([]);
    }
  );

  test('A9 · reduced motion removes every Planla animation', DESKTOP, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPlan(page, { width: 1440 });
    const animated = await page.locator('.atlas-plan-view').evaluate(root =>
      [...root.querySelectorAll('*')]
        .filter(el => {
          const style = getComputedStyle(el);
          return style.animationName !== 'none' && parseFloat(style.animationDuration) > 0.01;
        })
        .map(el => el.className.toString().split(' ')[0])
    );
    expect(animated).toEqual([]);
  });

  test('A10 · section headings share one size of at least 24 px', DESKTOP, async ({ page }) => {
    await openPlan(page, { width: 1440 });
    const sizes = await page
      .locator('.atlas-plan-view h2')
      .evaluateAll(headings =>
        headings
          .filter(h => h.getBoundingClientRect().height > 0)
          .map(h => Math.round(parseFloat(getComputedStyle(h).fontSize)))
      );
    expect(sizes.length).toBeGreaterThanOrEqual(4);
    expect(new Set(sizes).size, `h2 sizes: ${sizes.join(', ')}`).toBe(1);
    expect(sizes[0]).toBeGreaterThanOrEqual(24);
  });

  test('A11 · sections in each column follow one vertical rhythm', DESKTOP, async ({ page }) => {
    await openPlan(page, { width: 1440 });
    for (const column of ['.atlas-plan-view__main', '.atlas-plan-view__aside']) {
      const gaps = await page.locator(column).evaluate(el => {
        const boxes = [...el.children]
          .map(child => child.getBoundingClientRect())
          .filter(rect => rect.height > 0);
        return boxes.slice(1).map((rect, index) => Math.round(rect.top - boxes[index].bottom));
      });
      if (gaps.length < 1) continue;
      expect(
        Math.max(...gaps) - Math.min(...gaps),
        `${column} gaps ${gaps.join(', ')}`
      ).toBeLessThanOrEqual(2);
    }
  });

  test(
    'A12 · Planla stays compact: at most 2900 px on desktop and 5200 px on phones',
    DESKTOP,
    async ({ page }) => {
      await openPlan(page, { width: 1440 });
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
        2900
      );
      await openPlan(page, { width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
        5200
      );
    }
  );

  test(
    'A13 · on phones the decision and the score are in the first view above the tab bar',
    DESKTOP,
    async ({ page }) => {
      await openPlan(page, { width: 390, height: 844 });
      const decision = await page
        .locator('.atlas-plan-view .daily-plan__decision strong')
        .first()
        .boundingBox();
      const score = await page
        .locator('.atlas-plan-view .daily-plan__score strong')
        .first()
        .boundingBox();
      expect(decision).not.toBeNull();
      expect(score).not.toBeNull();
      expect(decision!.y + decision!.height).toBeLessThanOrEqual(844 - 96);
      expect(score!.y + score!.height).toBeLessThanOrEqual(844 - 96);
    }
  );

  test(
    'A14 · the hourly strip fits on desktop, has touch-size hours and shows score differences',
    DESKTOP,
    async ({ page }) => {
      await openPlan(page, { width: 1440 });
      const strip = page.locator('.atlas-plan-view .daily-plan__slots');
      const state = await strip.evaluate(el => {
        const slots = [...el.querySelectorAll<HTMLElement>('.daily-plan__slot')];
        const scored = slots.map(slot => ({
          score: Number(slot.querySelector('strong')?.textContent),
          height: slot.getBoundingClientRect().height,
          look: (() => {
            const own = getComputedStyle(slot);
            const before = getComputedStyle(slot, '::before');
            return [
              own.backgroundColor,
              own.backgroundImage,
              before.transform,
              before.height,
              before.backgroundColor,
            ].join('|');
          })(),
        }));
        const max = scored.reduce((a, b) => (b.score > a.score ? b : a), scored[0]);
        const min = scored.reduce((a, b) => (b.score < a.score ? b : a), scored[0]);
        return {
          count: slots.length,
          fits: el.scrollWidth <= el.clientWidth + 1,
          minHeight: Math.min(...scored.map(s => s.height)),
          spread: max.score - min.score,
          distinct: max.look !== min.look,
        };
      });
      expect(state.count).toBe(12);
      expect(state.fits).toBe(true);
      expect(state.minHeight).toBeGreaterThanOrEqual(44);
      if (state.spread >= 5) expect(state.distinct).toBe(true);
    }
  );

  test(
    'A15 · every outlook day shows its weather icon and high and low temperatures',
    DESKTOP,
    async ({ page }) => {
      await openPlan(page, { width: 1440 });
      const days = page.locator('.atlas-plan-view .day-outlook__day');
      expect(await days.count()).toBeGreaterThanOrEqual(2);
      for (const day of await days.all()) {
        await expect(day.locator('svg').first()).toBeVisible();
        expect((await day.textContent())?.match(/-?\d+°/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
      }
    }
  );

  test('A16 · every Planla section has an accessible name', DESKTOP, async ({ page }) => {
    await openPlan(page, { width: 1440 });
    const unnamed = await page.locator('.atlas-plan-view').evaluate(root =>
      [...root.querySelectorAll('section, aside')]
        .filter(el => el.getBoundingClientRect().height > 0)
        .filter(el => {
          const labelledby = el.getAttribute('aria-labelledby');
          const named = labelledby
            ? labelledby.split(' ').some(id => document.getElementById(id)?.textContent?.trim())
            : Boolean(el.getAttribute('aria-label')?.trim());
          return !named;
        })
        .map(el => el.className.toString().split(' ')[0])
    );
    expect(unnamed).toEqual([]);
  });
});
