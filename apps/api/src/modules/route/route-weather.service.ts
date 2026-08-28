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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smoothstep = (value: number, start: number, end: number) => {
  const t = clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
};

export const scoreRouteConditions = (temp: number, popPercent: number, wind: number) => {
  const pop = clamp(popPercent / 100, 0, 1);
  const thermal =
    temp > 25
      ? 48 * smoothstep(temp, 25, 43)
      : temp < 18
        ? 48 * smoothstep(18 - temp, 0, 28)
        : 0;
  const rain = 30 * smoothstep(pop, 0.12, 0.9);
  const windPenalty = 34 * smoothstep(Math.max(0, wind), 4, 18);
  const material = [thermal, rain, windPenalty].filter(value => value >= 8).length;
  const compound = material >= 2 ? Math.min(8, (material - 1) * 4) : 0;
  let score = Math.round(100 - thermal - rain - windPenalty - compound);
  score = clamp(score, 0, 100);
  if (temp >= 43 || temp <= -20) score = Math.min(score, 25);
  else if (temp >= 40 || temp <= -10) score = Math.min(score, 40);
  if (wind >= 20) score = Math.min(score, 30);
  return score;
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
        const score = scoreRouteConditions(sample.temp, sample.pop, sample.windSpeed);
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
          risk: (score < 55
            ? 'high'
            : score < 75
              ? 'caution'
              : 'low') as RouteSegmentWeather['risk'],
        };
      });
      const meanScore = segments.reduce((sum, segment) => sum + segment.score, 0) / segments.length;
      const worstScore = Math.min(...segments.map(segment => segment.score));
      const score = Math.round(meanScore * 0.8 + worstScore * 0.2);
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
        improvement >= 8
          ? { departure: laterDate.toISOString(), score: later.score, improvement }
          : undefined,
      disclaimer:
        input.lang === 'tr'
          ? 'Bu sonuç gerçek yol/navigasyon rotası değildir; iki şehir arasındaki yaklaşık hava koridorunu örnekler. Trafik, yol kapanması ve yol güvenliği içermez.'
          : 'This is not a turn-by-turn road route; it samples an approximate weather corridor between the two cities. It does not include traffic, closures or road safety.',
    };
  }
}
