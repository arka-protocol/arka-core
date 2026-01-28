/**
 * Memory Cache Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryCache, createMemoryCache } from './memory.js';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = createMemoryCache({
      checkInterval: 0, // Disable auto cleanup for tests
    });
  });

  afterEach(async () => {
    await cache.close();
  });

  describe('basic operations', () => {
    it('should set and get values', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get<string>('key1');
      expect(result).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should delete values', async () => {
      await cache.set('key1', 'value1');
      const deleted = await cache.delete('key1');
      expect(deleted).toBe(true);
      const result = await cache.get('key1');
      expect(result).toBeNull();
    });

    it('should return false when deleting non-existent key', async () => {
      const deleted = await cache.delete('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should check if key exists', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('nonexistent')).toBe(false);
    });

    it('should store complex objects', async () => {
      const obj = { name: 'test', nested: { value: 42 } };
      await cache.set('obj', obj);
      const result = await cache.get<typeof obj>('obj');
      expect(result).toEqual(obj);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      vi.useFakeTimers();

      await cache.set('key1', 'value1', { ttl: 1 }); // 1 second TTL

      // Should exist immediately
      expect(await cache.get('key1')).toBe('value1');

      // Advance time past TTL
      vi.advanceTimersByTime(1500);

      // Should be expired now
      expect(await cache.get('key1')).toBeNull();

      vi.useRealTimers();
    });

    it('should use default TTL when set', async () => {
      vi.useFakeTimers();

      const cacheWithTtl = createMemoryCache({
        defaultTtl: 1,
        checkInterval: 0,
      });

      await cacheWithTtl.set('key1', 'value1');
      expect(await cacheWithTtl.get('key1')).toBe('value1');

      vi.advanceTimersByTime(1500);
      expect(await cacheWithTtl.get('key1')).toBeNull();

      await cacheWithTtl.close();
      vi.useRealTimers();
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entries when at capacity', async () => {
      const smallCache = createMemoryCache({
        maxSize: 3,
        checkInterval: 0,
      });

      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3');

      // Access key1 to make it recent
      await smallCache.get('key1');

      // Add new entry - should evict key2 (least recently used)
      await smallCache.set('key4', 'value4');

      expect(await smallCache.get('key1')).toBe('value1'); // Was accessed
      expect(await smallCache.get('key2')).toBeNull(); // Evicted
      expect(await smallCache.get('key3')).not.toBeNull(); // key3 was accessed by check above
      expect(await smallCache.get('key4')).toBe('value4'); // Just added

      await smallCache.close();
    });
  });

  describe('multi operations', () => {
    it('should get multiple values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const results = await cache.mget<string>(['key1', 'key2', 'key3']);
      expect(results.get('key1')).toBe('value1');
      expect(results.get('key2')).toBe('value2');
      expect(results.get('key3')).toBeNull();
    });

    it('should set multiple values', async () => {
      const entries = new Map<string, string>([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);
      await cache.mset(entries);

      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBe('value2');
    });

    it('should delete multiple values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      const count = await cache.mdelete(['key1', 'key2', 'nonexistent']);
      expect(count).toBe(2);
      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
      expect(await cache.has('key3')).toBe(true);
    });
  });

  describe('tags', () => {
    it('should invalidate by tag', async () => {
      await cache.set('user:1', { name: 'Alice' }, { tags: ['users'] });
      await cache.set('user:2', { name: 'Bob' }, { tags: ['users'] });
      await cache.set('product:1', { name: 'Widget' }, { tags: ['products'] });

      const invalidated = await cache.invalidateByTag('users');
      expect(invalidated).toBe(2);

      expect(await cache.get('user:1')).toBeNull();
      expect(await cache.get('user:2')).toBeNull();
      expect(await cache.get('product:1')).not.toBeNull();
    });

    it('should handle entries with multiple tags', async () => {
      await cache.set('item:1', 'data', { tags: ['tag1', 'tag2'] });
      await cache.set('item:2', 'data', { tags: ['tag1'] });
      await cache.set('item:3', 'data', { tags: ['tag2'] });

      await cache.invalidateByTag('tag1');

      expect(await cache.get('item:1')).toBeNull();
      expect(await cache.get('item:2')).toBeNull();
      expect(await cache.get('item:3')).not.toBeNull();
    });
  });

  describe('stats', () => {
    it('should track cache statistics', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1'); // hit
      await cache.get('key1'); // hit
      await cache.get('nonexistent'); // miss
      await cache.delete('key1');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.67, 1);
    });
  });

  describe('namespace', () => {
    it('should prefix keys with namespace', async () => {
      const nsCache = createMemoryCache({
        namespace: 'myapp',
        checkInterval: 0,
      });

      await nsCache.set('key1', 'value1');
      // The internal key is 'myapp:key1' but external access uses 'key1'
      expect(await nsCache.get('key1')).toBe('value1');

      await nsCache.close();
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(cache.getStats().size).toBe(0);
    });
  });
});
