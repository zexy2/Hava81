import { afterEach, describe, expect, it, vi } from "vitest";

describe("browser environment config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("normalizes supported public Vite settings", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "  https://api.example.test/api/v1  ");
    vi.stubEnv("VITE_CACHE_TTL", "600000");
    vi.stubEnv("VITE_MAX_RETRIES", "5");
    vi.stubEnv("VITE_ENABLE_ANALYTICS", "true");

    const { config } = await import("../config/env.config");

    expect(config.api.baseUrl).toBe("https://api.example.test/api/v1");
    expect(config.api.maxRetries).toBe(5);
    expect(config.cache.ttl).toBe(600000);
    expect(config.features.enableAnalytics).toBe(true);
  });

  it("falls back safely for invalid numeric settings", async () => {
    vi.stubEnv("VITE_CACHE_TTL", "-1");
    vi.stubEnv("VITE_MAX_RETRIES", "not-a-number");
    vi.stubEnv("VITE_ENABLE_ANALYTICS", "yes");

    const { config } = await import("../config/env.config");

    expect(config.cache.ttl).toBe(300000);
    expect(config.api.maxRetries).toBe(3);
    expect(config.features.enableAnalytics).toBe(false);
  });
});
