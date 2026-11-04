import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../../i18n';
import { HourlySource } from '../../components/hava81/forecastAtlas/HourlySource';
import type { ForecastMeta } from '../../types';

const meta = (overrides: Partial<ForecastMeta>): ForecastMeta => ({
  provider: 'MET Norway',
  fetchedAt: new Date(),
  timezoneOffsetSeconds: 10_800,
  intervalHours: 1,
  ...overrides,
});

describe('HourlySource', () => {
  it('credits MET Norway with its licence, Hava81 processing and OpenWeather for the chance of rain', () => {
    render(<HourlySource meta={meta({ sourceUrl: 'https://api.met.no/' })} />);
    expect(screen.getByRole('link', { name: 'MET Norway' })).toHaveAttribute(
      'href',
      'https://api.met.no/'
    );
    expect(screen.getByRole('link', { name: 'CC BY 4.0' })).toBeInTheDocument();
    expect(screen.getByText(/Yağış olasılığı:/)).toBeInTheDocument();
    expect(screen.getByText('Weather data provided by OpenWeather')).toBeInTheDocument();
  });

  it('credits Open-Meteo with its licence and no OpenWeather line', () => {
    render(<HourlySource meta={meta({ provider: 'Open-Meteo' })} />);
    expect(screen.getByText('Open-Meteo').tagName).toBe('SPAN');
    expect(screen.getByRole('link', { name: 'CC BY 4.0' })).toBeInTheDocument();
    expect(screen.queryByText(/Yağış olasılığı:/)).not.toBeInTheDocument();
  });

  it('shows another provider with its own attribution, once', () => {
    const { container, rerender } = render(
      <HourlySource meta={meta({ provider: 'Other', attribution: 'Other · licence' })} />
    );
    expect(container).toHaveTextContent('Other · Other · licence');
    rerender(<HourlySource meta={meta({ provider: 'Other', attribution: 'Other' })} />);
    expect(container.textContent).not.toMatch(/Other · Other/);
    expect(screen.queryByRole('link', { name: 'CC BY 4.0' })).not.toBeInTheDocument();
  });
});
