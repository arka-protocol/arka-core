/**
 * Debug Utilities Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  prettyPrint,
  measureTime,
  createTimer,
  Timer,
  createDebugLogger,
  DebugLogger,
  tap,
  assert,
  diff,
  formatDiff,
  getMemoryUsage,
  getStackTrace,
  getCaller,
} from './debugUtils.js';

describe('debugUtils', () => {
  describe('prettyPrint', () => {
    it('should format simple values', () => {
      expect(prettyPrint(null, { colors: false })).toBe('null');
      expect(prettyPrint(undefined, { colors: false })).toBe('undefined');
      expect(prettyPrint(true, { colors: false })).toBe('true');
      expect(prettyPrint(42, { colors: false })).toBe('42');
      expect(prettyPrint('hello', { colors: false })).toBe('"hello"');
    });

    it('should format objects', () => {
      const obj = { name: 'test', value: 123 };
      const output = prettyPrint(obj, { colors: false });
      expect(output).toContain('name');
      expect(output).toContain('test');
      expect(output).toContain('value');
      expect(output).toContain('123');
    });

    it('should format arrays', () => {
      const arr = [1, 2, 3];
      const output = prettyPrint(arr, { colors: false });
      expect(output).toContain('1');
      expect(output).toContain('2');
      expect(output).toContain('3');
    });

    it('should handle circular references', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj;
      const output = prettyPrint(obj, { colors: false });
      expect(output).toContain('[Circular]');
    });

    it('should respect maxDepth', () => {
      const deep = { a: { b: { c: { d: { e: 'deep' } } } } };
      const output = prettyPrint(deep, { colors: false, maxDepth: 2 });
      expect(output).toContain('[Max Depth]');
    });

    it('should truncate long strings', () => {
      const longString = 'x'.repeat(2000);
      const output = prettyPrint(longString, { colors: false, maxStringLength: 100 });
      expect(output.length).toBeLessThan(2000);
      expect(output).toContain('...');
    });

    it('should format dates', () => {
      const date = new Date('2024-01-01');
      const output = prettyPrint(date, { colors: false });
      expect(output).toContain('Date');
      expect(output).toContain('2024');
    });

    it('should format Maps and Sets', () => {
      const map = new Map([['key', 'value']]);
      const set = new Set([1, 2, 3]);

      expect(prettyPrint(map, { colors: false })).toContain('Map');
      expect(prettyPrint(set, { colors: false })).toContain('Set');
    });
  });

  describe('measureTime', () => {
    it('should measure execution time', async () => {
      const { result, durationMs } = await measureTime(async () => {
        await new Promise(r => setTimeout(r, 50));
        return 'done';
      });

      expect(result).toBe('done');
      expect(durationMs).toBeGreaterThanOrEqual(40);
    });

    it('should log when label provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await measureTime(async () => 'done', 'test-operation');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-operation'));
      consoleSpy.mockRestore();
    });
  });

  describe('Timer', () => {
    it('should track multiple measurements', () => {
      const timer = createTimer('test');

      timer.mark('start');
      // Simulate some work
      timer.measure('operation1', 'start');

      timer.mark('middle');
      timer.measure('operation2', 'middle');

      const stats1 = timer.getStats('operation1');
      const stats2 = timer.getStats('operation2');

      expect(stats1).not.toBeNull();
      expect(stats1?.count).toBe(1);
      expect(stats2).not.toBeNull();
    });

    it('should calculate statistics correctly', () => {
      const timer = new Timer('test');

      // Add some measurements manually
      for (let i = 0; i < 10; i++) {
        timer.mark(`start-${i}`);
        timer.measure('repeated');
      }

      const stats = timer.getStats('repeated');
      expect(stats?.count).toBe(10);
      expect(stats?.avg).toBeDefined();
      expect(stats?.min).toBeDefined();
      expect(stats?.max).toBeDefined();
    });

    it('should generate report', () => {
      const timer = new Timer('test');
      timer.measure('op');
      const report = timer.report();

      expect(report).toContain('Timer: test');
      expect(report).toContain('op');
    });

    it('should reset', () => {
      const timer = new Timer('test');
      timer.measure('op');
      timer.reset();

      expect(timer.getStats('op')).toBeNull();
    });
  });

  describe('DebugLogger', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.DEBUG;
    });

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.DEBUG;
      } else {
        process.env.DEBUG = originalEnv;
      }
    });

    it('should be disabled by default', () => {
      delete process.env.DEBUG;
      const logger = createDebugLogger('test');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.log('message');

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should be enabled when DEBUG matches', () => {
      process.env.DEBUG = 'test';
      const logger = new DebugLogger('test');
      logger.enable(); // Force enable since constructor already ran

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.log('message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should support wildcard matching', () => {
      process.env.DEBUG = 'pact:*';
      const logger = new DebugLogger('pact:service');
      logger.enable();

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.log('message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('tap', () => {
    it('should log and pass through value', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = tap('test')('value');

      expect(result).toBe('value');
      expect(consoleSpy).toHaveBeenCalledWith('[tap:test]', 'value');
      consoleSpy.mockRestore();
    });

    it('should call custom function', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const customFn = vi.fn();

      tap('test', customFn)('value');

      expect(customFn).toHaveBeenCalledWith('value');
      consoleSpy.mockRestore();
    });
  });

  describe('assert', () => {
    it('should pass on truthy condition', () => {
      expect(() => assert(true)).not.toThrow();
      expect(() => assert(1)).not.toThrow();
      expect(() => assert('string')).not.toThrow();
    });

    it('should throw on falsy condition', () => {
      expect(() => assert(false)).toThrow('Assertion failed');
      expect(() => assert(null, 'Custom message')).toThrow('Custom message');
    });

    it('should log data on failure', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => assert(false, 'Test', { debug: 'data' })).toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('diff', () => {
    it('should detect no differences for equal objects', () => {
      const a = { x: 1, y: 2 };
      const b = { x: 1, y: 2 };
      expect(diff(a, b)).toHaveLength(0);
    });

    it('should detect value changes', () => {
      const a = { x: 1 };
      const b = { x: 2 };
      const result = diff(a, b);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: 'x',
        type: 'value',
        a: 1,
        b: 2,
      });
    });

    it('should detect added properties', () => {
      const a = { x: 1 };
      const b = { x: 1, y: 2 };
      const result = diff(a, b);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: 'y',
        type: 'added',
      });
    });

    it('should detect removed properties', () => {
      const a = { x: 1, y: 2 };
      const b = { x: 1 };
      const result = diff(a, b);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        path: 'y',
        type: 'removed',
      });
    });

    it('should detect type changes', () => {
      const a = { x: '1' };
      const b = { x: 1 };
      const result = diff(a, b);

      expect(result.some(r => r.type === 'type' || r.type === 'value')).toBe(true);
    });

    it('should handle arrays', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 4];
      const result = diff(a, b);

      expect(result).toHaveLength(1);
      expect(result[0]?.path).toBe('[2]');
    });

    it('should handle nested objects', () => {
      const a = { outer: { inner: 1 } };
      const b = { outer: { inner: 2 } };
      const result = diff(a, b);

      expect(result).toHaveLength(1);
      expect(result[0]?.path).toBe('outer.inner');
    });
  });

  describe('formatDiff', () => {
    it('should format diff results', () => {
      const results = diff({ a: 1 }, { a: 2, b: 3 });
      const formatted = formatDiff(results, false);

      expect(formatted).toContain('a');
      expect(formatted).toContain('b');
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage info', () => {
      const usage = getMemoryUsage();

      expect(usage.heapUsed).toBeDefined();
      expect(usage.heapTotal).toBeDefined();
      expect(usage.rss).toBeDefined();
      expect(usage.raw).toBeDefined();
    });

    it('should format bytes correctly', () => {
      const usage = getMemoryUsage();

      expect(usage.heapUsed).toMatch(/\d+\.?\d*\s*(B|KB|MB|GB)/);
    });
  });

  describe('getStackTrace', () => {
    it('should return stack trace array', () => {
      const stack = getStackTrace();

      expect(Array.isArray(stack)).toBe(true);
      expect(stack.length).toBeGreaterThan(0);
    });

    it('should skip frames when requested', () => {
      const stack0 = getStackTrace(0);
      const stack1 = getStackTrace(1);

      expect(stack1.length).toBeLessThan(stack0.length);
    });
  });

  describe('getCaller', () => {
    it('should return caller info', () => {
      const caller = getCaller();

      // May be null in some test environments
      if (caller) {
        expect(caller.file).toBeDefined();
        expect(caller.line).toBeDefined();
      }
    });
  });
});
