import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
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
    // Night spans indexes 3..13 of 24 columns.
    expect((bands[0] as HTMLElement).style.left).toBe(`${(3 / 24) * 100}%`);
    expect((bands[0] as HTMLElement).style.width).toBe(`${(11 / 24) * 100}%`);
    expect(bands[0]).toHaveTextContent('Gece');

    const region = screen.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i });
    const hours = within(region).getAllByRole('listitem');
    expect(hours.filter(hour => hour.classList.contains('is-night'))).toHaveLength(11);
    expect(hours[2]).not.toHaveClass('is-night');
    expect(hours[3]).toHaveClass('is-night');
  });

  it('draws one rain-chance bar per wet hour and keeps saffron for the first signal only', () => {
    const { container } = renderRhythm();

    const bars = container.querySelectorAll('.hava81-forecast-atlas__rain-bar');
    expect(bars).toHaveLength(2);
    expect(container.querySelectorAll('.hava81-forecast-atlas__rain-bar.is-signal')).toHaveLength(
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

    expect(container.querySelectorAll('.hava81-forecast-atlas__rain-bar')).toHaveLength(0);
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
      expect(low).toHaveTextContent('En düşük9°CYarın 03:00');
      expect(high).toHaveTextContent('En yüksek21°C18:00');
      expect(rain).toHaveTextContent('Yarın 04:00');
      expect(low.querySelector('time')).toHaveAttribute('datetime', '2026-10-22T03:00:00.000Z');
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
    expect(container.querySelector('.hava81-forecast-atlas__readout')).toHaveTextContent('15°');

    fireEvent.pointerLeave(track as HTMLElement);
    expect(items[5]).not.toHaveClass('is-active');
    expect(container.querySelector('.hava81-forecast-atlas__readout')).toBeNull();
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
