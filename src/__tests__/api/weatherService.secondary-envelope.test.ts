import { vi, type Mock } from 'vitest';
import { httpClient } from '../../api/httpClient';
import { weatherService } from '../../api/weatherService';
import { ErrorCode } from '../../types';

vi.mock('../../api/httpClient', () => ({
  httpClient: { get: vi.fn() },
}));

const mockGet = httpClient.get as Mock;

const expectApiDataError = (promise: Promise<unknown>, field: string) =>
  expect(promise).rejects.toMatchObject({
    code: ErrorCode.API_ERROR,
    retryable: true,
    details: { field },
  });

describe('weatherService secondary BFF envelope validation', () => {
  beforeEach(() => mockGet.mockReset());

  it('rejects a null context envelope without leaking a TypeError', async () => {
    mockGet.mockResolvedValue(null);
    await expectApiDataError(weatherService.getContextSignals(41.01, 28.97), 'context');
  });

  it('rejects a missing context units record before UI formatting can dereference it', async () => {
    mockGet.mockResolvedValue({
      provider: 'Open-Meteo',
      attribution: 'Open-Meteo · CC BY 4.0',
      fetchedAt: new Date().toISOString(),
    });
    await expectApiDataError(weatherService.getContextSignals(41.01, 28.97), 'context.units');
  });

  it('rejects a non-string context unit before UI formatting can call string methods on it', async () => {
    mockGet.mockResolvedValue({
      provider: 'Open-Meteo',
      attribution: 'Open-Meteo · CC BY 4.0',
      fetchedAt: new Date().toISOString(),
      dustMax: 4,
      units: { dust: 123 },
    });
    await expectApiDataError(weatherService.getContextSignals(41.01, 28.97), 'context.units.dust');
  });

  it('rejects a non-object marine context payload', async () => {
    mockGet.mockResolvedValue({
      provider: 'Open-Meteo',
      attribution: 'Open-Meteo · CC BY 4.0',
      fetchedAt: new Date().toISOString(),
      units: {},
      marine: [],
    });
    await expectApiDataError(weatherService.getContextSignals(41.01, 28.97, true), 'context.marine');
  });

  it('rejects a null air-quality envelope without leaking a TypeError', async () => {
    mockGet.mockResolvedValue(null);
    await expectApiDataError(weatherService.getAirQuality(41.01, 28.97), 'airQuality');
  });

  it('rejects a null route envelope without leaking a TypeError', async () => {
    mockGet.mockResolvedValue(null);
    await expectApiDataError(
      weatherService.getRouteWeather(
        { lat: 41.01, lon: 28.97 },
        { lat: 39.93, lon: 32.86 },
        new Date()
      ),
      'route'
    );
  });

  it('rejects a non-object route segment before reading segment fields', async () => {
    mockGet.mockResolvedValue({
      kind: 'corridor-estimate',
      estimatedDistanceKm: 450,
      estimatedDurationMinutes: 300,
      requestedDeparture: new Date().toISOString(),
      score: 75,
      segments: [null],
      disclaimer: 'Model tabanlı rota tahmini.',
    });
    await expectApiDataError(
      weatherService.getRouteWeather(
        { lat: 41.01, lon: 28.97 },
        { lat: 39.93, lon: 32.86 },
        new Date()
      ),
      'route.segments.0'
    );
  });

  it('rejects a non-object better-departure payload', async () => {
    mockGet.mockResolvedValue({
      kind: 'corridor-estimate',
      estimatedDistanceKm: 450,
      estimatedDurationMinutes: 300,
      requestedDeparture: new Date().toISOString(),
      score: 75,
      segments: [
        {
          fraction: 0,
          lat: 41.01,
          lon: 28.97,
          eta: new Date().toISOString(),
          temperature: 24,
          precipitationProbability: 10,
          windSpeed: 3,
          description: 'açık',
          score: 80,
          risk: 'low',
        },
      ],
      disclaimer: 'Model tabanlı rota tahmini.',
      betterDeparture: [],
    });
    await expectApiDataError(
      weatherService.getRouteWeather(
        { lat: 41.01, lon: 28.97 },
        { lat: 39.93, lon: 32.86 },
        new Date()
      ),
      'route.betterDeparture'
    );
  });
});
