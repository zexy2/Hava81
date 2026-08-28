import type { WeatherService } from '../weather/weather.service';
import type { ForecastDto } from '../weather/contracts';

export interface RoutePoint {
  lat: number;
  lon: number;
  fraction: number;
}
export interface RouteSegmentWeather {
  fraction: number;
  lat: number;
  lon: number;
  eta: string;
  temperature: number;
  precipitationProbability: number;
  windSpeed: number;
  description: string;
  score: number;
  risk: 'low' | 'caution' | 'high';
}
export interface RouteWeatherResult {
  kind: 'corridor-estimate';
  estimatedDistanceKm: number;
  estimatedDurationMinutes: number;
  requestedDeparture: string;
  score: number;
  segments: RouteSegmentWeather[];
  betterDeparture?: { departure: string; score: number; improvement: number };
  disclaimer: string;
}

const earthRadiusKm = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;
export const haversine = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
};
const interpolate = (
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  count = 5
): RoutePoint[] =>
  Array.from({ length: count }, (_, i) => {
    const f = i / (count - 1);
    return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f, fraction: f };
  });

const scoreConditions = (temp: number, popPercent: number, wind: number) => {
  let score = 100;
  if (popPercent >= 80) score -= 45;
  else if (popPercent >= 50) score -= 30;
  else if (popPercent >= 25) score -= 12;
  if (wind >= 17.2) score -= 35;
  else if (wind >= 10.8) score -= 20;
  else if (wind >= 8) score -= 8;
  if (temp >= 40 || temp <= -5) score -= 45;
  else if (temp >= 36 || temp <= 0) score -= 30;
  else if (temp >= 32 || temp <= 5) score -= 15;
  return Math.max(0, Math.min(100, Math.round(score)));
};
const pickNearest = (forecast: ForecastDto, timeMs: number) =>
  forecast.hourly.reduce(
    (best, item) =>
      Math.abs(Date.parse(item.time) - timeMs) < Math.abs(Date.parse(best.time) - timeMs)
        ? item
        : best,
    forecast.hourly[0]
  );

export class RouteWeatherService {
  constructor(private readonly weather: WeatherService) {}

  async evaluate(input: {
    origin: { lat: number; lon: number };
    destination: { lat: number; lon: number };
    departure: Date;
    lang: 'tr' | 'en';
  }): Promise<RouteWeatherResult> {
    const distance = haversine(input.origin, input.destination);
    // Corridor estimate: straight-line distance adjusted for a typical road detour factor.
    const roadLikeDistance = distance * 1.18;
    const durationMinutes = Math.max(45, Math.round((roadLikeDistance / 75) * 60));
    const points = interpolate(input.origin, input.destination, 5);
    const forecasts = await Promise.all(
      points.map(point =>
        this.weather
          .getForecast({ lat: point.lat, lon: point.lon, units: 'metric', lang: input.lang })
          .then(r => r.value)
      )
    );

    const evaluateDeparture = (departure: Date) => {
      const segments = points.map((point, index) => {
        const etaMs = departure.getTime() + durationMinutes * 60_000 * point.fraction;
        const sample = pickNearest(forecasts[index], etaMs);
        const score = scoreConditions(sample.temp, sample.pop, sample.windSpeed);
        return {
          fraction: point.fraction,
          lat: point.lat,
          lon: point.lon,
          eta: new Date(etaMs).toISOString(),
          temperature: sample.temp,
          precipitationProbability: sample.pop,
          windSpeed: sample.windSpeed,
          description: sample.description,
          score,
          risk: (score < 50
            ? 'high'
            : score < 70
              ? 'caution'
              : 'low') as RouteSegmentWeather['risk'],
        };
      });
      const score = Math.round(segments.reduce((sum, s) => sum + s.score, 0) / segments.length);
      return { segments, score };
    };

    const primary = evaluateDeparture(input.departure);
    const laterDate = new Date(input.departure.getTime() + 3 * 60 * 60_000);
    const later = evaluateDeparture(laterDate);
    const improvement = later.score - primary.score;

    return {
      kind: 'corridor-estimate',
      estimatedDistanceKm: Math.round(roadLikeDistance),
      estimatedDurationMinutes: durationMinutes,
      requestedDeparture: input.departure.toISOString(),
      score: primary.score,
      segments: primary.segments,
      betterDeparture:
        improvement >= 10
          ? { departure: laterDate.toISOString(), score: later.score, improvement }
          : undefined,
      disclaimer:
        input.lang === 'tr'
          ? 'Bu sonuç gerçek yol/navigasyon rotası değildir; iki şehir arasındaki yaklaşık hava koridorunu örnekler. Trafik, yol kapanması ve yol güvenliği içermez.'
          : 'This is not a turn-by-turn road route; it samples an approximate weather corridor between the two cities. It does not include traffic, closures or road safety.',
    };
  }
}
