import type { AsyncCache, CacheResult } from './cache';
import { AppError } from './errors';

/**
 * Tüm upstream (OpenWeather / Open-Meteo) çağrıları için süreç genelinde
 * kayan pencereli limit. Cache'te olmayan her yükleme bir hak tüketir.
 */
export class UpstreamBudget {
  private readonly calls: number[] = [];

  constructor(
    private readonly maxPerWindow: number,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  take(): void {
    const now = this.now();
    while (this.calls.length > 0 && (this.calls[0] as number) <= now - this.windowMs) {
      this.calls.shift();
    }
    if (this.calls.length >= this.maxPerWindow) {
      throw new AppError(
        503,
        'UPSTREAM_BUDGET_EXHAUSTED',
        'Hava durumu sağlayıcısına istek sınırına ulaşıldı. Lütfen biraz sonra tekrar deneyin.',
      );
    }
    this.calls.push(now);
  }

  get used(): number {
    return this.calls.length;
  }
}

/** Cache'i sarar: yalnızca cache kaçırıldığında (loader çalıştığında) bütçeden düşer. */
export const withUpstreamBudget = (cache: AsyncCache, budget: UpstreamBudget): AsyncCache => ({
  getOrLoad<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<CacheResult<T>> {
    return cache.getOrLoad(key, ttlMs, () => {
      budget.take();
      return loader();
    });
  },
  clear: () => cache.clear(),
  get size() {
    return cache.size;
  },
  get inFlightSize() {
    return cache.inFlightSize;
  },
});
