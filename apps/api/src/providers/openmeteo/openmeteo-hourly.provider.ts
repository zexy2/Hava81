import { z } from "zod";
import { AppError } from "../../core/errors";
import type {
  HourlyForecastProvider,
  HourlyForecastProviderResult,
  HourlyForecastQuery,
  WeatherLanguage,
} from "../weather-provider";

const optionalHourlySeries = z.array(z.number().nullable()).optional();
const providerTimestampSchema = z.number().int().nonnegative();
const providerTimezoneOffsetSchema = z.number().int().min(-43_200).max(50_400);
const ONE_HOUR_MS = 60 * 60 * 1_000;

const hourlySchema = z.object({
  utc_offset_seconds: providerTimezoneOffsetSchema,
  daily: z
    .object({
      time: z.array(providerTimestampSchema),
      temperature_2m_max: z.array(z.number().nullable()),
      temperature_2m_min: z.array(z.number().nullable()),
      weather_code: z.array(z.number().int().nullable()),
      precipitation_probability_max: z.array(z.number().nullable()),
      precipitation_sum: z.array(z.number().nullable()).optional(),
    })
    .optional(),
  hourly: z.object({
    time: z.array(providerTimestampSchema),
    temperature_2m: z.array(z.number().nullable()),
    apparent_temperature: optionalHourlySeries,
    relative_humidity_2m: optionalHourlySeries,
    precipitation_probability: z.array(z.number().nullable()),
    precipitation: optionalHourlySeries,
    weather_code: z.array(z.number().int().nullable()),
    wind_speed_10m: z.array(z.number().nullable()),
    wind_gusts_10m: optionalHourlySeries,
    visibility: optionalHourlySeries,
    uv_index: optionalHourlySeries,
    is_day: z.array(z.number().int().min(0).max(1).nullable()),
  }),
});

const descriptionForCode = (code: number, lang: WeatherLanguage): string => {
  const tr = lang === "tr";
  if (code === 0) return tr ? "açık" : "clear sky";
  if (code === 1) return tr ? "çoğunlukla açık" : "mainly clear";
  if (code === 2) return tr ? "parçalı bulutlu" : "partly cloudy";
  if (code === 3) return tr ? "kapalı" : "overcast";
  if (code === 45 || code === 48) return tr ? "sisli" : "foggy";
  if ([51, 53, 55].includes(code)) return tr ? "çisenti" : "drizzle";
  if ([56, 57].includes(code)) return tr ? "dondurucu çisenti" : "freezing drizzle";
  if ([61, 63].includes(code)) return tr ? "yağmurlu" : "rain";
  if (code === 65) return tr ? "kuvvetli yağmur" : "heavy rain";
  if ([66, 67].includes(code)) return tr ? "dondurucu yağmur" : "freezing rain";
  if ([71, 73].includes(code)) return tr ? "karlı" : "snow";
  if (code === 75) return tr ? "yoğun kar" : "heavy snow";
  if (code === 77) return tr ? "kar taneleri" : "snow grains";
  if ([80, 81].includes(code)) return tr ? "sağanak yağış" : "rain showers";
  if (code === 82) return tr ? "kuvvetli sağanak" : "heavy rain showers";
  if ([85, 86].includes(code)) return tr ? "kar sağanağı" : "snow showers";
  if (code === 95) return tr ? "gök gürültülü fırtına" : "thunderstorm";
  if ([96, 99].includes(code)) return tr ? "dolulu gök gürültülü fırtına" : "thunderstorm with hail";
  return tr ? "değişken hava" : "variable weather";
};

const iconForCode = (code: number, isDay: boolean): string => {
  const suffix = isDay ? "d" : "n";
  if (code === 0) return `01${suffix}`;
  if (code === 1) return `02${suffix}`;
  if (code === 2) return `03${suffix}`;
  if (code === 3) return `04${suffix}`;
  if (code === 45 || code === 48) return `50${suffix}`;
  if ([51, 53, 55, 56, 57, 80, 81, 82].includes(code)) return `09${suffix}`;
  if ([61, 63, 65, 66, 67].includes(code)) return `10${suffix}`;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return `13${suffix}`;
  if ([95, 96, 99].includes(code)) return `11${suffix}`;
  return `03${suffix}`;
};

const finiteInRangeAt = (
  series: Array<number | null> | undefined,
  index: number,
  min: number,
  max = Number.POSITIVE_INFINITY,
): number | undefined => {
  const value = series?.[index];
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
};

const isPlausibleCelsius = (value: number): boolean => value >= -100 && value <= 100;

export class OpenMeteoHourlyProvider implements HourlyForecastProvider {
  readonly name = "Open-Meteo";
  readonly attribution = "Open-Meteo · CC BY 4.0";
  readonly sourceUrl = "https://open-meteo.com/";

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 8_000,
    private readonly baseUrl = "https://api.open-meteo.com",
    private readonly apiKey?: string,
  ) {}

  async getHourly(query: HourlyForecastQuery): Promise<HourlyForecastProviderResult> {
    const url = new URL("/v1/forecast", this.baseUrl);
    url.searchParams.set("latitude", String(query.lat));
    url.searchParams.set("longitude", String(query.lon));
    url.searchParams.set(
      "hourly",
      [
        "temperature_2m",
        "apparent_temperature",
        "relative_humidity_2m",
        "precipitation_probability",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
        "wind_gusts_10m",
        "visibility",
        "uv_index",
        "is_day",
      ].join(","),
    );
    url.searchParams.set(
      "daily",
      [
        "temperature_2m_max",
        "temperature_2m_min",
        "weather_code",
        "precipitation_probability_max",
        "precipitation_sum",
      ].join(","),
    );
    url.searchParams.set("forecast_hours", "48");
    url.searchParams.set("forecast_days", "5");
    url.searchParams.set("timeformat", "unixtime");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("temperature_unit", "celsius");
    url.searchParams.set("wind_speed_unit", "ms");
    url.searchParams.set("precipitation_unit", "mm");
    if (this.apiKey) url.searchParams.set("apikey", this.apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AppError(502, "HOURLY_PROVIDER_ERROR", "Saatlik tahmin sağlayıcısı yanıt vermedi.");
      }
      const parsed = hourlySchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new AppError(
          502,
          "INVALID_HOURLY_PROVIDER_RESPONSE",
          "Saatlik tahmin sağlayıcısı beklenmeyen bir cevap döndürdü.",
        );
      }

      const raw = parsed.data.hourly;
      const length = Math.min(
        raw.time.length,
        raw.temperature_2m.length,
        raw.precipitation_probability.length,
        raw.weather_code.length,
        raw.wind_speed_10m.length,
        raw.is_day.length,
      );
      const hourly: HourlyForecastProviderResult["hourly"] = [];
      for (let index = 0; index < length; index += 1) {
        const temp = raw.temperature_2m[index];
        const pop = raw.precipitation_probability[index];
        const code = raw.weather_code[index];
        const windSpeed = raw.wind_speed_10m[index];
        const isDay = raw.is_day[index];
        if (temp === null || pop === null || code === null || windSpeed === null || isDay === null) {
          continue;
        }
        if (!isPlausibleCelsius(temp) || pop < 0 || pop > 100 || windSpeed < 0) {
          throw new AppError(
            502,
            "INVALID_HOURLY_PROVIDER_RESPONSE",
            "Saatlik tahmin sağlayıcısı fiziksel olarak geçersiz bir cevap döndürdü.",
          );
        }
        hourly.push({
          time: new Date(raw.time[index] * 1_000).toISOString(),
          temp: Math.round(temp * 10) / 10,
          icon: iconForCode(code, isDay === 1),
          description: descriptionForCode(code, query.lang),
          pop: Math.max(0, Math.min(100, Math.round(pop))),
          windSpeed,
          apparentTemperature: finiteInRangeAt(raw.apparent_temperature, index, -100, 100),
          humidity: finiteInRangeAt(raw.relative_humidity_2m, index, 0, 100),
          precipitationMm: finiteInRangeAt(raw.precipitation, index, 0),
          windGust: finiteInRangeAt(raw.wind_gusts_10m, index, 0),
          uvIndex: finiteInRangeAt(raw.uv_index, index, 0),
          visibility: finiteInRangeAt(raw.visibility, index, 0),
          weatherCode: code,
        });
      }
      if (hourly.length === 0) {
        throw new AppError(502, "EMPTY_HOURLY_PROVIDER_RESPONSE", "Saatlik tahmin verisi şu anda kullanılamıyor.");
      }
      const hasHourlyGap = hourly.some((item, index) => {
        if (index === 0) return false;
        return new Date(item.time).getTime() - new Date(hourly[index - 1].time).getTime() !== ONE_HOUR_MS;
      });
      if (hasHourlyGap) {
        throw new AppError(
          502,
          "NON_CONTIGUOUS_HOURLY_PROVIDER_RESPONSE",
          "Saatlik tahmin verisi şu anda kesintisiz kullanılamıyor.",
        );
      }

      const dailyRaw = parsed.data.daily;
      const daily: NonNullable<HourlyForecastProviderResult["daily"]> = [];
      if (dailyRaw) {
        const dailyLength = Math.min(
          dailyRaw.time.length,
          dailyRaw.temperature_2m_max.length,
          dailyRaw.temperature_2m_min.length,
          dailyRaw.weather_code.length,
          dailyRaw.precipitation_probability_max.length,
        );
        for (let index = 0; index < dailyLength; index += 1) {
          const tempMax = dailyRaw.temperature_2m_max[index];
          const tempMin = dailyRaw.temperature_2m_min[index];
          const code = dailyRaw.weather_code[index];
          const pop = dailyRaw.precipitation_probability_max[index];
          if (tempMax === null || tempMin === null || code === null || pop === null) continue;
          if (
            !isPlausibleCelsius(tempMin) ||
            !isPlausibleCelsius(tempMax) ||
            tempMin > tempMax ||
            pop < 0 ||
            pop > 100
          ) {
            continue;
          }
          const localDate = new Date(
            (dailyRaw.time[index] + parsed.data.utc_offset_seconds) * 1_000,
          )
            .toISOString()
            .slice(0, 10);
          daily.push({
            date: localDate,
            tempMin: Math.round(tempMin * 10) / 10,
            tempMax: Math.round(tempMax * 10) / 10,
            icon: iconForCode(code, true),
            description: descriptionForCode(code, query.lang),
            pop: Math.max(0, Math.min(100, Math.round(pop))),
            precipitationMm: finiteInRangeAt(dailyRaw.precipitation_sum, index, 0),
          });
        }
      }

      return {
        timezoneOffsetSeconds: parsed.data.utc_offset_seconds,
        ...(daily.length ? { daily } : {}),
        hourly,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (controller.signal.aborted) {
        throw new AppError(504, "HOURLY_PROVIDER_TIMEOUT", "Saatlik tahmin sağlayıcısı zaman aşımına uğradı.");
      }
      throw new AppError(502, "HOURLY_PROVIDER_ERROR", "Saatlik tahmin sağlayıcısına ulaşılamadı.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
