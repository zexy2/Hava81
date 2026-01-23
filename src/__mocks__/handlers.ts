/**
 * MSW Handlers
 * Mock Service Worker handlers for API mocking
 */

import { http, HttpResponse } from 'msw';

const API_BASE = 'https://api.openweathermap.org/data/2.5';

// Mock weather data
const mockWeatherData = {
  coord: { lon: 27.1428, lat: 38.4237 },
  weather: [
    {
      id: 800,
      main: 'Clear',
      description: 'açık hava',
      icon: '01d',
    },
  ],
  base: 'stations',
  main: {
    temp: 22,
    feels_like: 21,
    temp_min: 20,
    temp_max: 24,
    pressure: 1015,
    humidity: 65,
  },
  visibility: 10000,
  wind: {
    speed: 3.5,
    deg: 180,
  },
  clouds: { all: 0 },
  dt: 1640000000,
  sys: {
    type: 2,
    id: 2038,
    country: 'TR',
    sunrise: 1639980000,
    sunset: 1640020000,
  },
  timezone: 10800,
  id: 311046,
  name: 'İzmir',
  cod: 200,
};

export const handlers = [
  // Current weather endpoint
  http.get(`${API_BASE}/weather`, ({ request }) => {
    const url = new URL(request.url);
    const city = url.searchParams.get('q');
    const apiKey = url.searchParams.get('appid');

    // Check API key
    if (!apiKey) {
      return HttpResponse.json(
        { cod: 401, message: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Handle not found
    if (city?.toLowerCase() === 'notfound') {
      return HttpResponse.json(
        { cod: '404', message: 'city not found' },
        { status: 404 }
      );
    }

    // Return mock data with city name
    return HttpResponse.json({
      ...mockWeatherData,
      name: city || 'İzmir',
    });
  }),

  // Forecast endpoint (for future use)
  http.get(`${API_BASE}/forecast`, ({ request }) => {
    const url = new URL(request.url);
    const apiKey = url.searchParams.get('appid');

    if (!apiKey) {
      return HttpResponse.json(
        { cod: 401, message: 'Invalid API key' },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      cod: '200',
      list: [],
      city: { name: 'İzmir', country: 'TR' },
    });
  }),
];

export default handlers;
