import { AppError } from './errors';
import type {
  AirQualityQuery,
  CurrentWeatherQuery,
  ForecastQuery,
  WeatherProvider,
} from '../providers/weather-provider';
import type {
  AirQualityUpstream,
  CurrentWeatherUpstream,
  ForecastUpstream,
} from '../providers/openweather/schemas';

export interface ProviderResilienceConfig {
  retryCount: number;
  failureThreshold: number;
  resetMs: number;
}

export interface ProviderHealthSnapshot {
  name: string;
  state: 'closed' | 'open' | 'half-open';
  consecutiveFailures: number;
  fallbackConfigured: boolean;
  lastFailureAt: string | null;
}

export class ResilientWeatherProvider implements WeatherProvider {
  readonly name: string;
  private consecutiveFailures = 0;
  private openedAt = 0;
  private lastFailureAt: Date | null = null;

  constructor(
    private readonly primary: WeatherProvider,
    private readonly fallback: WeatherProvider | undefined,
    private readonly config: ProviderResilienceConfig,
  ) {
    this.name = fallback
      ? `${primary.name ?? 'primary'} + ${fallback.name ?? 'fallback'}`
      : primary.name ?? 'weather-provider';
  }

  getCurrent(query: CurrentWeatherQuery): Promise<CurrentWeatherUpstream> {
    return this.execute((provider) => provider.getCurrent(query));
  }

  getForecast(query: ForecastQuery): Promise<ForecastUpstream> {
    return this.execute((provider) => provider.getForecast(query));
  }

  getAirQuality(query: AirQualityQuery): Promise<AirQualityUpstream> {
    return this.execute((provider) => provider.getAirQuality(query));
  }

  getHealth(): ProviderHealthSnapshot {
    const now = Date.now();
    const isOpen = this.openedAt > 0 && now - this.openedAt < this.config.resetMs;
    const isHalfOpen = this.openedAt > 0 && !isOpen;
    return {
      name: this.name,
      state: isOpen ? 'open' : isHalfOpen ? 'half-open' : 'closed',
      consecutiveFailures: this.consecutiveFailures,
      fallbackConfigured: Boolean(this.fallback),
      lastFailureAt: this.lastFailureAt?.toISOString() ?? null,
    };
  }

  private async execute<T>(operation: (provider: WeatherProvider) => Promise<T>): Promise<T> {
    const now = Date.now();
    if (this.openedAt && now - this.openedAt < this.config.resetMs) {
      if (this.fallback) return operation(this.fallback);
      throw new AppError(503, 'PROVIDER_CIRCUIT_OPEN', 'Hava durumu sağlayıcısı geçici olarak devre dışı.');
    }

    if (this.openedAt && now - this.openedAt >= this.config.resetMs) {
      this.openedAt = 0;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.retryCount; attempt += 1) {
      try {
        const result = await operation(this.primary);
        this.consecutiveFailures = 0;
        this.openedAt = 0;
        return result;
      } catch (error) {
        lastError = error;
        const retryable = error instanceof AppError ? error.statusCode >= 500 : true;
        if (!retryable) throw error;
        if (attempt < this.config.retryCount) {
          await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
        }
      }
    }

    this.recordFailure();
    if (this.fallback) {
      try {
        return await operation(this.fallback);
      } catch (fallbackError) {
        lastError = fallbackError;
      }
    }
    throw lastError;
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    this.lastFailureAt = new Date();
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.openedAt = Date.now();
    }
  }
}
