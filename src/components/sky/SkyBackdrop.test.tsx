import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';
import { SkyBackdrop } from './SkyBackdrop';

vi.mock('./skyScene', () => ({
  resolveSkyScene: vi.fn((_weather: unknown, _hourly: unknown, now: number) => ({
    condition: 'clear',
    phase: now > Date.parse('2026-10-28T06:00:00.000Z') ? 'day' : 'night',
    cloudCover: 0,
    intensity: 0,
    windSpeed: 0,
    sunrise: Number.NaN,
    sunset: Number.NaN,
  })),
}));

vi.mock('./LivingSky', () => ({
  default: ({ scene }: { scene: { phase: string } }) => (
    <div data-testid="living-sky" data-phase={scene.phase} />
  ),
}));

const weather = { cityName: 'İzmir' } as NormalizedWeatherData;
const hourly: HourlyForecast[] = [];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SkyBackdrop clock isolation', () => {
  it('updates the scene every minute without rerendering the dashboard parent', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-28T06:00:00.000Z'));
    let parentRenders = 0;

    function Parent() {
      parentRenders += 1;
      const [unrelatedCount, setUnrelatedCount] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setUnrelatedCount(count => count + 1)}>
            Update unrelated state {unrelatedCount}
          </button>
          <SkyBackdrop weather={weather} hourly={hourly} />
        </>
      );
    }

    render(<Parent />);
    expect(await screen.findByTestId('living-sky')).toHaveAttribute('data-phase', 'night');
    expect(parentRenders).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /update unrelated state/i }));
    expect(parentRenders).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(screen.getByTestId('living-sky')).toHaveAttribute('data-phase', 'day');
    expect(parentRenders).toBe(2);
  });
});
