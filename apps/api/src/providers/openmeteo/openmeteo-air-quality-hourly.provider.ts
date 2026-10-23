import { z } from "zod";
import { AppError } from "../../core/errors";
import { HOURLY_FORECAST_HOURS } from "../../modules/weather/contracts";
import type {
  AirQualityHourlyProvider,
  AirQualityHourlyProviderResult,
  CoordinateQuery,
} from "../weather-provider";

// `Date` accepts timestamps only within ±8.64e15 milliseconds. Open-Meteo uses Unix seconds;
// reject impossible provider timestamps at schema validation instead of throwing in toISOString.
const MAX_DATE_UNIX_SECONDS = 8_640_000_000_000;
const providerTimestampSchema = z.number().int().nonnegative().max(MAX_DATE_UNIX_SECONDS);
const optionalSeries = z.array(z.number().nullable()).optional();

const airQualityHourlySchema = z.object({
  hourly: z.object({
    time: z.array(providerTimestampSchema),
    european_aqi: optionalSeries,
    pm2_5: optionalSeries,
  }),
});

const finiteNonNegative = (value: number | null | undefined): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;

const finiteNonNegativeAtMost = (
  value: number | null | undefined,
  max: number,
): number | undefined => {
  const normalized = finiteNonNegative(value);
  return normalized !== undefined && normalized <= max ? normalized : undefined;
};

/**
 * Plan v3 (P1.2): hourly European AQI and PM2.5 from the Open-Meteo air-quality API for the
 * five-day plan horizon. Hours without a modelled value are omitted (the tail of the forecast
 * is often null); the client falls back to the current OpenWeather AQI for those hours.
 */
export class OpenMeteoAirQualityHourlyProvider implements AirQualityHourlyProvider {
  readonly name = "Open-Meteo";
  readonly attribution = "Open-Meteo · CC BY 4.0 · CAMS";
  readonly sourceUrl = "https://open-meteo.com/en/docs/air-quality-api";

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 8_000,
    private readonly baseUrl = "https://air-quality-api.open-meteo.com",
    private readonly apiKey?: string,
  ) {}

  async getAirQualityHourly(query: CoordinateQuery): Promise<AirQualityHourlyProviderResult> {
    const url = new URL("/v1/air-quality", this.baseUrl);
    url.searchParams.set("latitude", String(query.lat));
    url.searchParams.set("longitude", String(query.lon));
    url.searchParams.set("hourly", "european_aqi,pm2_5");
    url.searchParams.set("forecast_hours", String(HOURLY_FORECAST_HOURS));
    url.searchParams.set("timeformat", "unixtime");
    url.searchParams.set("timezone", "GMT");
    if (this.apiKey) url.searchParams.set("apikey", this.apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AppError(502, "AIR_QUALITY_HOURLY_PROVIDER_ERROR", "Saatlik hava kalitesi sağlayıcısı yanıt vermedi.");
      }
      const parsed = airQualityHourlySchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new AppError(
          502,
          "INVALID_AIR_QUALITY_HOURLY_PROVIDER_RESPONSE",
          "Saatlik hava kalitesi sağlayıcısı beklenmeyen bir cevap döndürdü.",
        );
      }
      const raw = parsed.data.hourly;
      const length = raw.time.length;
      if (
        [raw.european_aqi, raw.pm2_5].some(series => series !== undefined && series.length !== length) ||
        raw.time.some((time, index) => index > 0 && time <= raw.time[index - 1])
      ) {
        throw new AppError(
          502,
          "INVALID_AIR_QUALITY_HOURLY_PROVIDER_RESPONSE",
          "Saatlik hava kalitesi sağlayıcısı tutarsız veri serileri döndürdü.",
        );
      }

      const hourly: AirQualityHourlyProviderResult["hourly"] = [];
      for (let index = 0; index < length; index += 1) {
        // Open-Meteo defines European AQI as an open-ended scale (>100 is extremely poor) and
        // publishes no upper bound. Do not silently drop a severe value at an arbitrary ceiling.
        const europeanAqi = finiteNonNegative(raw.european_aqi?.[index]);
        const pm25 = finiteNonNegativeAtMost(raw.pm2_5?.[index], 2_000);
        if (europeanAqi === undefined) continue;
        hourly.push({
          time: new Date(raw.time[index] * 1_000).toISOString(),
          europeanAqi: Math.round(europeanAqi),
          ...(pm25 === undefined ? {} : { pm25: Math.round(pm25 * 10) / 10 }),
        });
      }
      if (hourly.length === 0) {
        throw new AppError(
          502,
          "EMPTY_AIR_QUALITY_HOURLY_PROVIDER_RESPONSE",
          "Saatlik hava kalitesi verisi şu anda kullanılamıyor.",
        );
      }
      return { hourly };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (controller.signal.aborted) {
        throw new AppError(504, "AIR_QUALITY_HOURLY_PROVIDER_TIMEOUT", "Saatlik hava kalitesi sağlayıcısı zaman aşımına uğradı.");
      }
      throw new AppError(502, "AIR_QUALITY_HOURLY_PROVIDER_ERROR", "Saatlik hava kalitesi sağlayıcısına ulaşılamadı.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
