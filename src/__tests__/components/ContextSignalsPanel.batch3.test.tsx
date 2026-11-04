/**
 * Contract for the batch-3 context panel fixes (PR #1741). Each test names the issue it closes.
 *
 * FROZEN: written before the implementation and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { ContextSignalsPanel } from '../../components/hava81/ContextSignalsPanel';
import { SettingsProvider } from '../../context';
import type { ContextSignals } from '../../types';

const NOW = new Date();
const hourStart = new Date(Math.floor(NOW.getTime() / 3_600_000) * 3_600_000);
const DOIS = [
  '10.48670/mds-00373',
  '10.48670/mds-00359',
  '10.48670/mds-00360',
  '10.48670/mds-00355',
];

const copernicus = (overrides: Partial<ContextSignals> = {}): ContextSignals => ({
  provider: 'MET Norway + Copernicus',
  fetchedAt: NOW,
  attribution: `MET Norway · CC BY 4.0 · Contains modified Copernicus Atmosphere Monitoring Service information (CAMS European air quality forecast, CC BY 4.0) · Generated using E.U. Copernicus Marine Service Information; ${DOIS.map(doi => `https://doi.org/${doi}`).join(', ')}`,
  uvIndexMax: 5,
  grassPollenMax: 30,
  dustMax: 20,
  units: { grassPollen: 'grains/m³', dust: 'µg/m³', waveHeight: 'm', seaSurfaceTemperature: '°C' },
  marine: {
    observedAt: hourStart.toISOString(),
    validAt: hourStart.toISOString(),
    modelRunAt: new Date(hourStart.getTime() - 6 * 3_600_000).toISOString(),
    waveHeight: 0.7,
    seaSurfaceTemperature: 18.4,
  },
  ...overrides,
});

const renderPanel = (signals: ContextSignals) =>
  render(
    <SettingsProvider>
      <ContextSignalsPanel signals={signals} timezoneOffsetSeconds={3 * 3_600} />
    </SettingsProvider>
  );

describe('context panel, batch 3', () => {
  afterEach(async () => {
    await i18n.changeLanguage('tr');
  });

  // #1772
  it('#1772 links every Copernicus Marine product DOI the API credits', () => {
    renderPanel(copernicus());
    for (const doi of DOIS) {
      expect(screen.getByRole('link', { name: doi })).toHaveAttribute(
        'href',
        `https://doi.org/${doi}`
      );
    }
  });

  // #1744
  it('#1744 says CAMS pollen is an experimental model, in Turkish and English', async () => {
    const { unmount } = renderPanel(copernicus());
    expect(screen.getByText(/deneysel/i)).toBeInTheDocument();
    unmount();
    await i18n.changeLanguage('en');
    renderPanel(copernicus());
    expect(screen.getByText(/experimental/i)).toBeInTheDocument();
  });

  it('#1744 shows no pollen qualifier when there is no pollen value', () => {
    renderPanel(copernicus({ grassPollenMax: undefined, olivePollenMax: undefined }));
    expect(screen.queryByText(/deneysel/i)).not.toBeInTheDocument();
  });

  // #1768
  it('#1768 labels sea values as a model for the hour, with the model run time', () => {
    renderPanel(copernicus());
    const run = screen.getByText(/model/i, { selector: '.context-signal--marine *' });
    expect(run).toBeInTheDocument();
    expect(document.querySelector('.context-signal--marine time')).toHaveAttribute(
      'dateTime',
      new Date(hourStart.getTime() - 6 * 3_600_000).toISOString()
    );
  });

  // #1771
  it('#1771 credits Copernicus alone when MET Norway is down, without claiming UV', () => {
    renderPanel(
      copernicus({
        provider: 'Copernicus',
        uvIndexMax: undefined,
        attribution: `Contains modified Copernicus Atmosphere Monitoring Service information (CAMS European air quality forecast, CC BY 4.0) · Generated using E.U. Copernicus Marine Service Information; ${DOIS.map(doi => `https://doi.org/${doi}`).join(', ')}`,
      })
    );
    expect(screen.getByRole('link', { name: 'CAMS' })).toHaveAttribute(
      'href',
      'https://atmosphere.copernicus.eu/'
    );
    expect(screen.getByRole('link', { name: 'Copernicus Marine' })).toHaveAttribute(
      'href',
      'https://marine.copernicus.eu/'
    );
    expect(screen.queryByRole('link', { name: 'MET Norway' })).not.toBeInTheDocument();
    // No UV card: the UV value came from MET Norway.
    expect(screen.queryByText(/Tahmini UV/)).not.toBeInTheDocument();
  });
});
