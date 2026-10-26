import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import { ensureForecastAtlasLoaded } from './helpers/forecast';
import {
  expectBeforeInDom,
  expectContainedIn,
  expectNoHorizontalScroll,
  expectNoOverlap,
  expectReadable,
  expectTextNotClipped,
  expectVisibleFocusRing,
  expectWithinViewportWidth,
  setTextScale,
  setWidth,
} from './helpers/layout';
import {
  createWeatherFixtures,
  fixtures,
  overrideApiJson,
  overrideDaily,
  seedSettings,
  VISUAL_FIXED_NOW,
} from './helpers/weather-fixtures';

const { localDate } = fixtures;

// Ritim: hourly forecast atlas (chart, interval chooser, summary) and the 5-day list.

const failForecast = async (page: import('@playwright/test').Page) => {
  // Non-retryable 400s: this covers the error state, not network backoff timing.
  await overrideApiJson(page, 'forecast', { error: 'forced forecast failure' }, 400);
  await overrideApiJson(page, 'hourly', { error: 'forced forecast failure' }, 400);
};

test.describe('forecast errors', () => {
  test('failed forecast keeps a visible card in the forecast slot', DESKTOP, async ({ page }) => {
    await failForecast(page);
    await page.goto('/istanbul/');
    const decision = page.locator('.hava81-decision-field');
    await expect(decision).toBeVisible();
    const fallback = page.locator('.atlas-forecast-error-card');
    await expect(fallback.getByRole('heading', { name: 'Bugünün ritmi' })).toBeVisible();
    await expect(fallback.getByRole('status')).toContainText('Yakın tahmin');
    await expect(fallback.getByRole('button', { name: 'Tekrar dene' })).toHaveCount(0);
    // The card holds the forecast slot in the first screen instead of leaving it blank.
    await expect(fallback).toBeInViewport();
    await expectNoOverlap(fallback, decision, 'fallback vs decision field');
    await expectNoHorizontalScroll(page);

    await setWidth(page, 320, 844);
    await setTextScale(page, 200);
    await expectReadable(page, fallback, 'fallback at 320px/200%');
  });

  test(
    'mobile forecast error message precedes the environment rail and reflows at 200% text',
    MOBILE,
    async ({ page }) => {
      await failForecast(page);
      await setWidth(page, 320, 844);
      await page.goto('/istanbul');
      const message = page.locator('.atlas-message--inline');
      await expect(message).toBeVisible();
      await expect(page.locator('.environment-rail')).toBeVisible();
      await expectBeforeInDom(
        message,
        page.locator('.environment-rail'),
        'error before environment rail'
      );
      await setTextScale(page, 200);
      await expectReadable(page, message, 'forecast error at 320px/200%');
    }
  );
});

test.describe('hourly atlas', () => {
  test('hourly interval controls resample the same 24-hour forecast', DESKTOP, async ({ page }) => {
    // 11:30 İstanbul: the 24-hour series starts at 12:00, which the sampled labels below assert.
    const pinned = createWeatherFixtures(VISUAL_FIXED_NOW);
    await page.clock.setFixedTime(new Date(VISUAL_FIXED_NOW));
    await overrideApiJson(page, 'current', pinned.current);
    await overrideApiJson(page, 'hourly', pinned.hourlyForecast);
    await page.goto('/istanbul');
    await ensureForecastAtlasLoaded(page);

    const interval = page.getByRole('group', { name: 'Gösterim aralığı' });
    await expect(page.getByText(/24 saatlik tahmin sabit kalır/i)).toBeVisible();
    await expect(interval).toHaveAttribute('aria-describedby', /-interval-help$/);
    await expect(
      interval.getByRole('button', { name: '1sa Her 1 saatte bir göster' })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(interval.getByRole('button')).toHaveCount(7);
    for (const hours of [2, 3, 4, 6, 8, 12]) {
      await expect(
        interval.getByRole('button', {
          name: `${hours}sa Her ${hours} saatte bir göster`,
          exact: true,
        })
      ).toBeVisible();
    }
    await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(24);

    const displayedTimes = async () =>
      page.locator('.hava81-forecast-atlas__hour time > span:last-child').allTextContents();

    await interval
      .getByRole('button', { name: '2sa Her 2 saatte bir göster', exact: true })
      .click();
    await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(12);

    await interval.getByRole('button', { name: '3sa Her 3 saatte bir göster' }).click();
    await expect(
      page.getByRole('heading', { name: /Saatlik tahmin · sonraki 24 saat/i })
    ).toBeVisible();
    await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(8);
    expect((await displayedTimes()).slice(0, 4)).toEqual(['12:00', '15:00', '18:00', '21:00']);
    await expect(page.locator('.hava81-forecast-atlas__hour-day')).toHaveCount(1);
    await expect(page.locator('.hava81-forecast-atlas__hour.is-day-boundary')).toContainText(
      '00:00'
    );

    await interval.getByRole('button', { name: '4sa Her 4 saatte bir göster' }).click();
    await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(6);

    await interval.getByRole('button', { name: '6sa Her 6 saatte bir göster' }).click();
    await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(4);
    expect(await displayedTimes()).toEqual(['12:00', '18:00', '00:00', '06:00']);

    await interval.getByRole('button', { name: '8sa Her 8 saatte bir göster' }).click();
    await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(3);

    await interval.getByRole('button', { name: '12sa Her 12 saatte bir göster' }).click();
    await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(2);
    expect(await displayedTimes()).toEqual(['12:00', '00:00']);
  });

  test(
    'hourly display falls back to the existing three-hour forecast when the hourly source fails',
    DESKTOP,
    async ({ page }) => {
      await overrideApiJson(page, 'hourly', { error: { code: 'HOURLY_PROVIDER_ERROR' } }, 503);

      await page.goto('/istanbul');
      await ensureForecastAtlasLoaded(page);
      await expect(page.getByRole('heading', { name: /3 saat aralıklarla tahmin/i })).toBeVisible();
      await page.getByRole('button', { name: /Planla’yı aç/ }).click();
      await expect(page.getByRole('heading', { name: /Gün planı/i })).toBeVisible();
    }
  );

  test(
    'lazy forecast atlas renders hourly and daily guidance after city data loads',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/istanbul');
      await ensureForecastAtlasLoaded(page);
      await expect(page.getByRole('heading', { name: 'Bugünün ritmi' })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /Saatlik tahmin · sonraki 24 saat/i })
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: /5 Günlük Tahmin/i })).toBeVisible();
      await expect(
        page.getByRole('region', { name: /Kaydırılabilir saatlik tahmin/i })
      ).toBeVisible();
    }
  );

  test(
    'mobile first viewport defers the hourly chart chunk until its section nears the viewport',
    MOBILE,
    async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 480 });
      const chartChunkRequests: string[] = [];
      page.on('request', request => {
        const pathname = new URL(request.url()).pathname;
        if (/\/ForecastAtlas-[^/]+\.js$/.test(pathname)) chartChunkRequests.push(pathname);
      });

      await page.goto('/istanbul/');
      const deferred = page.locator('.atlas-forecast-loading--card');
      await expect(deferred).toContainText(
        'Saatlik tahmin, bu bölüm ekrana yaklaştığında yüklenir.'
      );
      await expect(deferred).not.toBeInViewport();
      await expect(page.locator('.hava81-forecast-atlas')).toHaveCount(0);
      expect(chartChunkRequests).toHaveLength(0);

      await deferred.scrollIntoViewIfNeeded();
      await expect(
        page.getByRole('heading', { name: /Saatlik tahmin · sonraki 24 saat/i })
      ).toBeVisible();
      await expect.poll(() => chartChunkRequests.length).toBeGreaterThan(0);
    }
  );

  test(
    'narrow hourly atlas keeps every interval, its summary and a sticky axis usable',
    MOBILE,
    async ({ page }) => {
      await setWidth(page, 320, 720);
      await page.goto('/istanbul');
      await ensureForecastAtlasLoaded(page);

      const interval = page.getByRole('group', { name: 'Gösterim aralığı' });
      // Guidance is available to assistive technology without a long visible paragraph.
      const intervalHelp = page.locator('.hava81-forecast-atlas__range-help');
      await expect(intervalHelp).toContainText('24 saatlik tahmin sabit kalır');
      expect(await interval.getAttribute('aria-describedby')).toBe(
        await intervalHelp.getAttribute('id')
      );
      const options = interval.getByRole('button');
      await expect(options).toHaveCount(7);

      // All seven sampling options are reachable without a horizontal swipe, also at 200% text.
      for (const [width, scale] of [
        [320, 100],
        [320, 200],
        [360, 200],
      ] as const) {
        await setWidth(page, width, 844);
        await setTextScale(page, scale);
        const at = `${width}px/${scale}%`;
        for (const option of await options.all())
          await expectContainedIn(option, interval, `interval option ${at}`);
        expect(
          await interval.evaluate(element => element.scrollWidth <= element.clientWidth + 1),
          `no hidden intervals ${at}`
        ).toBe(true);
        await expectNoHorizontalScroll(page, at);
        // The Turkish "1sa"…"12sa" labels stay inside their buttons (overflow-wrap: anywhere).
        await expectTextNotClipped(interval, `interval labels ${at}`);
      }
      await setWidth(page, 390, 844);
      await expectTextNotClipped(interval, 'interval labels at 390px/200%');
      await setWidth(page, 320, 720);
      await setTextScale(page, 100);
      await options.last().click();
      await expect(options.last()).toHaveAttribute('aria-pressed', 'true');
      await options.first().click();
      await expect(options.first()).toHaveAttribute('aria-pressed', 'true');

      const summary = page.getByRole('list', { name: 'Saatlik tahmin özeti' });
      await expect(summary.getByRole('listitem')).toHaveCount(3);
      for (const item of await summary.getByRole('listitem').all())
        await expectWithinViewportWidth(item, 'summary item');

      // The temperature axis stays in place while the hourly rail scrolls.
      const axisLabels = page.locator('.hava81-forecast-atlas__axis-label');
      expect(await axisLabels.count()).toBeGreaterThanOrEqual(2);
      expect((await axisLabels.allTextContents()).every(label => label.endsWith('°'))).toBe(true);
      const axisX = () =>
        axisLabels.evaluateAll(elements =>
          elements.map(element => element.getBoundingClientRect().x)
        );
      const before = await axisX();
      const hourlyViewport = page.locator('.hava81-forecast-atlas__hourly-viewport');
      await hourlyViewport.evaluate(element => {
        element.scrollLeft = 360;
      });
      expect((await axisX()).every((x, index) => Math.abs(x - before[index]) < 1)).toBe(true);
      expect(await hourlyViewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);

      // Hour labels, day markers and "now" stay legible.
      await expectTextNotClipped(
        page.locator('.hava81-forecast-atlas__hourly-viewport'),
        'hour labels'
      );
      await expectVisibleFocusRing(hourlyViewport, { insideClippingRail: true });
      await expectNoHorizontalScroll(page);
    }
  );

  test(
    'mobile hourly forecast offers accessible forward and back navigation',
    MOBILE,
    async ({ page }) => {
      await page.goto('/izmir/');
      await ensureForecastAtlasLoaded(page);
      const chart = page.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i });
      await expect(chart).toBeVisible();
      const navigation = page.getByRole('group', { name: 'Saatlik tahminde gezin' });
      await expect(navigation).toBeVisible();
      const previous = navigation.getByRole('button', { name: 'Önceki saatleri göster' });
      const next = navigation.getByRole('button', { name: 'Sonraki saatleri göster' });
      await expect(previous).toBeDisabled();
      await expect(next).toBeEnabled();
      await next.click();
      await expect.poll(() => chart.evaluate(el => el.scrollLeft)).toBeGreaterThan(10);
      await expect(previous).toBeEnabled();
      await previous.click();
      await expect.poll(() => chart.evaluate(el => el.scrollLeft)).toBeLessThan(17);
      await expect(previous).toBeDisabled();
      await expect(next).toBeEnabled();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);

      // Sampling down the 24-hour forecast avoids needless navigation controls.
      await page.getByRole('button', { name: /12sa.*12 saatte bir göster/i }).click();
      await expect(navigation).toBeHidden();
    }
  );

  test(
    'hourly forecast arrows reveal the rest of the 24 hours on tablet and desktop',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/izmir/');
      await ensureForecastAtlasLoaded(page);
      const viewport = page.locator('.hava81-forecast-atlas__hourly-viewport');
      await expect(viewport).toBeVisible();
      const navigation = page.locator('.hava81-forecast-atlas__scroll-navigation');
      const previous = navigation.getByRole('button', { name: 'Önceki saatleri göster' });
      const next = navigation.getByRole('button', { name: 'Sonraki saatleri göster' });

      for (const width of [768, 1440]) {
        await setWidth(page, width, 900);
        await expect(navigation, `navigation visible at ${width}px`).toBeVisible();
        await expect(next).toBeEnabled();
        await next.click();
        await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(100);
        await expect(previous).toBeEnabled();
        await previous.click();
        await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeLessThan(17);
        await expect(previous).toBeDisabled();
        await expectNoHorizontalScroll(page, `${width}px`);
      }
    }
  );

  test(
    'English hourly forecast shows one-line AM/PM clock labels on narrow phones',
    MOBILE,
    async ({ page }) => {
      await seedSettings(page, { language: 'en' });
      await page.goto('/istanbul/');
      await ensureForecastAtlasLoaded(page);
      const forecast = page.locator('.hava81-forecast-atlas');
      await expect(forecast).toBeVisible();
      const times = forecast.locator('.hava81-forecast-atlas__hour time > span:last-child');
      for (const width of [320, 390]) {
        await setWidth(page, width, 844);
        expect(await times.count()).toBeGreaterThanOrEqual(12);
        expect(
          (await times.allTextContents()).every(text =>
            /^(?:[1-9]|1[0-2])\s(?:AM|PM)$/.test(text.trim())
          )
        ).toBe(true);
        const wrapped = await times.evaluateAll(
          elements =>
            elements.filter(
              element =>
                element.getBoundingClientRect().height >
                parseFloat(getComputedStyle(element).lineHeight) + 2
            ).length
        );
        expect(wrapped, `clock labels stay on one line at ${width}px`).toBe(0);
        await expectTextNotClipped(
          forecast.locator('.hava81-forecast-atlas__hourly-viewport'),
          `${width}px`
        );
        await expectNoHorizontalScroll(page, `${width}px`);
      }
    }
  );

  test(
    'narrow English hourly summary keeps long precipitation copy readable',
    MOBILE,
    async ({ page }) => {
      await seedSettings(page, { language: 'en', themeMode: 'dark' });
      await setWidth(page, 320, 720);
      await page.goto('/istanbul');
      await ensureForecastAtlasLoaded(page);
      const summary = page.getByRole('list', { name: 'Hourly forecast summary' });
      const rainItem = summary.getByRole('listitem').filter({ hasText: 'Rain peak' });
      await expect(rainItem).toContainText('45% · 0.2 mm');
      for (const width of [320, 390]) {
        await setWidth(page, width, 844);
        await expectReadable(page, rainItem, `rain summary at ${width}px`);
      }
    }
  );
});

test.describe('five-day forecast', () => {
  test(
    'mobile five-day forecast lists every day without horizontal scrolling',
    MOBILE,
    async ({ page }) => {
      const fiveDays = Array.from({ length: 5 }, (_, index) => ({
        date: localDate(index),
        tempMin: 18 + index,
        tempMax: 25 + index,
        icon: index % 2 === 0 ? '02d' : '10d',
        description: index % 2 === 0 ? 'parçalı bulutlu' : 'hafif yağmurlu',
        pop: index % 2 === 0 ? 15 : 55,
      }));
      await overrideDaily(page, fiveDays);
      await page.goto('/istanbul');
      await ensureForecastAtlasLoaded(page);
      const days = page.locator('.hava81-forecast-atlas__days');
      await expect(days).toBeVisible();
      await expect(days).toHaveAttribute('tabindex', '0');
      const rows = days.locator('.hava81-forecast-atlas__day');
      expect(await rows.count()).toBeGreaterThanOrEqual(5);
      for (const row of await rows.all()) await expectWithinViewportWidth(row, 'day row');
      expect(await days.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(
        true
      );
      await expectTextNotClipped(days);
      await expectNoHorizontalScroll(page);
    }
  );

  test(
    'mobile daily forecast wraps long English conditions at 200% text',
    MOBILE,
    async ({ page }) => {
      await seedSettings(page, { language: 'en', themeMode: 'dark' });
      await overrideDaily(page, [
        {
          date: localDate(),
          tempMin: 20,
          tempMax: 28,
          icon: '11d',
          description: 'thunderstorms with heavy rain',
          pop: 73,
        },
        {
          date: localDate(1),
          tempMin: 18,
          tempMax: 25,
          icon: '10d',
          description: 'partly cloudy with scattered showers',
          pop: 48,
        },
      ]);
      await page.goto('/istanbul');
      await ensureForecastAtlasLoaded(page);
      await setTextScale(page, 200);
      const days = page.locator('.hava81-forecast-atlas__day');
      await expect(days).toHaveCount(2);
      await expect(page.getByText('thunderstorms with heavy rain')).toBeVisible();
      await expect(page.getByText('partly cloudy with scattered showers')).toBeVisible();
      await expectReadable(page, page.locator('.hava81-forecast-atlas__days'), '390px/200%');
      await expectTextNotClipped(page.locator('.hava81-forecast-atlas__range'), 'interval labels');
    }
  );

  test(
    'desktop daily forecast keeps full condition labels across widths and at 200% text',
    DESKTOP,
    async ({ page }) => {
      await overrideDaily(page, [
        {
          date: localDate(),
          tempMin: 20,
          tempMax: 28,
          icon: '02d',
          description: 'parçalı bulutlu',
          pop: 10,
        },
        {
          date: localDate(1),
          tempMin: 17,
          tempMax: 23,
          icon: '11d',
          description: 'gök gürültülü fırtına',
          pop: 73,
          precipitationMm: 11.6,
        },
      ]);
      await page.goto('/istanbul');
      await ensureForecastAtlasLoaded(page);
      const days = page.locator('.hava81-forecast-atlas__days');
      await expect(page.locator('.hava81-forecast-atlas__description')).toHaveCount(2);
      await expect(page.getByText('gök gürültülü fırtına')).toBeVisible();
      for (const [width, scale] of [
        [1280, 100],
        [1024, 100],
        [1024, 200],
        [1280, 200],
      ] as const) {
        await setWidth(page, width, 900);
        await setTextScale(page, scale);
        await expectReadable(page, days, `${width}px/${scale}%`);
      }
    }
  );
});
