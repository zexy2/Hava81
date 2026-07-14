/**
 * MSW Handlers
 * Mock Service Worker handlers for API mocking
 */

import { http, HttpResponse } from 'msw';

const API_BASE = '*/api/v1';

// Mock weather data
const mockWeatherData = {
  cityName: 'İzmir',
  country: 'TR',
  temperature: 22,
  feelsLike: 21,
  tempMin: 20,
  tempMax: 24,
  humidity: 65,
  pressure: 1015,
  visibility: 10000,
  windSpeed: 3.5,
  windDirection: 180,
  description: 'açık hava',
  icon: '01d',
  sunrise: '2024-01-01T06:00:00.000Z',
  sunset: '2024-01-01T18:00:00.000Z',
  timestamp: '2024-01-01T12:00:00.000Z',
  coordinates: { lon: 27.1428, lat: 38.4237 },
  clouds: 0,
};

export const handlers = [
  // Current weather endpoint
  http.get(`${API_BASE}/weather/current`, ({ request }) => {
    const url = new URL(request.url);
    const city = url.searchParams.get('city');

    // Handle not found
    if (city?.toLowerCase() === 'notfound') {
      return HttpResponse.json(
        { error: { code: 'LOCATION_NOT_FOUND', message: 'Şehir bulunamadı.', requestId: 'test' } },
        { status: 404 }
      );
    }

    // Return mock data with city name
    return HttpResponse.json({
      ...mockWeatherData,
      cityName: city || 'İzmir',
    });
  }),

  http.get(`${API_BASE}/weather/forecast`, () => {
    return HttpResponse.json({
      daily: [],
      hourly: [],
    });
  }),
  http.get(`${API_BASE}/weather/air-quality`, () =>
    HttpResponse.json({ aqi: 1, aqiLabel: 'İyi', pm25: 5, pm10: 8, o3: 20 })
  ),
];

export default handlers;
