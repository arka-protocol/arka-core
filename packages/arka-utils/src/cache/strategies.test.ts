/**
 * Cache Strategies Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryCache, createMemoryCache } from './memory.js';
import {
  cacheAside,
  writeThrough,
  writeBehind,
  staleWhileRevalidate,
  TieredCache,
  memoize,
  cacheKey,
  CacheKeyBuilder,
} from './strategies.js';

describe('Cache Strategies', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = createMemoryCache({ checkInterval: 0 });
  });

  afterEach(async () => {
    await cache.close();
  });

  describe('cacheAside', () => {
    it('should return cached value on hit', async () => {
      await cache.set('key1', 'cached-value');
      const loader = vi.fn().mockResolvedValue('loaded-value');

      const result = await cacheAside(cache, 'key1', loader);

      expect(result).toBe('cached-value');
      expect(loader).not.toHaveBeenCalled();
    });

    it('should load and cache on miss', async () => {
      const loader = vi.fn().mockResolvedValue('loaded-value');

      const result = await cacheAside(cache, 'key1', loader);

      expect(result).toBe('loaded-value');
      expect(loader).toHaveBeenCalledOnce();

      // Wait for async cache write
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(await cache.get('key1')).toBe('loaded-value');
    });

    it('should use TTL options', async () => {
      vi.useFakeTimers();

      const loader = vi.fn().mockResolvedValue('value');
      await cacheAside(cache, 'key1', loader, { ttl: 1 });

      // Wait for async cache write
      await vi.advanceTimersByTimeAsync(10);
      expect(await cache.get('key1')).toBe('value');

      vi.advanceTimersByTime(1500);
      expect(await cache.get('key1')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('writeThrough', () => {
    it('should write to cache and source simultaneously', async () => {
      const writer = vi.fn().mockResolvedValue(undefined);

      await writeThrough(cache, 'key1', 'value1', writer);

      expect(await cache.get('key1')).toBe('value1');
      expect(writer).toHaveBeenCalledWith('value1');
    });

    it('should fail if either write fails', async () => {
      const writer = vi.fn().mockRejectedValue(new Error('Write failed'));

      await expect(writeThrough(cache, 'key1', 'value1', writer)).rejects.toThrow('Write failed');
    });
  });

  describe('writeBehind', () => {
    it('should write to cache immediately and queue source write', async () => {
      const writer = vi.fn().mockResolvedValue(undefined);

      await writeBehind(cache, 'key1', 'value1', writer);

      // Cache should be written immediately
      expect(await cache.get('key1')).toBe('value1');

      // Wait for async source write
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(writer).toHaveBeenCalledWith('value1');
    });

    it('should not fail if source write fails', async () => {
      const writer = vi.fn().mockRejectedValue(new Error('Source error'));

      await expect(writeBehind(cache, 'key1', 'value1', writer)).resolves.not.toThrow();
      expect(await cache.get('key1')).toBe('value1');
    });
  });

  describe('staleWhileRevalidate', () => {
    it('should return fresh data when not stale', async () => {
      vi.useFakeTimers();

      const loader = vi.fn().mockResolvedValue('value1');
      const options = { staleAfter: 30, maxAge: 60 };

      // First call loads fresh data
      const result1 = await staleWhileRevalidate(cache, 'key1', loader, options);
      expect(result1).toBe('value1');
      expect(loader).toHaveBeenCalledTimes(1);

      // Second call within stale time returns cached
      vi.advanceTimersByTime(10000); // 10 seconds
      const result2 = await staleWhileRevalidate(cache, 'key1', loader, options);
      expect(result2).toBe('value1');
      expect(loader).toHaveBeenCalledTimes(1); // Not called again

      vi.useRealTimers();
    });

    it('should return stale data and refresh in background', async () => {
      vi.useFakeTimers();

      let loadCount = 0;
      const loader = vi.fn().mockImplementation(async () => {
        loadCount++;
        return `value${loadCount}`;
      });
      const options = { staleAfter: 30, maxAge: 60 };

      // First call
      await staleWhileRevalidate(cache, 'key1', loader, options);

      // Advance past stale time but before max age
      vi.advanceTimersByTime(35000); // 35 seconds

      // Should return stale value immediately and trigger background refresh
      const result = await staleWhileRevalidate(cache, 'key1', loader, options);
      expect(result).toBe('value1'); // Returns stale value
      expect(loader).toHaveBeenCalledTimes(2); // Background refresh triggered

      vi.useRealTimers();
    });

    it('should force refresh when past max age', async () => {
      vi.useFakeTimers();

      let loadCount = 0;
      const loader = vi.fn().mockImplementation(async () => {
        loadCount++;
        return `value${loadCount}`;
      });
      const options = { staleAfter: 30, maxAge: 60 };

      // First call
      await staleWhileRevalidate(cache, 'key1', loader, options);

      // Advance past max age
      vi.advanceTimersByTime(65000); // 65 seconds

      // Should load fresh data
      const result = await staleWhileRevalidate(cache, 'key1', loader, options);
      expect(result).toBe('value2');

      vi.useRealTimers();
    });
  });

  describe('TieredCache', () => {
    let tier1: MemoryCache;
    let tier2: MemoryCache;
    let tieredCache: TieredCache;

    beforeEach(() => {
      tier1 = createMemoryCache({ checkInterval: 0 });
      tier2 = createMemoryCache({ checkInterval: 0 });
      tieredCache = new TieredCache([tier1, tier2]);
    });

    afterEach(async () => {
      await tieredCache.close();
    });

    it('should require at least one tier', () => {
      expect(() => new TieredCache([])).toThrow('At least one cache tier required');
    });

    it('should check tiers in order', async () => {
      await tier2.set('key1', 'from-tier2');

      const result = await tieredCache.get('key1');
      expect(result).toBe('from-tier2');
    });

    it('should populate upper tiers on hit', async () => {
      await tier2.set('key1', 'from-tier2');

      await tieredCache.get('key1');

      // Wait for async population
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(await tier1.get('key1')).toBe('from-tier2');
    });

    it('should write to all tiers', async () => {
      await tieredCache.set('key1', 'value1');

      expect(await tier1.get('key1')).toBe('value1');
      expect(await tier2.get('key1')).toBe('value1');
    });

    it('should delete from all tiers', async () => {
      await tieredCache.set('key1', 'value1');
      await tieredCache.delete('key1');

      expect(await tier1.get('key1')).toBeNull();
      expect(await tier2.get('key1')).toBeNull();
    });

    it('should check existence in any tier', async () => {
      await tier2.set('key1', 'value1');

      expect(await tieredCache.has('key1')).toBe(true);
      expect(await tieredCache.has('nonexistent')).toBe(false);
    });

    it('should track stats', async () => {
      await tieredCache.set('key1', 'value1');
      await tieredCache.get('key1'); // hit
      await tieredCache.get('nonexistent'); // miss
      await tieredCache.delete('key1');

      const stats = tieredCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(1);
    });
  });

  describe('memoize', () => {
    it('should cache function results', async () => {
      const fn = vi.fn().mockImplementation(async (a: number, b: number) => a + b);
      const memoized = memoize(
        fn,
        cache,
        (a, b) => `sum:${a}:${b}`
      );

      const result1 = await memoized(1, 2);
      const result2 = await memoized(1, 2);

      expect(result1).toBe(3);
      expect(result2).toBe(3);
      // Wait for async cache write
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(fn).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should use different cache keys for different args', async () => {
      const fn = vi.fn().mockImplementation(async (x: number) => x * 2);
      const memoized = memoize(fn, cache, (x) => `double:${x}`);

      await memoized(5);
      await memoized(10);

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('CacheKeyBuilder', () => {
    it('should build keys from parts', () => {
      const key = cacheKey('user')
        .add('123')
        .add('profile')
        .build();

      expect(key).toBe('user:123:profile');
    });

    it('should skip null and undefined values', () => {
      const key = cacheKey('data')
        .add('valid')
        .add(null)
        .add(undefined)
        .add('also-valid')
        .build();

      expect(key).toBe('data:valid:also-valid');
    });

    it('should handle objects', () => {
      const key = cacheKey('query')
        .addObject({ page: 1, limit: 10, sort: 'name' })
        .build();

      // Keys are sorted alphabetically
      expect(key).toBe('query:limit=10:page=1:sort=name');
    });

    it('should use custom separator', () => {
      const key = cacheKey('path')
        .add('to')
        .add('resource')
        .build('/');

      expect(key).toBe('path/to/resource');
    });

    it('should work without prefix', () => {
      const key = new CacheKeyBuilder()
        .add('segment1')
        .add('segment2')
        .build();

      expect(key).toBe('segment1:segment2');
    });
  });
});
