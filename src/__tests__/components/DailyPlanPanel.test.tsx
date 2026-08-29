import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyPlanPanel } from '../../components/hava81/DailyPlanPanel';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';

vi.mock('../../analytics/productEvents', () => ({ trackProductEvent: vi.fn() }));
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
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('exposes the explanation as a named accessibility group', () => {
    render(<DailyPlanPanel weather={weather} hourly={hourly} />);

    expect(screen.getByRole('group', { name: 'hava81.dailyPlan.explain.label' })).toBeInTheDocument();
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

    render(<DailyPlanPanel weather={weather} hourly={richHourly} />);

    const timeline = screen.getByRole('list', { name: 'hava81.dailyPlan.timelineLabel' });
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(12);
    expect(within(timeline).queryByText('hava81.dailyPlan.bands.excellent')).not.toBeInTheDocument();
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

    render(<DailyPlanPanel weather={weather} hourly={rainyHourly} />);

    const timeline = screen.getByRole('list', { name: 'hava81.dailyPlan.timelineLabel' });
    expect(within(timeline).getByText(/23° · %15 · 0,2 mm/)).toBeInTheDocument();
    expect(within(timeline).getByText('hava81.dailyPlan.reasons.rainRisk')).toBeInTheDocument();
    expect(
      within(timeline).getByRole('listitem', {
        name: /%15.*0,2 mm.*hava81\.dailyPlan\.reasons\.rainRisk/,
      })
    ).toBeInTheDocument();
  });

  it('announces clipboard success without moving focus', async () => {
    const user = userEvent.setup();
    render(<DailyPlanPanel weather={weather} hourly={hourly} />);

    const button = screen.getByRole('button', { name: 'hava81.share.action' });
    await user.click(button);

    expect(button).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('hava81.share.copied');
  });
});
