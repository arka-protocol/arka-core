/**
 * Redis Cache Implementation
 *
 * Redis-based cache for distributed caching.
 * Requires ioredis as a peer dependency.
 */

import type { CacheClient, CacheOptions, CacheStats, CacheSerializer } from './types.js';
import { jsonSerializer } from './types.js';

export interface RedisCacheOptions {
  /** Redis connection URL or options */
  connection: string | RedisConnectionOptions;
  /** Default TTL in seconds */
  defaultTtl?: number;
  /** Namespace prefix for all keys */
  namespace?: string;
  /** Custom serializer */
  serializer?: CacheSerializer;
  /** Retry attempts for connection */
  maxRetries?: number;
  /** Retry delay in ms */
  retryDelay?: number;
}

export interface RedisConnectionOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  tls?: boolean;
  keyPrefix?: string;
}

// Type for Redis client (ioredis compatible)
export interface RedisClientInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  keys(pattern: string): Promise<string[]>;
  flushdb(): Promise<string>;
  quit(): Promise<string>;
  info(section?: string): Promise<string>;
  ping(): Promise<string>;
  on(event: string, callback: (...args: unknown[]) => void): void;
}

/**
 * Redis Cache Implementation
 *
 * Note: This requires ioredis to be installed as a peer dependency.
 * The class accepts a Redis client instance to maintain flexibility.
 */
export class RedisCache implements CacheClient {
  private client: RedisClientInterface;
  private readonly namespace: string;
  private readonly defaultTtl: number;
  private readonly serializer: CacheSerializer;

  private hits = 0;
  private misses = 0;
  private sets = 0;
  private deletes = 0;

  constructor(client: RedisClientInterface, options: Omit<RedisCacheOptions, 'connection'> = {}) {
    this.client = client;
    this.namespace = options.namespace ?? '';
    this.defaultTtl = options.defaultTtl ?? 0;
    this.serializer = options.serializer ?? jsonSerializer;
  }

  private getFullKey(key: string): string {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }

  private getTagKey(tag: string): string {
    return `${this.namespace ? `${this.namespace}:` : ''}__tag:${tag}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);
    const data = await this.client.get(fullKey);

    if (data === null) {
      this.misses++;
      return null;
    }

    this.hits++;
    try {
      return this.serializer.deserialize<T>(data);
    } catch {
      // Invalid data, treat as miss
      this.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.getFullKey(key);
    const ttl = options?.ttl ?? this.defaultTtl;
    const serialized = this.serializer.serialize(value);

    if (ttl > 0) {
      await this.client.setex(fullKey, ttl, serialized);
    } else {
      await this.client.set(fullKey, serialized);
    }

    this.sets++;

    // Handle tags (store in Redis sets)
    if (options?.tags && options.tags.length > 0) {
      // Store the tags with the key for later retrieval
      const tagData = { __tags: options.tags, __value: value };
      const tagSerialized = this.serializer.serialize(tagData);

      if (ttl > 0) {
        await this.client.setex(fullKey, ttl, tagSerialized);
      } else {
        await this.client.set(fullKey, tagSerialized);
      }

      // Add key to each tag's set using a Lua-like approach
      // In production, you'd use Redis SADD or a separate index
    }
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const result = await this.client.del(fullKey);
    if (result > 0) {
      this.deletes++;
      return true;
    }
    return false;
  }

  async has(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const result = await this.client.exists(fullKey);
    return result > 0;
  }

  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const fullKeys = keys.map(k => this.getFullKey(k));
    const results = await this.client.mget(...fullKeys);

    const map = new Map<string, T | null>();
    keys.forEach((key, index) => {
      const data = results[index];
      if (data === null || data === undefined) {
        this.misses++;
        map.set(key, null);
      } else {
        this.hits++;
        try {
          map.set(key, this.serializer.deserialize<T>(data));
        } catch {
          map.set(key, null);
        }
      }
    });

    return map;
  }

  async mset<T>(entries: Map<string, T>, options?: CacheOptions): Promise<void> {
    // Use pipeline for better performance in production
    for (const [key, value] of entries) {
      await this.set(key, value, options);
    }
  }

  async mdelete(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    const fullKeys = keys.map(k => this.getFullKey(k));
    const result = await this.client.del(...fullKeys);
    this.deletes += result;
    return result;
  }

  async clear(): Promise<void> {
    if (this.namespace) {
      // Only clear keys in our namespace
      const pattern = `${this.namespace}:*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } else {
      // Clear entire DB (use with caution!)
      await this.client.flushdb();
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    // In a production implementation, you would:
    // 1. Maintain a Redis SET for each tag containing all keys with that tag
    // 2. Use SMEMBERS to get all keys for the tag
    // 3. Delete all those keys
    // 4. Delete the tag set itself

    // Simplified implementation - scan for keys
    const tagKey = this.getTagKey(tag);
    const keys = await this.client.keys(`${this.namespace}:*`);

    let count = 0;
    for (const key of keys) {
      const data = await this.client.get(key);
      if (data) {
        try {
          const parsed = this.serializer.deserialize<{ __tags?: string[] }>(data);
          if (parsed.__tags?.includes(tag)) {
            await this.client.del(key);
            count++;
          }
        } catch {
          // Skip invalid entries
        }
      }
    }

    return count;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      deletes: this.deletes,
      size: -1, // Would need to call DBSIZE
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  async close(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Health check - verify Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get Redis info
   */
  async getInfo(): Promise<string> {
    return this.client.info();
  }
}

/**
 * Create a Redis cache with an existing client
 */
export function createRedisCache(
  client: RedisClientInterface,
  options?: Omit<RedisCacheOptions, 'connection'>
): RedisCache {
  return new RedisCache(client, options);
}

/**
 * Connection string parser for Redis URL
 */
export function parseRedisUrl(url: string): RedisConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) : 0,
    tls: parsed.protocol === 'rediss:',
  };
}
