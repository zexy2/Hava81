import { act, render } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForecastMeta } from '../../../types';
import { useForecastClock } from './useForecastClock';

const now = Date.parse('2026-10-08T12:30:00.000Z');
const meta: ForecastMeta = {
  provider: 'Open-Meteo',
  fetchedAt: new Date(now),
  timezoneOffsetSeconds: 10_800,
  intervalHours: 1,
  freshForSeconds: 7_200,
};

function ClockProbe() {
  const clock = useForecastClock(meta);
  return <output>{clock.currentTimeMs}</output>;
}

describe('useForecastClock initial scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the render-time clock without an immediate duplicate commit', () => {
    const onRender = vi.fn();
    render(
      <Profiler id="forecast-clock" onRender={onRender}>
        <ClockProbe />
      </Profiler>
    );

    expect(onRender).toHaveBeenCalledTimes(1);
  });

  it('still refreshes at the next location-local hour', () => {
    const onRender = vi.fn();
    const { getByText } = render(
      <Profiler id="forecast-clock" onRender={onRender}>
        <ClockProbe />
      </Profiler>
    );

    expect(getByText(String(now))).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(30 * 60_000 + 100);
    });

    expect(getByText(String(now + 30 * 60_000 + 100))).toBeInTheDocument();
    expect(onRender).toHaveBeenCalledTimes(2);
  });
});
