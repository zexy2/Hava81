import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import {
  expectBeforeInDom,
  expectContainedIn,
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectReadable,
  expectTextNotClipped,
  setTextScale,
  setWidth,
} from './helpers/layout';
import { fixtures, overrideApiJson, seedSettings } from './helpers/weather-fixtures';

const { current, hourlyForecast, isoAtHour } = fixtures;

// Karar: the first screen (WeatherDecisionField + Ritim) and the Karar özeti hero (DecisionGlance).

test.describe('first screen composition (Faz 2)', () => {
  test(
    'desktop first screen shows the decision field beside the rhythm chart, then environment, then Planla',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/istanbul');
      const decision = page.locator('.hava81-decision-field');
      const rhythm = page.locator('.hava81-forecast-atlas');
      await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
      // Both halves of the composition are visible without scrolling at 1280px.
      await expect(decision).toBeInViewport();
      await expect(rhythm).toBeInViewport();
      await expectNoOverlap(decision, rhythm, 'decision field vs rhythm chart');
      await expect(decision.locator('.hava81-decision-field__next-change')).toBeVisible();

      // Reading order: Karar → Ritim → one environmental surface → a single Planla entry.
      const environment = page.locator('.environment-rail');
      const entry = page.locator('.atlas-plan-entry');
      await expectBeforeInDom(decision, environment, 'decision before environment');
      await expectBeforeInDom(environment, entry, 'environment before the Planla entry');
      await expect(entry).toBeVisible();
      // Plan panels are not part of the main flow; they live in the hidden Planla view.
      const plan = page.locator('.atlas-plan-view');
      await expect(plan).toBeHidden();
      for (const panel of ['.daily-plan', '.commute-plan', '.activity-planner']) {
        await expect(page.locator(panel), `${panel} is not in the main flow`).toBeHidden();
      }
      // Only one headline score on Today: the decision summary's 0–100.
      await expect(page.locator('.decision-glance__score')).toBeVisible();
      await expect(
        page.locator(
          '.daily-plan__score:visible, .activity-card__score:visible, .route-weather__score:visible'
        )
      ).toHaveCount(0);
      await expectNoHorizontalScroll(page);
    }
  );

  test('current conditions stay in the first mobile viewport', MOBILE, async ({ page }) => {
    await page.goto('/istanbul');
    await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeInViewport();
    await expect(page.locator('.hava81-decision-field__temperature-value')).toBeInViewport();
  });

  // Rewritten from the Faz 2 `test.fixme`: at a 1024px desktop with 200% text the
  // first-screen reading block must reflow instead of clipping or colliding.
  test(
    'mid-width desktop decision reading reflows at 200 percent text size',
    DESKTOP,
    async ({ page }) => {
      await setWidth(page, 1024, 900);
      await page.goto('/istanbul');
      await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
      await setTextScale(page, 200);

      const field = page.locator('.hava81-decision-field');
      const value = field.locator('.hava81-decision-field__temperature-value');
      const symbol = field.locator('.hava81-decision-field__symbol');
      await expect(value).toBeVisible();
      await expect(symbol).toBeVisible();
      await expectReadable(page, field.locator('.hava81-decision-field__reading'), 'reading block');
      await expectNoOverlap(value, symbol, 'temperature vs weather art');
      await expectContainedIn(symbol, field, 'weather art');
      await expectContainedIn(value, field, 'temperature');
      await expectReadable(
        page,
        field.locator('.hava81-decision-field__next-change'),
        'next-change sentence'
      );
      await expectReadable(page, field, 'decision field');
      // The neighbouring rhythm chart never sits on top of the enlarged field.
      await expectNoOverlap(
        field,
        page.locator('.hava81-forecast-atlas'),
        'decision field vs rhythm chart'
      );
    }
  );
});

test.describe('decision field details', () => {
  test('mobile metadata shows source freshness and hides coordinates', MOBILE, async ({ page }) => {
    await page.goto('/istanbul');
    const meta = page.locator('.hava81-decision-field__atlas-meta');
    await expect(meta).toBeVisible();
    await expect(meta).toContainText(/OpenWeather/i);
    const coordinates = meta.locator('.hava81-decision-field__coordinate-meta');
    for (const item of await coordinates.all()) await expect(item).toBeHidden();
  });

  test(
    'English weather freshness labels use English instead of Turkish fallbacks',
    DESKTOP,
    async ({ page }) => {
      await seedSettings(page, { language: 'en' });
      await page.goto('/istanbul/');
      await expect(page.locator('.hava81-decision-field__city')).toHaveText('İstanbul');
      const metadata = page.locator('.hava81-decision-field__atlas-meta');
      await expect(metadata).toContainText('Just updated');
      await expect(metadata).not.toContainText(/güncellendi|Güncellik|Eski veri|dk önce/i);
    }
  );

  test(
    'mobile planning signals show compact copy but keep full guidance for assistive tech',
    MOBILE,
    async ({ page }) => {
      await page.goto('/istanbul');
      const change = page.locator('.hava81-decision-field__change');
      const rows = change.locator('.hava81-decision-field__decision-list li');
      await expect(rows.first()).toBeVisible();
      for (const compact of await change
        .locator('.hava81-decision-field__decision-copy--compact')
        .all()) {
        await expect(compact).toBeVisible();
      }
      for (const full of await change
        .locator('.hava81-decision-field__decision-copy--full')
        .all()) {
        await expect(full).toBeHidden();
      }
      for (const row of await rows.all()) await expect(row).toHaveAttribute('aria-label', /\S/);
      await expectNoHorizontalScroll(page);
    }
  );

  test(
    'city name stays whole and clear of the plate at 100% and 200% text',
    MOBILE,
    async ({ page }) => {
      await page.goto('/izmir/');
      const city = page.locator('.hava81-decision-field__city');
      const plate = page.locator('.hava81-decision-field__plate');
      await expect(city).toBeVisible();
      await expect(plate).toBeVisible();

      for (const width of [320, 390]) {
        await setWidth(page, width, 844);
        for (const scale of [100, 200] as const) {
          await setTextScale(page, scale);
          for (const name of ['İzmir', 'İstanbul', 'Kahramanmaraş']) {
            await city.evaluate((element, value) => {
              element.textContent = value;
            }, name);
            const at = `${name} at ${width}px/${scale}%`;
            await expectNoOverlap(city, plate, at);
            await expectContainedIn(city, city.locator('xpath=..'), at);
            await expectNoHorizontalScroll(page, at);
            if (name !== 'Kahramanmaraş') {
              // Short names never break mid-word ("İzm" / "ir").
              const lines = await city.evaluate(element => {
                const range = document.createRange();
                range.selectNodeContents(element);
                return new Set(
                  [...range.getClientRects()]
                    .filter(rect => rect.width > 0)
                    .map(rect => Math.round(rect.top))
                ).size;
              });
              expect(lines, `${at} stays on one line`).toBe(1);
            }
          }
        }
      }
    }
  );
});

test.describe('decision hero (Karar özeti)', () => {
  test(
    'mobile hero shows the useful timing and umbrella summary inside the card',
    MOBILE,
    async ({ page }) => {
      await page.goto('/izmir/');
      const hero = page.locator('.decision-glance');
      await expect(hero).toBeVisible();
      await expect(hero.locator('.decision-glance__quick').first()).toBeVisible();
      await expect(hero.locator('.decision-glance__quick').nth(1)).toBeVisible();
      await expectContainedIn(
        hero.locator('.decision-glance__quick').first(),
        hero,
        'first quick chip'
      );
      await expectContainedIn(hero.locator('.decision-glance__score'), hero, 'score');
    }
  );

  test(
    'mobile hero and current card stay readable with enlarged text',
    MOBILE,
    async ({ page }) => {
      await page.goto('/izmir/');
      const hero = page.locator('.decision-glance');
      const card = page.locator('.hava81-decision-field__current');
      await expect(hero.locator('.decision-glance__score')).toBeVisible();

      for (const width of [320, 390]) {
        await setWidth(page, width, 844);
        for (const scale of [100, 200] as const) {
          await setTextScale(page, scale);
          const at = `${width}px/${scale}%`;
          const score = hero.locator('.decision-glance__score');
          await expectContainedIn(score, hero.locator('.decision-glance__side'), `score ${at}`);
          await expectContainedIn(score.locator('strong'), score, `score number ${at}`);
          await expectContainedIn(
            hero.locator('.decision-glance__details'),
            hero,
            `explanation ${at}`
          );
          await expectNoOverlap(
            score,
            hero.locator('.decision-glance__score-label'),
            `score vs label ${at}`
          );
          await expectNoOverlap(
            score,
            hero.locator('.decision-glance__details'),
            `score vs explanation ${at}`
          );
          await expectContainedIn(
            hero.locator('.decision-glance__message'),
            hero,
            `headline ${at}`
          );
          // Weather art in the current card never covers the temperature.
          await expectContainedIn(
            card.locator('.hava81-decision-field__weather-symbol'),
            card,
            `weather icon ${at}`
          );
          await expectNoOverlap(
            card.locator('.hava81-decision-field__symbol'),
            card.locator('.hava81-decision-field__temperature'),
            `weather art vs temperature ${at}`
          );
          await expectNoHorizontalScroll(page, at);
        }
      }
    }
  );

  test(
    'hero decoration and date never cover the score at responsive widths',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/sanliurfa/');
      const hero = page.locator('.decision-glance');
      const score = hero.locator('.decision-glance__score');
      await expect(score).toBeVisible();
      await expect(page.locator('.decision-glance[data-weather-scene="clear"]')).toBeVisible();

      for (const width of [390, 768, 1024, 1440]) {
        await setWidth(page, width, 900);
        const at = `${width}px`;
        await expectNoOverlap(hero.locator('.decision-glance__sun'), score, `sun vs score ${at}`);
        await expectNoOverlap(hero.locator('.decision-glance__date'), score, `date vs score ${at}`);
        await expectContainedIn(score, hero, `score ${at}`);
        await expectNoHorizontalScroll(page, at);
      }
    }
  );

  test(
    'tablet hero reflows enlarged text without covering the score',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/izmir/');
      const hero = page.locator('.decision-glance');
      await expect(hero.locator('.decision-glance__score')).toBeVisible();
      await setTextScale(page, 200);
      for (const width of [768, 1024, 1280]) {
        await setWidth(page, width, 900);
        const at = `${width}px/200%`;
        await expectNoOverlap(
          hero.locator('.decision-glance__message'),
          hero.locator('.decision-glance__score'),
          `copy vs score ${at}`
        );
        await expectContainedIn(hero.locator('.decision-glance__details'), hero, `details ${at}`);
        await expectContainedIn(hero.locator('.decision-glance__side'), hero, `score column ${at}`);
        await expectTextNotClipped(hero.locator('.decision-glance__main'), at);
        await expectNoHorizontalScroll(page, at);
      }
    }
  );

  test('mobile decision scenery quiets down when text is enlarged', MOBILE, async ({ page }) => {
    await page.goto('/izmir/');
    const hero = page.locator('.decision-glance');
    const atmosphere = hero.locator('.decision-glance__atmosphere');
    await expect(hero.locator('.decision-glance__message')).toBeVisible();
    const opacity = () => atmosphere.evaluate(element => Number(getComputedStyle(element).opacity));

    for (const width of [320, 390]) {
      await setWidth(page, width, 844);
      await setTextScale(page, 100);
      expect(await opacity(), `weather art visible at ${width}px`).toBeGreaterThanOrEqual(0.3);
      await setTextScale(page, 200);
      // Enlarged text gets quiet atmospheric artwork so the headline stays legible.
      expect(await opacity(), `weather art quiet at ${width}px/200%`).toBeLessThanOrEqual(0.15);
      await expectContainedIn(
        hero.locator('.decision-glance__message'),
        hero,
        `headline ${width}px/200%`
      );
      await expectNoHorizontalScroll(page, `${width}px/200%`);
    }
  });

  test('hero labels a next-day forecast window in the city timezone', MOBILE, async ({ page }) => {
    const fixed = new Date('2026-10-08T20:15:00.000Z'); // 23:15 in İstanbul
    await page.clock.install({ time: fixed });
    await overrideApiJson(page, 'current', {
      ...current,
      timestamp: fixed.toISOString(),
      meta: { ...current.meta, fetchedAt: fixed.toISOString() },
    });
    await overrideApiJson(page, 'hourly', {
      ...hourlyForecast,
      hourly: Array.from({ length: 24 }, (_, index) => ({
        time: new Date(Date.parse('2026-10-08T21:00:00.000Z') + index * 60 * 60_000).toISOString(),
        temp: 18 + Math.min(index, 3),
        icon: '02n',
        description: 'az bulutlu',
        pop: 0,
        windSpeed: 2,
      })),
      meta: { ...hourlyForecast.meta, fetchedAt: fixed.toISOString() },
    });

    await page.goto('/istanbul/');
    const hero = page.locator('.decision-glance');
    await expect(hero.locator('.decision-glance__window')).toContainText('Yarın');
    await expect(hero.locator('.decision-glance__quick').first()).toContainText('Yarın');
    await setWidth(page, 320, 844);
    await expectNoHorizontalScroll(page, '320px');
  });

  test(
    'English recommended window uses an AM/PM clock and stays clear of the score',
    MOBILE,
    async ({ page }) => {
      await seedSettings(page, { language: 'en' });
      await overrideApiJson(page, 'hourly', {
        ...hourlyForecast,
        hourly: Array.from({ length: 24 }, (_, index) => ({
          time: isoAtHour(index + 1),
          temp: 20 + Math.round(5 * Math.sin(index / 5)),
          icon: '01d',
          description: 'clear',
          pop: 5,
          windSpeed: 2,
        })),
      });
      await page.goto('/istanbul/');
      const hero = page.locator('.decision-glance');
      await expect(hero.locator('.decision-glance__window')).toContainText(/AM|PM/);

      for (const [width, scale] of [
        [320, 100],
        [390, 100],
        [320, 200],
      ] as const) {
        await setWidth(page, width, 844);
        await setTextScale(page, scale);
        const at = `${width}px/${scale}%`;
        // The compact hero substitutes the first quick chip for the window paragraph.
        const windowCopy = hero.locator('.decision-glance__window');
        const recommendation = (await windowCopy.isVisible())
          ? windowCopy
          : hero.locator('.decision-glance__quick').first();
        await expectContainedIn(recommendation, hero, `recommendation ${at}`);
        await expectNoOverlap(
          recommendation,
          hero.locator('.decision-glance__score'),
          `recommendation vs score ${at}`
        );
        await expectNoHorizontalScroll(page, at);
      }
    }
  );
});
