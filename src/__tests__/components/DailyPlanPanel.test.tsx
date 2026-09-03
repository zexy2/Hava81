import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyPlanPanel } from '../../components/hava81/DailyPlanPanel';
import type { ForecastMeta, HourlyForecast, NormalizedWeatherData } from '../../types';

vi.mock('../../analytics/productEvents', () => ({ trackProductEvent: vi.fn() }));
const settingsMock = vi.hoisted(() => ({ temperatureUnit: 'metric' as 'metric' | 'imperial' }));
vi.mock('../../context', () => ({
  useSettings: () => ({
    convertTemperature: (celsius: number) =>
      settingsMock.temperatureUnit === 'imperial' ? Math.round((celsius * 9) / 5 + 32) : celsius,
    getTemperatureSymbol: () => (settingsMock.temperatureUnit === 'imperial' ? '°F' : '°C'),
  }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'tr' } }),
}));

const weather: NormalizedWeatherData = {
  cityName: 'İzmir',
  country: 'TR',
  temperature: 24,
  feelsLike: 24,
  tempMin: 20,
  tempMax: 27,
  humidity: 45,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 3,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: new Date('2026-08-28T03:30:00.000Z'),
  sunset: new Date('2026-08-28T16:45:00.000Z'),
  timestamp: new Date('2026-08-28T06:00:00.000Z'),
  coordinates: { lat: 38.42, lon: 27.14 },
  clouds: 0,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date('2026-08-28T06:00:00.000Z'),
    timezoneOffsetSeconds: 10800,
  },
};

const freshForecastMeta = (freshForSeconds = 1_800): ForecastMeta => ({
  provider: 'OpenMeteo',
  fetchedAt: new Date(),
  timezoneOffsetSeconds: 10800,
  intervalHours: 1,
  freshForSeconds,
});

const hourly: HourlyForecast[] = [6, 9, 12].map(hour => ({
  time: new Date(`2026-08-28T${String(hour).padStart(2, '0')}:00:00.000Z`),
  temp: 24,
  pop: 0.1,
  windSpeed: 3,
  icon: '01d',
  description: 'açık',
}));

describe('DailyPlanPanel sharing', () => {
  beforeEach(() => {
    settingsMock.temperatureUnit = 'metric';
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('exposes the explanation as a named accessibility group', () => {
    render(<DailyPlanPanel weather={weather} hourly={hourly} forecastMeta={freshForecastMeta()} />);

    expect(
      screen.getByRole('group', { name: 'hava81.dailyPlan.explain.label' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /hava81\.dailyPlan\.bands\.(excellent|good|caution|difficult) · (97–100|75–96|55–74|0–54)/
      )
    ).toBeInTheDocument();
  });

  it('keeps the safety boundary visible while detailed score methodology is collapsed by default', () => {
    render(<DailyPlanPanel weather={weather} hourly={hourly} forecastMeta={freshForecastMeta()} />);

    expect(screen.getByText('hava81.dailyPlan.safetyNote')).toBeVisible();
    const summary = screen.getByText('hava81.dailyPlan.methodDetails');
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText('hava81.dailyPlan.note')).not.toBeVisible();

    fireEvent.click(summary);
    expect(details).toHaveAttribute('open');
    expect(screen.getByText('hava81.dailyPlan.note')).toBeVisible();
  });

  it('shows the same 12-hour horizon that the score evaluates without repeating band copy in every slot', () => {
    const richHourly: HourlyForecast[] = Array.from({ length: 12 }, (_, index) => ({
      time: new Date(Date.parse('2026-08-28T18:00:00.000Z') + index * 60 * 60 * 1000),
      temp: 24,
      pop: index === 4 ? 0.35 : 0.1,
      precipitationMm: 0,
      windSpeed: 3,
      windGust: 5,
      apparentTemperature: 24,
      humidity: 45,
      uvIndex: 0,
      visibility: 20000,
      weatherCode: 0,
      icon: '01n',
      description: 'açık',
    }));

    render(<DailyPlanPanel weather={weather} hourly={richHourly} forecastMeta={freshForecastMeta()} />);

    const timeline = screen.getByRole('list', { name: 'hava81.dailyPlan.timelineLabel' });
    expect(timeline).toHaveAttribute('tabindex', '0');
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(12);
    expect(
      within(timeline).queryByText('hava81.dailyPlan.bands.excellent')
    ).not.toBeInTheDocument();
    expect(within(timeline).getByText('hava81.dailyPlan.reasons.rainRisk')).toBeInTheDocument();
    expect(within(timeline).getAllByText('hava81.dailyPlan.tomorrow')).toHaveLength(1);
  });

  it('shows precipitation probability and measurable amount together when both explain the risk', () => {
    const rainyHourly: HourlyForecast[] = [
      {
        time: new Date('2026-08-28T18:00:00.000Z'),
        temp: 23,
        pop: 0.15,
        precipitationMm: 0.2,
        windSpeed: 3,
        windGust: 5,
        apparentTemperature: 23,
        humidity: 60,
        uvIndex: 0,
        visibility: 20000,
        weatherCode: 61,
        icon: '10n',
        description: 'hafif yağmur',
      },
    ];

    render(<DailyPlanPanel weather={weather} hourly={rainyHourly} forecastMeta={freshForecastMeta()} />);

    const timeline = screen.getByRole('list', { name: 'hava81.dailyPlan.timelineLabel' });
    expect(within(timeline).getByText(/23°C · %15 · 0,2 mm/)).toBeInTheDocument();
    expect(within(timeline).getByText('hava81.dailyPlan.reasons.rainRisk')).toBeInTheDocument();
    expect(
      within(timeline).getByRole('listitem', {
        name: /%15.*0,2 mm.*hava81\.dailyPlan\.reasons\.rainRisk/,
      })
    ).toBeInTheDocument();
  });

  it('honors the selected temperature unit in the timeline and accessible label', () => {
    settingsMock.temperatureUnit = 'imperial';

    render(<DailyPlanPanel weather={weather} hourly={hourly} forecastMeta={freshForecastMeta()} />);

    const timeline = screen.getByRole('list', { name: 'hava81.dailyPlan.timelineLabel' });
    expect(
      within(timeline).getAllByText(
        (_, element) =>
          element?.tagName === 'SMALL' && element.textContent?.startsWith('75°F') === true
      )
    ).toHaveLength(3);
    expect(within(timeline).getAllByRole('listitem')[0]).toHaveAccessibleName(/75°F/);
  });

  it('keeps sharing single-flight while the native share sheet is pending', async () => {
    const user = userEvent.setup();
    let resolveShare!: () => void;
    const sharePromise = new Promise<void>(resolve => {
      resolveShare = resolve;
    });
    const share = vi.fn(() => sharePromise);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });

    render(<DailyPlanPanel weather={weather} hourly={hourly} forecastMeta={freshForecastMeta()} />);

    const button = screen.getByRole('button', { name: 'hava81.share.action' });
    await user.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveTextContent('common.loading');

    await user.click(button);
    expect(share).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveShare();
      await sharePromise;
    });
    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'false'));
    expect(button).toBeEnabled();
  });

  it('falls back to the clipboard when native sharing is present but unavailable', async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockRejectedValue(new Error('share target unavailable'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<DailyPlanPanel weather={weather} hourly={hourly} forecastMeta={freshForecastMeta()} />);
    await user.click(screen.getByRole('button', { name: 'hava81.share.action' }));

    expect(share).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('hava81.share.copied');
  });

  it('surfaces an unavailable state when no share transport exists', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });

    render(<DailyPlanPanel weather={weather} hourly={hourly} forecastMeta={freshForecastMeta()} />);
    const button = screen.getByRole('button', { name: 'hava81.share.action' });
    await user.click(button);

    expect(button).toHaveFocus();
    expect(button).toHaveTextContent('hava81.share.unavailable');
    expect(screen.getByRole('status')).toHaveTextContent('hava81.share.unavailable');
  });

  it('surfaces an unavailable state when clipboard fallback is rejected', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('clipboard denied')) },
    });

    render(<DailyPlanPanel weather={weather} hourly={hourly} forecastMeta={freshForecastMeta()} />);
    await user.click(screen.getByRole('button', { name: 'hava81.share.action' }));

    expect(screen.getByRole('button')).toHaveTextContent('hava81.share.unavailable');
    expect(screen.getByRole('status')).toHaveTextContent('hava81.share.unavailable');
  });

  it('does not copy after the user cancels native sharing', async () => {
    const user = userEvent.setup();
    const abort = new Error('cancelled');
    abort.name = 'AbortError';
    const share = vi.fn().mockRejectedValue(abort);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<DailyPlanPanel weather={weather} hourly={hourly} forecastMeta={freshForecastMeta()} />);
    await user.click(screen.getByRole('button', { name: 'hava81.share.action' }));

    expect(share).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('hides the daily decision surface when forecast evidence expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T06:00:00.000Z'));
    try {
      render(
        <DailyPlanPanel
          weather={weather}
          hourly={hourly}
          forecastMeta={freshForecastMeta(30)}
        />
      );

      expect(screen.getByRole('button', { name: 'hava81.share.action' })).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_101);
      });

      expect(screen.getByRole('status')).toHaveTextContent('hava81.dailyPlan.forecastStale');
      expect(screen.queryByRole('button', { name: 'hava81.share.action' })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces clipboard success without moving focus', async () => {
    const user = userEvent.setup();
    render(<DailyPlanPanel weather={weather} hourly={hourly} forecastMeta={freshForecastMeta()} />);

    const button = screen.getByRole('button', { name: 'hava81.share.action' });
    await user.click(button);

    expect(button).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('hava81.share.copied');
  });

  it('keeps repeated share feedback visible for the full interval after the latest share', async () => {
    vi.useFakeTimers();
    try {
      render(<DailyPlanPanel weather={weather} hourly={hourly} forecastMeta={freshForecastMeta()} />);

      const button = screen.getByRole('button', { name: 'hava81.share.action' });
      await act(async () => {
        fireEvent.click(button);
        await Promise.resolve();
      });
      expect(button).toHaveTextContent('hava81.share.copied');

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await act(async () => {
        fireEvent.click(button);
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(700);
      });
      expect(button).toHaveTextContent('hava81.share.copied');

      await act(async () => {
        vi.advanceTimersByTime(900);
      });
      expect(button).toHaveTextContent('hava81.share.action');
    } finally {
      vi.useRealTimers();
    }
  });
});
