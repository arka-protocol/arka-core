/**
 * Caching Strategies
 *
 * Higher-level caching patterns built on top of cache clients.
 */

import type { CacheClient, CacheOptions } from './types.js';

/**
 * Cache-aside (Lazy Loading) pattern
 *
 * 1. Check cache
 * 2. If miss, load from source
 * 3. Store in cache
 * 4. Return value
 */
export async function cacheAside<T>(
  cache: CacheClient,
  key: string,
  loader: () => Promise<T>,
  options?: CacheOptions
): Promise<T> {
  // Try cache first
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Load from source
  const value = await loader();

  // Store in cache (don't await to avoid blocking)
  cache.set(key, value, options).catch(() => {
    // Ignore cache write errors
  });

  return value;
}

/**
 * Write-through pattern
 *
 * 1. Write to cache and source simultaneously
 * 2. Return when both complete
 */
export async function writeThrough<T>(
  cache: CacheClient,
  key: string,
  value: T,
  writer: (value: T) => Promise<void>,
  options?: CacheOptions
): Promise<void> {
  await Promise.all([
    cache.set(key, value, options),
    writer(value),
  ]);
}

/**
 * Write-behind (Write-back) pattern
 *
 * 1. Write to cache immediately
 * 2. Queue write to source (async)
 */
export async function writeBehind<T>(
  cache: CacheClient,
  key: string,
  value: T,
  writer: (value: T) => Promise<void>,
  options?: CacheOptions
): Promise<void> {
  // Write to cache immediately
  await cache.set(key, value, options);

  // Queue async write to source
  writer(value).catch(() => {
    // Log error but don't fail
    // In production, implement retry queue
  });
}

/**
 * Read-through pattern with stale-while-revalidate
 *
 * Returns stale data while refreshing in background
 */
export interface StaleWhileRevalidateOptions extends CacheOptions {
  /** How long before data is considered stale (seconds) */
  staleAfter: number;
  /** Maximum age before data must be refreshed (seconds) */
  maxAge: number;
}

export interface CachedValue<T> {
  value: T;
  cachedAt: number;
}

export async function staleWhileRevalidate<T>(
  cache: CacheClient,
  key: string,
  loader: () => Promise<T>,
  options: StaleWhileRevalidateOptions
): Promise<T> {
  const cached = await cache.get<CachedValue<T>>(key);
  const now = Date.now();

  if (cached !== null) {
    const age = (now - cached.cachedAt) / 1000;

    // Data is fresh
    if (age < options.staleAfter) {
      return cached.value;
    }

    // Data is stale but within max age - revalidate in background
    if (age < options.maxAge) {
      // Background refresh
      loader().then((value) => {
        cache.set(key, { value, cachedAt: Date.now() }, { ttl: options.maxAge });
      }).catch(() => {});

      return cached.value;
    }
  }

  // No cache or expired - load fresh
  const value = await loader();
  await cache.set(key, { value, cachedAt: now }, { ttl: options.maxAge });
  return value;
}

/**
 * Multi-tier caching
 *
 * Check multiple cache levels in order
 */
export class TieredCache implements CacheClient {
  private tiers: CacheClient[];
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private deletes = 0;

  constructor(tiers: CacheClient[]) {
    if (tiers.length === 0) {
      throw new Error('At least one cache tier required');
    }
    this.tiers = tiers;
  }

  async get<T>(key: string): Promise<T | null> {
    for (let i = 0; i < this.tiers.length; i++) {
      const tier = this.tiers[i];
      if (!tier) continue;

      const value = await tier.get<T>(key);
      if (value !== null) {
        this.hits++;

        // Populate upper tiers
        for (let j = 0; j < i; j++) {
          const upperTier = this.tiers[j];
          if (upperTier) {
            upperTier.set(key, value).catch(() => {});
          }
        }

        return value;
      }
    }

    this.misses++;
    return null;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    this.sets++;
    await Promise.all(
      this.tiers.map(tier => tier.set(key, value, options))
    );
  }

  async delete(key: string): Promise<boolean> {
    this.deletes++;
    const results = await Promise.all(
      this.tiers.map(tier => tier.delete(key))
    );
    return results.some(r => r);
  }

  async has(key: string): Promise<boolean> {
    for (const tier of this.tiers) {
      if (await tier.has(key)) {
        return true;
      }
    }
    return false;
  }

  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    const remaining = [...keys];

    for (const tier of this.tiers) {
      if (remaining.length === 0) break;

      const tierResults = await tier.mget<T>(remaining);
      const foundKeys: string[] = [];

      for (const [key, value] of tierResults) {
        if (value !== null) {
          result.set(key, value);
          foundKeys.push(key);
        }
      }

      // Remove found keys from remaining
      for (const key of foundKeys) {
        const index = remaining.indexOf(key);
        if (index !== -1) {
          remaining.splice(index, 1);
        }
      }
    }

    // Set null for not found
    for (const key of remaining) {
      result.set(key, null);
    }

    return result;
  }

  async mset<T>(entries: Map<string, T>, options?: CacheOptions): Promise<void> {
    await Promise.all(
      this.tiers.map(tier => tier.mset(entries, options))
    );
  }

  async mdelete(keys: string[]): Promise<number> {
    const results = await Promise.all(
      this.tiers.map(tier => tier.mdelete(keys))
    );
    return Math.max(...results);
  }

  async clear(): Promise<void> {
    await Promise.all(this.tiers.map(tier => tier.clear()));
  }

  async invalidateByTag(tag: string): Promise<number> {
    const results = await Promise.all(
      this.tiers.map(tier => tier.invalidateByTag(tag))
    );
    return Math.max(...results);
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      deletes: this.deletes,
      size: -1,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  async close(): Promise<void> {
    await Promise.all(this.tiers.map(tier => tier.close()));
  }
}

/**
 * Memoization decorator with cache
 */
export function memoize<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  cache: CacheClient,
  keyGenerator: (...args: TArgs) => string,
  options?: CacheOptions
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const key = keyGenerator(...args);
    return cacheAside(cache, key, () => fn(...args), options);
  };
}

/**
 * Cache key builder utility
 */
export class CacheKeyBuilder {
  private parts: string[] = [];

  constructor(prefix?: string) {
    if (prefix) {
      this.parts.push(prefix);
    }
  }

  add(value: string | number | boolean | null | undefined): this {
    if (value !== null && value !== undefined) {
      this.parts.push(String(value));
    }
    return this;
  }

  addObject(obj: Record<string, unknown>): this {
    // Sort keys for consistency
    const sorted = Object.keys(obj).sort();
    for (const key of sorted) {
      const value = obj[key];
      if (value !== null && value !== undefined) {
        this.parts.push(`${key}=${String(value)}`);
      }
    }
    return this;
  }

  build(separator = ':'): string {
    return this.parts.join(separator);
  }
}

/**
 * Create a cache key builder
 */
export function cacheKey(prefix?: string): CacheKeyBuilder {
  return new CacheKeyBuilder(prefix);
}
