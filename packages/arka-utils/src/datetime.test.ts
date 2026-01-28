/**
 * DateTime Utilities Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  now,
  parseISODate,
  isWithinRange,
  isEffective,
  startOfDay,
  endOfDay,
  addDays,
  durationMs,
  formatDuration,
} from './datetime.js';

describe('DateTime Utilities', () => {
  describe('now', () => {
    it('should return an ISO date string', () => {
      const result = now();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should return current time', () => {
      const before = Date.now();
      const result = new Date(now()).getTime();
      const after = Date.now();
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });

  describe('parseISODate', () => {
    it('should parse valid ISO date strings', () => {
      const date = parseISODate('2024-01-15T10:30:00.000Z');
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0); // January
      expect(date.getUTCDate()).toBe(15);
      expect(date.getUTCHours()).toBe(10);
      expect(date.getUTCMinutes()).toBe(30);
    });

    it('should throw on invalid date strings', () => {
      expect(() => parseISODate('invalid')).toThrow('Invalid ISO date string');
      expect(() => parseISODate('2024-99-99')).toThrow('Invalid ISO date string');
      expect(() => parseISODate('')).toThrow('Invalid ISO date string');
    });
  });

  describe('isWithinRange', () => {
    const testDate = '2024-06-15T12:00:00.000Z';

    it('should return true when date is within range', () => {
      expect(
        isWithinRange(testDate, '2024-01-01T00:00:00.000Z', '2024-12-31T23:59:59.999Z')
      ).toBe(true);
    });

    it('should return false when date is before start', () => {
      expect(
        isWithinRange(testDate, '2024-07-01T00:00:00.000Z', '2024-12-31T23:59:59.999Z')
      ).toBe(false);
    });

    it('should return false when date is after end', () => {
      expect(
        isWithinRange(testDate, '2024-01-01T00:00:00.000Z', '2024-05-31T23:59:59.999Z')
      ).toBe(false);
    });

    it('should handle null start', () => {
      expect(isWithinRange(testDate, null, '2024-12-31T23:59:59.999Z')).toBe(true);
      expect(isWithinRange(testDate, null, '2024-01-01T00:00:00.000Z')).toBe(false);
    });

    it('should handle null end', () => {
      expect(isWithinRange(testDate, '2024-01-01T00:00:00.000Z', null)).toBe(true);
      expect(isWithinRange(testDate, '2024-12-31T00:00:00.000Z', null)).toBe(false);
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-06-15T12:00:00.000Z');
      expect(isWithinRange(date, '2024-01-01T00:00:00.000Z', '2024-12-31T23:59:59.999Z')).toBe(
        true
      );
    });
  });

  describe('isEffective', () => {
    const testDate = '2024-06-15T12:00:00.000Z';

    it('should return true for effective rules', () => {
      expect(
        isEffective('2024-01-01T00:00:00.000Z', '2024-12-31T23:59:59.999Z', testDate)
      ).toBe(true);
    });

    it('should return false for not-yet-effective rules', () => {
      expect(
        isEffective('2024-07-01T00:00:00.000Z', '2024-12-31T23:59:59.999Z', testDate)
      ).toBe(false);
    });

    it('should return false for expired rules', () => {
      expect(
        isEffective('2024-01-01T00:00:00.000Z', '2024-05-31T23:59:59.999Z', testDate)
      ).toBe(false);
    });

    it('should handle undefined dates', () => {
      expect(isEffective(undefined, undefined, testDate)).toBe(true);
      expect(isEffective(null, null, testDate)).toBe(true);
    });

    it('should use current date when atDate not provided', () => {
      // Rule effective from far in the past to far in the future
      expect(isEffective('2000-01-01T00:00:00.000Z', '2099-12-31T23:59:59.999Z')).toBe(true);
      // Rule expired
      expect(isEffective('2000-01-01T00:00:00.000Z', '2000-12-31T23:59:59.999Z')).toBe(false);
    });
  });

  describe('startOfDay', () => {
    it('should return start of day for a date string', () => {
      const result = startOfDay('2024-06-15T15:30:45.123Z');
      expect(result.toISOString()).toBe('2024-06-15T00:00:00.000Z');
    });

    it('should return start of day for a Date object', () => {
      const result = startOfDay(new Date('2024-06-15T15:30:45.123Z'));
      expect(result.toISOString()).toBe('2024-06-15T00:00:00.000Z');
    });
  });

  describe('endOfDay', () => {
    it('should return end of day for a date string', () => {
      const result = endOfDay('2024-06-15T10:30:45.123Z');
      expect(result.toISOString()).toBe('2024-06-15T23:59:59.999Z');
    });

    it('should return end of day for a Date object', () => {
      const result = endOfDay(new Date('2024-06-15T10:30:45.123Z'));
      expect(result.toISOString()).toBe('2024-06-15T23:59:59.999Z');
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      const result = addDays('2024-06-15T12:00:00.000Z', 5);
      expect(result.getUTCDate()).toBe(20);
    });

    it('should subtract negative days', () => {
      const result = addDays('2024-06-15T12:00:00.000Z', -5);
      expect(result.getUTCDate()).toBe(10);
    });

    it('should handle month boundaries', () => {
      const result = addDays('2024-06-28T12:00:00.000Z', 5);
      expect(result.getUTCMonth()).toBe(6); // July
      expect(result.getUTCDate()).toBe(3);
    });

    it('should work with Date objects', () => {
      const result = addDays(new Date('2024-06-15T12:00:00.000Z'), 10);
      expect(result.getUTCDate()).toBe(25);
    });
  });

  describe('durationMs', () => {
    it('should calculate duration between two date strings', () => {
      const result = durationMs(
        '2024-06-15T10:00:00.000Z',
        '2024-06-15T12:00:00.000Z'
      );
      expect(result).toBe(2 * 60 * 60 * 1000); // 2 hours in ms
    });

    it('should calculate duration between Date objects', () => {
      const start = new Date('2024-06-15T10:00:00.000Z');
      const end = new Date('2024-06-15T10:30:00.000Z');
      const result = durationMs(start, end);
      expect(result).toBe(30 * 60 * 1000); // 30 minutes in ms
    });

    it('should handle negative duration', () => {
      const result = durationMs(
        '2024-06-15T12:00:00.000Z',
        '2024-06-15T10:00:00.000Z'
      );
      expect(result).toBe(-2 * 60 * 60 * 1000);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(1000)).toBe('1.00s');
      expect(formatDuration(5500)).toBe('5.50s');
      expect(formatDuration(59999)).toBe('60.00s');
    });

    it('should format minutes', () => {
      expect(formatDuration(60000)).toBe('1.00m');
      expect(formatDuration(150000)).toBe('2.50m');
    });

    it('should format hours', () => {
      expect(formatDuration(3600000)).toBe('1.00h');
      expect(formatDuration(7200000)).toBe('2.00h');
    });
  });
});
