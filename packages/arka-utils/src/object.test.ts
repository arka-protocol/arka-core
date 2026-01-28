/**
 * Object Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getNestedValue,
  setNestedValue,
  hasNestedValue,
  deepClone,
  deepMerge,
  omit,
  pick,
  flattenObject,
} from './object.js';

describe('Object Utilities', () => {
  describe('getNestedValue', () => {
    const obj = {
      level1: {
        level2: {
          level3: 'deep value',
        },
        array: [1, 2, 3],
      },
      simple: 'value',
    };

    it('should get simple values', () => {
      expect(getNestedValue(obj, 'simple')).toBe('value');
    });

    it('should get nested values', () => {
      expect(getNestedValue(obj, 'level1.level2.level3')).toBe('deep value');
    });

    it('should return undefined for non-existent paths', () => {
      expect(getNestedValue(obj, 'nonexistent')).toBeUndefined();
      expect(getNestedValue(obj, 'level1.nonexistent')).toBeUndefined();
      expect(getNestedValue(obj, 'level1.level2.level3.extra')).toBeUndefined();
    });

    it('should handle arrays in path', () => {
      expect(getNestedValue(obj, 'level1.array')).toEqual([1, 2, 3]);
    });

    it('should handle null in path', () => {
      const objWithNull = { a: { b: null } };
      expect(getNestedValue(objWithNull, 'a.b.c')).toBeUndefined();
    });

    it('should handle empty path parts', () => {
      expect(getNestedValue(obj, '')).toBeUndefined();
    });
  });

  describe('setNestedValue', () => {
    it('should set simple values', () => {
      const result = setNestedValue({}, 'simple', 'value');
      expect(result).toEqual({ simple: 'value' });
    });

    it('should set nested values', () => {
      const result = setNestedValue({}, 'level1.level2.level3', 'deep value');
      expect(result).toEqual({
        level1: {
          level2: {
            level3: 'deep value',
          },
        },
      });
    });

    it('should preserve existing values', () => {
      const original = { existing: 'value', level1: { existing2: 'value2' } };
      const result = setNestedValue(original, 'level1.new', 'new value');
      expect(result.existing).toBe('value');
      expect(result.level1.existing2).toBe('value2');
      expect(result.level1.new).toBe('new value');
    });

    it('should not mutate original object', () => {
      const original = { level1: { value: 'original' } };
      setNestedValue(original, 'level1.value', 'changed');
      expect(original.level1.value).toBe('original');
    });

    it('should overwrite non-object intermediates', () => {
      const original: Record<string, unknown> = { level1: 'string value' };
      const result = setNestedValue(original, 'level1.level2', 'new value');
      expect(result.level1).toEqual({ level2: 'new value' });
    });
  });

  describe('hasNestedValue', () => {
    const obj = {
      level1: {
        level2: {
          value: 'exists',
          nullValue: null,
        },
      },
    };

    it('should return true for existing paths', () => {
      expect(hasNestedValue(obj, 'level1')).toBe(true);
      expect(hasNestedValue(obj, 'level1.level2')).toBe(true);
      expect(hasNestedValue(obj, 'level1.level2.value')).toBe(true);
    });

    it('should return false for non-existent paths', () => {
      expect(hasNestedValue(obj, 'nonexistent')).toBe(false);
      expect(hasNestedValue(obj, 'level1.nonexistent')).toBe(false);
    });

    it('should return true for null values', () => {
      // null is a defined value, not undefined
      expect(hasNestedValue(obj, 'level1.level2.nullValue')).toBe(true);
    });
  });

  describe('deepClone', () => {
    it('should clone simple objects', () => {
      const original = { a: 1, b: 'test' };
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });

    it('should clone nested objects', () => {
      const original = { level1: { level2: { value: 'deep' } } };
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned.level1).not.toBe(original.level1);
      expect(cloned.level1.level2).not.toBe(original.level1.level2);
    });

    it('should clone arrays', () => {
      const original = { arr: [1, 2, { nested: true }] };
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned.arr).not.toBe(original.arr);
    });

    it('should handle null values', () => {
      const original = { value: null };
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
    });
  });

  describe('deepMerge', () => {
    it('should merge simple objects', () => {
      const result = deepMerge({ a: 1, b: 0 }, { b: 2 });
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should merge nested objects', () => {
      const result = deepMerge(
        { level1: { a: 1, b: 0 } },
        { level1: { b: 2 } }
      );
      expect(result).toEqual({ level1: { a: 1, b: 2 } });
    });

    it('should overwrite primitive values', () => {
      const result = deepMerge({ a: 1 }, { a: 2 });
      expect(result).toEqual({ a: 2 });
    });

    it('should not mutate original objects', () => {
      const original = { level1: { a: 1, b: 0 } };
      deepMerge(original, { level1: { b: 2 } });
      expect(original).toEqual({ level1: { a: 1, b: 0 } });
    });

    it('should handle multiple sources', () => {
      const result = deepMerge({ a: 1, b: 0, c: 0 }, { b: 2 }, { c: 3 });
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should handle arrays by replacement', () => {
      const result = deepMerge({ arr: [1, 2] }, { arr: [3, 4] });
      expect(result).toEqual({ arr: [3, 4] });
    });

    it('should skip undefined values', () => {
      const result = deepMerge({ a: 1, b: 0 }, { a: undefined, b: 2 });
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe('omit', () => {
    it('should omit specified keys', () => {
      const result = omit({ a: 1, b: 2, c: 3 }, ['b']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should omit multiple keys', () => {
      const result = omit({ a: 1, b: 2, c: 3 }, ['a', 'c']);
      expect(result).toEqual({ b: 2 });
    });

    it('should handle non-existent keys', () => {
      const obj = { a: 1, b: 2 };
      const result = omit(obj, ['b']);
      expect(result).toEqual({ a: 1 });
    });

    it('should not mutate original object', () => {
      const original = { a: 1, b: 2 };
      omit(original, ['b']);
      expect(original).toEqual({ a: 1, b: 2 });
    });
  });

  describe('pick', () => {
    it('should pick specified keys', () => {
      const result = pick({ a: 1, b: 2, c: 3 }, ['a', 'c']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should handle non-existent keys', () => {
      const obj = { a: 1, b: 2 };
      const result = pick(obj, ['a']);
      expect(result).toEqual({ a: 1 });
    });

    it('should return empty object for empty keys array', () => {
      const result = pick({ a: 1, b: 2 }, []);
      expect(result).toEqual({});
    });
  });

  describe('flattenObject', () => {
    it('should flatten nested objects', () => {
      const result = flattenObject({
        level1: {
          level2: {
            value: 'deep',
          },
        },
      });
      expect(result).toEqual({ 'level1.level2.value': 'deep' });
    });

    it('should handle multiple levels', () => {
      const result = flattenObject({
        a: {
          b: 1,
          c: {
            d: 2,
          },
        },
        e: 3,
      });
      expect(result).toEqual({
        'a.b': 1,
        'a.c.d': 2,
        e: 3,
      });
    });

    it('should handle arrays as values', () => {
      const result = flattenObject({
        items: [1, 2, 3],
      });
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    it('should handle empty objects', () => {
      const result = flattenObject({});
      expect(result).toEqual({});
    });

    it('should handle null values', () => {
      const result = flattenObject({
        a: null,
        b: {
          c: null,
        },
      });
      expect(result).toEqual({ a: null, 'b.c': null });
    });

    it('should use custom prefix', () => {
      const result = flattenObject({ a: { b: 1 } }, 'root');
      expect(result).toEqual({ 'root.a.b': 1 });
    });
  });
});
