import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import '../../i18n';
import { ForecastAtlas } from '../../components/hava81/ForecastAtlas';
import { SettingsProvider } from '../../context';

const renderAtlas = () =>
  render(
    <SettingsProvider>
      <ForecastAtlas
        daily={[]}
        hourly={[
          {
            time: new Date('2026-08-29T00:00:00Z'),
            temp: 24,
            icon: '01n',
            description: 'açık',
            pop: 0,
            windSpeed: 2,
          },
          {
            time: new Date('2026-08-29T01:00:00Z'),
            temp: 23,
            icon: '01n',
            description: 'açık',
            pop: 0.15,
            windSpeed: 2,
          },
        ]}
        meta={{
          provider: 'Open-Meteo',
          fetchedAt: new Date(),
          timezoneOffsetSeconds: 0,
          intervalHours: 1,
        }}
      />
    </SettingsProvider>
  );

const renderRangeAtlas = (count = 24) =>
  render(
    <SettingsProvider>
      <ForecastAtlas
        daily={[]}
        hourly={Array.from({ length: count }, (_, index) => ({
          time: new Date(Date.UTC(2026, 7, 29, index)),
          temp: 20 + index / 10,
          icon: '01d',
          description: 'açık',
          pop: 0,
          windSpeed: 2,
        }))}
        meta={{
          provider: 'Open-Meteo',
          fetchedAt: new Date(),
          timezoneOffsetSeconds: 0,
          intervalHours: 1,
        }}
      />
    </SettingsProvider>
  );

describe('ForecastAtlas hourly precipitation labels', () => {
  it('omits repetitive zero-rain labels from each dry hourly slot', () => {
    renderAtlas();
    const region = screen.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i });
    expect(within(region).queryByText('0%')).not.toBeInTheDocument();
    expect(within(region).getByText('15%')).toBeInTheDocument();
    expect(within(region).queryByText(/00:00 saatinde yağış beklenmiyor/i)).not.toBeInTheDocument();
  });

  it('keeps hourly rain amount visible even when probability rounds to zero', () => {
    render(
      <SettingsProvider>
        <ForecastAtlas
          daily={[]}
          hourly={[
            {
              time: new Date('2026-08-29T00:00:00Z'),
              temp: 22,
              icon: '10n',
              description: 'hafif yağmur',
              pop: 0,
              precipitationMm: 0.4,
              windSpeed: 2,
            },
            {
              time: new Date('2026-08-29T01:00:00Z'),
              temp: 22,
              icon: '10n',
              description: 'hafif yağmur',
              pop: 0.35,
              precipitationMm: 0.8,
              windSpeed: 2,
            },
          ]}
          meta={{
            provider: 'Open-Meteo',
            fetchedAt: new Date(),
            timezoneOffsetSeconds: 0,
            intervalHours: 1,
          }}
        />
      </SettingsProvider>
    );

    const region = screen.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i });
    const hours = within(region).getAllByRole('listitem');
    expect(hours[0]).toHaveTextContent('0,4 mm');
    expect(hours[0]).not.toHaveTextContent('0%');
    expect(within(hours[0]).queryByText(/yağış beklenmiyor/i)).not.toBeInTheDocument();
    expect(hours[1]).toHaveTextContent('35% · 0,8 mm');
    expect(
      within(hours[1]).getByRole('group', {
        name: /yağış olasılığı %35; saatlik miktar 0,8 mm/i,
      })
    ).toBeInTheDocument();
  });

  it('shows trace hourly accumulation without pretending it is zero rain', () => {
    render(
      <SettingsProvider>
        <ForecastAtlas
          daily={[]}
          hourly={[
            {
              time: new Date('2026-08-29T00:00:00Z'),
              temp: 22,
              icon: '09n',
              description: 'çiseleme',
              pop: 0.01,
              precipitationMm: 0.04,
              windSpeed: 2,
            },
          ]}
          meta={{
            provider: 'Open-Meteo',
            fetchedAt: new Date(),
            timezoneOffsetSeconds: 0,
            intervalHours: 1,
          }}
        />
      </SettingsProvider>
    );

    const region = screen.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i });
    expect(within(region).getByText('<0,1 mm')).toBeInTheDocument();
    expect(within(region).getByText('1%')).toBeInTheDocument();
  });

  it('keeps the available horizon while exposing useful compact sampling intervals', () => {
    renderRangeAtlas(8);

    expect(
      screen.getByRole('heading', { name: /saatlik tahmin · sonraki 8 saat/i })
    ).toBeInTheDocument();
    const interval = screen.getByRole('group', { name: /tahmin aralığı/i });
    expect(within(interval).getByRole('button', { name: '1s 1 saatlik' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      within(interval)
        .getAllByRole('button')
        .map(button => button.textContent)
    ).toEqual(['1s', '2s', '3s', '4s', '6s']);
    expect(within(interval).getByRole('button', { name: '2s 2 saatlik' })).toBeInTheDocument();
    expect(within(interval).getByRole('button', { name: '6s 6 saatlik' })).toBeInTheDocument();
    expect(
      within(interval).queryByRole('button', { name: '8s 8 saatlik' })
    ).not.toBeInTheDocument();
    expect(
      within(interval).queryByRole('button', { name: '12s 12 saatlik' })
    ).not.toBeInTheDocument();
  });

  it('presents the hourly trend as a summarized visual forecast surface', () => {
    const { container } = renderRangeAtlas(8);

    const summary = screen.getByRole('list', { name: /saatlik tahmin özeti/i });
    expect(within(summary).getAllByRole('listitem')).toHaveLength(3);
    expect(summary).toHaveTextContent('En düşük');
    expect(summary).toHaveTextContent('En yüksek');
    expect(summary).toHaveTextContent('Yağış piki');
    expect(summary).toHaveTextContent('Yok');
    expect(within(summary).getByText('Yağış piki').closest('[role="listitem"]')).not.toHaveClass(
      'has-signal'
    );

    const area = container.querySelector('.hava81-forecast-atlas__area');
    const curve = container.querySelector('.hava81-forecast-atlas__curve');
    expect(area).toBeInTheDocument();
    const guides = container.querySelectorAll('.hava81-forecast-atlas__guide');
    const axisLabels = container.querySelectorAll('.hava81-forecast-atlas__axis-label');
    expect(guides.length).toBeGreaterThanOrEqual(2);
    expect(axisLabels).toHaveLength(guides.length);
    expect(Array.from(axisLabels).every(label => label.textContent?.endsWith('°'))).toBe(true);
    expect(curve?.getAttribute('d')).toContain(' C ');

    const region = screen.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i });
    const source = screen.getByText(/Hava81 tarafından biçimlendirildi/i).closest('p');
    expect(source).not.toBeNull();
    expect(
      region.compareDocumentPosition(source as Node) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('collapses duplicate hourly low/high values when the displayed range is flat', () => {
    render(
      <SettingsProvider>
        <ForecastAtlas
          daily={[]}
          hourly={[
            {
              time: new Date('2026-08-29T00:00:00Z'),
              temp: 24.1,
              icon: '01n',
              description: 'açık',
              pop: 0,
              windSpeed: 2,
            },
            {
              time: new Date('2026-08-29T01:00:00Z'),
              temp: 24.4,
              icon: '01n',
              description: 'açık',
              pop: 0,
              windSpeed: 2,
            },
          ]}
          meta={{
            provider: 'Open-Meteo',
            fetchedAt: new Date(),
            timezoneOffsetSeconds: 0,
            intervalHours: 1,
          }}
        />
      </SettingsProvider>
    );

    const summary = screen.getByRole('list', { name: /saatlik tahmin özeti/i });
    expect(within(summary).getAllByRole('listitem')).toHaveLength(2);
    expect(summary).toHaveTextContent('Sıcaklık24°C');
    expect(summary).not.toHaveTextContent('En düşük');
    expect(summary).not.toHaveTextContent('En yüksek');
    expect(summary).toHaveTextContent('Yağış piki');
    expect(document.querySelectorAll('.hava81-forecast-atlas__guide')).toHaveLength(1);
    expect(document.querySelectorAll('.hava81-forecast-atlas__axis-label')).toHaveLength(1);
  });

  it('changes sampling cadence without changing the 24-hour forecast horizon', async () => {
    const user = userEvent.setup();
    renderRangeAtlas();

    const interval = screen.getByRole('group', { name: /tahmin aralığı/i });
    const region = screen.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i });
    expect(within(interval).getByRole('button', { name: '1s 1 saatlik' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(within(interval).getAllByRole('button')).toHaveLength(7);
    expect(within(region).getAllByRole('listitem')).toHaveLength(24);

    await user.click(within(interval).getByRole('button', { name: '2s 2 saatlik' }));
    expect(within(region).getAllByRole('listitem')).toHaveLength(12);

    await user.click(within(interval).getByRole('button', { name: '3s 3 saatlik' }));
    expect(within(interval).getByRole('button', { name: '3s 3 saatlik' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      screen.getByRole('heading', { name: /saatlik tahmin · sonraki 24 saat/i })
    ).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem')).toHaveLength(8);
    expect(
      within(region)
        .getAllByRole('listitem')
        .map(item => item.textContent?.match(/\d{2}:\d{2}/)?.[0])
    ).toEqual(['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00']);

    await user.click(within(interval).getByRole('button', { name: '6s 6 saatlik' }));
    expect(within(interval).getByRole('button', { name: '6s 6 saatlik' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(within(region).getAllByRole('listitem')).toHaveLength(4);
    expect(
      within(region)
        .getAllByRole('listitem')
        .map(item => item.textContent?.match(/\d{2}:\d{2}/)?.[0])
    ).toEqual(['00:00', '06:00', '12:00', '18:00']);

    await user.click(within(interval).getByRole('button', { name: '12s 12 saatlik' }));
    expect(within(region).getAllByRole('listitem')).toHaveLength(2);
  });
  it('keeps the 24-hour summary and chart scale stable when display sampling changes', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SettingsProvider>
        <ForecastAtlas
          daily={[]}
          hourly={Array.from({ length: 24 }, (_, index) => ({
            time: new Date(Date.UTC(2026, 7, 29, index)),
            temp: index === 1 ? 31 : index === 2 ? 12 : 20,
            icon: '01d',
            description: 'açık',
            pop: index === 5 ? 0.8 : 0,
            precipitationMm: index === 5 ? 1.2 : 0,
            windSpeed: 2,
          }))}
          meta={{
            provider: 'Open-Meteo',
            fetchedAt: new Date(),
            timezoneOffsetSeconds: 0,
            intervalHours: 1,
          }}
        />
      </SettingsProvider>
    );

    const summary = screen.getByRole('list', { name: /saatlik tahmin özeti/i });
    const interval = screen.getByRole('group', { name: /tahmin aralığı/i });
    const assertFullHorizonSummary = () => {
      expect(summary).toHaveTextContent('12°C');
      expect(summary).toHaveTextContent('31°C');
      expect(summary).toHaveTextContent('%80 · 1,2 mm');
      expect(within(summary).getByText('Yağış piki').closest('[role="listitem"]')).toHaveClass(
        'has-signal'
      );
    };
    const assertFullHorizonScale = () => {
      expect(
        Array.from(container.querySelectorAll('.hava81-forecast-atlas__axis-label')).map(
          label => label.textContent
        )
      ).toEqual(['31°', '22°', '12°']);
    };

    assertFullHorizonSummary();
    assertFullHorizonScale();
    await user.click(within(interval).getByRole('button', { name: '3s 3 saatlik' }));
    assertFullHorizonSummary();
    assertFullHorizonScale();
    await user.click(within(interval).getByRole('button', { name: '6s 6 saatlik' }));
    assertFullHorizonSummary();
    assertFullHorizonScale();
    await user.click(within(interval).getByRole('button', { name: '12s 12 saatlik' }));
    assertFullHorizonSummary();
    assertFullHorizonScale();
  });

  it('shows daily precipitation totals without inventing a 0% rain label', () => {
    render(
      <SettingsProvider>
        <ForecastAtlas
          daily={[
            {
              date: new Date('2026-08-29T12:00:00.000Z'),
              tempMin: 20,
              tempMax: 25,
              icon: '10d',
              description: 'hafif yağmur',
              pop: 0,
              precipitationMm: 0.4,
            },
            {
              date: new Date('2026-08-30T12:00:00.000Z'),
              tempMin: 19,
              tempMax: 24,
              icon: '10d',
              description: 'yağmurlu',
              pop: 0.35,
              precipitationMm: 2.3,
            },
          ]}
          hourly={[]}
          meta={{
            provider: 'Open-Meteo',
            fetchedAt: new Date(),
            timezoneOffsetSeconds: 0,
            intervalHours: 1,
          }}
        />
      </SettingsProvider>
    );

    const days = screen.getAllByRole('listitem');
    expect(days[0]).toHaveTextContent('0,4 mm');
    expect(days[0]).not.toHaveTextContent('0%');
    expect(
      within(days[0]).getByRole('group', { name: /günlük toplam yağış 0,4 mm/i })
    ).toBeInTheDocument();
    expect(days[1]).toHaveTextContent('35% · 2,3 mm');
    expect(
      within(days[1]).getByRole('group', {
        name: /yağış olasılığı %35; günlük toplam 2,3 mm/i,
      })
    ).toBeInTheDocument();
  });

  it('shows one daily temperature when rounded high and low are identical', () => {
    render(
      <SettingsProvider>
        <ForecastAtlas
          daily={[
            {
              date: new Date('2026-08-29T12:00:00.000Z'),
              tempMin: 24.4,
              tempMax: 24.49,
              icon: '01d',
              description: 'açık',
              pop: 0,
            },
          ]}
          hourly={[]}
          meta={{
            provider: 'Open-Meteo',
            fetchedAt: new Date(),
            timezoneOffsetSeconds: 0,
            intervalHours: 1,
          }}
        />
      </SettingsProvider>
    );

    const temperature = screen.getByRole('group', { name: /günlük sıcaklık 24°C/i });
    expect(temperature).toHaveTextContent('24°');
    expect(temperature).not.toHaveTextContent('/');
  });

  it('preserves a real daily range when integer rounding would make high and low look identical', () => {
    render(
      <SettingsProvider>
        <ForecastAtlas
          daily={[
            {
              date: new Date('2026-08-29T12:00:00.000Z'),
              tempMin: 24.2,
              tempMax: 24.4,
              icon: '01d',
              description: 'açık',
              pop: 0,
            },
          ]}
          hourly={[]}
          meta={{
            provider: 'Open-Meteo',
            fetchedAt: new Date(),
            timezoneOffsetSeconds: 0,
            intervalHours: 1,
          }}
        />
      </SettingsProvider>
    );

    const temperature = screen.getByRole('group', {
      name: /yüksek 24,4°C, düşük 24,2°C/i,
    });
    expect(temperature).toHaveTextContent('24,4°/24,2°');
  });

  it('uses the forecast location timezone for hourly clock labels and day boundaries', () => {
    render(
      <SettingsProvider>
        <ForecastAtlas
          daily={[]}
          hourly={[
            {
              time: new Date('2026-08-29T20:00:00.000Z'),
              temp: 22,
              icon: '01n',
              description: 'açık',
              pop: 0,
              windSpeed: 2,
            },
            {
              time: new Date('2026-08-29T21:00:00.000Z'),
              temp: 21,
              icon: '01n',
              description: 'açık',
              pop: 0,
              windSpeed: 2,
            },
          ]}
          meta={{
            provider: 'Open-Meteo',
            fetchedAt: new Date(),
            timezoneOffsetSeconds: 3 * 60 * 60,
            intervalHours: 1,
          }}
        />
      </SettingsProvider>
    );

    const region = screen.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i });
    const hours = within(region).getAllByRole('listitem');
    expect(hours[0]).toHaveTextContent('23:00');
    expect(hours[1]).toHaveTextContent('00:00');
    expect(hours[1].querySelector('.hava81-forecast-atlas__hour-day')).toBeInTheDocument();
    expect(hours[1]).toHaveClass('is-day-boundary');
  });

  it('marks the local day change without repeating a date on every hourly card', async () => {
    const user = userEvent.setup();
    render(
      <SettingsProvider>
        <ForecastAtlas
          daily={[]}
          hourly={Array.from({ length: 24 }, (_, index) => ({
            time: new Date(Date.parse('2026-08-29T20:00:00.000Z') + index * 60 * 60_000),
            temp: 22,
            icon: '01n',
            description: 'açık',
            pop: 0,
            windSpeed: 2,
          }))}
          meta={{
            provider: 'Open-Meteo',
            fetchedAt: new Date(),
            timezoneOffsetSeconds: 0,
            intervalHours: 1,
          }}
        />
      </SettingsProvider>
    );

    const interval = screen.getByRole('group', { name: /tahmin aralığı/i });
    const region = screen.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i });

    const boundaryFor = () => region.querySelectorAll('.hava81-forecast-atlas__hour-day');

    expect(boundaryFor()).toHaveLength(1);
    expect(boundaryFor()[0].closest('li')).toHaveTextContent('00:00');

    await user.click(within(interval).getByRole('button', { name: '3s 3 saatlik' }));
    expect(boundaryFor()).toHaveLength(1);
    expect(boundaryFor()[0].closest('li')).toHaveTextContent('02:00');

    await user.click(within(interval).getByRole('button', { name: '6s 6 saatlik' }));
    expect(boundaryFor()).toHaveLength(1);
    expect(boundaryFor()[0].closest('li')).toHaveTextContent('02:00');
  });
});
