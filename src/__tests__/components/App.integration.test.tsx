import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { SettingsProvider } from '../../context';
import i18n from '../../i18n';

const service = vi.hoisted(() => ({
  getCurrentWeather: vi.fn(),
  getCurrentLocationWeather: vi.fn(),
  getForecast: vi.fn(),
  getHourlyForecast: vi.fn(),
  getAirQuality: vi.fn(),
  getContextSignals: vi.fn(),
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

const hourlyForecast = {
  hourly: [
    {
      time: new Date('2026-08-28T18:00:00.000Z'),
      temp: 23,
      icon: '01d' as const,
      description: 'açık',
      pop: 0.1,
      windSpeed: 3.2,
    },
    {
      time: new Date('2026-08-28T19:00:00.000Z'),
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

const air = { aqi: 3, aqiLabel: 'Orta', pm25: 8, pm10: 14, o3: 40 };

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
    service.getHourlyForecast.mockReset().mockResolvedValue(hourlyForecast);
    service.getAirQuality.mockReset().mockResolvedValue(air);
    service.getContextSignals.mockReset().mockResolvedValue(null);
  });

  it('renders the decision-first city view and forecast metadata', async () => {
    renderApp();
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
    expect(screen.getByRole('img', { name: 'açık' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'çoğunlukla açık' })).toBeInTheDocument();
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
    expect(
      await screen.findByRole('heading', { name: /gün planı/i }, { timeout: 3_000 })
    ).toBeInTheDocument();
    expect(screen.getByText(/şimdi mi, sonra mı/i)).toBeInTheDocument();
    expect(screen.getByText('OpenWeather')).toBeInTheDocument();
    expect(screen.getByText('3/5 · Orta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hava81' })).toBeInTheDocument();
    const timeline = screen.getByRole('list', { name: /uygunluk zaman çizelgesi/i });
    expect(
      [...timeline.querySelectorAll('[role="listitem"]')].every(item => item.tagName === 'DIV')
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'HaritaHaritayı gösterİstanbul' })
    ).toBeInTheDocument();
    expect(service.getForecast).toHaveBeenCalledWith(41.01, 28.97, 'tr');
  }, 12_000);

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

  it('opens saved cities without silently favoriting the current city', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul' });

    expect(localStorage.getItem('favorites')).toBeNull();
    await user.click(screen.getByRole('button', { name: /kayıtlı/i }));

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
    await user.click(screen.getByRole('button', { name: /kayıtlı/i }));
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
    const compare = screen.getByRole('button', { name: /karşılaştır/i });
    expect(compare).toBeInTheDocument();
    await user.click(compare);
    expect(
      await screen.findByRole('heading', { name: /şehir karşılaştırması/i })
    ).toBeInTheDocument();
  });

  it('keeps social metadata aligned with the active city and language', async () => {
    const socialTags = [
      ['property', 'og:url'],
      ['property', 'og:title'],
      ['property', 'og:image:alt'],
      ['property', 'og:locale'],
      ['name', 'twitter:title'],
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

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    expect(canonical?.href).toBe('http://localhost:3000/istanbul/');
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content).toBe(
      'http://localhost:3000/istanbul/'
    );
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content).toBe(
      'İstanbul hava durumu — Hava81'
    );
    expect(document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.content).toBe(
      'İstanbul hava durumu — Hava81'
    );
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:locale"]')?.content).toBe(
      'tr_TR'
    );
  });

  it('opens settings and switches language without leaking provider credentials', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul' });
    expect(document.title).toBe('İstanbul hava durumu — Hava81');
    await user.click(screen.getByRole('button', { name: /ayarlar/i }));
    expect(
      await screen.findByRole('heading', { name: 'Birimler' }, { timeout: 5_000 })
    ).toBeInTheDocument();
    const english = screen.getByRole('button', { name: /english/i });
    await user.click(english);
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en');
      expect(document.title).toBe('İstanbul weather — Hava81');
      expect(service.getCurrentWeather).toHaveBeenLastCalledWith(
        expect.objectContaining({ lang: 'en' })
      );
    });
    expect(await screen.findByRole('heading', { name: 'Planning signals' })).toBeInTheDocument();
    expect(screen.getByText(/looks like a calmer window for being outdoors/i)).toBeInTheDocument();
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
