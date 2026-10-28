import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import {
  expectContainedIn,
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectReadable,
  expectTouchTarget,
  expectVisibleFocusRing,
  expectWithinViewportWidth,
  setTextScale,
  setWidth,
} from './helpers/layout';
import {
  createWeatherFixtures,
  VISUAL_FIXED_NOW,
  fixtures,
  overrideApi,
  overrideApiJson,
  seedSettings,
} from './helpers/weather-fixtures';

const { current, hourlyForecast, now: fixtureNow } = fixtures;

// Planla: Gün planı, Çıkış planı, aktiviteler, uyarılar, bağlam sinyalleri ve rota.
// Since Faz 2.3 these live in a separate view reached via the bottom navigation, the
// desktop header or `?view=plan`; the panel tests open that view directly.
const PLAN = '/istanbul/?view=plan';

test.describe('Planla view', () => {
  test('?view=plan opens Planla on load and Today leaves it', async ({ page }) => {
    await page.goto(PLAN);
    const plan = page.locator('.atlas-plan-view');
    await expect(plan.getByRole('heading', { name: 'Planla · İstanbul', level: 1 })).toBeVisible();
    await expect(plan.getByRole('heading', { name: 'Gün planı' })).toBeVisible();
    // The main flow is not rendered behind Planla.
    await expect(page.locator('.hava81-decision-field')).toHaveCount(0);
    await expect(page.locator('.decision-glance')).toHaveCount(0);
    await expect(page).toHaveURL(/\/istanbul\/\?view=plan$/);

    await plan.getByRole('button', { name: 'Bugüne dön' }).click();
    await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
    await expect(plan).toBeHidden();
    await expect(page).toHaveURL(/\/istanbul\/$/);
  });

  test(
    'mobile bottom navigation switches between Today and Planla and updates the URL',
    MOBILE,
    async ({ page }) => {
      await page.goto('/istanbul/');
      const nav = page.locator('.atlas-bottom-nav');
      const planButton = nav.getByRole('button', { name: 'Planla' });
      const todayButton = nav.getByRole('button', { name: 'Bugün' });
      await expect(todayButton).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('.daily-plan')).toBeHidden();

      await planButton.click();
      await expect(planButton).toHaveAttribute('aria-current', 'page');
      await expect(page).toHaveURL(/\?view=plan$/);
      await expect(page.locator('.daily-plan')).toBeVisible();
      await expect(page.locator('.activity-planner')).toBeVisible();

      await todayButton.click();
      await expect(todayButton).toHaveAttribute('aria-current', 'page');
      await expect(page).toHaveURL(/\/istanbul\/$/);
      await expect(page.locator('.hava81-decision-field')).toBeVisible();
      await expect(page.locator('.daily-plan')).toBeHidden();
    }
  );

  test(
    'desktop header offers Planla when the bottom navigation is hidden',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/istanbul/');
      await expect(page.locator('.atlas-bottom-nav')).toBeHidden();
      const headerPlan = page.locator('.atlas-plan-button');
      await expect(headerPlan).toBeVisible();
      await expect(headerPlan).not.toHaveAttribute('aria-current');
      await headerPlan.click();
      await expect(headerPlan).toHaveAttribute('aria-current', 'page');
      await expect(page).toHaveURL(/\?view=plan$/);
      await expect(page.locator('.atlas-plan-view .commute-plan')).toBeVisible();
    }
  );

  test(
    'the decision summary score explanation opens the day plan in Planla',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/istanbul/');
      await page.locator('.decision-glance__details').click();
      await expect(page).toHaveURL(/\?view=plan$/);
      const title = page.locator('#daily-plan-title');
      await expect(title).toBeVisible();
      await expect(title).toBeFocused();
    }
  );

  test('plan-view state survives a round trip to Today', DESKTOP, async ({ page }) => {
    // The outlook hides when the available forecast cannot support at least two local-day
    // summaries. Pin a five-day forecast so this state-persistence regression is independent
    // of the hour at which CI happens to run.
    const pinned = createWeatherFixtures(VISUAL_FIXED_NOW);
    await page.clock.setFixedTime(new Date(VISUAL_FIXED_NOW));
    await overrideApiJson(page, 'current', pinned.current);
    await overrideApiJson(page, 'forecast', pinned.forecast);
    await overrideApiJson(page, 'hourly', pinned.hourlyForecast120());
    await overrideApiJson(page, 'air', pinned.air);
    await overrideApiJson(page, 'context', pinned.context);
    await overrideApiJson(page, 'route', pinned.routeResult);

    await page.goto(PLAN);
    const plan = page.locator('.atlas-plan-view');
    await expect(plan.getByRole('heading', { name: 'Planla · İstanbul', level: 1 })).toBeVisible();
    const outlook = plan.locator('section.day-outlook');
    await expect(outlook).toBeVisible();
    await expect(outlook.locator('.day-outlook__day').nth(1)).toBeVisible();

    const runPlan = outlook.getByLabel('Hangi plan için?').getByRole('button', { name: 'Koşu' });
    await runPlan.click();
    await expect(runPlan).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Bugüne dön' }).click();
    await expect(page.locator('.hava81-decision-field')).toBeVisible();
    await expect(plan).toBeHidden();
    await page.locator('.atlas-plan-button').click();
    await expect(plan).toBeVisible();
    await expect(outlook).toBeVisible();
    await expect(
      outlook.getByLabel('Hangi plan için?').getByRole('button', { name: 'Koşu' })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('scores in Planla are labelled hourly or per activity', DESKTOP, async ({ page }) => {
    await page.goto(PLAN);
    await expect(page.locator('.daily-plan__slots-caption')).toHaveText(
      'Saatlik uygunluk · 0–100 · yüksek daha uygun'
    );
    await expect(page.locator('.daily-plan__score small')).toContainText('Genel dışarı skoru');
    const cards = page.locator('.activity-card');
    await expect(cards).toHaveCount(2);
    for (const card of await cards.all())
      await expect(card.locator('.activity-card__score')).toContainText('Bu aktivite için');
  });

  test('English Planla uses "Plan" and labels activity scores', DESKTOP, async ({ page }) => {
    await seedSettings(page, { language: 'en' });
    await page.goto(PLAN);
    await expect(page.getByRole('heading', { name: 'Plan · İstanbul', level: 1 })).toBeVisible();
    await expect(page.locator('.atlas-plan-button')).toHaveText('Plan');
    await expect(page.locator('.daily-plan__slots-caption')).toHaveText(
      'Hourly suitability · 0–100 · higher is better'
    );
    await expect(page.locator('.activity-card__score').first()).toContainText('For this activity');
  });

  test(
    'plan intro keeps the mobile first viewport compact in Turkish and English',
    MOBILE,
    async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const language of ['tr', 'en'] as const) {
        await seedSettings(page, { language, themeMode: 'dark' });
        await page.goto(PLAN);
        const intro = page.locator('.atlas-plan-view__header p');
        await expect(intro).toBeVisible();
        await expect(intro).toHaveText(
          language === 'en'
            ? 'Plan activities and routes around the weather. The daily score is on Today; activity scores are here.'
            : 'Aktivitelerini ve rotalarını hava durumuna göre planla. Günlük skor Bugün’de; aktivite puanları burada.'
        );
        const metrics = await intro.evaluate(element => ({
          height: element.getBoundingClientRect().height,
          lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
        }));
        expect(metrics.height, `${language} plan intro line budget`).toBeLessThanOrEqual(
          metrics.lineHeight * 3.1
        );
      }
    }
  );
});

test.describe('daily plan', () => {
  test(
    'daily plan timeline matches its 12-hour score horizon and shows risk-first slot copy',
    DESKTOP,
    async ({ page }) => {
      // Pin the browser clock to the series start: ended forecast steps are not scored.
      const evening = createWeatherFixtures(Date.parse('2026-08-28T18:00:00.000Z'));
      await page.clock.setFixedTime(new Date(evening.now));
      await overrideApiJson(page, 'current', evening.current);
      await overrideApi(page, 'hourly', route =>
        route.fulfill({
          json: {
            ...hourlyForecast,
            meta: evening.hourlyForecast.meta,
            hourly: Array.from({ length: 24 }, (_, index) => ({
              ...hourlyForecast.hourly[index],
              time: new Date(
                Date.parse('2026-08-28T18:00:00.000Z') + index * 60 * 60_000
              ).toISOString(),
              pop: index === 4 ? 45 : 10,
              precipitationMm: 0,
              windGust: 5,
              apparentTemperature: 24,
              humidity: 50,
              uvIndex: 0,
              visibility: 20000,
              weatherCode: 2,
            })),
          },
        })
      );

      await page.goto(PLAN);
      const timeline = page.getByRole('list', { name: 'Günün hava uygunluk zaman çizelgesi' });
      await expect(timeline.locator('.daily-plan__slot')).toHaveCount(12);
      await expect(timeline).not.toContainText('Çok uygun');
      await expect(timeline.getByText('Yağış ihtimali var')).toBeVisible();
      await expect(timeline.getByText('Yarın')).toHaveCount(1);
    }
  );

  test(
    'daily plan avoids repeated perfect scores for pleasant humid night hours',
    DESKTOP,
    async ({ page }) => {
      const currentHour = new Date(current.timestamp);
      currentHour.setUTCMinutes(0, 0, 0);
      const profile = [
        {
          temp: 22.6,
          apparentTemperature: 25.4,
          humidity: 81,
          windSpeed: 1.25,
          windGust: 3.9,
          visibility: 31560,
        },
        {
          temp: 22.4,
          apparentTemperature: 25.1,
          humidity: 81,
          windSpeed: 1.12,
          windGust: 2.9,
          visibility: 31340,
        },
        {
          temp: 22.1,
          apparentTemperature: 24.8,
          humidity: 82,
          windSpeed: 1.17,
          windGust: 2.7,
          visibility: 31080,
        },
        {
          temp: 21.7,
          apparentTemperature: 24.4,
          humidity: 83,
          windSpeed: 1.14,
          windGust: 2.6,
          visibility: 29500,
        },
        {
          temp: 21.5,
          apparentTemperature: 24.2,
          humidity: 85,
          windSpeed: 1.26,
          windGust: 2.7,
          visibility: 28280,
        },
        {
          temp: 21.4,
          apparentTemperature: 23.9,
          humidity: 85,
          windSpeed: 1.34,
          windGust: 2.8,
          visibility: 27700,
        },
        {
          temp: 21.4,
          apparentTemperature: 24,
          humidity: 84,
          windSpeed: 1.12,
          windGust: 2.9,
          visibility: 29000,
        },
      ];
      await overrideApi(page, 'hourly', route =>
        route.fulfill({
          json: {
            ...hourlyForecast,
            hourly: profile.map((point, index) => ({
              ...point,
              time: new Date(currentHour.getTime() + index * 60 * 60_000).toISOString(),
              icon: '01n',
              description: 'açık',
              pop: 0,
              precipitationMm: 0,
              uvIndex: 0,
              weatherCode: 0,
            })),
          },
        })
      );

      await page.goto(PLAN);
      const timeline = page.getByRole('list', { name: 'Günün hava uygunluk zaman çizelgesi' });
      await expect(timeline.locator('.daily-plan__slot')).toHaveCount(profile.length);
      const scores = (await timeline.locator('.daily-plan__slot > strong').allTextContents()).map(
        Number
      );

      expect(scores).toHaveLength(profile.length);
      expect(scores.every(score => Number.isFinite(score) && score < 100)).toBe(true);
      expect(Math.min(...scores)).toBeGreaterThanOrEqual(94);
      expect(Math.max(...scores)).toBeLessThanOrEqual(98);
      expect(new Set(scores).size).toBeGreaterThanOrEqual(3);
      expect(scores[0]).toBeLessThan(scores[scores.length - 1]);
    }
  );

  test(
    'timeline marks the best hour and its score meters match the scores',
    DESKTOP,
    async ({ page }) => {
      // Fixed 09:00 İstanbul: the marked best hour must be a recommendable (07–23) hour,
      // so the test must not depend on when CI runs (plan v3 Faz 0.3).
      const morning = createWeatherFixtures(Date.parse('2026-08-28T06:00:00.000Z'));
      await page.clock.setFixedTime(new Date(morning.now));
      await overrideApiJson(page, 'current', morning.current);
      const hour = new Date(morning.now);
      await overrideApiJson(page, 'hourly', {
        ...morning.hourlyForecast,
        hourly: Array.from({ length: 24 }, (_, index) => ({
          ...morning.hourlyForecast.hourly[index],
          time: new Date(hour.getTime() + index * 60 * 60_000).toISOString(),
          temp: 21 - Math.floor(index / 6),
          // A wet afternoon: the morning is clearly better, so a best window exists.
          ...(index >= 4 ? { pop: 80, precipitationMm: 2.5 } : { pop: 0, precipitationMm: 0 }),
          apparentTemperature: 20,
          humidity: 55,
          windGust: 5,
          uvIndex: 0,
          weatherCode: 1,
          visibility: 20000,
        })),
      });
      await page.goto(PLAN);
      const timeline = page.locator('.daily-plan .daily-plan__slots');
      const slots = timeline.locator('.daily-plan__slot');
      await expect(slots).toHaveCount(12);
      const state = await timeline.evaluate(element => {
        const cards = Array.from(element.querySelectorAll<HTMLElement>('.daily-plan__slot'));
        return {
          best: cards.filter(card => card.classList.contains('is-best-window')).length,
          metersMatch: cards.every(card => {
            const score = Number(card.querySelector('strong')?.textContent);
            return (
              Number.isFinite(score) &&
              score >= 0 &&
              score <= 100 &&
              card.style.getPropertyValue('--hour-score').trim() === `${score}%`
            );
          }),
        };
      });
      expect(state.metersMatch).toBe(true);
      expect(state.best).toBeGreaterThan(0);
      // The strip either fits all twelve hours or scrolls on its own; the page never does.
      const overflows = await timeline.evaluate(
        element => element.scrollWidth > element.clientWidth + 1
      );
      if (overflows) {
        await timeline.evaluate(element => {
          element.scrollLeft = 200;
        });
        expect(await timeline.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      } else {
        await expect(slots.last()).toBeInViewport();
      }
      await expectNoHorizontalScroll(page);
    }
  );

  test(
    'mobile Daily Plan keeps its safety boundary visible and tucks method detail behind a disclosure',
    MOBILE,
    async ({ page }) => {
      await page.goto(PLAN);
      await expect(page.getByRole('heading', { name: 'Gün planı' })).toBeVisible();
      const safety = page.locator('.daily-plan__safety');
      const method = page.locator('.daily-plan__method');
      const summary = method.locator('summary');
      await expect(safety).toBeVisible();
      await expect(summary).toBeVisible();
      await expect(method).not.toHaveAttribute('open', '');

      await summary.click();
      await expect(method).toHaveAttribute('open', '');
      await summary.click();
      await expect(method).not.toHaveAttribute('open', '');

      await setWidth(page, 320, 844);
      await setTextScale(page, 200);
      await expectReadable(page, page.locator('.daily-plan__notes'), 'notes at 320px/200%');
    }
  );

  test(
    'mobile score explanation opens on demand and every activity choice stays visible',
    MOBILE,
    async ({ page }) => {
      await page.goto(PLAN);
      const breakdown = page.locator('.daily-plan__explain');
      await expect(breakdown).toBeVisible();
      await breakdown.locator('summary').click();
      await expect(breakdown).toHaveAttribute('open', '');
      await expect(breakdown.locator('.daily-plan__impacts, .daily-plan__stable')).toBeVisible();
      await breakdown.locator('summary').click();
      await expect(breakdown).not.toHaveAttribute('open');

      const chips = page.locator('.activity-planner__chips');
      await expect(chips.locator('button')).toHaveCount(6);
      for (const [width, scale] of [
        [390, 100],
        [320, 200],
      ] as const) {
        await setWidth(page, width, 844);
        await setTextScale(page, scale);
        for (const chip of await chips.locator('button').all()) {
          const label = (await chip.innerText()).replace(/\s+/g, ' ').trim();
          await expectContainedIn(chip, chips, `chip "${label}" ${width}px/${scale}%`);
        }
        expect(
          await chips.evaluate(element => element.scrollWidth <= element.clientWidth + 1)
        ).toBe(true);
        await expectNoHorizontalScroll(page, `${width}px/${scale}%`);
      }
    }
  );

  test(
    'English Daily Plan header keeps title and actions apart at 390px',
    MOBILE,
    async ({ page }) => {
      await seedSettings(page, { language: 'en', themeMode: 'dark' });
      await page.goto(PLAN);
      await expect(page.getByRole('heading', { name: 'Day plan' })).toBeVisible();
      const header = page.locator('.daily-plan__header');
      for (const scale of [100, 200] as const) {
        await setTextScale(page, scale);
        await expectNoOverlap(
          header.locator('h2'),
          header.locator('.daily-plan__header-actions'),
          `title vs actions ${scale}%`
        );
        await expectReadable(page, header, `header ${scale}%`);
      }
      await expectTouchTarget(header.locator('.daily-plan__share'), 'share action');
    }
  );

  test(
    'mobile sharing copies a canonical city decision and announces success',
    MOBILE,
    async ({ page }) => {
      await page.addInitScript(() => {
        const w = window as Window & { __hava81ClipboardText?: string };
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (text: string) => {
              w.__hava81ClipboardText = text;
            },
          },
        });
      });

      await page.goto(PLAN);
      const shareButton = page.locator('.daily-plan__share');
      await expect(shareButton).toBeVisible();
      await expect(shareButton).toBeEnabled();
      await shareButton.click();

      const feedback = page.locator('.daily-plan__header-actions [role="status"]');
      await expect(feedback).toHaveText('Kopyalandı');
      const copiedText = await page.evaluate(
        () => (window as Window & { __hava81ClipboardText?: string }).__hava81ClipboardText ?? ''
      );
      expect(copiedText).toContain('Hava81');
      expect(copiedText).toContain('Şemsiye:');
      expect(copiedText).toContain('/istanbul/');
    }
  );
});

test.describe('activities', () => {
  test(
    'activity preference and time range change the personalized plan',
    DESKTOP,
    async ({ page }) => {
      await page.goto(PLAN);
      const picnic = page.getByLabel('Aktivite seçimi').getByRole('button', { name: 'Piknik' });
      await expect(picnic).toHaveAttribute('aria-pressed', 'false');
      await picnic.click();
      await expect(picnic).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('heading', { name: 'Piknik' })).toBeVisible();
      await expect(page.getByText(/Üç aktivite seçtin/i)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Motosiklet', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Çamaşır', exact: true })).toBeDisabled();

      // Preferences live in their own disclosure since the Planla redesign.
      await page.locator('.activity-planner__prefs > summary').click();
      await page.getByRole('textbox', { name: 'Başlangıç' }).fill('18:00');
      await page.getByRole('textbox', { name: 'Bitiş' }).fill('20:00');
      await expect(page.getByText('18:00–20:00 uygunluğu').first()).toBeVisible();
      const runCard = page
        .locator('.activity-card')
        .filter({ has: page.getByRole('heading', { name: 'Koşu', exact: true }) });
      await runCard.locator('summary').click();
      await expect(runCard.getByText(/Koşuda 10–22°C/)).toBeVisible();
    }
  );

  test(
    'narrow English planner keeps disclosures working and content readable at 320px',
    MOBILE,
    async ({ page }) => {
      // 11:30 İstanbul: the fixture's 45 % rain hour (13:00) is inside the active hours, so the
      // main-risk line exists whenever CI runs.
      const pinned = createWeatherFixtures(VISUAL_FIXED_NOW);
      await page.clock.setFixedTime(new Date(VISUAL_FIXED_NOW));
      await overrideApiJson(page, 'current', pinned.current);
      await overrideApiJson(page, 'hourly', pinned.hourlyForecast);
      await seedSettings(page, { language: 'en' });
      await setWidth(page, 320, 720);
      await page.goto(PLAN);
      await expect(page.getByRole('heading', { name: 'Day plan' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'What are you doing today?' })).toBeAttached();
      await expect(page.locator('.daily-plan__quick > *')).toHaveCount(3);

      await page.locator('.activity-planner__prefs > summary').click();
      const windowHelp = page.locator('.activity-planner__window-help');
      await expect(windowHelp.locator('summary')).toHaveText('How it works');
      await expect(windowHelp.locator('p')).toBeHidden();
      await windowHelp.locator('summary').click();
      await expect(windowHelp.locator('p')).toContainText('wraps past midnight');
      await expectReadable(page, windowHelp, 'window help');
      await windowHelp.locator('summary').click();
      await expect(windowHelp.locator('p')).toBeHidden();

      const details = page.locator('.activity-card__details');
      await expect(details).toHaveCount(2);
      for (const detail of await details.all())
        await expect(detail).not.toHaveAttribute('open', '');
      await expect(page.locator('.activity-card__risk').first()).toBeVisible();
      await expect(page.locator('.activity-card__impact').first()).toBeHidden();
      await details.locator('summary').first().click();
      await expect(page.locator('.activity-card__impact').first()).toBeVisible();
      await expect(page.locator('.activity-card__criteria').first()).toBeVisible();

      for (const region of ['.daily-plan', '.activity-planner']) {
        await expectReadable(page, page.locator(region), `${region} at 320px`);
      }
    }
  );

  test(
    'coming days stay readable at 320px with 200% text and switch to an activity',
    MOBILE,
    async ({ page }) => {
      // Pinned clock: the five-day series starts at the next full hour after 11:30 İstanbul.
      const pinned = createWeatherFixtures(VISUAL_FIXED_NOW);
      await page.clock.setFixedTime(new Date(VISUAL_FIXED_NOW));
      await overrideApiJson(page, 'current', pinned.current);
      await overrideApiJson(page, 'hourly', {
        ...pinned.hourlyForecast,
        hourly: Array.from({ length: 120 }, (_, index) => ({
          ...pinned.hourlyForecast.hourly[index % 24],
          time: new Date(
            Math.ceil(VISUAL_FIXED_NOW / 3_600_000) * 3_600_000 + index * 3_600_000
          ).toISOString(),
        })),
      });
      await page.goto(PLAN);
      const outlook = page.locator('section.day-outlook');
      await expect(outlook.getByRole('heading', { name: 'Önümüzdeki günler' })).toBeVisible();
      await expect(outlook.locator('.day-outlook__day').first()).toContainText('Bugün');
      await expect(outlook.locator('.day-outlook__day').nth(1)).toContainText('Yarın');

      await setWidth(page, 320, 760);
      await setTextScale(page, 200);
      await expectReadable(page, outlook, 'coming days at 320px/200%');
      await expectNoHorizontalScroll(page, 'coming days at 320px/200%');

      const intents = outlook.locator('.day-outlook__intents button');
      if ((await intents.count()) > 1) {
        await intents.nth(1).click();
        await expect(intents.nth(1)).toHaveAttribute('aria-pressed', 'true');
        await expectReadable(page, outlook, 'coming days for an activity');
      }
    }
  );

  test(
    'expanded activity cards stay readable at 320px with 200% text',
    MOBILE,
    async ({ page }) => {
      await page.goto(PLAN);
      const planner = page.locator('section.activity-planner');
      const chips = planner.locator('.activity-planner__chips button');
      for (let index = 0; index < 2; index += 1) {
        if ((await chips.nth(index).getAttribute('aria-pressed')) !== 'true')
          await chips.nth(index).click();
      }
      await expect(planner.locator('.activity-card')).toHaveCount(2);
      await expect(planner.locator('.activity-card__identity .activity-glyph svg')).toHaveCount(2);
      await setWidth(page, 320, 760);
      await setTextScale(page, 200);
      const header = planner.locator('.activity-planner__header');
      const prefs = planner.locator('.activity-planner__prefs');
      await prefs.locator(':scope > summary').click();
      const sensitivity = planner.locator('.activity-planner__sensitivity');
      await expectReadable(page, header, 'planner header at 320px/200%');
      await expectContainedIn(header, planner, 'planner header');
      await expectReadable(page, prefs, 'preferences at 320px/200%');
      await expectContainedIn(sensitivity, prefs, 'sensitivity panel');
      expect(await sensitivity.evaluate(element => getComputedStyle(element).flexBasis)).toBe(
        'auto'
      );
      await planner.locator('.activity-planner__score-explanation').evaluate(element => {
        (element as HTMLDetailsElement).open = true;
      });
      await planner.locator('.activity-card__details').evaluateAll(elements => {
        elements.forEach(element => {
          (element as HTMLDetailsElement).open = true;
        });
      });
      for (const card of await planner.locator('.activity-card').all()) {
        await expectContainedIn(card.locator('.activity-card__score'), card, 'activity score');
      }
      await expectReadable(page, planner, 'planner at 320px/200%');
    }
  );

  test('activity disclosures keep a visible keyboard focus ring', DESKTOP, async ({ page }) => {
    await page.goto(PLAN);
    await page.locator('.activity-planner__prefs > summary').click();
    for (const summary of [
      page.locator('.activity-planner__window-help summary'),
      page.locator('.activity-planner__score-explanation summary'),
      page.locator('.activity-card__details summary').first(),
    ]) {
      await expect(summary).toBeVisible();
      await expectVisibleFocusRing(summary, { insideClippingRail: true });
    }
  });
});

test.describe('daylight (plan v3 Faz 0.3)', () => {
  // 22 Ekim 2026 21:00 İstanbul: calm, dry, comfortable night hours used to win
  // ("Koşu 100, piknik 100, en uygun aralık 21:00–01:00"; çamaşır 01:00–05:00).
  const EVENING = Date.parse('2026-10-22T18:00:00.000Z');
  const HOUR = 60 * 60_000;
  const localHour = (offsetHours: number) => (21 + offsetHours) % 24;
  const isDayHour = (hour: number) => hour >= 8 && hour < 18;

  test(
    'at 21:00 Planla never recommends night hours for the day plan or activities',
    DESKTOP,
    async ({ page }) => {
      const evening = createWeatherFixtures(EVENING);
      const hourly = Array.from({ length: 36 }, (_, index) => {
        const isDay = isDayHour(localHour(index));
        return {
          time: new Date(EVENING + index * HOUR).toISOString(),
          temp: isDay ? 24 : 18,
          apparentTemperature: isDay ? 25 : 18,
          humidity: isDay ? 45 : 60,
          pop: isDay ? 15 : 0,
          precipitationMm: 0,
          windSpeed: isDay ? 7 : 2,
          windGust: isDay ? 12 : 4,
          uvIndex: isDay ? 4 : 0,
          visibility: 20000,
          weatherCode: 0,
          icon: isDay ? '01d' : '01n',
          isDay,
          description: 'açık',
        };
      });
      await overrideApiJson(page, 'current', {
        ...evening.current,
        icon: '01n',
        temperature: 18,
        feelsLike: 18,
      });
      await overrideApiJson(page, 'forecast', evening.forecast);
      await overrideApiJson(page, 'hourly', { ...evening.hourlyForecast, hourly });
      await overrideApiJson(page, 'air', evening.air);
      await overrideApiJson(page, 'context', evening.context);
      await page.clock.setFixedTime(new Date(EVENING));

      await page.goto(PLAN);
      await page.getByRole('button', { name: 'Piknik', exact: true }).click();
      const cards = page.locator('.activity-card');
      await expect(cards).toHaveCount(3);

      // A range "start–end" ends when its last slot ends, so the recommended hours are
      // start … end-1: "21:00–23:00" means the 21:00 and 22:00 slots.
      const rangeHours = (text: string) => {
        const [start, end] = [...text.matchAll(/(\d{2}):00/g)].map(match => Number(match[1]));
        if (start === undefined) return [];
        if (end === undefined) return [start];
        const hours: number[] = [];
        for (let hour = start; hour !== end; hour = (hour + 1) % 24) hours.push(hour);
        return hours;
      };
      const dayPlanText = (await page.locator('.daily-plan__decision').innerText()) ?? '';
      expect(dayPlanText).not.toContain('21:00–01:00');
      for (const hour of rangeHours(dayPlanText)) {
        expect(hour >= 7 && hour < 23, `day plan hour ${hour}`).toBe(true);
      }

      for (const [name, allowed] of [
        ['Yürüyüş', (hour: number) => hour >= 7 && hour < 23],
        ['Koşu', (hour: number) => hour >= 7 && hour < 23],
        ['Piknik', isDayHour],
      ] as const) {
        const card = cards.filter({ has: page.getByRole('heading', { name, exact: true }) });
        const best = card.locator(':scope > p').first();
        await expect(best).toContainText(/\d{2}:00/);
        const hours = rangeHours(await best.innerText());
        expect(hours.length, name).toBeGreaterThan(0);
        for (const hour of hours) expect(allowed(hour), `${name} hour ${hour}`).toBe(true);
      }
    }
  );
});

test.describe('commute (Çıkış planı)', () => {
  test(
    'out-and-back plan persists routine times and produces a preparation decision',
    DESKTOP,
    async ({ page }) => {
      await overrideApiJson(page, 'hourly', fixtures.hourlyFromNow());
      await page.clock.setFixedTime(new Date(fixtureNow));
      const outboundClock = fixtures.localClockAt(2);
      const returnClock = fixtures.localClockAt(5);

      await page.goto(PLAN);
      await expect(page.getByRole('heading', { name: 'Çıkış planı' })).toBeVisible();
      await page.getByRole('textbox', { name: 'Çıkış', exact: true }).fill(outboundClock);
      await page.getByRole('textbox', { name: 'Dönüş', exact: true }).fill(returnClock);
      const verdict = page.locator('.commute-plan__verdict');
      await expect(verdict).toBeVisible();
      await expect(verdict.locator('strong')).not.toHaveText('');
      await expect(verdict).toHaveAttribute(
        'data-advice',
        /^(umbrella-take|umbrella-consider|heat|cold|strong-wind|wind-caution|poor-air|stable)$/
      );
      await expect(
        page.getByRole('list', { name: 'Çıkış ve dönüş hava pencereleri' })
      ).toBeVisible();

      await page.reload();
      await expect(page.getByRole('textbox', { name: 'Çıkış', exact: true })).toHaveValue(
        outboundClock
      );
      await expect(page.getByRole('textbox', { name: 'Dönüş', exact: true })).toHaveValue(
        returnClock
      );
    }
  );

  test('commute windows reflow at 200% text on phones', MOBILE, async ({ page }) => {
    await overrideApiJson(page, 'hourly', fixtures.hourlyFromNow());
    await page.clock.setFixedTime(new Date(fixtureNow));
    await page.goto(PLAN);
    await setTextScale(page, 200);
    await page.getByRole('textbox', { name: 'Çıkış', exact: true }).fill(fixtures.localClockAt(2));
    await page.getByRole('textbox', { name: 'Dönüş', exact: true }).fill(fixtures.localClockAt(5));
    await expect(page.locator('.commute-plan__verdict')).toBeVisible();
    await expect(page.locator('.commute-window')).toHaveCount(2);
    for (const width of [320, 390]) {
      await setWidth(page, width, 844);
      await expectReadable(page, page.locator('.commute-plan'), `commute at ${width}px/200%`);
    }
  });
});

test.describe('route weather', () => {
  test('route weather renders a transparent corridor result', DESKTOP, async ({ page }) => {
    await page.goto(PLAN);
    await page.getByText('Rota havası', { exact: true }).click();
    await page.getByRole('button', { name: /koridoru kontrol et/i }).click();
    await expect(page.getByRole('heading', { name: /İstanbul → Ankara/i })).toBeVisible();
    await expect(page.getByText(/gerçek yol\/navigasyon rotası değildir/i)).toBeVisible();
    await expect(
      page.getByRole('list', { name: /rota boyunca hava örnekleri/i }).getByRole('listitem')
    ).toHaveCount(5);
  });

  test('route disclosure keeps a visible keyboard focus ring', DESKTOP, async ({ page }) => {
    await page.goto(PLAN);
    await expectVisibleFocusRing(page.locator('.route-weather > summary'), {
      insideClippingRail: true,
    });
  });

  test('narrow route form keeps endpoints usable and swaps direction', MOBILE, async ({ page }) => {
    await setWidth(page, 320, 720);
    await page.goto(PLAN);
    await page.getByText('Rota havası', { exact: true }).click();
    const form = page.locator('.route-weather__form');
    const origin = form.getByLabel('Başlangıç');
    const destination = form.getByLabel('Varış');
    const swap = form.getByRole('button', { name: 'Yönü değiştir' });
    await expect(origin).toHaveValue('İstanbul');
    await expect(destination).toHaveValue('Ankara');
    for (const control of [origin, destination, swap]) {
      await expectWithinViewportWidth(control, 'route control');
      await expectTouchTarget(control, 'route control');
    }
    await expectNoHorizontalScroll(page);

    await swap.click();
    await expect(origin).toHaveValue('Ankara');
    await expect(destination).toHaveValue('İstanbul');
  });

  test(
    'mobile route corridor scrolls horizontally inside its own rail',
    MOBILE,
    async ({ page }) => {
      await page.goto(PLAN);
      await page.getByText('Rota havası', { exact: true }).click();
      await page.getByRole('button', { name: /koridoru kontrol et/i }).click();
      await expect(page.getByRole('heading', { name: /İstanbul → Ankara/i })).toBeVisible();
      const segments = page.locator('.route-weather__segments');
      expect(await segments.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(
        true
      );
      await segments.evaluate(element => {
        element.scrollLeft = 120;
      });
      expect(await segments.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      await expectNoHorizontalScroll(page);
    }
  );
});
