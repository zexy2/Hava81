import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ContextSignalsPanel } from '../../components/hava81/ContextSignalsPanel';
import { SettingsProvider } from '../../context';
import type { ContextSignals } from '../../types';

const renderPanel = (signals: ContextSignals, timezoneOffsetSeconds = 3 * 60 * 60) =>
  render(
    <SettingsProvider>
      <ContextSignalsPanel signals={signals} timezoneOffsetSeconds={timezoneOffsetSeconds} />
    </SettingsProvider>
  );

describe('ContextSignalsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T06:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps modeled context attributed and renders marine values without inventing missing data', () => {
    renderPanel({
          provider: 'Open-Meteo',
          fetchedAt: new Date('2026-08-28T06:00:00Z'),
          attribution: 'Open-Meteo · CC BY 4.0',
          uvIndexMax: 7,
          units: {
            waveHeight: 'm',
            waveDirection: '°',
            wavePeriod: 's',
            seaSurfaceTemperature: '°C',
          },
          marine: {
            observedAt: '2026-08-28T09:00',
            waveHeight: 0.4,
            waveDirection: 315,
            wavePeriod: 4.8,
            seaSurfaceTemperature: 25.1,
          },
    });
    expect(screen.getByRole('link', { name: 'Open-Meteo' })).toHaveAttribute(
      'href',
      'https://open-meteo.com/'
    );
    expect(screen.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/4.0/'
    );
    expect(screen.getByText(/Hava81 tarafından özetlendi/)).toBeInTheDocument();
    expect(screen.getByText(/veri alındı/i)).toBeInTheDocument();
    expect(screen.queryByText(/model \d{2}:\d{2}/i)).not.toBeInTheDocument();
    expect(screen.getByText('UV · 24s model maksimumu')).toBeInTheDocument();
    expect(
      screen.getByText(/WHO UV İndeksi rehberinde 3 ve üzeri/i)
    ).toBeInTheDocument();
    expect(screen.getByText('25.1°C')).toBeInTheDocument();
    expect(screen.getByText(/0.40 m.*4.8 s.*315°/)).toBeInTheDocument();
  });

  it('renders provider fetch time in the weather location timezone', () => {
    renderPanel(
      {
        provider: 'Open-Meteo',
        fetchedAt: new Date('2026-08-28T06:00:00Z'),
        attribution: 'Open-Meteo · CC BY 4.0',
        units: {},
      },
      3 * 60 * 60
    );

    expect(screen.getByText(/veri alındı 09:00/i)).toBeInTheDocument();
  });

  it('converts sea surface temperature to the selected temperature unit', () => {
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'imperial',
        windSpeedUnit: 'ms',
        themeMode: 'auto',
        language: 'tr',
      })
    );

    renderPanel({
      provider: 'Open-Meteo',
      fetchedAt: new Date('2026-08-28T06:00:00Z'),
      attribution: 'Open-Meteo · CC BY 4.0',
      units: { seaSurfaceTemperature: '°C' },
      marine: {
        observedAt: '2026-08-28T09:00',
        seaSurfaceTemperature: 25.1,
      },
    });

    expect(screen.getByText('77°F')).toBeInTheDocument();
    expect(screen.queryByText('25.1°C')).not.toBeInTheDocument();
  });

  it('does not render materially future provider evidence', () => {
    renderPanel({
      provider: 'Open-Meteo',
      fetchedAt: new Date('2026-08-28T06:02:00Z'),
      attribution: 'Open-Meteo · CC BY 4.0',
      uvIndexMax: 4,
      units: {},
    });

    expect(screen.queryByText(/veri alındı/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hava81 tarafından özetlendi/)).not.toBeInTheDocument();
    expect(screen.queryByText('UV · 24s model maksimumu')).not.toBeInTheDocument();
  });

  it('recommends protection from the WHO moderate UV band upward', () => {
    renderPanel({
          provider: 'Open-Meteo',
          fetchedAt: new Date('2026-08-28T06:00:00Z'),
          attribution: 'Open-Meteo · CC BY 4.0',
          uvIndexMax: 4,
          units: {},
    });

    expect(screen.getByText('Orta')).toBeInTheDocument();
    expect(screen.getByText(/WHO UV İndeksi rehberinde 3 ve üzeri/i)).toBeInTheDocument();
  });

  it('keeps the WHO extreme UV category distinct at 11 and above', () => {
    renderPanel({
          provider: 'Open-Meteo',
          fetchedAt: new Date('2026-08-28T06:00:00Z'),
          attribution: 'Open-Meteo · CC BY 4.0',
          uvIndexMax: 11.2,
          units: {},
    });

    expect(screen.getByText('Aşırı')).toBeInTheDocument();
    expect(
      screen.getByText(/WHO UV İndeksi rehberinde 3 ve üzeri/i)
    ).toBeInTheDocument();
  });

  it('keeps the displayed pollen maximum paired with the unit from the same source series', () => {
    renderPanel({
      provider: 'Open-Meteo',
      fetchedAt: new Date('2026-08-28T06:00:00Z'),
      attribution: 'Open-Meteo · CC BY 4.0',
      grassPollenMax: 3.2,
      olivePollenMax: 7.4,
      units: { grassPollen: 'grass-unit', olivePollen: 'olive-unit' },
    });

    expect(screen.getByText('7.4')).toBeInTheDocument();
    expect(screen.getByText('olive-unit')).toBeInTheDocument();
    expect(screen.queryByText('grass-unit')).not.toBeInTheDocument();
  });

  it('normalizes modeled micro units without requiring a Greek font glyph', () => {
    renderPanel({
          provider: 'Open-Meteo',
          fetchedAt: new Date('2026-08-28T06:00:00Z'),
          attribution: 'Open-Meteo · CC BY 4.0',
          dustMax: 12.4,
          grassPollenMax: 3.2,
          units: { dust: 'μg/m³', grassPollen: 'μg/m³' },
    });

    expect(screen.getAllByText('µg/m³')).toHaveLength(2);
    expect(screen.queryByText('μg/m³')).not.toBeInTheDocument();
  });

  it('removes modeled health and activity evidence at the exact provider freshness boundary', async () => {
    renderPanel({
      provider: 'Open-Meteo',
      fetchedAt: new Date('2026-08-28T06:00:00Z'),
      freshForSeconds: 30,
      attribution: 'Open-Meteo · CC BY 4.0',
      uvIndexMax: 7,
      dustMax: 18,
      units: { dust: 'µg/m³' },
    });

    expect(screen.getByText('UV · 24s model maksimumu')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_200);
    });

    expect(screen.queryByText('UV · 24s model maksimumu')).not.toBeInTheDocument();
    expect(screen.queryByText('18')).not.toBeInTheDocument();
    expect(screen.queryByText(/Hava81 tarafından özetlendi/)).not.toBeInTheDocument();
  });
});
