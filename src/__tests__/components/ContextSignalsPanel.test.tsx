import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../../i18n';
import { ContextSignalsPanel } from '../../components/hava81/ContextSignalsPanel';

describe('ContextSignalsPanel', () => {
  it('keeps modeled context attributed and renders marine values without inventing missing data', () => {
    render(
      <ContextSignalsPanel
        signals={{
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
        }}
      />
    );
    expect(screen.getByText(/Open-Meteo · CC BY 4.0/)).toBeInTheDocument();
    expect(screen.getByText('UV · 24s model maksimumu')).toBeInTheDocument();
    expect(
      screen.getByText(/UV korunma önerilen seviyeye çıkıyor/i)
    ).toBeInTheDocument();
    expect(screen.getByText('25.1°C')).toBeInTheDocument();
    expect(screen.getByText(/0.40 m.*4.8 s.*315°/)).toBeInTheDocument();
  });

  it('recommends protection from the WHO moderate UV band upward', () => {
    render(
      <ContextSignalsPanel
        signals={{
          provider: 'Open-Meteo',
          fetchedAt: new Date('2026-08-28T06:00:00Z'),
          attribution: 'Open-Meteo · CC BY 4.0',
          uvIndexMax: 4,
          units: {},
        }}
      />
    );

    expect(screen.getByText('Orta')).toBeInTheDocument();
    expect(screen.getByText(/UV korunma önerilen seviyeye çıkıyor/i)).toBeInTheDocument();
  });

  it('keeps the WHO extreme UV category distinct at 11 and above', () => {
    render(
      <ContextSignalsPanel
        signals={{
          provider: 'Open-Meteo',
          fetchedAt: new Date('2026-08-28T06:00:00Z'),
          attribution: 'Open-Meteo · CC BY 4.0',
          uvIndexMax: 11.2,
          units: {},
        }}
      />
    );

    expect(screen.getByText('Aşırı')).toBeInTheDocument();
    expect(
      screen.getByText(/UV korunma önerilen seviyeye çıkıyor/i)
    ).toBeInTheDocument();
  });

  it('normalizes modeled micro units without requiring a Greek font glyph', () => {
    render(
      <ContextSignalsPanel
        signals={{
          provider: 'Open-Meteo',
          fetchedAt: new Date('2026-08-28T06:00:00Z'),
          attribution: 'Open-Meteo · CC BY 4.0',
          dustMax: 12.4,
          grassPollenMax: 3.2,
          units: { dust: 'μg/m³', grassPollen: 'μg/m³' },
        }}
      />
    );

    expect(screen.getAllByText('µg/m³')).toHaveLength(2);
    expect(screen.queryByText('μg/m³')).not.toBeInTheDocument();
  });
});
