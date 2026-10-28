import { DESKTOP, MOBILE, expect, test } from './helpers/test';
import { ensureForecastAtlasLoaded } from './helpers/forecast';
import { expectReadable, setTextScale, setWidth } from './helpers/layout';
import { fixtures, overrideApi, seedSettings } from './helpers/weather-fixtures';

const { current } = fixtures;

test('core city experience renders and uses a shareable city URL', async ({ page }) => {
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page).toHaveURL(/\/istanbul\/$/);
  await expect(page.getByText(/OpenWeather/)).toBeVisible();
  await ensureForecastAtlasLoaded(page);
  const hourlySection = page.getByRole('region', { name: /Saatlik tahmin · sonraki 24 saat/i });
  await expect(
    page.getByRole('heading', { name: /Saatlik tahmin · sonraki 24 saat/i })
  ).toBeVisible();
  await expect(hourlySection.getByRole('link', { name: 'Open-Meteo' })).toHaveAttribute(
    'href',
    'https://open-meteo.com/'
  );
  await expect(hourlySection.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute(
    'href',
    'https://creativecommons.org/licenses/by/4.0/'
  );
  await expect(page.locator('.hava81-forecast-atlas__source')).toContainText(
    'Hava81 tarafından biçimlendirildi'
  );
  await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(24);
  // Faz 2.3: plan, activities and route are one step away in Planla, not in the main flow.
  await expect(page.getByRole('heading', { name: /Gün planı/i })).toBeHidden();
  await page.getByRole('button', { name: 'Planla', exact: true }).click();
  await expect(page).toHaveURL(/\?view=plan$/);
  await expect(page.getByRole('heading', { name: /Gün planı/i })).toBeVisible();
  const dailyPlan = page.locator('.daily-plan');
  await expect(dailyPlan).toContainText('%45 · 0,2 mm');
  await expect(dailyPlan.getByText('Makul', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Bugün ne yapacaksın/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Güneş, toz, polen ve deniz/i })).toBeVisible();
  await expect(page.getByText('UV · 24s model maksimumu', { exact: true })).toBeVisible();
  await expect(page.getByText('Rota havası', { exact: true })).toBeVisible();
});

test.describe('routing and location', () => {
  test(
    'browser history can return from a city view to the root location gate',
    DESKTOP,
    async ({ page }) => {
      await page.goto('/istanbul/');
      await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

      await page.evaluate(() => {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      await expect(page.locator('.atlas-empty--location')).toBeVisible();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toHaveCount(0);
      await expect(page).toHaveTitle('Hava81 — Havayı değil, gününü planla');
      // A local preview may use its own origin, while SEO audits deliberately keep the
      // public production canonical. Accept only those two exact root URLs, never a third host.
      const canonicalHref = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect([new URL('/', page.url()).href, 'https://hava81.zekiakgul.dev/']).toContain(canonicalHref);
    }
  );

  test(
    'root route shows İstanbul immediately without requesting browser location',
    MOBILE,
    async ({ page }) => {
      await page.addInitScript(() => {
        const w = window as Window & { __initialGeoCalls?: number };
        w.__initialGeoCalls = 0;
        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: {
            getCurrentPosition: () => {
              w.__initialGeoCalls = (w.__initialGeoCalls ?? 0) + 1;
            },
          },
        });
      });

      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
      await expect(page).toHaveURL(/\/istanbul\/?$/);
      expect(
        await page.evaluate(
          () => (window as Window & { __initialGeoCalls?: number }).__initialGeoCalls
        )
      ).toBe(0);
    }
  );

  test(
    'location denial explains the failure and stays readable at 200% text',
    MOBILE,
    async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: {
            getCurrentPosition: (_success: PositionCallback, failure?: PositionErrorCallback) => {
              failure?.({ code: 1 } as GeolocationPositionError);
            },
          },
        });
      });
      await page.goto('/istanbul');
      await page.getByRole('button', { name: 'Konumumu Kullan' }).click();

      await expect(page.getByText('Konum izni reddedildi')).toBeVisible();
      await expect(page.getByText('Bir şeyler ters gitti')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Tekrar Dene' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Kapat' })).toBeVisible();

      await setWidth(page, 320, 844);
      await setTextScale(page, 200);
      await expectReadable(
        page,
        page.locator('.atlas-message--error'),
        'location error at 320px/200%'
      );
    }
  );

  test(
    'current location keeps exact coordinates but uses the canonical province identity',
    MOBILE,
    async ({ page }) => {
      await overrideApi(page, 'current', route => {
        const isCoordinateRequest = new URL(route.request().url()).searchParams.has('lat');
        return route.fulfill({
          json: isCoordinateRequest
            ? { ...current, cityName: 'Ulus', coordinates: { lat: 39.9334, lon: 32.8597 } }
            : current,
        });
      });
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: {
            getCurrentPosition: (success: PositionCallback) => {
              success({ coords: { latitude: 39.9334, longitude: 32.8597 } } as GeolocationPosition);
            },
          },
        });
      });
      await page.goto('/istanbul');
      await page.getByRole('button', { name: 'Konumumu Kullan' }).click();

      await expect(page.getByRole('heading', { name: 'Ankara', level: 1 })).toBeVisible();
      await expect(page.getByLabel('Plaka kodu 06')).toBeVisible();
      await expect(page).toHaveURL(/\/ankara\/?$/);
    }
  );
});

test.describe('language and theme', () => {
  test('English mode updates document language and decision copy', DESKTOP, async ({ page }) => {
    await seedSettings(page, { language: 'en' });
    await page.goto('/istanbul/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('İstanbul weather — Hava81');
    await expect(page.getByRole('heading', { name: 'Planning signals' })).toBeVisible();
    const decisions = page.locator('.hava81-decision-field__decision-list');
    await expect(decisions).not.toContainText('civarında');
    await expect(decisions).not.toContainText('güneş koruması');
  });

  test(
    'theme choice switches color mode and keeps browser chrome color in sync',
    DESKTOP,
    async ({ page }) => {
      const themeColors = () =>
        page
          .locator('meta[name="theme-color"]')
          .evaluateAll(elements => elements.map(element => (element as HTMLMetaElement).content));

      await page.goto('/istanbul');
      await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'light');
      await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
      expect(await themeColors()).toEqual(['#F3F6F4', '#F3F6F4']);

      await page.getByRole('button', { name: /ayarlar/i }).click();
      await page.getByRole('button', { name: 'Koyu' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
      expect(await themeColors()).toEqual(['#0E2C32', '#0E2C32']);
    }
  );
});
