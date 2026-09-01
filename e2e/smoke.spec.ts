import { expect, test } from '@playwright/test';

const fixtureNow = Date.now();
const fixtureIsoAtHour = (offsetHours: number) =>
  new Date(fixtureNow + offsetHours * 60 * 60_000).toISOString();
const fixtureLocalDate = (offsetDays = 0) =>
  new Date(fixtureNow + 3 * 60 * 60_000 + offsetDays * 24 * 60 * 60_000).toISOString().slice(0, 10);

const current = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 23,
  feelsLike: 23,
  tempMin: 19,
  tempMax: 27,
  humidity: 58,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 4.2,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: fixtureIsoAtHour(-6),
  sunset: fixtureIsoAtHour(6),
  timestamp: fixtureIsoAtHour(0),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 5,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date().toISOString(),
    timezoneOffsetSeconds: 10800,
    cacheStatus: 'MISS',
    freshForSeconds: 60,
  },
};
const forecast = {
  daily: [
    { date: fixtureLocalDate(), tempMin: 19, tempMax: 27, icon: '01d', description: 'açık', pop: 10 },
  ],
  hourly: [
    {
      time: fixtureIsoAtHour(1),
      temp: 23,
      icon: '01d',
      description: 'açık',
      pop: 10,
      windSpeed: 4,
    },
    {
      time: fixtureIsoAtHour(4),
      temp: 26,
      icon: '01d',
      description: 'açık',
      pop: 5,
      windSpeed: 5,
    },
  ],
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date().toISOString(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 3,
    cacheStatus: 'MISS',
    freshForSeconds: 300,
  },
};
const hourlyForecast = {
  hourly: Array.from({ length: 24 }, (_, index) => ({
    time: new Date(Date.parse('2026-08-28T09:00:00.000Z') + index * 60 * 60_000).toISOString(),
    temp: 22 - Math.floor(index / 6),
    icon: index < 3 ? '01d' : '02n',
    description: index < 3 ? 'açık' : 'çoğunlukla açık',
    pop: index === 4 ? 45 : 10,
    precipitationMm: index === 4 ? 0.2 : 0,
    windSpeed: 3 + index * 0.05,
  })),
  meta: {
    provider: 'Open-Meteo',
    attribution: 'Open-Meteo · CC BY 4.0',
    sourceUrl: 'https://open-meteo.com/',
    fetchedAt: new Date().toISOString(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 1,
    cacheStatus: 'MISS',
    freshForSeconds: 300,
  },
};

const air = {
  aqi: 2,
  aqiLabel: 'Orta',
  pm25: 9,
  pm10: 14,
  o3: 42,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date().toISOString(),
    cacheStatus: 'MISS',
    freshForSeconds: 120,
  },
};
const context = {
  provider: 'Open-Meteo',
  fetchedAt: new Date().toISOString(),
  attribution: 'Open-Meteo · CC BY 4.0',
  uvIndexMax: 7.1,
  dustMax: 12,
  grassPollenMax: 4,
  olivePollenMax: 1,
  units: {
    dust: 'μg/m³',
    grassPollen: 'grains/m³',
    olivePollen: 'grains/m³',
    waveHeight: 'm',
    seaSurfaceTemperature: '°C',
  },
  marine: { observedAt: new Date().toISOString(), waveHeight: 0.3, seaSurfaceTemperature: 24.8 },
};

const routeRequestedDeparture = new Date();
const routeDurationMinutes = 331;
const routeResult = {
  kind: 'corridor-estimate',
  estimatedDistanceKm: 413,
  estimatedDurationMinutes: routeDurationMinutes,
  requestedDeparture: routeRequestedDeparture.toISOString(),
  score: 84,
  segments: [0, 0.25, 0.5, 0.75, 1].map((fraction, index) => ({
    fraction,
    lat: 41 - index * 0.25,
    lon: 29 + index * 0.9,
    eta: new Date(
      routeRequestedDeparture.getTime() + routeDurationMinutes * 60_000 * fraction
    ).toISOString(),
    temperature: 22 + index,
    precipitationProbability: index === 2 ? 30 : 5,
    windSpeed: 4 + index,
    description: index === 2 ? 'hafif yağmur' : 'açık',
    score: index === 2 ? 70 : 88,
    risk: index === 2 ? 'caution' : 'low',
  })),
  disclaimer: 'Bu sonuç gerçek yol/navigasyon rotası değildir.',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/weather/current**', route => route.fulfill({ json: current }));
  await page.route('**/api/v1/weather/forecast**', route => route.fulfill({ json: forecast }));
  await page.route('**/api/v1/weather/hourly**', route => route.fulfill({ json: hourlyForecast }));
  await page.route('**/api/v1/weather/air-quality**', route => route.fulfill({ json: air }));
  await page.route('**/api/v1/weather/context**', route => route.fulfill({ json: context }));
  await page.route('**/api/v1/weather/route**', route => route.fulfill({ json: routeResult }));
});

test('mobile location denial explains the permission failure', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'single mobile geolocation-error regression');
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
});

test('mobile current location keeps exact weather coordinates but uses the canonical province identity', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'single mobile geolocation identity regression');
  await page.unroute('**/api/v1/weather/current**');
  await page.route('**/api/v1/weather/current**', route => {
    const requestUrl = new URL(route.request().url());
    const isCoordinateRequest = requestUrl.searchParams.has('lat');
    return route.fulfill({
      json: isCoordinateRequest
        ? {
            ...current,
            cityName: 'Ulus',
            coordinates: { lat: 39.9334, lon: 32.8597 },
          }
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
});

test('narrow mobile dashboard stays inside a 320px viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'single narrow-mobile overflow regression');
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  const layout = await page.locator('.atlas-dashboard__primary').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
    };
  });

  expect(layout.viewportWidth).toBe(320);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
});

test('tablet forecast source links keep touch-friendly target heights', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'tablet-768', 'tablet forecast source target regression');
  await page.goto('/istanbul');

  const source = page.locator('.hava81-forecast-atlas__source');
  await expect(source).toBeVisible();
  const links = source.getByRole('link');
  await expect(links).toHaveCount(2);
  const heights = await links.evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().height)
  );

  expect(heights.every(height => height >= 44)).toBe(true);
  const layout = await source.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

test('forced colors keeps the selected forecast interval visibly distinct', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'forced-colors interval regression');
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/istanbul');

  const selected = page.locator('.hava81-forecast-atlas__range-button[aria-pressed="true"]');
  const unselected = page.locator('.hava81-forecast-atlas__range-button[aria-pressed="false"]').first();
  await expect(selected).toBeVisible();
  await expect(unselected).toBeVisible();

  const state = await selected.evaluate((element, unselectedSelector) => {
    const selectedStyle = getComputedStyle(element);
    const other = document.querySelector(unselectedSelector as string);
    if (!other) throw new Error('Missing unselected interval');
    const unselectedStyle = getComputedStyle(other);
    return {
      forcedColors: matchMedia('(forced-colors: active)').matches,
      selectedDecoration: selectedStyle.textDecorationLine,
      selectedBorder: selectedStyle.borderColor,
      unselectedBorder: unselectedStyle.borderColor,
    };
  }, '.hava81-forecast-atlas__range-button[aria-pressed="false"]');

  expect(state.forcedColors).toBe(true);
  expect(state.selectedDecoration).toContain('underline');
  expect(state.selectedBorder).not.toBe(state.unselectedBorder);
});

test('forced colors keeps a pressed header action visibly distinct', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'forced-colors header pressed-state regression');
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/istanbul');

  const search = page.locator('.atlas-icon-button--search');
  const favorite = page.locator('.atlas-icon-button[aria-pressed]').filter({ has: page.locator('svg') }).first();
  await expect(search).toBeVisible();
  await expect(favorite).toHaveAttribute('aria-pressed', 'false');
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');

  const state = await favorite.evaluate((element, referenceSelector) => {
    const selectedStyle = getComputedStyle(element);
    const reference = document.querySelector(referenceSelector as string);
    if (!reference) throw new Error('Missing unpressed header reference');
    const referenceStyle = getComputedStyle(reference);
    return {
      forcedColors: matchMedia('(forced-colors: active)').matches,
      selectedBackground: selectedStyle.backgroundColor,
      selectedBorder: selectedStyle.borderColor,
      referenceBackground: referenceStyle.backgroundColor,
      referenceBorder: referenceStyle.borderColor,
    };
  }, '.atlas-icon-button--search');

  expect(state.forcedColors).toBe(true);
  expect(state.selectedBackground).not.toBe(state.referenceBackground);
  expect(state.selectedBorder).not.toBe(state.referenceBorder);
});

test('keyboard map close restores focus to the map trigger', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile map focus restoration regression');
  await page.goto('/istanbul');

  const mapTrigger = page.locator('.atlas-bottom-nav__button').filter({ hasText: 'Harita' });
  await expect(mapTrigger).toBeVisible();
  await mapTrigger.focus();
  await page.keyboard.press('Enter');

  const mapRegion = page.locator('#weather-map-region');
  await expect(mapRegion).toBeVisible();
  await expect(mapRegion).toBeFocused();

  await page.keyboard.press('Tab');
  const close = mapRegion.getByRole('button', { name: 'Kapat' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(mapRegion).toBeHidden();
  await expect(mapTrigger).toBeFocused();
});

test('desktop header keeps settings reachable at 200% text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop text-resize header regression');
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  const search = page.locator('.atlas-header__search');
  const actions = page.locator('.atlas-header__actions');
  const settings = page.locator('.atlas-settings-button');
  const geometry = await settings.evaluate(element => {
    const searchRect = document.querySelector('.atlas-header__search')?.getBoundingClientRect();
    const actionsRect = document.querySelector('.atlas-header__actions')?.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      searchRight: searchRect?.right ?? 0,
      actionsLeft: actionsRect?.left ?? 0,
      settingsReachable: hit === element || element.contains(hit),
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  await expect(search).toBeVisible();
  await expect(actions).toBeVisible();
  expect(geometry.searchRight).toBeLessThanOrEqual(geometry.actionsLeft);
  expect(geometry.settingsReachable).toBe(true);
  expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);

  await settings.click();
  await expect(page.getByRole('dialog', { name: /ayarlar|settings/i })).toBeVisible();
});

test('wide tablet header reflows search at 200% text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'wide-tablet text-resize header regression');
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  const settings = page.locator('.atlas-settings-button');
  const geometry = await settings.evaluate(element => {
    const search = document.querySelector('.atlas-header__search') as HTMLElement | null;
    const actions = document.querySelector('.atlas-header__actions') as HTMLElement | null;
    const input = document.querySelector('.search-bar__input') as HTMLElement | null;
    const submit = document.querySelector('.search-bar__submit') as HTMLElement | null;
    if (!search || !actions || !input || !submit) throw new Error('Missing header control');
    const searchRect = search.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const submitRect = submit.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      searchBelowActions: searchRect.top >= actionsRect.bottom,
      controlsSeparated: inputRect.right <= submitRect.left + 1,
      searchFits: search.scrollWidth <= search.clientWidth,
      settingsReachable: hit === element || element.contains(hit),
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(geometry.searchBelowActions).toBe(true);
  expect(geometry.controlsSeparated).toBe(true);
  expect(geometry.searchFits).toBe(true);
  expect(geometry.settingsReachable).toBe(true);
  expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
});

test('compact tablet header stays inside the viewport at 200% text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'compact-tablet text-resize header regression');
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  const geometry = await page.locator('.atlas-header__inner').evaluate(element => {
    const search = element.querySelector<HTMLElement>('.atlas-header__search');
    const actions = element.querySelector<HTMLElement>('.atlas-header__actions');
    const settings = element.querySelector<HTMLElement>('.atlas-settings-button');
    if (!search || !actions || !settings) throw new Error('Missing compact tablet header control');
    const searchRect = search.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    const settingsRect = settings.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const hit = document.elementFromPoint(
      settingsRect.left + settingsRect.width / 2,
      settingsRect.top + settingsRect.height / 2
    );
    return {
      innerFits: element.scrollWidth <= element.clientWidth,
      pageFits: document.documentElement.scrollWidth <= viewportWidth,
      searchFits: searchRect.left >= 0 && searchRect.right <= viewportWidth,
      actionsFit: actionsRect.left >= 0 && actionsRect.right <= viewportWidth,
      settingsFits: settingsRect.left >= 0 && settingsRect.right <= viewportWidth,
      settingsReachable: hit === settings || settings.contains(hit),
    };
  });

  expect(geometry.innerFits).toBe(true);
  expect(geometry.pageFits).toBe(true);
  expect(geometry.searchFits).toBe(true);
  expect(geometry.actionsFit).toBe(true);
  expect(geometry.settingsFits).toBe(true);
  expect(geometry.settingsReachable).toBe(true);
});

test('mobile header keeps quick actions reachable at 200% text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile text-resize header regression');
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  const assertHeaderFits = async () => {
    const state = await page.locator('.atlas-header__inner').evaluate(element => {
      const actions = Array.from(
        element.querySelectorAll<HTMLButtonElement>('.atlas-header__actions button')
      ).filter(button => getComputedStyle(button).display !== 'none');
      const viewportWidth = document.documentElement.clientWidth;
      return {
        innerFits: element.scrollWidth <= element.clientWidth,
        pageFits: document.documentElement.scrollWidth <= viewportWidth,
        actions: actions.map(button => {
          const rect = button.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          );
          return {
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
            reachable: hit === button || button.contains(hit),
          };
        }),
        viewportWidth,
      };
    });

    expect(state.innerFits).toBe(true);
    expect(state.pageFits).toBe(true);
    expect(state.actions.length).toBeGreaterThanOrEqual(4);
    expect(state.actions.every(action =>
      action.left >= 0 &&
      action.right <= state.viewportWidth &&
      action.width >= 44 &&
      action.height >= 44 &&
      action.reachable
    )).toBe(true);
  };

  await assertHeaderFits();
  await page.setViewportSize({ width: 320, height: 844 });
  await assertHeaderFits();

  const searchToggle = page.locator('.atlas-icon-button--search');
  await searchToggle.click();
  const search = page.locator('.atlas-header__search');
  await expect(search).toBeVisible();
  const searchGeometry = await search.evaluate(element => ({
    fits: element.scrollWidth <= element.clientWidth,
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    viewportWidth: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth,
  }));
  expect(searchGeometry.fits).toBe(true);
  expect(searchGeometry.left).toBeGreaterThanOrEqual(0);
  expect(searchGeometry.right).toBeLessThanOrEqual(searchGeometry.viewportWidth);
  expect(searchGeometry.pageWidth).toBeLessThanOrEqual(searchGeometry.viewportWidth);
});

test('mobile daily plan reflows at 200% text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile daily-plan text-resize regression');
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  const dailyPlan = page.locator('.daily-plan');
  await expect(dailyPlan).toBeVisible();
  const planState = await dailyPlan.evaluate(element => {
    const fits = (node: Element) => {
      const html = node as HTMLElement;
      return html.scrollWidth <= html.clientWidth + 1;
    };
    const explain = element.querySelector('.daily-plan__explain');
    const explainHead = element.querySelector('.daily-plan__explain-head');
    const quick = element.querySelector('.daily-plan__quick');
    const quickItems = Array.from(element.querySelectorAll('.daily-plan__quick > div'));
    const share = element.querySelector('.daily-plan__share');
    if (!explain || !explainHead || !quick || !share) throw new Error('Missing daily plan content');
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      planFits: fits(element),
      explainFits: fits(explain),
      explainHeadFits: fits(explainHead),
      quickFits: fits(quick) && quickItems.every(fits),
      shareFits: fits(share),
    };
  });
  expect(planState.pageWidth).toBeLessThanOrEqual(planState.viewportWidth);
  expect(planState.planFits).toBe(true);
  expect(planState.explainFits).toBe(true);
  expect(planState.explainHeadFits).toBe(true);
  expect(planState.quickFits).toBe(true);
  expect(planState.shareFits).toBe(true);

  await page.setViewportSize({ width: 320, height: 844 });
  const narrowState = await dailyPlan.evaluate(element => {
    const fits = (node: Element) => {
      const html = node as HTMLElement;
      return html.scrollWidth <= html.clientWidth + 1;
    };
    const explain = element.querySelector('.daily-plan__explain');
    const explainHead = element.querySelector('.daily-plan__explain-head');
    const quick = element.querySelector('.daily-plan__quick');
    const quickItems = Array.from(element.querySelectorAll('.daily-plan__quick > div'));
    const share = element.querySelector('.daily-plan__share');
    if (!explain || !explainHead || !quick || !share) throw new Error('Missing daily plan content');
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      planFits: fits(element),
      explainFits: fits(explain),
      explainHeadFits: fits(explainHead),
      quickFits: fits(quick) && quickItems.every(fits),
      shareFits: fits(share),
    };
  });
  expect(narrowState.pageWidth).toBeLessThanOrEqual(narrowState.viewportWidth);
  expect(narrowState.planFits).toBe(true);
  expect(narrowState.explainFits).toBe(true);
  expect(narrowState.explainHeadFits).toBe(true);
  expect(narrowState.quickFits).toBe(true);
  expect(narrowState.shareFits).toBe(true);
});

test('commute time inputs stay inside their grid at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop commute input text-resize regression');
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'Çıkış planı' })).toBeVisible();

  const times = page.locator('.commute-plan__times');
  const measure = async () =>
    times.evaluate(element => {
      const fits = (node: Element) => {
        const html = node as HTMLElement;
        const rect = html.getBoundingClientRect();
        const parentRect = element.getBoundingClientRect();
        return (
          html.scrollWidth <= html.clientWidth + 1 &&
          rect.left >= parentRect.left - 1 &&
          rect.right <= parentRect.right + 1
        );
      };
      const labels = Array.from(element.querySelectorAll('label'));
      const inputs = Array.from(element.querySelectorAll('input'));
      return {
        timesFit: element.scrollWidth <= element.clientWidth + 1,
        labelsFit: labels.every(fits),
        inputsFit: inputs.every(fits),
        labelTops: labels.map(label => label.getBoundingClientRect().top),
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

  const normal = await measure();
  expect(normal.timesFit).toBe(true);
  expect(normal.labelsFit).toBe(true);
  expect(normal.inputsFit).toBe(true);
  expect(Math.abs(normal.labelTops[0] - normal.labelTops[1])).toBeLessThanOrEqual(1);

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });
  const enlarged = await measure();
  expect(enlarged.timesFit).toBe(true);
  expect(enlarged.labelsFit).toBe(true);
  expect(enlarged.inputsFit).toBe(true);
  expect(Math.abs(enlarged.labelTops[0] - enlarged.labelTops[1])).toBeLessThanOrEqual(1);
  expect(enlarged.pageWidth).toBeLessThanOrEqual(enlarged.viewportWidth);
});

test('mobile commute windows reflow at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile commute text-resize regression');

  await page.unroute('**/api/v1/weather/hourly**');
  await page.route('**/api/v1/weather/hourly**', route =>
    route.fulfill({
      json: {
        ...hourlyForecast,
        hourly: Array.from({ length: 24 }, (_, index) => ({
          ...hourlyForecast.hourly[index],
          time: fixtureIsoAtHour(index + 1),
        })),
      },
    })
  );
  await page.clock.setFixedTime(new Date(fixtureNow));
  const localFixtureNow = fixtureNow + current.meta.timezoneOffsetSeconds * 1000;
  const clockAtOffset = (offsetHours: number) =>
    new Date(localFixtureNow + offsetHours * 60 * 60_000).toISOString().slice(11, 16);

  await page.goto('/istanbul');
  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });
  await page.getByRole('textbox', { name: 'Çıkış', exact: true }).fill(clockAtOffset(2));
  await page.getByRole('textbox', { name: 'Dönüş', exact: true }).fill(clockAtOffset(5));
  await expect(page.locator('.commute-plan__verdict')).toBeVisible();

  const commute = page.locator('.commute-plan');
  const assertWindowsFit = async () => {
    const layout = await commute.evaluate(element => {
      const fits = (node: Element) => {
        const html = node as HTMLElement;
        return html.scrollWidth <= html.clientWidth + 1;
      };
      const windows = element.querySelector('.commute-plan__windows');
      const cards = Array.from(element.querySelectorAll('.commute-window'));
      const metrics = Array.from(element.querySelectorAll('.commute-window dl'));
      const copy = Array.from(element.querySelectorAll('.commute-window dt, .commute-window dd'));
      if (!windows || cards.length !== 2 || metrics.length !== 2 || copy.length === 0) {
        throw new Error('Missing commute window content');
      }
      return {
        windowsFit: fits(windows),
        cardsFit: cards.every(fits),
        metricsFit: metrics.every(fits),
        copyFits: copy.every(fits),
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    expect(layout.windowsFit).toBe(true);
    expect(layout.cardsFit).toBe(true);
    expect(layout.metricsFit).toBe(true);
    expect(layout.copyFits).toBe(true);
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
  };

  await page.setViewportSize({ width: 320, height: 844 });
  await assertWindowsFit();
  await page.setViewportSize({ width: 390, height: 844 });
  await assertWindowsFit();
});

test('mobile context signals reflow at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile context-signals text-resize regression');
  await page.goto('/istanbul');
  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const panel = page.locator('.context-signals');
  await expect(panel).toBeVisible();
  const assertContextFits = async () => {
    const layout = await panel.evaluate(element => {
      const fits = (node: Element) => {
        const html = node as HTMLElement;
        return html.scrollWidth <= html.clientWidth + 1;
      };
      const header = element.querySelector('header');
      const source = element.querySelector('.context-signals__source');
      const grid = element.querySelector('.context-signals__grid');
      const cards = Array.from(element.querySelectorAll('.context-signal'));
      const note = element.querySelector('.context-signals__note');
      if (!header || !source || !grid || cards.length !== 4 || !note) {
        throw new Error('Missing context signal content');
      }
      return {
        panelFits: fits(element),
        headerFits: fits(header),
        sourceFits: fits(source),
        gridFits: fits(grid),
        cardsFit: cards.every(fits),
        noteFits: fits(note),
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    expect(layout.panelFits).toBe(true);
    expect(layout.headerFits).toBe(true);
    expect(layout.sourceFits).toBe(true);
    expect(layout.gridFits).toBe(true);
    expect(layout.cardsFit).toBe(true);
    expect(layout.noteFits).toBe(true);
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
  };

  await page.setViewportSize({ width: 320, height: 844 });
  await assertContextFits();
  await page.setViewportSize({ width: 390, height: 844 });
  await assertContextFits();
});

test('settings dialog avoids nested page landmarks', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'settings landmark regression');
  await page.goto('/istanbul');
  await page.locator('.atlas-settings-button').click();

  const dialog = page.getByRole('dialog', { name: /ayarlar|settings/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('banner')).toHaveCount(0);
  await expect(dialog.getByRole('contentinfo')).toHaveCount(0);
});

test('mobile settings reflows option groups at 200% text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile settings text-resize regression');
  await page.goto('/istanbul');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.locator('.atlas-settings-button').click();
  const dialog = page.getByRole('dialog', { name: /ayarlar|settings/i });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(350);

  const measure = async () => dialog.evaluate(element => {
    const groups = Array.from(element.querySelectorAll<HTMLElement>('.settings-option-group'));
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      panel: (() => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      })(),
      groups: groups.map(group => {
        const options = Array.from(group.querySelectorAll<HTMLElement>('.settings-option'));
        const rows = new Map<number, number>();
        for (const option of options) {
          const top = Math.round(option.getBoundingClientRect().top);
          rows.set(top, (rows.get(top) ?? 0) + 1);
        }
        return {
          columns: Math.max(...rows.values()),
          fits: group.scrollWidth <= group.clientWidth,
          optionsFit: options.every(option => option.scrollWidth <= option.clientWidth + 1),
        };
      }),
    };
  });

  const wide = await measure();
  expect(wide.pageWidth).toBeLessThanOrEqual(wide.viewportWidth);
  expect(wide.panel.left).toBeGreaterThanOrEqual(0);
  expect(wide.panel.right).toBeLessThanOrEqual(wide.viewportWidth);
  expect(wide.groups.map(group => group.columns)).toEqual([1, 1, 2, 2]);
  expect(wide.groups.every(group => group.fits && group.optionsFit)).toBe(true);

  await page.setViewportSize({ width: 320, height: 844 });
  const narrow = await measure();
  expect(narrow.pageWidth).toBeLessThanOrEqual(narrow.viewportWidth);
  expect(narrow.panel.left).toBeGreaterThanOrEqual(0);
  expect(narrow.panel.right).toBeLessThanOrEqual(narrow.viewportWidth);
  expect(narrow.groups.map(group => group.columns)).toEqual([1, 1, 1, 1]);
  expect(narrow.groups.every(group => group.fits && group.optionsFit)).toBe(true);
});

test('forced colors keeps selected activity and settings options distinct', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'forced-colors selected-state regression');
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/istanbul');

  const selectedActivity = page.locator('.activity-planner__chips button[aria-pressed="true"]').first();
  const unselectedActivity = page.locator('.activity-planner__chips button[aria-pressed="false"]').first();
  await expect(selectedActivity).toBeVisible();
  await expect(unselectedActivity).toBeVisible();
  const activityState = await selectedActivity.evaluate((element, otherSelector) => {
    const selectedStyle = getComputedStyle(element);
    const other = document.querySelector(otherSelector as string);
    if (!other) throw new Error('Missing unselected activity');
    const otherStyle = getComputedStyle(other);
    return {
      decoration: selectedStyle.textDecorationLine,
      border: selectedStyle.borderColor,
      otherBorder: otherStyle.borderColor,
    };
  }, '.activity-planner__chips button[aria-pressed="false"]');
  expect(activityState.decoration).toContain('underline');
  expect(activityState.border).not.toBe(activityState.otherBorder);

  await page.locator('.atlas-settings-button').click();
  const selectedSetting = page.locator('.settings-option[aria-pressed="true"]').first();
  const unselectedSetting = page.locator('.settings-option[aria-pressed="false"]').first();
  await expect(selectedSetting).toBeVisible();
  await expect(unselectedSetting).toBeVisible();
  const settingsState = await selectedSetting.evaluate((element, otherSelector) => {
    const selectedStyle = getComputedStyle(element);
    const other = document.querySelector(otherSelector as string);
    if (!other) throw new Error('Missing unselected setting');
    const otherStyle = getComputedStyle(other);
    return {
      forcedColors: matchMedia('(forced-colors: active)').matches,
      decoration: selectedStyle.textDecorationLine,
      border: selectedStyle.borderColor,
      otherBorder: otherStyle.borderColor,
    };
  }, '.settings-option[aria-pressed="false"]');
  expect(settingsState.forcedColors).toBe(true);
  expect(settingsState.decoration).toContain('underline');
  expect(settingsState.border).not.toBe(settingsState.otherBorder);
});

test('mobile environment rail keeps labels readable at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile environment text-resize regression');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const rail = page.locator('.environment-rail');
  await expect(rail).toBeVisible();
  const layout = await rail.evaluate(element => {
    const fits = (node: Element) => {
      const html = node as HTMLElement;
      return html.scrollWidth <= html.clientWidth + 1;
    };
    const modules = Array.from(element.querySelectorAll('.environment-rail__module'));
    const labels = Array.from(element.querySelectorAll('.environment-rail__label'));
    const rect = element.getBoundingClientRect();
    return {
      railFits: fits(element),
      modulesFit: modules.every(fits),
      labelsFit: labels.every(fits),
      left: rect.left,
      right: rect.right,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(layout.railFits).toBe(true);
  expect(layout.modulesFit).toBe(true);
  expect(layout.labelsFit).toBe(true);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
});

test('mobile environment map action keeps its focus ring inside the clipped rail', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile environment focus regression');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/istanbul');

  const action = page.locator('.environment-rail__module--action');
  await expect(action).toBeVisible();
  const focusState = await action.evaluate(element => {
    (element as HTMLElement).focus({ focusVisible: true } as FocusOptions & { focusVisible: boolean });
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement?.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (!parent) throw new Error('Missing environment rail parent');
    return {
      focusVisible: element.matches(':focus-visible'),
      outlineWidth: parseFloat(style.outlineWidth),
      outlineOffset: parseFloat(style.outlineOffset),
      rightClearance: parent.right - rect.right,
      bottomClearance: parent.bottom - rect.bottom,
      overflow: getComputedStyle(element.parentElement!).overflow,
    };
  });

  expect(focusState.focusVisible).toBe(true);
  expect(focusState.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(focusState.outlineOffset).toBeLessThan(0);
  expect(focusState.overflow).toBe('hidden');
  expect(focusState.rightClearance).toBeLessThan(4);
  expect(focusState.bottomClearance).toBeLessThan(4);
});

test('mobile day-plan header stays readable at 390px', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile day-plan header regression');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'metric',
        windSpeedUnit: 'ms',
        themeMode: 'dark',
        language: 'en',
        notificationsEnabled: false,
      })
    );
  });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'Day plan' })).toBeVisible();

  const layout = await page.locator('.daily-plan__header').evaluate(element => {
    const header = element.getBoundingClientRect();
    const title = element.querySelector('h2')?.getBoundingClientRect();
    const actions = element.querySelector('.daily-plan__header-actions')?.getBoundingClientRect();
    const share = element.querySelector('.daily-plan__share')?.getBoundingClientRect();
    const score = element.querySelector('.daily-plan__score')?.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (!title || !actions || !share || !score) throw new Error('Missing Daily Plan header element');
    return {
      direction: style.flexDirection,
      headerWidth: header.width,
      titleWidth: title.width,
      titleHeight: title.height,
      actionsWidth: actions.width,
      shareHeight: share.height,
      overlap: Math.max(0, Math.min(title.right, actions.right) - Math.max(title.left, actions.left)) *
        Math.max(0, Math.min(title.bottom, actions.bottom) - Math.max(title.top, actions.top)),
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(layout.direction).toBe('column');
  expect(layout.titleWidth).toBeGreaterThan(200);
  expect(layout.titleHeight).toBeLessThan(50);
  expect(layout.actionsWidth).toBeGreaterThan(250);
  expect(layout.shareHeight).toBeGreaterThanOrEqual(44);
  expect(layout.overlap).toBe(0);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

test('narrow English layout keeps decision content readable at 320px', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'single English narrow-layout regression');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'metric',
        windSpeedUnit: 'ms',
        themeMode: 'light',
        language: 'en',
        notificationsEnabled: false,
      })
    );
  });
  await page.unroute('**/api/v1/weather/forecast**');
  await page.route('**/api/v1/weather/forecast**', route =>
    route.fulfill({
      json: {
        ...forecast,
        daily: [
          {
            date: fixtureLocalDate(),
            tempMin: 19,
            tempMax: 27,
            icon: '02d',
            description: 'partly cloudy',
            pop: 10,
          },
        ],
      },
    })
  );

  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'Day plan' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What are you doing today?' })).toBeAttached();

  const layout = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    };
    const description = document.querySelector<HTMLElement>('.hava81-forecast-atlas__description');
    if (!description) throw new Error('Missing forecast description');
    const descriptionStyle = getComputedStyle(description);
    return {
      viewportWidth,
      pageWidth: document.documentElement.scrollWidth,
      daily: rect('.daily-plan'),
      dailyHeader: rect('.daily-plan__header'),
      activity: rect('.activity-planner'),
      activityHeader: rect('.activity-planner__header'),
      sensitivity: rect('.activity-planner__sensitivity'),
      description: {
        clientWidth: description.clientWidth,
        scrollWidth: description.scrollWidth,
        whiteSpace: descriptionStyle.whiteSpace,
        textOverflow: descriptionStyle.textOverflow,
      },
    };
  });

  expect(layout.viewportWidth).toBe(320);
  expect(layout.pageWidth).toBeLessThanOrEqual(320);
  for (const item of [layout.daily, layout.dailyHeader, layout.activity, layout.activityHeader, layout.sensitivity]) {
    expect(item.left).toBeGreaterThanOrEqual(0);
    expect(item.right).toBeLessThanOrEqual(320);
  }
  expect(layout.description.whiteSpace).toBe('normal');
  expect(layout.description.textOverflow).toBe('clip');

  const quickDecisions = await page.locator('.daily-plan__quick').evaluate(element => {
    const parent = element.getBoundingClientRect();
    const cells = Array.from(element.children).map(child => {
      const rect = child.getBoundingClientRect();
      return {
        top: rect.top,
        width: rect.width,
        clientWidth: (child as HTMLElement).clientWidth,
        scrollWidth: (child as HTMLElement).scrollWidth,
      };
    });
    return { height: parent.height, cells };
  });
  expect(quickDecisions.height).toBeLessThan(110);
  expect(quickDecisions.cells).toHaveLength(3);
  expect(Math.max(...quickDecisions.cells.map(cell => cell.top)) - Math.min(...quickDecisions.cells.map(cell => cell.top))).toBeLessThan(2);
  expect(quickDecisions.cells.every(cell => cell.scrollWidth <= cell.clientWidth + 1)).toBe(true);

  const windowHelp = page.locator('.activity-planner__window-help');
  await expect(windowHelp.locator('summary')).toHaveText('How it works');
  await expect(windowHelp.locator('p')).toBeHidden();
  const closedWindowHelp = await page.locator('.activity-planner__window-copy').evaluate(element => ({
    height: element.getBoundingClientRect().height,
    summaryHeight: element.querySelector('summary')?.getBoundingClientRect().height ?? 0,
  }));
  expect(closedWindowHelp.height).toBeLessThan(60);
  expect(closedWindowHelp.summaryHeight).toBeGreaterThanOrEqual(44);
  await windowHelp.locator('summary').click();
  await expect(windowHelp.locator('p')).toBeVisible();
  await expect(windowHelp.locator('p')).toContainText('wraps past midnight');
  const openWindowHelp = await windowHelp.evaluate(element => {
    const paragraph = element.querySelector<HTMLElement>('p');
    const rect = element.getBoundingClientRect();
    if (!paragraph) throw new Error('Missing activity window help copy');
    return {
      right: rect.right,
      clientWidth: paragraph.clientWidth,
      scrollWidth: paragraph.scrollWidth,
    };
  });
  expect(openWindowHelp.right).toBeLessThanOrEqual(320);
  expect(openWindowHelp.scrollWidth).toBeLessThanOrEqual(openWindowHelp.clientWidth + 1);
  await windowHelp.locator('summary').click();

  const activityChips = await page.locator('.activity-planner__chips').evaluate(element => {
    const rail = element.getBoundingClientRect();
    const buttons = Array.from(element.querySelectorAll('button')).map(button => {
      const rect = button.getBoundingClientRect();
      return { left: rect.left, right: rect.right, height: rect.height, clientWidth: button.clientWidth, scrollWidth: button.scrollWidth };
    });
    return {
      height: rail.height,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      right: rail.right,
      buttons,
    };
  });
  expect(activityChips.height).toBeLessThan(60);
  expect(activityChips.scrollWidth).toBeGreaterThan(activityChips.clientWidth);
  expect(activityChips.buttons.every(button => button.height >= 44)).toBe(true);
  expect(activityChips.buttons.every(button => button.scrollWidth <= button.clientWidth + 1)).toBe(true);
  expect(
    activityChips.buttons.some(button => button.left < activityChips.right && button.right > activityChips.right)
  ).toBe(true);

  const activityDetails = page.locator('.activity-card__details');
  await expect(activityDetails).toHaveCount(2);
  expect(await activityDetails.evaluateAll(elements => elements.every(element => !element.hasAttribute('open')))).toBe(true);
  const detailSummaryHeights = await activityDetails.locator('summary').evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().height)
  );
  expect(detailSummaryHeights.every(height => height >= 44)).toBe(true);
  await expect(page.locator('.activity-card__risk').first()).toBeVisible();
  await expect(page.locator('.activity-card__impact').first()).toBeHidden();
  await activityDetails.locator('summary').first().click();
  await expect(page.locator('.activity-card__impact').first()).toBeVisible();
  await expect(page.locator('.activity-card__criteria').first()).toBeVisible();

  expect(layout.description.scrollWidth).toBeLessThanOrEqual(layout.description.clientWidth + 1);
});

test('core city experience renders and uses a shareable city URL', async ({ page }) => {
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page).toHaveURL(/\/istanbul\/$/);
  await expect(page.getByText(/OpenWeather/)).toBeVisible();
  const hourlyHeading = page.getByRole('heading', { name: /Saatlik tahmin · sonraki 24 saat/i });
  await expect(hourlyHeading).toBeVisible();
  const hourlySection = page.getByRole('region', { name: /Saatlik tahmin · sonraki 24 saat/i });
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
  await expect(page.getByRole('heading', { name: /Gün planı/i })).toBeVisible();
  const dailyPlan = page.locator('.daily-plan');
  await expect(dailyPlan).toContainText('%45 · 0,2 mm');
  await expect(dailyPlan.getByText('Makul', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Bugün ne yapacaksın/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Güneş, toz, polen ve deniz/i })).toBeVisible();
  await expect(page.getByText('UV · 24s model maksimumu', { exact: true })).toBeVisible();
  await expect(page.getByText(/Rota havası/i)).toBeVisible();
});


test('daily plan timeline matches its 12-hour score horizon and shows risk-first slot copy', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser daily-plan coverage');
  await page.unroute('**/api/v1/weather/hourly**');
  await page.route('**/api/v1/weather/hourly**', route =>
    route.fulfill({
      json: {
        ...hourlyForecast,
        hourly: Array.from({ length: 24 }, (_, index) => ({
          ...hourlyForecast.hourly[index],
          time: new Date(Date.parse('2026-08-28T18:00:00.000Z') + index * 60 * 60_000).toISOString(),
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

  await page.goto('/istanbul');
  const timeline = page.getByRole('list', { name: 'Günün hava uygunluk zaman çizelgesi' });
  await expect(timeline.locator('.daily-plan__slot')).toHaveCount(12);
  await expect(timeline).not.toContainText('Çok uygun');
  await expect(timeline.getByText('Yağış ihtimali var')).toBeVisible();
  await expect(timeline.getByText('Yarın')).toHaveCount(1);
});


test('daily plan avoids repeated perfect scores for pleasant humid night hours', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single top-end score calibration regression');
  await page.unroute('**/api/v1/weather/hourly**');
  const currentHour = new Date(current.timestamp);
  currentHour.setUTCMinutes(0, 0, 0);
  const profile = [
    { temp: 22.6, apparentTemperature: 25.4, humidity: 81, windSpeed: 1.25, windGust: 3.9, visibility: 31560 },
    { temp: 22.4, apparentTemperature: 25.1, humidity: 81, windSpeed: 1.12, windGust: 2.9, visibility: 31340 },
    { temp: 22.1, apparentTemperature: 24.8, humidity: 82, windSpeed: 1.17, windGust: 2.7, visibility: 31080 },
    { temp: 21.7, apparentTemperature: 24.4, humidity: 83, windSpeed: 1.14, windGust: 2.6, visibility: 29500 },
    { temp: 21.5, apparentTemperature: 24.2, humidity: 85, windSpeed: 1.26, windGust: 2.7, visibility: 28280 },
    { temp: 21.4, apparentTemperature: 23.9, humidity: 85, windSpeed: 1.34, windGust: 2.8, visibility: 27700 },
    { temp: 21.4, apparentTemperature: 24, humidity: 84, windSpeed: 1.12, windGust: 2.9, visibility: 29000 },
  ];
  await page.route('**/api/v1/weather/hourly**', route =>
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

  await page.goto('/istanbul');
  const timeline = page.getByRole('list', { name: 'Günün hava uygunluk zaman çizelgesi' });
  await expect(timeline.locator('.daily-plan__slot')).toHaveCount(profile.length);
  const scores = (await timeline.locator('.daily-plan__slot > strong').allTextContents()).map(Number);

  expect(scores).toHaveLength(profile.length);
  expect(scores.every(score => Number.isFinite(score) && score < 100)).toBe(true);
  expect(Math.min(...scores)).toBeGreaterThanOrEqual(94);
  expect(Math.max(...scores)).toBeLessThanOrEqual(98);
  expect(new Set(scores).size).toBeGreaterThanOrEqual(3);
  expect(scores[0]).toBeLessThan(scores.at(-1)!);
});

test('narrow hourly atlas keeps its interval chip rail and summary readable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'single narrow hourly-atlas layout regression');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/istanbul');

  const interval = page.getByRole('group', { name: 'Tahmin aralığı' });
  const buttons = interval.getByRole('button');
  await expect(buttons).toHaveCount(7);
  const buttonBoxes = await buttons.evaluateAll(elements =>
    elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    })
  );
  expect(buttonBoxes.every(box => box.height >= 44 && box.width >= 44)).toBe(true);
  const intervalBox = await interval.boundingBox();
  expect(intervalBox).not.toBeNull();
  const intervalRight = (intervalBox?.x ?? 0) + (intervalBox?.width ?? 0);
  expect(buttonBoxes.some(box => box.left < intervalRight && box.right > intervalRight)).toBe(true);
  const intervalScroll = await interval.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(intervalScroll.scrollWidth).toBeGreaterThan(intervalScroll.clientWidth);

  const summary = page.getByRole('list', { name: 'Saatlik tahmin özeti' });
  await expect(summary.getByRole('listitem')).toHaveCount(3);
  const summaryBoxes = await summary.getByRole('listitem').evaluateAll(elements =>
    elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    })
  );
  expect(summaryBoxes.every(box => box.left >= 0 && box.right <= 320 && box.width >= 70)).toBe(true);
  await expect(page.locator('.hava81-forecast-atlas__area')).toHaveCount(1);
  const guides = page.locator('.hava81-forecast-atlas__guide');
  const axisLabels = page.locator('.hava81-forecast-atlas__axis-label');
  expect(await guides.count()).toBeGreaterThanOrEqual(2);
  await expect(axisLabels).toHaveCount(await guides.count());
  expect((await axisLabels.allTextContents()).every(label => label.endsWith('°'))).toBe(true);
  const axisXBefore = await axisLabels.evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().x)
  );
  const hourlyViewport = page.locator('.hava81-forecast-atlas__hourly-viewport');
  await hourlyViewport.evaluate(element => {
    element.scrollLeft = 360;
  });
  const axisXAfter = await axisLabels.evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().x)
  );
  expect(axisXAfter.every((x, index) => Math.abs(x - axisXBefore[index]) < 1)).toBe(true);
  await expect(hourlyViewport).toHaveCSS('overflow-x', 'auto');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test('narrow English hourly summary keeps long precipitation copy readable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'single narrow English summary regression');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'metric',
        windSpeedUnit: 'ms',
        themeMode: 'dark',
        language: 'en',
      })
    );
  });
  await page.goto('/istanbul');

  const summary = page.getByRole('list', { name: 'Hourly forecast summary' });
  const rainItem = summary.getByRole('listitem').filter({ hasText: 'Rain peak' });
  await expect(rainItem).toContainText('45% · 0.2 mm');

  const assertReadableSummary = async () => {
    const readability = await rainItem.locator('span, strong').evaluateAll(elements =>
      elements.map(element => {
        const style = getComputedStyle(element);
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          textOverflow: style.textOverflow,
          whiteSpace: style.whiteSpace,
        };
      })
    );
    expect(readability).toHaveLength(2);
    expect(readability.every(metric => metric.scrollWidth <= metric.clientWidth + 1)).toBe(true);
    expect(readability.every(metric => metric.scrollHeight <= metric.clientHeight + 1)).toBe(true);
    expect(readability.every(metric => metric.textOverflow === 'clip')).toBe(true);
    expect(readability.every(metric => metric.whiteSpace === 'normal')).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    ).toBe(0);
  };

  await assertReadableSummary();
  await page.setViewportSize({ width: 390, height: 844 });
  await assertReadableSummary();
});

test('tablet hourly interval controls keep touch-sized targets', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'tablet-768', 'tablet interval touch-target regression');
  await page.goto('/istanbul');

  const interval = page.getByRole('group', { name: 'Tahmin aralığı' });
  const buttons = interval.getByRole('button');
  await expect(buttons).toHaveCount(7);
  const boxes = await buttons.evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().height)
  );
  expect(boxes).toHaveLength(7);
  expect(boxes.every(height => height >= 44)).toBe(true);
});

test('mobile forecast summary reflows at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile forecast-summary text-resize regression');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const summary = page.locator('.hava81-forecast-atlas__summary');
  const assertSummaryFits = async () => {
    await expect(summary).toBeVisible();
    const layout = await summary.evaluate(element => {
      const fits = (node: Element) => {
        const html = node as HTMLElement;
        return html.scrollWidth <= html.clientWidth + 1;
      };
      const items = Array.from(element.querySelectorAll('.hava81-forecast-atlas__summary-item'));
      const labels = Array.from(element.querySelectorAll('.hava81-forecast-atlas__summary-item span'));
      const values = Array.from(element.querySelectorAll('.hava81-forecast-atlas__summary-item strong'));
      const rect = element.getBoundingClientRect();
      return {
        summaryFits: fits(element),
        itemsFit: items.every(fits),
        labelsFit: labels.every(fits),
        valuesFit: values.every(fits),
        left: rect.left,
        right: rect.right,
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    expect(layout.summaryFits).toBe(true);
    expect(layout.itemsFit).toBe(true);
    expect(layout.labelsFit).toBe(true);
    expect(layout.valuesFit).toBe(true);
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
  };

  await assertSummaryFits();
  await page.setViewportSize({ width: 390, height: 844 });
  await assertSummaryFits();
});


test('mid-width forecast summary reflows at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'mid-width forecast-summary text-resize regression');
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  const summary = page.locator('.hava81-forecast-atlas__summary');
  const items = summary.locator('.hava81-forecast-atlas__summary-item');
  await expect(items).toHaveCount(3);
  const normalBoxes = await items.evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect())
  );
  expect(Math.abs(normalBoxes[0].top - normalBoxes[2].top)).toBeLessThanOrEqual(1);

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const layout = await summary.evaluate(element => {
    const fits = (node: Element) => {
      const html = node as HTMLElement;
      return html.scrollWidth <= html.clientWidth + 1;
    };
    const items = Array.from(element.querySelectorAll('.hava81-forecast-atlas__summary-item'));
    const labels = Array.from(element.querySelectorAll('.hava81-forecast-atlas__summary-item span'));
    const values = Array.from(element.querySelectorAll('.hava81-forecast-atlas__summary-item strong'));
    const firstRect = items[0]?.getBoundingClientRect();
    const lastRect = items.at(-1)?.getBoundingClientRect();
    return {
      summaryFits: fits(element),
      itemsFit: items.every(fits),
      labelsFit: labels.every(fits),
      valuesFit: values.every(fits),
      copyCanWrap: [...labels, ...values].every(node => {
        const style = getComputedStyle(node);
        return style.whiteSpace === 'normal' && style.overflow === 'visible';
      }),
      reflowedToAnotherRow: Boolean(firstRect && lastRect && lastRect.top > firstRect.top + 1),
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(layout.summaryFits).toBe(true);
  expect(layout.itemsFit).toBe(true);
  expect(layout.labelsFit).toBe(true);
  expect(layout.valuesFit).toBe(true);
  expect(layout.copyCanWrap).toBe(true);
  expect(layout.reflowedToAnotherRow).toBe(true);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

test('desktop forecast days use compact rows only when the card narrows', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop forecast-card container regression');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  const firstDay = page.locator('.hava81-forecast-atlas__day').first();
  const geometry = async () =>
    firstDay.evaluate(row => {
      const metric = (selector: string) => {
        const node = row.querySelector<HTMLElement>(selector);
        if (!node) throw new Error(`Missing forecast-day node: ${selector}`);
        const rect = node.getBoundingClientRect();
        return {
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          top: rect.top,
          left: rect.left,
          right: rect.right,
        };
      };
      const rect = row.getBoundingClientRect();
      return {
        row: {
          clientWidth: row.clientWidth,
          scrollWidth: row.scrollWidth,
          height: rect.height,
        },
        day: metric('.hava81-forecast-atlas__day-name'),
        description: metric('.hava81-forecast-atlas__description'),
        temperatures: metric('.hava81-forecast-atlas__day-temperatures'),
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

  const wide = await geometry();
  expect(wide.description.left).toBeGreaterThan(wide.day.right);
  expect(wide.temperatures.left).toBeGreaterThan(wide.description.right);

  await page.setViewportSize({ width: 1024, height: 900 });
  const compact = await geometry();
  expect(compact.description.top).toBeGreaterThan(compact.day.top);
  expect(compact.description.clientWidth).toBeGreaterThan(200);
  expect(compact.row.scrollWidth).toBeLessThanOrEqual(compact.row.clientWidth + 1);

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });
  const enlarged = await geometry();
  expect(enlarged.description.top).toBeGreaterThan(enlarged.day.top);
  expect(enlarged.description.clientWidth).toBeGreaterThan(200);
  expect(enlarged.description.scrollWidth).toBeLessThanOrEqual(enlarged.description.clientWidth + 1);
  expect(enlarged.temperatures.scrollWidth).toBeLessThanOrEqual(enlarged.temperatures.clientWidth + 1);
  expect(enlarged.row.scrollWidth).toBeLessThanOrEqual(enlarged.row.clientWidth + 1);
  expect(enlarged.row.height).toBeLessThan(180);
  expect(enlarged.pageWidth).toBeLessThanOrEqual(enlarged.viewportWidth);
});

test('mobile daily forecast reflows instead of clipping at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile daily forecast text-resize regression');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'metric',
        windSpeedUnit: 'ms',
        themeMode: 'dark',
        language: 'en',
      })
    );
  });
  await page.unroute('**/api/v1/weather/forecast**');
  await page.route('**/api/v1/weather/forecast**', route =>
    route.fulfill({
      json: {
        ...forecast,
        daily: [
          {
            date: fixtureLocalDate(),
            tempMin: 20,
            tempMax: 28,
            icon: '11d',
            description: 'thunderstorms with heavy rain',
            pop: 73,
          },
          {
            date: fixtureLocalDate(1),
            tempMin: 18,
            tempMax: 25,
            icon: '10d',
            description: 'partly cloudy with scattered showers',
            pop: 48,
          },
        ],
      },
    })
  );
  await page.goto('/istanbul');
  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const days = page.locator('.hava81-forecast-atlas__day');
  await expect(days).toHaveCount(2);
  const descriptions = days.locator('.hava81-forecast-atlas__description');
  await expect(descriptions.getByText('thunderstorms with heavy rain')).toBeVisible();
  await expect(descriptions.getByText('partly cloudy with scattered showers')).toBeVisible();
  const readability = await descriptions.evaluateAll(elements =>
    elements.map(element => {
      const style = getComputedStyle(element);
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
      };
    })
  );
  const rowContentFits = await days.evaluateAll(elements =>
    elements.every(row =>
      Array.from(
        row.querySelectorAll<HTMLElement>(
          '.hava81-forecast-atlas__day-name, .hava81-forecast-atlas__description, .hava81-forecast-atlas__day-pop, .hava81-forecast-atlas__day-temperatures'
        )
      ).every(element => element.scrollWidth <= element.clientWidth + 1)
    )
  );
  const intervalLabelsFit = await page
    .locator('.hava81-forecast-atlas__range-button')
    .evaluateAll(elements =>
      elements.every(element => element.scrollWidth <= element.clientWidth + 1)
    );

  expect(readability.every(metric => metric.scrollWidth <= metric.clientWidth + 1)).toBe(true);
  expect(readability.every(metric => metric.scrollHeight <= metric.clientHeight + 1)).toBe(true);
  expect(readability.every(metric => metric.overflow === 'visible')).toBe(true);
  expect(readability.every(metric => metric.textOverflow === 'clip')).toBe(true);
  expect(readability.every(metric => metric.whiteSpace === 'normal')).toBe(true);
  expect(rowContentFits).toBe(true);
  expect(intervalLabelsFit).toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ).toBe(0);
});

test('saved comparison reflows at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile comparison text-resize regression');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'metric',
        windSpeedUnit: 'ms',
        themeMode: 'dark',
        language: 'en',
      })
    );
    localStorage.setItem(
      'favorites',
      JSON.stringify([
        { name: 'Kahramanmaraş' },
        { name: 'Afyonkarahisar' },
        { name: 'Şanlıurfa' },
      ])
    );
  });
  await page.unroute('**/api/v1/weather/current**');
  await page.route('**/api/v1/weather/current**', route => {
    const requestedCity = new URL(route.request().url()).searchParams.get('city') ?? current.cityName;
    return route.fulfill({ json: { ...current, cityName: requestedCity } });
  });
  await page.goto('/istanbul');
  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });
  await page.locator('.atlas-bottom-nav__button').filter({ hasText: /Saved|Kayıtlı/ }).click();

  const compare = page.locator('.hava81-compare');
  await expect(compare).toBeVisible();
  await expect(compare.locator('.hava81-compare__city')).toHaveCount(3);

  const assertFits = async () => {
    const state = await compare.evaluate(element => {
      const fits = (node: Element) => {
        const html = node as HTMLElement;
        return html.scrollWidth <= html.clientWidth + 1;
      };
      const table = element.querySelector('.hava81-compare__table');
      const cards = Array.from(element.querySelectorAll('.hava81-compare__city'));
      const headers = Array.from(element.querySelectorAll('.hava81-compare__city header'));
      const scoreWraps = Array.from(element.querySelectorAll('.hava81-compare__score-wrap'));
      const scoreLabels = Array.from(element.querySelectorAll('.hava81-compare__score-wrap small'));
      const scores = Array.from(element.querySelectorAll('.hava81-compare__score'));
      const metrics = Array.from(element.querySelectorAll('.hava81-compare__metrics > span'));
      if (!table) throw new Error('Missing comparison table');
      return {
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        compareFits: fits(element),
        tableFits: fits(table),
        cardsFit: cards.every(fits),
        headersFit: headers.every(fits),
        scoreWrapsFit: scoreWraps.every(fits),
        scoreLabelsFit: scoreLabels.every(fits),
        scoresFit: scores.every(fits),
        metricsFit: metrics.every(fits),
      };
    });
    expect(state.pageWidth).toBeLessThanOrEqual(state.viewportWidth);
    expect(state.compareFits).toBe(true);
    expect(state.tableFits).toBe(true);
    expect(state.cardsFit).toBe(true);
    expect(state.headersFit).toBe(true);
    expect(state.scoreWrapsFit).toBe(true);
    expect(state.scoreLabelsFit).toBe(true);
    expect(state.scoresFit).toBe(true);
    expect(state.metricsFit).toBe(true);
  };

  await assertFits();
  await page.setViewportSize({ width: 390, height: 844 });
  await assertFits();
});

test('decision field keeps metrics readable at narrow 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile decision-field text-resize regression');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const field = page.locator('.hava81-decision-field');
  const layout = await field.evaluate(element => {
    const fits = (node: Element | null) => {
      if (!(node instanceof HTMLElement)) return false;
      return node.scrollWidth <= node.clientWidth + 1;
    };
    const reading = element.querySelector('.hava81-decision-field__reading');
    const temperature = element.querySelector('.hava81-decision-field__temperature');
    const rail = element.querySelector('.hava81-decision-field__rail');
    const metrics = Array.from(element.querySelectorAll('.hava81-decision-field__metric'));
    const labels = Array.from(element.querySelectorAll('.hava81-decision-field__metric dt'));
    const rect = element.getBoundingClientRect();
    return {
      fieldFits: fits(element),
      readingFits: fits(reading),
      temperatureFits: fits(temperature),
      railFits: fits(rail),
      metricsFit: metrics.every(fits),
      labelsFit: labels.every(fits),
      left: rect.left,
      right: rect.right,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(layout.fieldFits).toBe(true);
  expect(layout.readingFits).toBe(true);
  expect(layout.temperatureFits).toBe(true);
  expect(layout.railFits).toBe(true);
  expect(layout.metricsFit).toBe(true);
  expect(layout.labelsFit).toBe(true);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
});

test('mid-width desktop decision reading reflows at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop decision mid-width resize regression');
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  const reading = page.locator('.hava81-decision-field__reading');
  const temperature = page.locator('.hava81-decision-field__temperature');
  const symbol = page.locator('.hava81-decision-field__symbol');
  const normal = await Promise.all([temperature.boundingBox(), symbol.boundingBox()]);
  expect(normal[0]).not.toBeNull();
  expect(normal[1]).not.toBeNull();
  expect(normal[1]!.y).toBeLessThan(normal[0]!.y + normal[0]!.height);

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const layout = await reading.evaluate(element => {
    const fits = (node: Element | null) => {
      if (!(node instanceof HTMLElement)) return false;
      return node.scrollWidth <= node.clientWidth + 1;
    };
    const temperature = element.querySelector('.hava81-decision-field__temperature');
    const value = element.querySelector('.hava81-decision-field__temperature-value');
    const symbol = element.querySelector('.hava81-decision-field__symbol');
    if (!(temperature instanceof HTMLElement) || !(value instanceof HTMLElement) || !(symbol instanceof HTMLElement)) {
      throw new Error('Missing decision reading content');
    }
    const temperatureRect = temperature.getBoundingClientRect();
    const symbolRect = symbol.getBoundingClientRect();
    return {
      readingFits: fits(element),
      temperatureFits: fits(temperature),
      valueFits: fits(value),
      symbolFits: fits(symbol),
      symbolBelowTemperature: symbolRect.top >= temperatureRect.bottom,
      valueFontSize: Number.parseFloat(getComputedStyle(value).fontSize),
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });
  expect(layout.readingFits).toBe(true);
  expect(layout.temperatureFits).toBe(true);
  expect(layout.valueFits).toBe(true);
  expect(layout.symbolFits).toBe(true);
  expect(layout.symbolBelowTemperature).toBe(true);
  expect(layout.valueFontSize).toBeGreaterThanOrEqual(200);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

test('desktop decision guidance stays readable at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop decision-field text-resize regression');
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const layout = await page.locator('.hava81-decision-field').evaluate(element => {
    const selectors = [
      '.hava81-decision-field__current',
      '.hava81-decision-field__reading',
      '.hava81-decision-field__temperature',
      '.hava81-decision-field__change',
      '.hava81-decision-field__decision-list',
    ];
    const regions = selectors.map(selector => {
      const region = element.querySelector<HTMLElement>(selector);
      if (!region) throw new Error(`Missing decision region ${selector}`);
      return {
        selector,
        clientWidth: region.clientWidth,
        scrollWidth: region.scrollWidth,
      };
    });
    const rect = element.getBoundingClientRect();
    return {
      fieldFits: element.scrollWidth <= element.clientWidth + 1,
      regions,
      left: rect.left,
      right: rect.right,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(layout.fieldFits).toBe(true);
  expect(layout.regions.every(region => region.scrollWidth <= region.clientWidth + 1)).toBe(true);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

test('decision plate stays readable at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop text-resize regression');
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const plate = page.locator('.hava81-decision-field__plate');
  await expect(plate).toBeVisible();
  const layout = await plate.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

test('activity planner stays contained at tablet 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'tablet activity text-resize regression');
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  const planner = page.locator('.activity-planner');
  const measure = async () =>
    planner.evaluate(element => {
      const fits = (node: Element | null) => {
        if (!(node instanceof HTMLElement)) return false;
        const rect = node.getBoundingClientRect();
        const plannerRect = element.getBoundingClientRect();
        return (
          node.scrollWidth <= node.clientWidth + 1 &&
          rect.left >= plannerRect.left - 1 &&
          rect.right <= plannerRect.right + 1
        );
      };
      const header = element.querySelector('.activity-planner__header');
      const sensitivity = element.querySelector('.activity-planner__sensitivity');
      const sensitivitySelect = sensitivity?.querySelector('select') ?? null;
      const cards = element.querySelector('.activity-planner__cards');
      const cardItems = Array.from(element.querySelectorAll('.activity-card'));
      if (!header || !sensitivity || !sensitivitySelect || !cards || cardItems.length < 2) {
        throw new Error('Missing activity planner tablet content');
      }
      return {
        plannerFits: fits(element),
        headerFits: fits(header),
        sensitivityFits: fits(sensitivity),
        sensitivitySelectFits: fits(sensitivitySelect),
        cardsFit: fits(cards),
        cardItemsFit: cardItems.every(fits),
        cardTops: cardItems.slice(0, 2).map(card => card.getBoundingClientRect().top),
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

  const normal = await measure();
  expect(normal.plannerFits).toBe(true);
  expect(normal.headerFits).toBe(true);
  expect(normal.sensitivityFits).toBe(true);
  expect(normal.sensitivitySelectFits).toBe(true);
  expect(normal.cardsFit).toBe(true);
  expect(normal.cardItemsFit).toBe(true);
  expect(Math.abs(normal.cardTops[0] - normal.cardTops[1])).toBeLessThanOrEqual(1);

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const enlarged = await measure();
  expect(enlarged.plannerFits).toBe(true);
  expect(enlarged.headerFits).toBe(true);
  expect(enlarged.sensitivityFits).toBe(true);
  expect(enlarged.sensitivitySelectFits).toBe(true);
  expect(enlarged.cardsFit).toBe(true);
  expect(enlarged.cardItemsFit).toBe(true);
  expect(enlarged.cardTops[1]).toBeGreaterThan(enlarged.cardTops[0] + 1);
  expect(enlarged.pageWidth).toBeLessThanOrEqual(enlarged.viewportWidth);
});

test('activity planner reflows at narrow 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile activity text-resize regression');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const planner = page.locator('.activity-planner');
  await planner.scrollIntoViewIfNeeded();
  await expect(planner).toBeVisible();
  const layout = await planner.evaluate(element => {
    const fits = (node: Element | null) => {
      if (!(node instanceof HTMLElement)) return false;
      return node.scrollWidth <= node.clientWidth + 1;
    };
    const selectors = [
      '.activity-planner__header',
      '.activity-planner__header h2',
      '.activity-planner__header p',
      '.activity-planner__window',
      '.activity-planner__window-copy',
      '.activity-planner__window-copy > strong',
      '.activity-planner__window-help summary',
    ];
    const labels = Array.from(element.querySelectorAll('.activity-planner__window > label span'));
    const rect = element.getBoundingClientRect();
    return {
      plannerFits: fits(element),
      sectionsFit: selectors.every(selector => fits(element.querySelector(selector))),
      labelsFit: labels.every(fits),
      left: rect.left,
      right: rect.right,
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
    };
  });

  expect(layout.plannerFits).toBe(true);
  expect(layout.sectionsFit).toBe(true);
  expect(layout.labelsFit).toBe(true);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

test('activity detail explanations reflow at narrow 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile activity-detail text-resize regression');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  await page.locator('.activity-planner__score-explanation').evaluate(element => {
    (element as HTMLDetailsElement).open = true;
  });
  await page.locator('.activity-card__details').evaluateAll(elements => {
    elements.forEach(element => {
      (element as HTMLDetailsElement).open = true;
    });
  });

  const planner = page.locator('.activity-planner');
  await planner.scrollIntoViewIfNeeded();
  const layout = await planner.evaluate(element => {
    const fits = (node: Element) => {
      const html = node as HTMLElement;
      return html.scrollWidth <= html.clientWidth + 1;
    };
    const explanation = element.querySelector('.activity-planner__score-explanation p');
    const detailBodies = Array.from(element.querySelectorAll('.activity-card__details-body'));
    const detailCopy = Array.from(element.querySelectorAll('.activity-card__details-body small'));
    if (!explanation || detailBodies.length === 0 || detailCopy.length === 0) {
      throw new Error('Missing expanded activity detail content');
    }
    return {
      explanationFits: fits(explanation),
      detailBodiesFit: detailBodies.every(fits),
      detailCopyFits: detailCopy.every(fits),
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(layout.explanationFits).toBe(true);
  expect(layout.detailBodiesFit).toBe(true);
  expect(layout.detailCopyFits).toBe(true);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

test('activity time filter stays within the page at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop text-resize regression');
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeVisible();

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const activityWindow = page.locator('.activity-planner__window');
  await activityWindow.scrollIntoViewIfNeeded();
  await expect(activityWindow).toBeVisible();
  const layout = await activityWindow.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

test('hourly interval controls resample the same 24-hour forecast', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser interval coverage');
  await page.goto('/istanbul');

  const interval = page.getByRole('group', { name: 'Tahmin aralığı' });
  await expect(interval.getByRole('button', { name: '1s 1 saatlik' })).toHaveAttribute('aria-pressed', 'true');
  await expect(interval.getByRole('button')).toHaveCount(7);
  for (const hours of [2, 3, 4, 6, 8, 12]) {
    await expect(interval.getByRole('button', { name: `${hours}s ${hours} saatlik`, exact: true })).toBeVisible();
  }
  await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(24);

  const displayedTimes = async () =>
    page.locator('.hava81-forecast-atlas__hour time > span:last-child').allTextContents();

  await interval.getByRole('button', { name: '2s 2 saatlik', exact: true }).click();
  await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(12);

  await interval.getByRole('button', { name: '3s 3 saatlik' }).click();
  await expect(page.getByRole('heading', { name: /Saatlik tahmin · sonraki 24 saat/i })).toBeVisible();
  await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(8);
  expect((await displayedTimes()).slice(0, 4)).toEqual(['12:00', '15:00', '18:00', '21:00']);
  await expect(page.locator('.hava81-forecast-atlas__hour-day')).toHaveCount(1);
  await expect(
    page.locator('.hava81-forecast-atlas__hour.is-day-boundary')
  ).toContainText('00:00');

  await interval.getByRole('button', { name: '4s 4 saatlik' }).click();
  await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(6);

  await interval.getByRole('button', { name: '6s 6 saatlik' }).click();
  await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(4);
  expect(await displayedTimes()).toEqual(['12:00', '18:00', '00:00', '06:00']);

  await interval.getByRole('button', { name: '8s 8 saatlik' }).click();
  await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(3);

  await interval.getByRole('button', { name: '12s 12 saatlik' }).click();
  await expect(page.locator('.hava81-forecast-atlas__hour')).toHaveCount(2);
  expect(await displayedTimes()).toEqual(['12:00', '00:00']);
});

test('hourly display falls back to the existing three-hour forecast when the hourly source fails', async ({
  page,
}) => {
  await page.unroute('**/api/v1/weather/hourly**');
  await page.route('**/api/v1/weather/hourly**', route =>
    route.fulfill({ status: 503, json: { error: { code: 'HOURLY_PROVIDER_ERROR' } } })
  );

  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: /3 saat aralıklarla tahmin/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Gün planı/i })).toBeVisible();
});

test('browser and install surfaces use Hava81 branding assets', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser coverage for brand assets');

  await page.goto('/istanbul');

  const iconHrefs = await page
    .locator('link[rel="icon"]')
    .evaluateAll(elements =>
      elements.map(element => (element as HTMLLinkElement).getAttribute('href'))
    );
  expect(iconHrefs).toEqual(
    expect.arrayContaining(['/hava81-mark.svg?v=20260828', '/hava81-favicon.ico?v=20260828'])
  );

  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/apple-touch-icon.png?v=20260828'
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://hava81.zekiakgul.dev/hava81-social-card.png?v=20260828'
  );
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image'
  );

  const samples = await page.evaluate(async () => {
    const readImage = async (src: string) => {
      const image = new Image();
      image.src = src;
      await image.decode();

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2D canvas unavailable');
      context.drawImage(image, 0, 0);

      let maxContentRadius: number | null = null;
      if (src.includes('maskable')) {
        const { data } = context.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
        const background = data.slice(0, 4);
        const centerX = (image.naturalWidth - 1) / 2;
        const centerY = (image.naturalHeight - 1) / 2;
        let measuredRadius = 0;
        for (let y = 0; y < image.naturalHeight; y += 1) {
          for (let x = 0; x < image.naturalWidth; x += 1) {
            const offset = (y * image.naturalWidth + x) * 4;
            const differsFromBackground = [0, 1, 2].some(
              channel => Math.abs(data[offset + channel] - background[channel]) > 8
            );
            if (!differsFromBackground) continue;
            measuredRadius = Math.max(measuredRadius, Math.hypot(x - centerX, y - centerY));
          }
        }
        maxContentRadius = measuredRadius;
      }

      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        center: Array.from(
          context.getImageData(
            Math.floor(image.naturalWidth / 2),
            Math.floor(image.naturalHeight / 2),
            1,
            1
          ).data
        ),
        maxContentRadius,
      };
    };

    return Promise.all([
      readImage('/hava81-icon-192.png'),
      readImage('/hava81-icon-512.png'),
      readImage('/hava81-maskable-512.png'),
      readImage('/apple-touch-icon.png?v=20260828'),
      readImage('/hava81-favicon.ico?v=20260828'),
      readImage('/hava81-social-card.png?v=20260828'),
    ]);
  });

  expect(samples[0]).toMatchObject({ width: 192, height: 192, center: [231, 165, 49, 255] });
  expect(samples[1]).toMatchObject({ width: 512, height: 512, center: [231, 165, 49, 255] });
  expect(samples[2]).toMatchObject({ width: 512, height: 512, center: [231, 165, 49, 255] });
  expect(samples[2].maxContentRadius).not.toBeNull();
  expect(samples[2].maxContentRadius ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(512 * 0.4);
  expect(samples[3]).toMatchObject({ width: 180, height: 180, center: [231, 165, 49, 255] });
  expect(samples[4].width).toBeGreaterThanOrEqual(32);
  expect(samples[4].center[0]).toBeGreaterThan(200);
  expect(samples[4].center[1]).toBeGreaterThan(120);
  expect(samples[4].center[2]).toBeLessThan(100);
  expect(samples[5]).toMatchObject({ width: 1200, height: 630 });
});

test('theme choice keeps browser chrome color in sync', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser theme metadata coverage');

  await page.goto('/istanbul');
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  expect(
    await page
      .locator('meta[name="theme-color"]')
      .evaluateAll(elements => elements.map(element => (element as HTMLMetaElement).content))
  ).toEqual(['#F3F6F4', '#F3F6F4']);

  await page.getByRole('button', { name: /ayarlar/i }).click();
  await page.getByRole('button', { name: 'Koyu' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
  expect(
    await page
      .locator('meta[name="theme-color"]')
      .evaluateAll(elements => elements.map(element => (element as HTMLMetaElement).content))
  ).toEqual(['#0E2C32', '#0E2C32']);
});

test('production HTML bootstraps current weather without a duplicate app request', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'single browser coverage for early current weather'
  );

  let currentRequests = 0;
  page.on('request', request => {
    if (request.url().includes('/api/v1/weather/current')) currentRequests += 1;
  });

  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
  expect(currentRequests).toBe(1);
});

test('fresh cached weather suppresses the generated bootstrap request', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'single browser coverage for bootstrap cache guard'
  );

  await page.addInitScript(cachedWeather => {
    window.localStorage.setItem(
      'weather_cache',
      JSON.stringify({ data: cachedWeather, timestamp: Date.now(), language: 'tr' })
    );
  }, current);

  let currentRequests = 0;
  page.on('request', request => {
    if (request.url().includes('/api/v1/weather/current')) currentRequests += 1;
  });

  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
  expect(currentRequests).toBe(0);
});

test('lazy forecast chunk does not block the decision-first view', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'single browser coverage for lazy chunk timing'
  );

  await page.route('**/assets/ForecastAtlas-*.js', async route => {
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.continue();
  });

  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Bugünün ritmi/i })).toBeVisible();
});

test('recovers once when a lazy chunk disappears during deploy', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'single browser coverage for deploy recovery'
  );

  let forecastChunkRequests = 0;
  await page.addInitScript(() => {
    Object.defineProperty(navigator.serviceWorker, 'register', {
      configurable: true,
      value: () => Promise.reject(new Error('service worker disabled for cold-cache recovery test')),
    });
  });
  await page.route('**/sw.js', route => route.abort());
  await page.route('**/assets/ForecastAtlas-*.js', async route => {
    forecastChunkRequests += 1;
    if (forecastChunkRequests === 1) {
      await route.fulfill({ status: 404, contentType: 'text/javascript', body: '' });
      return;
    }
    await route.continue();
  });

  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Bugünün ritmi/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page).toHaveURL(/\/istanbul\/$/);
  expect(forecastChunkRequests).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.app-fatal')).toHaveCount(0);
});

test('chunk recovery URL guard prevents reload loops without sessionStorage', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'single browser coverage for storage-restricted deploy recovery'
  );

  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    });
    Object.defineProperty(navigator.serviceWorker, 'register', {
      configurable: true,
      value: () => Promise.reject(new Error('service worker disabled for cold-cache recovery test')),
    });
  });

  await page.route('**/sw.js', route => route.abort());
  await page.route('**/assets/ForecastAtlas-*.js', route =>
    route.fulfill({ status: 404, contentType: 'text/javascript', body: '' })
  );

  const mainFrameUrls: string[] = [];
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) mainFrameUrls.push(frame.url());
  });

  await page.goto('/istanbul/');
  await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
  await page.waitForTimeout(2_000);

  expect(mainFrameUrls.filter(url => url.includes('__hava81_chunk_reload=')).length).toBe(1);
  await expect(page).toHaveURL(/\/istanbul\/$/);
});

test('English mode updates document language and decision copy', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser language coverage');

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'metric',
        windSpeedUnit: 'ms',
        themeMode: 'light',
        language: 'en',
      })
    );
  });
  await page.goto('/istanbul/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('İstanbul weather — Hava81');
  await expect(page.getByRole('heading', { name: 'Planning signals' })).toBeVisible();
  await expect(page.locator('.hava81-decision-field__decision-list')).not.toContainText(
    'civarında'
  );
  await expect(page.locator('.hava81-decision-field__decision-list')).not.toContainText(
    'güneş koruması'
  );
});

test('service worker update checks bypass the HTTP cache', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser PWA coverage');
  await page.goto('/');
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.updateViaCache === 'none';
  });
  const updateViaCache = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.updateViaCache;
  });
  expect(updateViaCache).toBe('none');
});

test('mobile header keeps current-location action reachable without horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile header assertion');
  await page.goto('/istanbul');

  const locationAction = page.locator('.atlas-icon-button--location');
  await expect(locationAction).toBeVisible();
  await expect(locationAction).toHaveAttribute('aria-label', /konum/i);

  expect(
    await page.locator('.atlas-header__inner').evaluate(element => element.scrollWidth <= element.clientWidth)
  ).toBe(true);

  await page.setViewportSize({ width: 320, height: 700 });
  await expect(locationAction).toBeVisible();
  expect(
    await page.locator('.atlas-header__inner').evaluate(element => element.scrollWidth <= element.clientWidth)
  ).toBe(true);
});

test('lazy forecast atlas renders hourly and daily guidance after city data loads', async ({ page }) => {
  await page.goto('/istanbul');
  await expect(page.getByRole('heading', { name: "Bugünün ritmi" })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Saatlik tahmin · sonraki 24 saat/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /5 Günlük Tahmin/i })).toBeVisible();
  await expect(page.getByRole('region', { name: /Kaydırılabilir saatlik tahmin/i })).toBeVisible();
});

test('desktop daily forecast keeps full condition labels readable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop daily forecast layout assertion');
  await page.unroute('**/api/v1/weather/forecast**');
  await page.route('**/api/v1/weather/forecast**', route =>
    route.fulfill({
      json: {
        ...forecast,
        daily: [
          {
            date: fixtureLocalDate(),
            tempMin: 20,
            tempMax: 28,
            icon: '02d',
            description: 'parçalı bulutlu',
            pop: 10,
          },
          {
            date: fixtureLocalDate(1),
            tempMin: 17,
            tempMax: 23,
            icon: '11d',
            description: 'gök gürültülü fırtına',
            pop: 73,
            precipitationMm: 11.6,
          },
        ],
      },
    })
  );

  await page.goto('/istanbul');
  const conditions = page.locator('.hava81-forecast-atlas__description');
  await expect(conditions).toHaveCount(2);
  await expect(conditions.getByText('gök gürültülü fırtına')).toBeVisible();
  expect(
    await conditions.evaluateAll(elements =>
      elements
        .filter(element => element.scrollWidth > element.clientWidth + 1)
        .map(element => element.textContent?.trim())
    )
  ).toEqual([]);
});

test('desktop dashboard uses the decision column instead of leaving dead space', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop composition assertion');
  await page.goto('/istanbul');
  await expect(page.locator('.commute-plan')).toBeVisible();
  await expect(page.locator('.activity-card')).toHaveCount(2);

  const layout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width };
    };
    const activity = rect('.activity-planner__cards');
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.activity-card')).map(element => {
      const box = element.getBoundingClientRect();
      return { width: box.width, left: box.left, right: box.right };
    });
    return {
      decision: rect('.hava81-decision-field'),
      forecast: rect('.hava81-forecast-atlas'),
      commute: rect('.commute-plan'),
      daily: rect('.daily-plan'),
      activity,
      cards,
    };
  });

  expect(Math.abs(layout.commute.left - layout.decision.left)).toBeLessThan(2);
  expect(layout.commute.top).toBeGreaterThanOrEqual(layout.decision.bottom + 8);
  expect(layout.forecast.left).toBeGreaterThanOrEqual(layout.decision.right + 8);
  expect(layout.daily.top).toBeGreaterThanOrEqual(
    Math.max(layout.commute.bottom, layout.forecast.bottom) + 8
  );
  expect(Math.min(...layout.cards.map(card => card.width))).toBeGreaterThan(layout.activity.width * 0.45);
});

test('current conditions stay in the first mobile viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile viewport assertion');
  await page.goto('/istanbul');
  const heading = page.getByRole('heading', { name: 'İstanbul' });
  await expect(heading).toBeVisible();
  const box = await heading.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? 1000) + (box?.height ?? 0)).toBeLessThan(844);
});

test('mobile interactive controls preserve 44px touch targets', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile touch target coverage');

  await page.goto('/istanbul');
  await expect(
    page.locator('.hava81-forecast-atlas__source').getByRole('link', { name: 'Open-Meteo' })
  ).toBeVisible();
  await expect(
    page.locator('.context-signals__source').getByRole('link', { name: 'Open-Meteo' })
  ).toBeVisible();

  const undersized = await page
    .locator('button, a, input, select, textarea, summary, [role="button"]')
    .evaluateAll(elements =>
      elements
        .map(element => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden';
          return {
            label:
              element.getAttribute('aria-label') ||
              element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60) ||
              element.tagName,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            visible,
          };
        })
        .filter(target => target.visible && (target.width < 44 || target.height < 44))
    );

  expect(undersized).toEqual([]);
});

test('desktop comparison entry works with two saved cities', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop comparison assertion');
  await page.addInitScript(() => {
    localStorage.setItem(
      'favorites',
      JSON.stringify([
        { name: 'İstanbul', lat: 41.01, lon: 28.97 },
        { name: 'İzmir', lat: 38.42, lon: 27.14 },
      ])
    );
  });
  await page.goto('/istanbul');
  await page.getByRole('button', { name: /Karşılaştır/i }).click();
  await expect(page.getByRole('heading', { name: /Şehir karşılaştırması/i })).toBeVisible();
  await expect(page.locator('.atlas-dashboard')).toHaveCount(0);
});


test('mobile map header reflows at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile map text-resize regression');
  await page.goto('/istanbul');
  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Harita', exact: true }).click();

  const panel = page.locator('#weather-map-region');
  const header = page.locator('.atlas-map-panel__header');
  await expect(panel).toBeVisible();
  const layout = await header.evaluate(element => {
    const fits = (node: Element) => {
      const html = node as HTMLElement;
      return html.scrollWidth <= html.clientWidth + 1;
    };
    const children = Array.from(element.children);
    return {
      headerFits: fits(element),
      childrenFit: children.every(fits),
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });
  expect(layout.headerFits).toBe(true);
  expect(layout.childrenFit).toBe(true);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
  await expect(header.getByRole('button', { name: 'Kapat' })).toBeVisible();
});

test('mobile map navigation opens a dedicated map view', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile map-view assertion');
  await page.goto('/istanbul');

  await page.getByRole('button', { name: 'Harita' }).click();
  const mapPanel = page.locator('#weather-map-region');
  await expect(mapPanel).toBeVisible();
  await expect(page.locator('.atlas-dashboard__primary')).not.toBeVisible();
  await expect(page.locator('.daily-plan')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Harita' })).toHaveAttribute('aria-current', 'page');

  const layout = await page.evaluate(() => {
    const map = document.querySelector<HTMLElement>('#weather-map-region');
    const nav = document.querySelector<HTMLElement>('.atlas-bottom-nav');
    if (!map || !nav) throw new Error('Missing map view or bottom navigation');
    const mapRect = map.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    return {
      scrollY: window.scrollY,
      mapTop: mapRect.top,
      mapBottom: mapRect.bottom,
      navTop: navRect.top,
      documentHeight: document.documentElement.scrollHeight,
    };
  });

  expect(layout.scrollY).toBeLessThan(200);
  expect(layout.mapTop).toBeGreaterThanOrEqual(0);
  expect(layout.mapBottom).toBeLessThanOrEqual(layout.navTop + 1);
  expect(layout.documentHeight).toBeLessThan(1600);

  await expect(page.locator('.leaflet-control-zoom-in')).toBeVisible();
  const mapTargets = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>('.leaflet-control-zoom a'),
      ...document.querySelectorAll<HTMLElement>('.weather-map__attribution a'),
      ...document.querySelectorAll<HTMLElement>('.weather-map__marker, .weather-map__plate-marker'),
    ].map(element => {
      const rect = element.getBoundingClientRect();
      return {
        label: element.getAttribute('aria-label') || element.textContent?.trim() || element.className,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    })
  );
  expect(mapTargets.length).toBeGreaterThanOrEqual(5);
  expect(mapTargets.filter(target => target.width < 44 || target.height < 44)).toEqual([]);
  await expect(page.locator('.leaflet-control-attribution')).toHaveCount(0);
  await expect(page.locator('.weather-map__attribution')).toContainText('OpenStreetMap contributors');
  await expect(page.locator('.weather-map__attribution')).toContainText('CARTO');

  await page.locator('.weather-map__marker').click();
  const popupClose = page.locator('.leaflet-popup-close-button');
  await expect(popupClose).toBeVisible();
  const popupCloseRect = await popupClose.boundingBox();
  expect(popupCloseRect?.width).toBeGreaterThanOrEqual(44);
  expect(popupCloseRect?.height).toBeGreaterThanOrEqual(44);
  const popupClearance = await page.evaluate(() => {
    const close = document.querySelector<HTMLElement>('.leaflet-popup-close-button');
    const heading = document.querySelector<HTMLElement>('.weather-map__popup-content h4');
    if (!close || !heading) throw new Error('Missing map popup controls');
    const closeRect = close.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    return headingRect.top - closeRect.bottom;
  });
  expect(popupClearance).toBeGreaterThanOrEqual(0);
});

test('mobile map province marker previews the city before switching views', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile map preview assertion');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/istanbul');
  await page.getByRole('button', { name: 'Harita' }).click();

  const bursaMarker = page.locator('.weather-map__plate-marker').filter({ hasText: '16' });
  await expect(bursaMarker).toBeVisible();
  const markerBounds = await bursaMarker.boundingBox();
  const mapBounds = await page.locator('.weather-map__container').boundingBox();
  expect(markerBounds).not.toBeNull();
  expect(mapBounds).not.toBeNull();
  expect(markerBounds!.x).toBeGreaterThanOrEqual(mapBounds!.x);
  expect(markerBounds!.y).toBeGreaterThanOrEqual(mapBounds!.y);
  expect(markerBounds!.x + markerBounds!.width).toBeLessThanOrEqual(mapBounds!.x + mapBounds!.width);
  expect(markerBounds!.y + markerBounds!.height).toBeLessThanOrEqual(mapBounds!.y + mapBounds!.height);
  await bursaMarker.click();

  await expect(page).toHaveURL(/\/istanbul\/?$/);
  await expect(page.locator('#weather-map-region')).toBeVisible();
  const popup = page.locator('.weather-map__popup');
  await expect(popup.getByRole('heading', { name: 'Bursa' })).toBeVisible();
  const cityButton = popup.getByRole('button', { name: /şehrin havasını gör/i });
  await expect(cityButton).toBeVisible();

  const bursaWeatherRequest = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname.endsWith('/api/v1/weather/current') && url.searchParams.get('city') === 'Bursa';
  });
  await cityButton.click();
  await expect(bursaWeatherRequest).resolves.toBeTruthy();
  await expect(page.locator('#weather-map-region')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bugün' })).toHaveAttribute('aria-current', 'page');
});

test('mobile saved navigation does not create a favorite just by opening the view', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile saved-view mutation regression');
  await page.goto('/istanbul');
  await expect(page.evaluate(() => localStorage.getItem('favorites'))).resolves.toBeNull();

  await page.getByRole('button', { name: 'Kayıtlı' }).click();

  await expect(page.getByRole('heading', { name: /Şehir karşılaştırması/i })).toBeVisible();
  await expect(page.getByText(/en az iki şehri favorilere ekle/i)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('favorites'))).toBeNull();
  await expect(page.getByRole('button', { name: /favorilere ekle/i })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
});

test('mobile saved navigation replaces the today dashboard', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile saved-view assertion');
  await page.addInitScript(() => {
    localStorage.setItem(
      'favorites',
      JSON.stringify([
        { name: 'İstanbul', lat: 41.01, lon: 28.97 },
        { name: 'İzmir', lat: 38.42, lon: 27.14 },
      ])
    );
  });
  await page.goto('/istanbul');
  await page.getByRole('button', { name: 'Kayıtlı' }).click();
  await expect(page.getByRole('heading', { name: /Şehir karşılaştırması/i })).toBeVisible();
  await expect(page.locator('.atlas-dashboard')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Kayıtlı' })).toHaveAttribute('aria-current', 'page');
});

test('activity preference and time range change the personalized plan', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop interaction assertion');
  await page.goto('/istanbul');
  const picnic = page.getByRole('button', { name: 'Piknik' });
  await expect(picnic).toHaveAttribute('aria-pressed', 'false');
  await picnic.click();
  await expect(picnic).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Piknik' })).toBeVisible();
  await expect(page.getByText(/Üç aktivite seçtin/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Motosiklet' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Çamaşır' })).toBeDisabled();

  await page.getByRole('textbox', { name: 'Başlangıç' }).fill('18:00');
  await page.getByRole('textbox', { name: 'Bitiş' }).fill('20:00');
  await expect(page.getByText('18:00–20:00 uygunluğu').first()).toBeVisible();
  const runCard = page.locator('.activity-card').filter({ has: page.getByRole('heading', { name: 'Koşu', exact: true }) });
  await runCard.locator('summary').click();
  await expect(runCard.getByText(/Koşuda 10–22°C/)).toBeVisible();
});

test('route form reflows when enlarged text narrows its content box', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop route text-resize container regression');
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/istanbul');
  await page.getByText('Rota havası', { exact: true }).click();

  const routeForm = page.locator('.route-weather__form');
  const measure = async () =>
    routeForm.evaluate(element => {
      const fits = (node: Element) => {
        const html = node as HTMLElement;
        const rect = html.getBoundingClientRect();
        const formRect = element.getBoundingClientRect();
        return (
          html.scrollWidth <= html.clientWidth + 1 &&
          rect.left >= formRect.left - 1 &&
          rect.right <= formRect.right + 1
        );
      };
      const labels = Array.from(element.querySelectorAll('label'));
      const controls = Array.from(element.querySelectorAll('select, input, button'));
      return {
        formFits: element.scrollWidth <= element.clientWidth + 1,
        labelsFit: labels.every(fits),
        controlsFit: controls.every(fits),
        labelTops: labels.map(label => label.getBoundingClientRect().top),
        controlTops: controls.map(control => control.getBoundingClientRect().top),
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

  const normal = await measure();
  expect(normal.formFits).toBe(true);
  expect(normal.labelsFit).toBe(true);
  expect(normal.controlsFit).toBe(true);
  expect(Math.abs(normal.labelTops[0] - normal.labelTops[2])).toBeLessThanOrEqual(1);

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });
  const enlarged = await measure();
  expect(enlarged.formFits).toBe(true);
  expect(enlarged.labelsFit).toBe(true);
  expect(enlarged.controlsFit).toBe(true);
  expect(enlarged.labelTops[2]).toBeGreaterThan(enlarged.labelTops[0] + 1);
  expect(enlarged.controlTops.at(-1)).toBeGreaterThan(enlarged.controlTops[0] + 1);
  expect(enlarged.pageWidth).toBeLessThanOrEqual(enlarged.viewportWidth);
});

test('narrow route form keeps endpoint controls readable and inside the viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile route layout assertion');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/istanbul');
  await page.getByText('Rota havası', { exact: true }).click();

  const routeForm = page.locator('.route-weather__form');
  const origin = routeForm.getByLabel('Başlangıç');
  const destination = routeForm.getByLabel('Varış');
  const swap = routeForm.getByRole('button', { name: 'Yönü değiştir' });
  await expect(origin).toHaveValue('İstanbul');
  await expect(destination).toHaveValue('Ankara');

  const layout = await page.locator('.route-weather__form').evaluate(element => {
    const viewportWidth = document.documentElement.clientWidth;
    const box = (node: Element | null) => {
      if (!node) throw new Error('Missing route form control');
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    };
    const selects = Array.from(element.querySelectorAll('select')).map(select => box(select));
    const swapButton = box(element.querySelector('.route-weather__swap'));
    const form = box(element);
    return { viewportWidth, pageWidth: document.documentElement.scrollWidth, form, selects, swapButton };
  });

  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.form.right).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.selects.every(select => select.left >= 0 && select.right <= layout.viewportWidth)).toBe(true);
  expect(layout.selects.every(select => select.width > 180 && select.height >= 44)).toBe(true);
  expect(layout.swapButton.width).toBeGreaterThanOrEqual(44);
  expect(layout.swapButton.height).toBeGreaterThanOrEqual(44);

  await swap.click();
  await expect(origin).toHaveValue('Ankara');
  await expect(destination).toHaveValue('İstanbul');
});

test('narrow route labels reflow at 200 percent text size', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', 'mobile route text-resize regression');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/istanbul');
  await page.getByText('Rota havası', { exact: true }).click();

  await page.locator('html').evaluate(element => {
    element.style.fontSize = '200%';
  });

  const routeForm = page.locator('.route-weather__form');
  await routeForm.scrollIntoViewIfNeeded();
  const layout = await routeForm.evaluate(element => {
    const fits = (node: Element) => {
      const html = node as HTMLElement;
      return html.scrollWidth <= html.clientWidth + 1;
    };
    const labels = Array.from(element.querySelectorAll('label'));
    const controls = Array.from(element.querySelectorAll('select, input, button'));
    const rect = element.getBoundingClientRect();
    return {
      formFits: fits(element),
      labelsFit: labels.every(fits),
      controlsFit: controls.every(fits),
      left: rect.left,
      right: rect.right,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(layout.formFits).toBe(true);
  expect(layout.labelsFit).toBe(true);
  expect(layout.controlsFit).toBe(true);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

test('route weather renders a transparent corridor result', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'desktop route assertion');
  await page.goto('/istanbul');
  await page.getByText('Rota havası', { exact: true }).click();
  await page.getByRole('button', { name: /koridoru kontrol et/i }).click();
  await expect(page.getByRole('heading', { name: /İstanbul → Ankara/i })).toBeVisible();
  await expect(page.getByText(/gerçek yol\/navigasyon rotası değildir/i)).toBeVisible();
  await expect(
    page.getByRole('list', { name: /rota boyunca hava örnekleri/i }).getByRole('listitem')
  ).toHaveCount(5);
});

test('production shell exposes an installable PWA contract', async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser PWA coverage');

  const manifestResponse = await request.get('/manifest.json');
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: expect.stringContaining('Hava81'),
    start_url: '/',
    scope: '/',
    display: 'standalone',
  });
  expect(manifest.icons?.length).toBeGreaterThanOrEqual(2);

  const workerResponse = await request.get('/sw.js');
  expect(workerResponse.ok()).toBeTruthy();
  const workerSource = await workerResponse.text();
  expect(workerSource).toContain("self.addEventListener('notificationclick'");
  expect(workerSource).toContain("fetch(request, { cache: 'no-store' })");

  await page.goto('/istanbul/');
  const registration = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const ready = await navigator.serviceWorker.ready;
    return { scope: ready.scope, active: Boolean(ready.active) };
  });
  expect(registration?.active).toBe(true);
  expect(registration?.scope).toMatch(/\/$/);

  // Reload once under service-worker control so the visited city shell and hashed assets are cached.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();

  // Stable root branding URLs must stay network-fresh; only fingerprinted /assets/ resources are
  // cache-first. This prevents an old logo/icon from surviving a later brand refresh indefinitely.
  await page.evaluate(async () => {
    await fetch('/hava81-mark.svg?sw-cache-probe=1');
  });
  const cachedUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      urls.push(...(await cache.keys()).map(request => request.url));
    }
    return urls;
  });
  expect(cachedUrls.some(url => new URL(url).pathname === '/hava81-mark.svg')).toBe(false);
  expect(cachedUrls.some(url => new URL(url).pathname.startsWith('/assets/'))).toBe(true);

  await page.context().setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'İstanbul' })).toBeVisible();
  } finally {
    await page.context().setOffline(false);
  }
});

test('out-and-back plan persists routine times and produces a preparation decision', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'single browser routine-plan coverage');

  await page.unroute('**/api/v1/weather/hourly**');
  await page.route('**/api/v1/weather/hourly**', route =>
    route.fulfill({
      json: {
        ...hourlyForecast,
        hourly: Array.from({ length: 24 }, (_, index) => ({
          ...hourlyForecast.hourly[index],
          time: fixtureIsoAtHour(index + 1),
        })),
      },
    })
  );
  await page.clock.setFixedTime(new Date(fixtureNow));
  const localFixtureNow = fixtureNow + current.meta.timezoneOffsetSeconds * 1000;
  const clockAtOffset = (offsetHours: number) =>
    new Date(localFixtureNow + offsetHours * 60 * 60_000).toISOString().slice(11, 16);
  const outboundClock = clockAtOffset(2);
  const returnClock = clockAtOffset(5);

  await page.goto('/istanbul/');
  await expect(page.getByRole('heading', { name: 'Çıkış planı' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Çıkış', exact: true }).fill(outboundClock);
  await page.getByRole('textbox', { name: 'Dönüş', exact: true }).fill(returnClock);
  const commuteVerdict = page.locator('.commute-plan__verdict');
  await expect(commuteVerdict).toBeVisible();
  await expect(commuteVerdict.locator('strong')).not.toHaveText('');
  await expect(commuteVerdict).toHaveAttribute(
    'data-advice',
    /^(umbrella-take|umbrella-consider|heat|cold|strong-wind|wind-caution|poor-air|stable)$/
  );
  await expect(page.getByRole('list', { name: 'Çıkış ve dönüş hava pencereleri' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Çıkış', exact: true })).toHaveValue(outboundClock);
  await expect(page.getByRole('textbox', { name: 'Dönüş', exact: true })).toHaveValue(returnClock);
});
