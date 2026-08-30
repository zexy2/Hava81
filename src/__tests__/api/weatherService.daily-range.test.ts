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

describe('weatherService daily forecast range validation', () => {
  it('rejects a fresh BFF forecast whose daily minimum exceeds its maximum', async () => {
    mockGet.mockResolvedValue({
      daily: [
        {
          date: '2026-07-14',
          tempMin: 28,
          tempMax: 18,
          icon: '01d',
          description: 'clear',
          pop: 5,
        },
      ],
      hourly: [
        {
          time: '2026-07-14T12:00:00.000Z',
          temp: 24,
          icon: '01d',
          pop: 5,
        },
      ],
      meta: {
        provider: 'OpenWeather',
        fetchedAt: '2026-07-14T12:00:01.000Z',
        timezoneOffsetSeconds: 10800,
        intervalHours: 3,
      },
    });

    await expect(weatherService.getForecast(38.42, 27.14)).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });
});
