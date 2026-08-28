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
          units: { waveHeight: 'm', seaSurfaceTemperature: '°C' },
          marine: { observedAt: '2026-08-28T09:00', waveHeight: 0.4, seaSurfaceTemperature: 25.1 },
        }}
      />
    );
    expect(screen.getByText('Open-Meteo · CC BY 4.0')).toBeInTheDocument();
    expect(screen.getByText('25.1°C')).toBeInTheDocument();
    expect(screen.getByText(/0.40/)).toBeInTheDocument();
  });
});
