/**
 * Cache Types
 *
 * Common types for caching implementations.
 */

export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Namespace/prefix for keys */
  namespace?: string;
  /** Tags for cache invalidation */
  tags?: string[];
}

export interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
  tags?: string[];
  createdAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  hitRate: number;
}

export interface CacheClient {
  /** Get a value from cache */
  get<T>(key: string): Promise<T | null>;

  /** Set a value in cache */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;

  /** Delete a value from cache */
  delete(key: string): Promise<boolean>;

  /** Check if key exists */
  has(key: string): Promise<boolean>;

  /** Get multiple values */
  mget<T>(keys: string[]): Promise<Map<string, T | null>>;

  /** Set multiple values */
  mset<T>(entries: Map<string, T>, options?: CacheOptions): Promise<void>;

  /** Delete multiple values */
  mdelete(keys: string[]): Promise<number>;

  /** Clear all cache */
  clear(): Promise<void>;

  /** Get cache statistics */
  getStats(): CacheStats;

  /** Invalidate by tag */
  invalidateByTag(tag: string): Promise<number>;

  /** Close connection */
  close(): Promise<void>;
}

export type CacheSerializer = {
  serialize: (value: unknown) => string;
  deserialize: <T>(data: string) => T;
};

export const jsonSerializer: CacheSerializer = {
  serialize: (value) => JSON.stringify(value),
  deserialize: <T>(data: string) => JSON.parse(data) as T,
};
