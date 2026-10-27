import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ForecastAtlas } from '../../components/hava81/ForecastAtlas';
import { SettingsProvider } from '../../context';
import type { HourlyForecast } from '../../types';

// 24 hourly Open-Meteo-style samples from 15:00 UTC: day until 17:00, night
// 18:00-04:00, day again from 05:00; a rain signal at index 13 (04:00).
const rhythmHours = (): HourlyForecast[] =>
  Array.from({ length: 24 }, (_, index) => {
    const hour = (15 + index) % 24;
    const night = hour >= 18 || hour < 5;
    return {
      time: new Date(Date.UTC(2026, 9, 21, 15 + index)),
      temp: index === 12 ? 9 : index === 3 ? 21 : 15,
      icon: night ? '02n' : '02d',
      description: 'az bulutlu',
      pop: index === 13 ? 0.6 : index === 14 ? 0.1 : 0,
      precipitationMm: index === 13 ? 0.8 : 0,
      windSpeed: 2,
    };
  });

const renderRhythm = (hourly = rhythmHours()) =>
  render(
    <SettingsProvider>
      <ForecastAtlas
        daily={[]}
        hourly={hourly}
        meta={{
          provider: 'Open-Meteo',
          fetchedAt: new Date(),
          freshForSeconds: 2 * 60 * 60,
          timezoneOffsetSeconds: 0,
          intervalHours: 1,
        }}
      />
    </SettingsProvider>
  );

describe('ForecastAtlas hourly rhythm', () => {
  it('shades provider night hours on the plot and in the matching hour values', () => {
    const { container } = renderRhythm();

    const bands = container.querySelectorAll('.hava81-forecast-atlas__night-band');
    expect(bands).toHaveLength(1);
    // Night spans indexes 3..13 of 24 columns, offset by the axis gutter.
    expect((bands[0] as HTMLElement).style.left).toContain(String(3 / 24));
    expect((bands[0] as HTMLElement).style.width).toContain(String(11 / 24));
    expect(bands[0]).toHaveTextContent('Gece');

    const region = screen.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i });
    const hours = within(region).getAllByRole('listitem');
    expect(hours.filter(hour => hour.classList.contains('is-night'))).toHaveLength(11);
    expect(hours[2]).not.toHaveClass('is-night');
    expect(hours[3]).toHaveClass('is-night');
  });

  it('reads rain chance as a five-cell gauge that lights at least one cell for any chance', () => {
    const { container } = renderRhythm();

    const gauges = container.querySelectorAll('.hava81-forecast-atlas__rain-gauge');
    expect(gauges).toHaveLength(24);
    // 60% lights three of five cells; 10% still lights one; dry hours stay empty.
    expect(gauges[13]).toHaveAttribute('data-level', '3');
    expect(gauges[14]).toHaveAttribute('data-level', '1');
    expect(gauges[0]).toHaveClass('is-dry');
    expect(gauges[13].querySelectorAll('.is-lit')).toHaveLength(3);
    expect(gauges[14].querySelectorAll('.is-lit')).toHaveLength(1);
    expect(container.querySelectorAll('.hava81-forecast-atlas__rain-gauge.is-signal')).toHaveLength(
      1
    );
    const flag = container.querySelector('.hava81-forecast-atlas__precipitation-flag');
    expect(flag).toHaveTextContent('60%');
    expect(container.querySelector('.hava81-forecast-atlas__axis-caption')).toHaveTextContent(
      'Yağış'
    );
  });

  it('omits the rain band entirely for a dry horizon', () => {
    const dry = rhythmHours().map(hour => ({ ...hour, pop: 0, precipitationMm: 0 }));
    const { container } = renderRhythm(dry);

    expect(container.querySelectorAll('.hava81-forecast-atlas__rain-gauge')).toHaveLength(0);
    expect(container.querySelector('.hava81-forecast-atlas__axis-caption')).toBeNull();
    expect(container.querySelector('.hava81-forecast-atlas__precipitation-flag')).toBeNull();
  });

  it('anchors low, high and rain-peak stats to the hour they occur', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-21T15:10:00Z'));
      renderRhythm();
      const summary = screen.getByRole('list', { name: /saatlik tahmin özeti/i });
      const [low, high, rain] = within(summary).getAllByRole('listitem');
      expect(low).toHaveTextContent('24 saatte en düşük9°CYarın 03:00');
      expect(high).toHaveTextContent('24 saatte en yüksek21°C18:00');
      expect(rain).toHaveTextContent('Yarın · 04:00');
      expect(low.querySelector('time')).toHaveAttribute('datetime', '2026-10-22T03:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ranks the rain summary by combined probability and amount, not probability alone', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-21T15:10:00Z'));
      const hourly = rhythmHours().map((hour, index) => ({
        ...hour,
        pop: index === 2 ? 0.8 : index === 9 ? 0.2 : 0,
        precipitationMm: index === 9 ? 6 : 0,
      }));
      renderRhythm(hourly);

      const summary = screen.getByRole('list', { name: /saatlik tahmin özeti/i });
      const rain = within(summary).getAllByRole('listitem')[2];
      expect(rain).toHaveTextContent('%20 · 6,0 mm');
      expect(rain.querySelector('time')).toHaveAttribute('datetime', '2026-10-22T00:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('links an hour column on the plot with its value cell while pointing', () => {
    const { container } = renderRhythm();
    const hours = container.querySelector<HTMLOListElement>('.hava81-forecast-atlas__hours');
    const track = container.querySelector<HTMLElement>('.hava81-forecast-atlas__hourly-track');
    expect(hours).not.toBeNull();
    expect(track).not.toBeNull();
    vi.spyOn(hours as HTMLOListElement, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 2400,
      width: 2400,
      top: 0,
      bottom: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerMove(track as HTMLElement, { clientX: 550 });
    const items = within(hours as HTMLOListElement).getAllByRole('listitem');
    expect(items[5]).toHaveClass('is-active');
    expect(container.querySelector('.hava81-forecast-atlas__point.is-active')).not.toBeNull();
    expect(container.querySelector('.hava81-forecast-atlas__column.is-active')).not.toBeNull();
    const tooltip = container.querySelector('.hava81-forecast-atlas__tooltip');
    expect(tooltip).toHaveTextContent('20:00');
    expect(tooltip).toHaveTextContent('15°C');
    expect(tooltip).toHaveTextContent('az bulutlu');

    fireEvent.pointerLeave(track as HTMLElement);
    expect(items[5]).not.toHaveClass('is-active');
    expect(container.querySelector('.hava81-forecast-atlas__tooltip')).toBeNull();
  });

  it('does not remeasure the SVG curve for pointer-only highlight renders', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      SVGElement.prototype,
      'getTotalLength'
    );
    const getTotalLength = vi.fn(() => 100);
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
      configurable: true,
      value: getTotalLength,
    });

    try {
      const { container } = renderRhythm();
      expect(getTotalLength).toHaveBeenCalledTimes(1);

      const hours = container.querySelector<HTMLOListElement>('.hava81-forecast-atlas__hours');
      const track = container.querySelector<HTMLElement>('.hava81-forecast-atlas__hourly-track');
      expect(hours).not.toBeNull();
      expect(track).not.toBeNull();
      vi.spyOn(hours as HTMLOListElement, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        right: 2400,
        width: 2400,
        top: 0,
        bottom: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      fireEvent.pointerMove(track as HTMLElement, { clientX: 550 });
      expect(container.querySelector('.hava81-forecast-atlas__hour.is-active')).toBeInTheDocument();
      expect(getTotalLength).toHaveBeenCalledTimes(1);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(SVGElement.prototype, 'getTotalLength', originalDescriptor);
      } else {
        Reflect.deleteProperty(SVGElement.prototype, 'getTotalLength');
      }
    }
  });

  it('colours the curve by temperature, warm at the top and cold at the bottom', () => {
    const { container } = renderRhythm();
    const stops = Array.from(
      container.querySelectorAll<SVGStopElement>('linearGradient[id$="-curve-light"] stop')
    ).map(stop => stop.getAttribute('stop-color'));
    expect(stops.length).toBeGreaterThanOrEqual(5);
    // 21°C (top) sits in the saffron range, 9°C (bottom) in the blue range.
    const channels = (value: string | null) => value?.match(/\d+/g)?.map(Number) ?? [];
    const [topRed, , topBlue] = channels(stops[0]);
    const [bottomRed, , bottomBlue] = channels(stops[stops.length - 1]);
    expect(topRed).toBeGreaterThan(topBlue);
    expect(bottomBlue).toBeGreaterThan(bottomRed);
    expect(container.querySelector('linearGradient[id$="-curve-dark"]')).not.toBeNull();
  });

  it('pulses only the current-hour point and softens night edges with twilight', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-21T15:10:00Z'));
      const { container } = renderRhythm();
      expect(container.querySelectorAll('.hava81-forecast-atlas__pulse')).toHaveLength(1);
      expect(
        container.querySelector(
          '.hava81-forecast-atlas__point.is-current .hava81-forecast-atlas__pulse'
        )
      ).not.toBeNull();
      expect(container.querySelector('.hava81-forecast-atlas__twilight.is-dusk')).not.toBeNull();
      expect(container.querySelector('.hava81-forecast-atlas__twilight.is-dawn')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps chart annotations out of the accessibility tree', () => {
    const { container } = renderRhythm();
    for (const selector of [
      '.hava81-forecast-atlas__bands',
      '.hava81-forecast-atlas__marks',
      '.hava81-forecast-atlas__rain',
      '.hava81-forecast-atlas__trace',
    ]) {
      expect(container.querySelector(selector)).toHaveAttribute('aria-hidden', 'true');
    }
    expect(screen.getByRole('img', { name: /saatlik tahmin/i })).toBeInTheDocument();
  });
});
