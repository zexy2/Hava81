export type CacheStatus = 'HIT' | 'MISS' | 'COALESCED';

export interface CacheResult<T> {
  value: T;
  status: CacheStatus;
}

export interface AsyncCache {
  getOrLoad<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<CacheResult<T>>;
  clear(): void;
  readonly size: number;
  readonly inFlightSize: number;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export class MemoryTtlCache implements AsyncCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  get size(): number {
    this.pruneExpired();
    return this.entries.size;
  }

  get inFlightSize(): number {
    return this.inFlight.size;
  }

  async getOrLoad<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<CacheResult<T>> {
    const cached = this.entries.get(key);

    if (cached && cached.expiresAt > this.now()) {
      return { value: cached.value as T, status: 'HIT' };
    }

    if (cached) {
      this.entries.delete(key);
    }

    const pending = this.inFlight.get(key);
    if (pending) {
      return { value: (await pending) as T, status: 'COALESCED' };
    }

    const loadPromise = loader()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, loadPromise);
    return { value: await loadPromise, status: 'MISS' };
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }

  private set(key: string, value: unknown, ttlMs: number): void {
    this.pruneExpired();

    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}
