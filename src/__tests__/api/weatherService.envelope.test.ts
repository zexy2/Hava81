import { vi, type Mock } from "vitest";
import { httpClient } from "../../api/httpClient";
import { weatherService } from "../../api/weatherService";
import { ErrorCode } from "../../types";

vi.mock("../../api/httpClient", () => ({
  httpClient: { get: vi.fn() },
}));

const mockGet = httpClient.get as Mock;

const forecastMeta = {
  provider: "OpenWeather",
  fetchedAt: "2026-07-14T12:00:01.000Z",
  timezoneOffsetSeconds: 10800,
  intervalHours: 3,
};

const hourlyMeta = {
  provider: "Open-Meteo",
  fetchedAt: "2026-08-28T17:00:00.000Z",
  timezoneOffsetSeconds: 10800,
  intervalHours: 1,
};

describe("weatherService forecast envelope validation", () => {
  beforeEach(() => mockGet.mockReset());

  it.each([
    ["null envelope", null, "forecast"],
    ["missing metadata", { daily: [], hourly: [] }, "forecast.meta"],
    ["non-array daily", { daily: {}, hourly: [], meta: forecastMeta }, "forecast.daily"],
    ["non-array hourly", { daily: [], hourly: null, meta: forecastMeta }, "forecast.hourly"],
  ])("rejects malformed forecast container: %s", async (_label, payload, field) => {
    mockGet.mockResolvedValue(payload);

    await expect(weatherService.getForecast(38.42, 27.14)).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
      details: { field },
    });
  });

  it.each([
    ["null daily item", { daily: [null], hourly: [], meta: forecastMeta }, "forecast.daily.0"],
    ["null hourly item", { daily: [], hourly: [null], meta: forecastMeta }, "forecast.hourly.0"],
  ])("rejects malformed forecast item: %s", async (_label, payload, field) => {
    mockGet.mockResolvedValue(payload);

    await expect(weatherService.getForecast(38.42, 27.14)).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
      details: { field },
    });
  });

  it.each([
    ["null envelope", null, "hourly"],
    ["missing metadata", { hourly: [] }, "hourly.meta"],
    ["non-array optional daily", { daily: {}, hourly: [], meta: hourlyMeta }, "hourly.daily"],
    ["non-array hourly", { hourly: {}, meta: hourlyMeta }, "hourly.hourly"],
  ])("rejects malformed one-hour forecast container: %s", async (_label, payload, field) => {
    mockGet.mockResolvedValue(payload);

    await expect(weatherService.getHourlyForecast(41.01, 28.97, "tr")).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
      details: { field },
    });
  });

  it.each([
    ["null daily item", { daily: [null], hourly: [], meta: hourlyMeta }, "hourly.daily.0"],
    ["null hourly item", { hourly: [null], meta: hourlyMeta }, "hourly.hourly.0"],
  ])("rejects malformed one-hour forecast item: %s", async (_label, payload, field) => {
    mockGet.mockResolvedValue(payload);

    await expect(weatherService.getHourlyForecast(41.01, 28.97, "tr")).rejects.toMatchObject({
      code: ErrorCode.API_ERROR,
      retryable: true,
      details: { field },
    });
  });
});