import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { SettingsProvider } from '../../context';
import i18n from '../../i18n';
import { ApiError } from '../../api/errors/ApiError';
import { ErrorCode } from '../../types';
import { BundleUnavailableError } from '../../api/weatherBundle';

const service = vi.hoisted(() => ({
  getCurrentWeather: vi.fn(),
  getCurrentLocationWeather: vi.fn(),
  getForecast: vi.fn(),
  getHourlyForecast: vi.fn(),
  getAirQuality: vi.fn(),
  getContextSignals: vi.fn(),
  // Faz 3.2: bundle uç noktası yokmuş gibi davran (eski API) → tekil isteklere düşülür.
  getForecastBundle: vi.fn(),
  hasBootstrapHourly: vi.fn(() => false),
  getProvinceTemperatures: vi.fn(async () => null),
}));

vi.mock('../../api/weatherService', () => ({ weatherService: service }));

const current = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 24,
  feelsLike: 24,
  tempMin: 19,
  tempMax: 28,
  humidity: 60,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 4.4,
  windDirection: 180,
  description: 'açık',
  icon: '01d' as const,
  sunrise: new Date('2026-08-28T03:00:00.000Z'),
  sunset: new Date('2026-08-28T16:00:00.000Z'),
  timestamp: new Date('2026-08-28T09:00:00.000Z'),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 5,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date(),
    timezoneOffsetSeconds: 10800,
    cacheStatus: 'MISS' as const,
    freshForSeconds: 60,
  },
};

const forecast = {
  daily: [
    {
      date: new Date('2026-08-28T12:00:00.000Z'),
      tempMin: 19,
      tempMax: 28,
      icon: '01d' as const,
      description: 'açık',
      pop: 0.1,
    },
  ],
  hourly: [
    {
      time: new Date('2026-08-28T09:00:00.000Z'),
      temp: 24,
      icon: '01d' as const,
      description: 'açık',
      pop: 0.1,
      windSpeed: 4,
    },
    {
      time: new Date('2026-08-28T12:00:00.000Z'),
      temp: 26,
      icon: '01d' as const,
      description: 'açık',
      pop: 0.15,
      windSpeed: 5,
    },
  ],
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 3,
    cacheStatus: 'MISS' as const,
    freshForSeconds: 300,
  },
};

const HOUR_MS = 60 * 60 * 1000;
const firstFutureHourlyTime = (() => {
  const now = Date.now();
  const rounded = Math.ceil(now / HOUR_MS) * HOUR_MS;
  return new Date(rounded > now ? rounded : rounded + HOUR_MS);
})();

const hourlyForecast = {
  hourly: [
    {
      time: firstFutureHourlyTime,
      temp: 23,
      icon: '01d' as const,
      description: 'açık',
      pop: 0.1,
      windSpeed: 3.2,
    },
    {
      time: new Date(firstFutureHourlyTime.getTime() + HOUR_MS),
      temp: 22,
      icon: '02n' as const,
      description: 'çoğunlukla açık',
      pop: 0.15,
      windSpeed: 3.1,
    },
  ],
  meta: {
    provider: 'Open-Meteo',
    attribution: 'Open-Meteo · CC BY 4.0',
    sourceUrl: 'https://open-meteo.com/',
    fetchedAt: new Date(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 1,
  },
};

const air = {
  aqi: 3,
  aqiLabel: 'Orta',
  pm25: 8,
  pm10: 14,
  o3: 40,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(), freshForSeconds: 300 },
};

const renderApp = () =>
  render(
    <SettingsProvider>
      <App />
    </SettingsProvider>
  );

describe('Hava81 app integration', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
    localStorage.clear();
    window.history.replaceState({}, '', '/istanbul');
    service.getCurrentWeather.mockReset().mockResolvedValue(current);
    service.getCurrentLocationWeather.mockReset().mockResolvedValue(current);
    service.getForecast.mockReset().mockResolvedValue(forecast);
    service.getForecastBundle
      .mockReset()
      .mockRejectedValue(new BundleUnavailableError('unsupported'));
    service.getHourlyForecast.mockReset().mockResolvedValue(hourlyForecast);
    service.getAirQuality.mockReset().mockResolvedValue(air);
    service.getContextSignals.mockReset().mockResolvedValue(null);
  });

  it('restores the root location gate when browser history returns from a city route', async () => {
    window.history.replaceState({}, '', '/istanbul/');
    renderApp();

    expect(await screen.findByRole('heading', { name: 'İstanbul', level: 1 })).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('İstanbul hava durumu — Hava81');
    });

    await act(async () => {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Havayı bulunduğun yere göre gösterelim',
        level: 1,
      })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'İstanbul', level: 1 })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
    expect(document.title).toBe('Hava81 — Havayı değil, gününü planla');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://hava81.zekiakgul.dev/'
    );
    expect(
      document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="tr"]')?.href
    ).toBe('https://hava81.zekiakgul.dev/');
    expect(
      document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="en"]')?.href
    ).toBe('https://hava81.zekiakgul.dev/en/');
  });

  it('starts an English city route in English when persisted settings still say Turkish', async () => {
    await i18n.changeLanguage('en');
    window.history.replaceState({}, '', '/en/istanbul/');
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'metric',
        windSpeedUnit: 'ms',
        themeMode: 'auto',
        language: 'tr',
      })
    );

    renderApp();

    expect(await screen.findByRole('heading', { name: 'İstanbul', level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(service.getCurrentWeather).toHaveBeenCalledTimes(1));
    expect(service.getCurrentWeather).toHaveBeenCalledWith(
      { city: 'İstanbul', lang: 'en' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(JSON.parse(localStorage.getItem('user-settings') ?? '{}').language).toBe('en');
  });

  it('replaces weather when a restored route no longer matches the visible city', async () => {
    service.getCurrentWeather.mockResolvedValueOnce(current).mockResolvedValueOnce({
      ...current,
      cityName: 'Ankara',
      coordinates: { lat: 39.9334, lon: 32.8597 },
    });
    window.history.replaceState({}, '', '/istanbul/');
    renderApp();

    expect(await screen.findByRole('heading', { name: 'İstanbul', level: 1 })).toBeInTheDocument();

    await act(async () => {
      window.history.pushState({}, '', '/ankara/');
      const pageshow = new Event('pageshow');
      Object.defineProperty(pageshow, 'persisted', { value: true });
      window.dispatchEvent(pageshow);
    });

    expect(await screen.findByRole('heading', { name: 'Ankara', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'İstanbul', level: 1 })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(service.getCurrentWeather).toHaveBeenLastCalledWith(
        { city: 'Ankara', lang: 'tr' },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  it('shows İstanbul immediately on the root route without requesting browser location', async () => {
    window.history.replaceState({}, '', '/');

    renderApp();

    expect(await screen.findByRole('heading', { name: 'İstanbul', level: 1 })).toBeInTheDocument();
    expect(service.getCurrentLocationWeather).not.toHaveBeenCalled();
    expect(service.getCurrentWeather).toHaveBeenCalledWith(
      { city: 'İstanbul', lang: 'tr' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    await waitFor(() => expect(window.location.pathname).toBe('/istanbul/'));
  });
  it('keeps province URLs canonical when an English weather provider adds Province', async () => {
    window.history.replaceState({}, '', '/sanliurfa/');
    service.getCurrentWeather.mockResolvedValue({
      ...current,
      cityName: 'Şanlıurfa Province',
      coordinates: { lat: 37.1591, lon: 38.7969 },
    });
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Şanlıurfa', level: 1 })).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname + window.location.search).toBe('/sanliurfa/');
      expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
        'https://hava81.zekiakgul.dev/sanliurfa/'
      );
    });
    expect(screen.getByRole('group', { name: 'Plaka kodu 63' })).toBeInTheDocument();
  });

  it('loads a directly shared district URL without falling back to a province', async () => {
    window.history.replaceState({}, '', '/?yer=Urla');
    service.getCurrentWeather.mockResolvedValue({
      ...current,
      cityName: 'Urla',
      coordinates: { lat: 38.3229, lon: 26.764 },
    });
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Urla', level: 1 })).toBeInTheDocument();
    expect(service.getCurrentWeather).toHaveBeenCalledWith(
      { city: 'Urla,TR', lang: 'tr' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(service.getCurrentLocationWeather).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search).toBe('/?yer=Urla');
    await waitFor(() => {
      expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
        'https://hava81.zekiakgul.dev/?yer=Urla'
      );
    });
  });

  it('changes the URL when a district replaces a province', async () => {
    window.history.replaceState({}, '', '/istanbul/');
    service.getCurrentWeather.mockResolvedValueOnce(current).mockResolvedValue({
      ...current,
      cityName: 'Urla',
      coordinates: { lat: 38.3229, lon: 26.764 },
    });
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByRole('heading', { name: 'İstanbul', level: 1 })).toBeInTheDocument();
    const input = screen.getByRole('combobox', { name: 'Şehir ara' });
    await user.clear(input);
    await user.type(input, 'Urla{Enter}');
    expect(await screen.findByRole('heading', { name: 'Urla', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe('/?yer=Urla');
  });

  it('opens a previously selected province on return without prompting for geolocation again', async () => {
    window.history.replaceState({}, '', '/');
    localStorage.setItem(
      'recent_weather_searches',
      JSON.stringify([{ city: 'İstanbul', timestamp: Date.now() }])
    );
    renderApp();

    expect(await screen.findByRole('heading', { name: 'İstanbul', level: 1 })).toBeInTheDocument();
    expect(service.getCurrentWeather).toHaveBeenCalledWith(
      { city: 'İstanbul', lang: 'tr' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(service.getCurrentLocationWeather).not.toHaveBeenCalled();
    expect(screen.queryByText('Havayı bulunduğun yere göre gösterelim')).not.toBeInTheDocument();
  });

  it('renders the decision-first city view and forecast metadata', async () => {
    const { container } = renderApp();
    expect(await screen.findByRole('heading', { name: 'İstanbul', level: 1 })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /plan için öne çıkanlar/i, level: 2 })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole(
        'heading',
        { name: /saatlik tahmin · sonraki 2 saat/i },
        { timeout: 5_000 }
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Açık' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Çoğunlukla açık' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open-Meteo' })).toHaveAttribute(
      'href',
      'https://open-meteo.com/'
    );
    expect(screen.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/4.0/'
    );
    expect(screen.getByRole('link', { name: 'CC BY 4.0' }).closest('p')).toHaveTextContent(
      'Hava81 tarafından biçimlendirildi'
    );
    expect(screen.getByText('OpenWeather')).toBeInTheDocument();
    expect(screen.getByText('3/5 · Orta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hava81' })).toHaveAttribute('href', '/');
    expect(
      screen.getByRole('button', { name: 'HaritaHaritayı gösterİstanbul' })
    ).toBeInTheDocument();
    expect(screen.getByText('Ctrl+K', { selector: 'kbd' })).toBeInTheDocument();
    expect(screen.getByText('Ctrl+,', { selector: 'kbd' })).toBeInTheDocument();
    expect(service.getForecast).toHaveBeenCalledWith(
      41.01,
      28.97,
      'tr',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    // Plan-only panels are not mounted on Today; their chunks are not needed for first paint.
    expect(screen.queryByRole('heading', { name: /gün planı/i })).not.toBeInTheDocument();
    expect(container.querySelector('.daily-plan')).toBeNull();
    expect(container.querySelector('.commute-plan')).toBeNull();
    expect(container.querySelector('.activity-planner')).toBeNull();
    expect(container.querySelector('.route-weather')).toBeNull();
    // The lightweight alert engine stays mounted so opted-in notifications keep running on Today.
    expect(container.querySelector('.decision-alerts')).not.toBeNull();
    const user = userEvent.setup();
    expect(container.querySelector('.atlas-plan-entry')).toBeNull();
    await user.click(container.querySelector<HTMLButtonElement>('.atlas-plan-button') as HTMLButtonElement);
    expect(
      await screen.findByRole('heading', { name: /gün planı/i }, { timeout: 3_000 })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector('.activity-planner')).not.toBeNull();
      expect(container.querySelector('.commute-plan')).not.toBeNull();
      expect(container.querySelector('.route-weather')).not.toBeNull();
    });
    expect(screen.getByText(/şimdi mi, sonra mı/i)).toBeInTheDocument();
    const timeline = screen.getByRole('list', { name: /uygunluk zaman çizelgesi/i });
    expect(
      [...timeline.querySelectorAll('[role="listitem"]')].every(item => item.tagName === 'DIV')
    ).toBe(true);
    expect(screen.getByText('Saatlik uygunluk · 0–100 · yüksek daha uygun')).toBeInTheDocument();
  }, 12_000);

  it('opens Planla from ?view=plan and keeps the view in the URL while switching', async () => {
    window.history.replaceState({}, '', '/istanbul/?view=plan');
    const user = userEvent.setup();
    const { container } = renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Planla · İstanbul', level: 1 })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: /gün planı/i }, { timeout: 3_000 })
    ).toBeInTheDocument();
    // The main flow (decision field + summary) is not rendered behind Planla.
    expect(screen.queryByRole('heading', { name: 'İstanbul', level: 1 })).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe('?view=plan'));
    expect(window.location.pathname).toBe('/istanbul/');
    const nav = screen.getByRole('navigation', { name: 'Ana gezinme' });
    expect(within(nav).getByRole('button', { name: 'Planla' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const activityPlanner = container.querySelector<HTMLElement>('.activity-planner');
    expect(activityPlanner).not.toBeNull();
    const walking = within(activityPlanner!).getByRole('button', { name: /yürüyüş/i });
    expect(walking).toHaveAttribute('aria-pressed', 'true');
    await user.click(walking);
    expect(walking).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: /bugüne dön/i }));
    expect(await screen.findByRole('heading', { name: 'İstanbul', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /gün planı/i })).not.toBeInTheDocument();
    expect(container.querySelector('.activity-planner')).not.toBeNull();
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(within(nav).getByRole('button', { name: 'Bugün' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    await user.click(within(nav).getByRole('button', { name: 'Planla' }));
    expect(
      await screen.findByRole('heading', { name: 'Planla · İstanbul', level: 1 })
    ).toBeInTheDocument();
    expect(
      within(container.querySelector<HTMLElement>('.activity-planner')!).getByRole('button', {
        name: /yürüyüş/i,
      })
    ).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(window.location.search).toBe('?view=plan'));
  }, 12_000);

  it('opens the score explanation in Planla from the decision summary', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul', level: 1 });
    const details = await screen.findByRole('link', { name: /skorun nedenini gör/i });
    expect(details).toHaveAttribute('href', '/istanbul/?view=plan#daily-plan-title');
    await user.click(details);
    const dayPlan = await screen.findByRole('heading', { name: /gün planı/i }, { timeout: 3_000 });
    await waitFor(() => expect(dayPlan).toHaveFocus());
    expect(window.location.search).toBe('?view=plan');
  }, 12_000);

  it('does not hand materially future modeled UV into first-viewport guidance', async () => {
    service.getContextSignals.mockResolvedValueOnce({
      provider: 'Open-Meteo',
      fetchedAt: new Date(Date.now() + 2 * 60_000),
      freshForSeconds: 300,
      attribution: 'Open-Meteo · CC BY 4.0',
      uvIndexMax: 9,
      units: {},
    });

    renderApp();

    expect(await screen.findByRole('heading', { name: 'İstanbul', level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(service.getContextSignals).toHaveBeenCalled());
    expect(screen.queryByText(/UV model maksimumu 9/i)).not.toBeInTheDocument();
  });

  it('does not hand materially future air quality into rendered decision surfaces', async () => {
    service.getAirQuality.mockResolvedValueOnce({
      ...air,
      aqi: 5,
      aqiLabel: 'Very Poor',
      meta: {
        ...air.meta,
        fetchedAt: new Date(Date.now() + 2 * 60_000),
      },
    });

    renderApp();

    expect(await screen.findByRole('heading', { name: 'İstanbul', level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(service.getAirQuality).toHaveBeenCalled());
    expect(screen.queryByText(/5\/5/)).not.toBeInTheDocument();
  });

  it('uses the freshness metadata from the hourly evidence driving first-viewport guidance', async () => {
    const staleBaseline = {
      ...forecast,
      meta: {
        ...forecast.meta,
        fetchedAt: new Date(Date.now() - 10 * 60_000),
        freshForSeconds: 30,
      },
    };
    const freshHourly = {
      ...hourlyForecast,
      meta: {
        ...hourlyForecast.meta,
        fetchedAt: new Date(),
        freshForSeconds: 300,
      },
    };
    service.getForecast.mockResolvedValueOnce(staleBaseline);
    service.getHourlyForecast.mockResolvedValueOnce(freshHourly);

    renderApp();

    expect(
      await screen.findByRole(
        'heading',
        { name: /saatlik tahmin · sonraki 2 saat/i },
        { timeout: 5_000 }
      )
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByText('Yakın saatler için karar verisi henüz hazır değil.')
      ).not.toBeInTheDocument()
    );
  }, 12_000);

  it('keeps the current city decision surface visible while a same-city refresh is pending', async () => {
    let resolveRefresh!: (value: typeof current) => void;
    const pendingRefresh = new Promise<typeof current>(resolve => {
      resolveRefresh = resolve;
    });

    renderApp();
    expect(await screen.findByRole('heading', { name: 'İstanbul', level: 1 })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Ara' })).toHaveAttribute('aria-busy', 'false')
    );

    service.getCurrentWeather.mockReturnValueOnce(pendingRefresh);
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60 * 1000 + 1);
    try {
      act(() => window.dispatchEvent(new Event('online')));

      await waitFor(() => expect(service.getCurrentWeather).toHaveBeenCalledTimes(2));
      expect(screen.getByRole('heading', { name: 'İstanbul', level: 1 })).toBeInTheDocument();
      expect(screen.queryByText(/hava durumu yükleniyor/i)).not.toBeInTheDocument();

      await act(async () => {
        resolveRefresh(current);
        await pendingRefresh;
      });
    } finally {
      dateNow.mockRestore();
    }
  });

  it('announces forecast loading while the current decision surface is already available', async () => {
    let resolveForecast!: (value: typeof forecast) => void;
    let resolveHourly!: (value: typeof hourlyForecast) => void;
    const pendingForecast = new Promise<typeof forecast>(resolve => {
      resolveForecast = resolve;
    });
    const pendingHourly = new Promise<typeof hourlyForecast>(resolve => {
      resolveHourly = resolve;
    });
    service.getForecast.mockImplementation(() => pendingForecast);
    service.getHourlyForecast.mockImplementation(() => pendingHourly);

    renderApp();
    expect(await screen.findByRole('heading', { name: 'İstanbul', level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(service.getForecast).toHaveBeenCalled());
    await waitFor(() => expect(service.getHourlyForecast).toHaveBeenCalled());

    const loadingStatus = screen.getByText(/yükleniyor/i).closest('[role="status"]');
    expect(loadingStatus).toHaveClass('atlas-forecast-loading');

    await act(async () => {
      resolveForecast(forecast);
      resolveHourly(hourlyForecast);
      await Promise.all([pendingForecast, pendingHourly]);
    });
  });

  it('retries a failed location request as location instead of falling back to the typed city', async () => {
    const user = userEvent.setup();
    service.getCurrentLocationWeather
      .mockRejectedValueOnce(new ApiError('Konum reddedildi', ErrorCode.LOCATION_DENIED))
      .mockResolvedValueOnce(current);

    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul', level: 1 });

    await user.click(screen.getByRole('button', { name: /konumumu kullan/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/konum izni reddedildi/i);

    await user.click(screen.getByRole('button', { name: /tekrar dene/i }));

    await waitFor(() => expect(service.getCurrentLocationWeather).toHaveBeenCalledTimes(2));
    expect(service.getCurrentWeather).toHaveBeenCalledTimes(1);
  });

  it('does not move desktop search focus to the hidden mobile toggle on Escape', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    await screen.findByRole('heading', { name: 'İstanbul', level: 1 });

    const searchToggle = container.querySelector<HTMLButtonElement>('.atlas-icon-button--search');
    const searchInput = screen.getByRole('combobox', { name: /şehir ara/i });
    expect(searchToggle).not.toBeNull();

    await user.click(searchInput);
    expect(searchInput).toHaveFocus();
    await user.keyboard('{Escape}');

    await new Promise(resolve => requestAnimationFrame(resolve));
    expect(searchInput).not.toHaveFocus();
    expect(searchToggle).not.toHaveFocus();
    expect(searchToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('restores focus to the search toggle when mobile search is dismissed with Escape', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    await screen.findByRole('heading', { name: 'İstanbul', level: 1 });

    const searchToggle = container.querySelector<HTMLButtonElement>('.atlas-icon-button--search');
    expect(searchToggle).not.toBeNull();
    await user.click(searchToggle!);
    const searchInput = screen.getByRole('combobox', { name: /şehir ara/i });
    await waitFor(() => expect(searchInput).toHaveFocus());

    await user.keyboard('{Escape}');
    await waitFor(() => expect(searchToggle).toHaveFocus());
    expect(searchToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes mobile search and restores toggle focus after submitting a city', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    await screen.findByRole('heading', { name: 'İstanbul', level: 1 });

    const searchToggle = container.querySelector<HTMLButtonElement>('.atlas-icon-button--search');
    expect(searchToggle).not.toBeNull();
    await user.click(searchToggle!);
    const searchInput = screen.getByRole('combobox', { name: /şehir ara/i });
    await waitFor(() => expect(searchInput).toHaveFocus());

    await user.keyboard('{Enter}');
    await waitFor(() => expect(searchToggle).toHaveFocus());
    expect(searchToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('pushes a history entry for an explicit city change so browser Back can return', async () => {
    const user = userEvent.setup();
    const pushState = vi.spyOn(window.history, 'pushState');
    service.getCurrentWeather.mockImplementation(async ({ city }: { city: string }) =>
      city === 'İzmir'
        ? {
            ...current,
            cityName: 'İzmir',
            coordinates: { lat: 38.42, lon: 27.14 },
          }
        : current
    );

    const { container } = renderApp();
    await screen.findByRole('heading', { name: 'İstanbul', level: 1 });
    const searchToggle = container.querySelector<HTMLButtonElement>('.atlas-icon-button--search');
    await user.click(searchToggle!);
    const searchInput = screen.getByRole('combobox', { name: /şehir ara/i });
    await user.clear(searchInput);
    await user.type(searchInput, 'İzmir');
    const izmirOption = await waitFor(() =>
      within(screen.getByRole('listbox', { name: 'Şehir önerileri' })).getByRole('option', {
        name: 'İzmir',
      })
    );
    await user.click(izmirOption);

    await screen.findByRole('heading', { name: 'İzmir', level: 1 });
    expect(pushState).toHaveBeenCalledWith({ city: 'İzmir' }, '', '/izmir/');
    expect(window.location.pathname).toBe('/izmir/');
  });

  it('shows a localized provider rate-limit message while preserving explicit retry', async () => {
    service.getCurrentWeather.mockRejectedValueOnce(
      new ApiError('internal provider detail', ErrorCode.PROVIDER_RATE_LIMITED, {
        statusCode: 503,
      })
    );

    renderApp();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Hava durumu servisi istekleri geçici olarak sınırlandırdı. Tekrar denemeden önce biraz bekleyin.'
    );
    expect(alert).not.toHaveTextContent('internal provider detail');
    expect(screen.getByRole('button', { name: /tekrar dene/i })).toBeInTheDocument();
  });

  it('does not offer retry for a non-retryable current-weather failure', async () => {
    service.getCurrentWeather.mockRejectedValueOnce(
      new ApiError('Şehir bulunamadı', ErrorCode.NOT_FOUND, { retryable: false })
    );

    renderApp();

    // Faz 1.3: a miss is shown inline under the search box, not as a system error.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/bulunamadı/i);
    expect(alert).toHaveClass('atlas-search-inline-error');
    expect(screen.queryByRole('button', { name: /tekrar dene/i })).not.toBeInTheDocument();
  });

  it('honors explicit non-retryable unknown current-weather failures', async () => {
    service.getCurrentWeather.mockRejectedValueOnce(
      new ApiError('Bu istek tekrar denenmemeli', ErrorCode.UNKNOWN, { retryable: false })
    );

    renderApp();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Bir şeyler ters gitti');
    expect(screen.queryByRole('button', { name: /tekrar dene/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kapat/i })).toBeInTheDocument();
  });

  it('keeps raw current-weather failures out of the user-visible error state', async () => {
    service.getCurrentWeather.mockRejectedValueOnce(
      new Error('secret upstream endpoint detail: api.internal.example')
    );

    renderApp();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Bir şeyler ters gitti');
    expect(alert).not.toHaveTextContent('secret upstream endpoint detail');
    expect(screen.getByRole('button', { name: /tekrar dene/i })).toBeInTheDocument();
  });

  it('does not offer forecast retry for an explicit non-retryable forecast failure', async () => {
    service.getForecast.mockRejectedValueOnce(
      new ApiError('Tahmin isteği geçersiz', ErrorCode.VALIDATION_ERROR, { retryable: false })
    );
    service.getHourlyForecast.mockRejectedValueOnce(new Error('hourly unavailable'));

    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul', level: 1 });

    const message = await screen.findByText(/yakın tahmin şu anda güncellenemedi/i);
    const section = message.closest('section');
    expect(section).not.toBeNull();
    expect(
      within(section!).queryByRole('button', { name: /tekrar dene/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /saat aralıklarla tahmin|saatlik tahmin/i })
    ).not.toBeInTheDocument();
    expect(document.querySelector('.hava81-forecast-atlas')).not.toBeInTheDocument();
  });

  it('opens saved cities without silently favoriting the current city', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul' });

    expect(localStorage.getItem('favorites')).toBeNull();
    await user.click(screen.getByRole('button', { name: /karşılaştır/i }));

    expect(
      await screen.findByRole('heading', { name: /şehir karşılaştırması/i }, { timeout: 3_000 })
    ).toBeInTheDocument();
    expect(screen.getByText(/en az iki şehri favorilere ekle/i)).toBeVisible();
    expect(localStorage.getItem('favorites')).toBeNull();
    expect(screen.getByRole('button', { name: /favorilere ekle/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('adds a favorite and exposes saved-city comparison navigation', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul' });
    await user.click(screen.getByRole('button', { name: /favorilere ekle/i }));
    expect(screen.getByText('İstanbul', { selector: '.city-tabs__name' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /karşılaştır/i }));
    expect(
      await screen.findByRole('heading', { name: /şehir karşılaştırması/i }, { timeout: 3_000 })
    ).toBeInTheDocument();
  });

  it('exposes desktop comparison when at least two favorites exist', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'favorites',
      JSON.stringify([
        { name: 'İstanbul', lat: 41.01, lon: 28.97 },
        { name: 'İzmir', lat: 38.42, lon: 27.14 },
      ])
    );
    service.getCurrentWeather.mockImplementation(async ({ city }: { city: string }) =>
      city === 'İzmir'
        ? {
            ...current,
            cityName: 'İzmir',
            coordinates: { lat: 38.42, lon: 27.14 },
            temperature: 29,
          }
        : current
    );

    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul' });
    const compare = screen
      .getAllByRole('button', { name: /karşılaştır/i })
      .find(button => button.classList.contains('atlas-compare-button'));
    expect(compare).toBeInTheDocument();
    expect(compare!).not.toHaveAttribute('aria-current');
    expect(compare!).not.toHaveAttribute('aria-pressed');
    await user.click(compare!);
    expect(
      await screen.findByRole('heading', { name: /şehir karşılaştırması/i })
    ).toBeInTheDocument();
    expect(compare!).toHaveAttribute('aria-current', 'page');
    expect(compare!).not.toHaveAttribute('aria-pressed');
  });

  it('keeps city URL and SEO metadata locale-correct while weather is unavailable', async () => {
    const tags = [
      ['name', 'description'],
      ['property', 'og:url'],
      ['property', 'og:title'],
      ['property', 'og:description'],
      ['property', 'og:image:alt'],
      ['property', 'og:locale'],
      ['property', 'og:locale:alternate'],
      ['name', 'twitter:title'],
      ['name', 'twitter:description'],
      ['name', 'twitter:image:alt'],
    ] as const;
    tags.forEach(([attribute, value]) => {
      let meta = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${value}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, value);
        document.head.appendChild(meta);
      }
      meta.content = 'stale';
    });
    window.history.replaceState({}, '', '/istanbul/');
    await i18n.changeLanguage('en');
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'metric',
        windSpeedUnit: 'ms',
        themeMode: 'auto',
        language: 'en',
      })
    );
    service.getCurrentWeather.mockImplementation(() => new Promise(() => {}));

    renderApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/en/istanbul/');
      expect(document.documentElement.lang).toBe('en');
      expect(document.title).toBe('İstanbul weather — Hava81');
      expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
        'https://hava81.zekiakgul.dev/en/istanbul/'
      );
      expect(document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content).toBe(
        'https://hava81.zekiakgul.dev/en/istanbul/'
      );
      expect(
        document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content
      ).toContain('Current weather, hourly and daily forecast');
      expect(
        document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content
      ).not.toContain('için güncel hava');
    });
  });

  it('clears a different city payload before browser back/forward navigation', async () => {
    let resolveIzmir: ((value: typeof current) => void) | undefined;
    service.getCurrentWeather.mockImplementation(({ city }: { city: string }) => {
      if (city === 'İzmir') {
        return new Promise<typeof current>(resolve => {
          resolveIzmir = resolve;
        });
      }
      return Promise.resolve(current);
    });

    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul' });
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://hava81.zekiakgul.dev/istanbul/'
    );

    window.history.pushState({}, '', '/izmir/');
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/izmir/');
      expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
        'https://hava81.zekiakgul.dev/izmir/'
      );
      expect(document.title).toBe('İzmir hava durumu — Hava81');
    });
    expect(resolveIzmir).toBeDefined();

    await act(async () => {
      resolveIzmir!({
        ...current,
        cityName: 'İzmir',
        coordinates: { lat: 38.42, lon: 27.14 },
      });
    });
    await screen.findByRole('heading', { name: 'İzmir' });
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://hava81.zekiakgul.dev/izmir/'
    );
  });

  it('keeps social metadata aligned with the active city and language', async () => {
    const socialTags = [
      ['name', 'description'],
      ['property', 'og:url'],
      ['property', 'og:title'],
      ['property', 'og:description'],
      ['property', 'og:image:alt'],
      ['property', 'og:locale'],
      ['property', 'og:locale:alternate'],
      ['name', 'twitter:title'],
      ['name', 'twitter:description'],
      ['name', 'twitter:image:alt'],
    ] as const;
    socialTags.forEach(([attribute, value]) => {
      const meta = document.createElement('meta');
      meta.setAttribute(attribute, value);
      meta.content = 'stale';
      document.head.appendChild(meta);
    });

    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul' });

    const cityDescription =
      'İstanbul için güncel hava, saatlik ve günlük tahmin, Hava81 Skoru, hava açısından en iyi dışarı çıkma penceresi, yağmur-rüzgâr-hava kalitesi ve günlük karar önerileri.';
    await waitFor(() => {
      const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      expect(canonical?.href).toBe('https://hava81.zekiakgul.dev/istanbul/');
      expect(document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content).toBe(
        'https://hava81.zekiakgul.dev/istanbul/'
      );
      expect(document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content).toBe(
        'İstanbul hava durumu — Hava81'
      );
      expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe(
        cityDescription
      );
      expect(
        document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content
      ).toBe(cityDescription);
      expect(
        document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.content
      ).toBe(cityDescription);
      expect(document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.content).toBe(
        'İstanbul hava durumu — Hava81'
      );
      expect(document.querySelector<HTMLMetaElement>('meta[property="og:locale"]')?.content).toBe(
        'tr_TR'
      );
      expect(
        document.querySelector<HTMLMetaElement>('meta[property="og:locale:alternate"]')?.content
      ).toBe('en_US');
    });
  });

  it('opens settings and switches language without leaking provider credentials', async () => {
    const user = userEvent.setup();
    // This integration exercises the real future-only decision horizon. Keep its
    // OpenWeather samples relative to the test clock instead of aging out after
    // the date the fixture was originally written.
    service.getForecast.mockImplementation(async () => {
      const firstFuture = new Date(Math.ceil(Date.now() / (3 * HOUR_MS)) * (3 * HOUR_MS));
      return {
        ...forecast,
        daily: forecast.daily.map(day => ({ ...day, date: firstFuture })),
        hourly: forecast.hourly.map((hour, index) => ({
          ...hour,
          time: new Date(firstFuture.getTime() + index * 3 * HOUR_MS),
        })),
        meta: { ...forecast.meta, fetchedAt: new Date() },
      };
    });
    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul' });
    await waitFor(() => expect(document.title).toBe('İstanbul hava durumu — Hava81'));
    const settingsButton = screen.getByRole('button', { name: /ayarlar/i });
    expect(settingsButton).toHaveAttribute('aria-haspopup', 'dialog');
    expect(settingsButton).toHaveAttribute('aria-expanded', 'false');
    expect(settingsButton).not.toHaveAttribute('aria-controls');
    await user.click(settingsButton);
    const settingsDialog = await screen.findByRole('dialog', {}, { timeout: 5_000 });
    expect(settingsDialog).toHaveAttribute('id', 'settings-panel-dialog');
    expect(settingsButton).toHaveAttribute('aria-expanded', 'true');
    expect(settingsButton).toHaveAttribute('aria-controls', settingsDialog.id);
    expect(
      await screen.findByRole('heading', { name: 'Birimler' }, { timeout: 5_000 })
    ).toBeInTheDocument();
    const english = screen.getByRole('button', { name: /english/i });
    await user.click(english);
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en');
      expect(document.title).toBe('İstanbul weather — Hava81');
      expect(service.getCurrentWeather).toHaveBeenLastCalledWith(
        expect.objectContaining({ lang: 'en' }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
    expect(await screen.findByRole('heading', { name: 'Planning signals' })).toBeInTheDocument();
    // This integration covers the language switch and metadata; stable-vs-window
    // decision copy is tested deterministically in weatherDecisions.test.ts.
  }, 12_000);

  it('keeps browser theme metadata aligned with an explicit dark theme', async () => {
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'metric',
        windSpeedUnit: 'ms',
        themeMode: 'dark',
        language: 'tr',
        notificationsEnabled: false,
      })
    );
    const themeTags = Array.from({ length: 2 }, () => {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#F3F6F4';
      document.head.appendChild(meta);
      return meta;
    });

    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul' });

    expect(document.documentElement.dataset.colorMode).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(themeTags.map(meta => meta.content)).toEqual(['#0E2C32', '#0E2C32']);

    themeTags.forEach(meta => meta.remove());
  });
});
