/**
 * Canonical Serialization Tests
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalStringify,
  canonicalSerialize,
  canonicalParse,
  canonicalEquals,
  toSignableBytes,
} from './canonical.js';

describe('Canonical Serialization', () => {
  describe('canonicalStringify', () => {
    it('should sort object keys alphabetically', () => {
      const result = canonicalStringify({ z: 1, a: 2, m: 3 });
      expect(result).toBe('{"a":2,"m":3,"z":1}');
    });

    it('should sort nested object keys', () => {
      const result = canonicalStringify({
        outer: { z: 1, a: 2 },
        another: 'value',
      });
      expect(result).toBe('{"another":"value","outer":{"a":2,"z":1}}');
    });

    it('should handle arrays without sorting', () => {
      const result = canonicalStringify({ arr: [3, 1, 2] });
      expect(result).toBe('{"arr":[3,1,2]}');
    });

    it('should handle nested arrays with objects', () => {
      const result = canonicalStringify([{ z: 1, a: 2 }, { y: 3 }]);
      expect(result).toBe('[{"a":2,"z":1},{"y":3}]');
    });

    it('should normalize -0 to 0', () => {
      const result = canonicalStringify({ value: -0 });
      expect(result).toBe('{"value":0}');
    });

    it('should convert Infinity to null', () => {
      const result = canonicalStringify({ value: Infinity });
      expect(result).toBe('{"value":null}');
    });

    it('should convert NaN to null', () => {
      const result = canonicalStringify({ value: NaN });
      expect(result).toBe('{"value":null}');
    });

    it('should convert BigInt to string', () => {
      const result = canonicalStringify({ value: BigInt(12345678901234567890n) });
      expect(result).toBe('{"value":"12345678901234567890"}');
    });

    it('should handle null values', () => {
      const result = canonicalStringify({ value: null });
      expect(result).toBe('{"value":null}');
    });

    it('should handle undefined by default (excludes)', () => {
      const result = canonicalStringify({ defined: 1, undef: undefined });
      expect(result).toBe('{"defined":1}');
    });

    it('should convert undefined to null when includeUndefined is true', () => {
      const result = canonicalStringify({ value: undefined }, { includeUndefined: true });
      expect(result).toBe('{"value":null}');
    });

    it('should apply custom replacer', () => {
      const result = canonicalStringify(
        { secret: 'password', public: 'visible' },
        {
          replacer: (key, value) => (key === 'secret' ? '[REDACTED]' : value),
        }
      );
      expect(result).toBe('{"public":"visible","secret":"[REDACTED]"}');
    });

    it('should produce deterministic output', () => {
      const obj = {
        id: 'test',
        nested: {
          values: [1, 2, 3],
          more: { z: 'last', a: 'first' },
        },
      };

      // Multiple calls should produce identical output
      const results = Array.from({ length: 10 }, () => canonicalStringify(obj));
      const unique = new Set(results);
      expect(unique.size).toBe(1);
    });
  });

  describe('canonicalSerialize', () => {
    it('should return a Buffer', () => {
      const result = canonicalSerialize({ test: true });
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should contain UTF-8 encoded canonical JSON', () => {
      const result = canonicalSerialize({ z: 1, a: 2 });
      expect(result.toString('utf8')).toBe('{"a":2,"z":1}');
    });
  });

  describe('canonicalParse', () => {
    it('should parse JSON string', () => {
      const result = canonicalParse<{ a: number }>('{"a":1}');
      expect(result).toEqual({ a: 1 });
    });

    it('should parse Buffer', () => {
      const buffer = Buffer.from('{"a":1}', 'utf8');
      const result = canonicalParse<{ a: number }>(buffer);
      expect(result).toEqual({ a: 1 });
    });

    it('should roundtrip with canonicalSerialize', () => {
      const original = { nested: { values: [1, 2, 3] }, name: 'test' };
      const serialized = canonicalSerialize(original);
      const parsed = canonicalParse(serialized);
      expect(parsed).toEqual(original);
    });
  });

  describe('canonicalEquals', () => {
    it('should return true for equivalent objects with different key order', () => {
      const a = { z: 1, a: 2 };
      const b = { a: 2, z: 1 };
      expect(canonicalEquals(a, b)).toBe(true);
    });

    it('should return false for different objects', () => {
      const a = { value: 1 };
      const b = { value: 2 };
      expect(canonicalEquals(a, b)).toBe(false);
    });

    it('should handle nested objects', () => {
      const a = { outer: { z: 1, a: 2 } };
      const b = { outer: { a: 2, z: 1 } };
      expect(canonicalEquals(a, b)).toBe(true);
    });

    it('should handle arrays', () => {
      const a = { arr: [1, 2, 3] };
      const b = { arr: [1, 2, 3] };
      expect(canonicalEquals(a, b)).toBe(true);
    });

    it('should return false for different arrays', () => {
      const a = { arr: [1, 2, 3] };
      const b = { arr: [3, 2, 1] };
      expect(canonicalEquals(a, b)).toBe(false);
    });

    it('should handle primitives', () => {
      expect(canonicalEquals(42, 42)).toBe(true);
      expect(canonicalEquals('test', 'test')).toBe(true);
      expect(canonicalEquals(true, true)).toBe(true);
      expect(canonicalEquals(null, null)).toBe(true);
    });
  });

  describe('toSignableBytes', () => {
    it('should return Uint8Array', () => {
      const result = toSignableBytes({ test: true });
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should contain canonical representation', () => {
      const result = toSignableBytes({ z: 1, a: 2 });
      const expected = new TextEncoder().encode('{"a":2,"z":1}');
      expect(result).toEqual(expected);
    });

    it('should produce identical bytes for equivalent objects', () => {
      const a = toSignableBytes({ z: 1, a: 2 });
      const b = toSignableBytes({ a: 2, z: 1 });
      expect(a).toEqual(b);
    });
  });
});
