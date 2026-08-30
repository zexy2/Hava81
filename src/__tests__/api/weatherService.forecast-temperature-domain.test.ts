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

const forecastEnvelope = () => ({
  daily: [
    {
      date: '2026-07-14',
      tempMin: 18,
      tempMax: 28,
      icon: '01d',
      description: 'clear',
      pop: 5,
    },
  ],
  hourly: [
    {
      time: '2026-07-14T12:00:00.000Z',
      temp: 24,
      apparentTemperature: 25,
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

describe('weatherService forecast temperature domain validation', () => {
  it('rejects an out-of-domain daily metric temperature', async () => {
    const payload = forecastEnvelope();
    payload.daily[0].tempMax = 101;
    mockGet.mockResolvedValue(payload);

    await expect(weatherService.getForecast(38.42, 27.14)).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });

  it('rejects an out-of-domain hourly metric temperature', async () => {
    const payload = forecastEnvelope();
    payload.hourly[0].temp = -101;
    mockGet.mockResolvedValue(payload);

    await expect(weatherService.getHourlyForecast(38.42, 27.14)).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });

  it('rejects an out-of-domain hourly apparent temperature', async () => {
    const payload = forecastEnvelope();
    payload.hourly[0].apparentTemperature = 101;
    mockGet.mockResolvedValue(payload);

    await expect(weatherService.getHourlyForecast(38.42, 27.14)).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
    });
  });

  it('accepts the metric temperature envelope boundaries', async () => {
    const payload = forecastEnvelope();
    payload.daily[0].tempMin = -100;
    payload.daily[0].tempMax = 100;
    payload.hourly[0].temp = -100;
    payload.hourly[0].apparentTemperature = 100;
    mockGet.mockResolvedValue(payload);

    await expect(weatherService.getForecast(38.42, 27.14)).resolves.toMatchObject({
      daily: [{ tempMin: -100, tempMax: 100 }],
      hourly: [{ temp: -100, apparentTemperature: 100 }],
    });
  });
});
