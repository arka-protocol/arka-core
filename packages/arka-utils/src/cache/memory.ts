/**
 * In-Memory Cache Implementation
 *
 * Simple in-memory cache with TTL support.
 * Useful for development and single-instance deployments.
 */

import type { CacheClient, CacheOptions, CacheEntry, CacheStats } from './types.js';

export interface MemoryCacheOptions {
  /** Default TTL in seconds (0 = no expiry) */
  defaultTtl?: number;
  /** Maximum number of entries */
  maxSize?: number;
  /** Check interval for expired entries in ms */
  checkInterval?: number;
  /** Namespace prefix for all keys */
  namespace?: string;
  /** Callback when item is evicted */
  onEvict?: (key: string, reason: 'expired' | 'lru') => void;
}

export class MemoryCache implements CacheClient {
  private cache = new Map<string, CacheEntry<unknown>>();
  private tagIndex = new Map<string, Set<string>>();
  private accessOrder: string[] = [];
  private cleanupInterval?: ReturnType<typeof setInterval>;

  private hits = 0;
  private misses = 0;
  private sets = 0;
  private deletes = 0;

  private readonly options: Required<MemoryCacheOptions>;

  constructor(options: MemoryCacheOptions = {}) {
    this.options = {
      defaultTtl: options.defaultTtl ?? 0,
      maxSize: options.maxSize ?? 10000,
      checkInterval: options.checkInterval ?? 60000,
      namespace: options.namespace ?? '',
      onEvict: options.onEvict ?? (() => {}),
    };

    // Start cleanup interval
    if (this.options.checkInterval > 0) {
      this.cleanupInterval = setInterval(
        () => this.cleanup(),
        this.options.checkInterval
      );
    }
  }

  private getFullKey(key: string): string {
    return this.options.namespace ? `${this.options.namespace}:${key}` : key;
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(fullKey);
      this.removeFromAccessOrder(fullKey);
      this.misses++;
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(fullKey);
    this.hits++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.getFullKey(key);
    const ttl = options?.ttl ?? this.options.defaultTtl;

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : undefined,
      tags: options?.tags,
    };

    // Evict if at capacity
    while (this.cache.size >= this.options.maxSize) {
      this.evictLRU();
    }

    // Remove old entry from tag index
    const oldEntry = this.cache.get(fullKey);
    if (oldEntry?.tags) {
      for (const tag of oldEntry.tags) {
        this.tagIndex.get(tag)?.delete(fullKey);
      }
    }

    // Set new entry
    this.cache.set(fullKey, entry);
    this.sets++;

    // Update tag index
    if (entry.tags) {
      for (const tag of entry.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(fullKey);
      }
    }

    // Update access order
    this.updateAccessOrder(fullKey);
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return false;
    }

    // Remove from tag index
    if (entry.tags) {
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(fullKey);
      }
    }

    this.cache.delete(fullKey);
    this.removeFromAccessOrder(fullKey);
    this.deletes++;
    return true;
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    for (const key of keys) {
      results.set(key, await this.get<T>(key));
    }
    return results;
  }

  async mset<T>(entries: Map<string, T>, options?: CacheOptions): Promise<void> {
    for (const [key, value] of entries) {
      await this.set(key, value, options);
    }
  }

  async mdelete(keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (await this.delete(key)) {
        count++;
      }
    }
    return count;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.tagIndex.clear();
    this.accessOrder = [];
  }

  async invalidateByTag(tag: string): Promise<number> {
    const keys = this.tagIndex.get(tag);
    if (!keys || keys.size === 0) {
      return 0;
    }

    let count = 0;
    for (const key of keys) {
      const entry = this.cache.get(key);
      if (entry?.tags) {
        for (const t of entry.tags) {
          this.tagIndex.get(t)?.delete(key);
        }
      }
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      count++;
    }

    this.tagIndex.delete(tag);
    return count;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      deletes: this.deletes,
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    await this.clear();
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    const oldestKey = this.accessOrder.shift()!;
    const entry = this.cache.get(oldestKey);

    if (entry?.tags) {
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(oldestKey);
      }
    }

    this.cache.delete(oldestKey);
    this.options.onEvict(oldestKey, 'lru');
  }

  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && entry.expiresAt < now) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      const entry = this.cache.get(key);
      if (entry?.tags) {
        for (const tag of entry.tags) {
          this.tagIndex.get(tag)?.delete(key);
        }
      }
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.options.onEvict(key, 'expired');
    }
  }
}

/**
 * Create an in-memory cache
 */
export function createMemoryCache(options?: MemoryCacheOptions): MemoryCache {
  return new MemoryCache(options);
}
