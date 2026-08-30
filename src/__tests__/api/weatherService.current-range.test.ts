import { vi, type Mock } from 'vitest';
import { httpClient } from '../../api/httpClient';
import { weatherService } from '../../api/weatherService';
import { ErrorCode } from '../../types';

vi.mock('../../api/httpClient', () => ({
  httpClient: {
    get: vi.fn(),
  },
}));

const mockGet = httpClient.get as Mock;

describe('weatherService current weather range validation', () => {
  it('rejects a fresh BFF current-weather response whose minimum exceeds its maximum', async () => {
    mockGet.mockResolvedValue({
      cityName: 'Izmir',
      country: 'TR',
      temperature: 22,
      feelsLike: 21,
      tempMin: 28,
      tempMax: 18,
      humidity: 65,
      pressure: 1015,
      visibility: 10000,
      windSpeed: 3.5,
      windDirection: 180,
      description: 'acik hava',
      icon: '01d',
      sunrise: '2026-07-14T02:45:00.000Z',
      sunset: '2026-07-14T17:35:00.000Z',
      timestamp: '2026-07-14T12:00:00.000Z',
      coordinates: { lat: 38.42, lon: 27.14 },
      clouds: 0,
      meta: {
        provider: 'OpenWeather',
        fetchedAt: '2026-07-14T12:00:01.000Z',
        timezoneOffsetSeconds: 10800,
        cacheStatus: 'MISS',
        freshForSeconds: 60,
      },
    });

    await expect(weatherService.getCurrentWeather({ city: 'Izmir' })).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });
});
