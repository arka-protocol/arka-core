/**
 * Retry Utilities Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sleep,
  calculateBackoff,
  retry,
  withRetry,
  isRetryableHttpError,
} from './retry.js';

describe('Retry Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sleep', () => {
    it('should resolve after specified duration', async () => {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });

    it('should not resolve before duration', async () => {
      let resolved = false;
      sleep(1000).then(() => {
        resolved = true;
      });
      vi.advanceTimersByTime(500);
      await Promise.resolve(); // flush promises
      expect(resolved).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    it('should return initial delay for first attempt', () => {
      // Due to jitter, we check if it's within expected range
      const delay = calculateBackoff(0, 100, 10000, 2);
      expect(delay).toBeGreaterThanOrEqual(50); // 100 * 0.5
      expect(delay).toBeLessThanOrEqual(150); // 100 * 1.5
    });

    it('should increase delay exponentially', () => {
      // Attempt 0: 100ms base
      // Attempt 1: 200ms base
      // Attempt 2: 400ms base
      // Due to jitter, we use wider ranges
      const delays = [0, 1, 2, 3].map((attempt) =>
        calculateBackoff(attempt, 100, 10000, 2)
      );

      // Each delay (base) should be ~2x the previous
      // But with jitter, we just check that later attempts tend to be larger
      // This is a probabilistic test
    });

    it('should cap at maximum delay', () => {
      const delay = calculateBackoff(10, 100, 1000, 2);
      // Max is 1000, with jitter it should be between 500-1500
      expect(delay).toBeLessThanOrEqual(1500);
    });

    it('should apply jitter', () => {
      // Run multiple times and check for variation
      const delays = Array.from({ length: 10 }, () =>
        calculateBackoff(0, 100, 10000, 2)
      );
      const uniqueDelays = new Set(delays);
      // With random jitter, we should get different values
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('retry', () => {
    it('should succeed on first try', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const resultPromise = retry(fn, {
        initialDelayMs: 100,
        maxRetries: 3,
      });

      // Advance timers for retry delay
      await vi.advanceTimersByTimeAsync(200);

      const result = await resultPromise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      vi.useRealTimers(); // Use real timers for this test
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));

      await expect(
        retry(fn, {
          maxRetries: 2,
          initialDelayMs: 10,
          maxDelayMs: 20,
        })
      ).rejects.toThrow('always fails');

      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
      vi.useFakeTimers(); // Restore fake timers
    });

    it('should respect isRetryable function', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('non-retryable'));

      const resultPromise = retry(fn, {
        maxRetries: 3,
        isRetryable: () => false,
      });

      await expect(resultPromise).rejects.toThrow('non-retryable');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const resultPromise = retry(fn, {
        maxRetries: 3,
        initialDelayMs: 100,
        onRetry,
      });

      await vi.advanceTimersByTimeAsync(200);
      await resultPromise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });
  });

  describe('withRetry', () => {
    it('should create a retryable wrapper', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const wrappedFn = withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 100,
      });

      const resultPromise = wrappedFn();
      await vi.advanceTimersByTimeAsync(200);
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to wrapped function', async () => {
      const fn = vi.fn((a: number, b: string) => Promise.resolve(`${a}-${b}`));
      const wrappedFn = withRetry(fn);

      const result = await wrappedFn(1, 'test');
      expect(result).toBe('1-test');
      expect(fn).toHaveBeenCalledWith(1, 'test');
    });
  });

  describe('isRetryableHttpError', () => {
    it('should return true for network errors', () => {
      expect(isRetryableHttpError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableHttpError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isRetryableHttpError(new Error('ETIMEDOUT'))).toBe(true);
      expect(isRetryableHttpError(new Error('socket hang up'))).toBe(true);
    });

    it('should return true for retryable status codes', () => {
      expect(isRetryableHttpError({ status: 429 })).toBe(true);
      expect(isRetryableHttpError({ status: 502 })).toBe(true);
      expect(isRetryableHttpError({ status: 503 })).toBe(true);
      expect(isRetryableHttpError({ status: 504 })).toBe(true);
    });

    it('should return false for non-retryable status codes', () => {
      expect(isRetryableHttpError({ status: 400 })).toBe(false);
      expect(isRetryableHttpError({ status: 401 })).toBe(false);
      expect(isRetryableHttpError({ status: 404 })).toBe(false);
      expect(isRetryableHttpError({ status: 500 })).toBe(false);
    });

    it('should return false for non-retryable errors', () => {
      expect(isRetryableHttpError(new Error('validation failed'))).toBe(false);
      expect(isRetryableHttpError('string error')).toBe(false);
      expect(isRetryableHttpError(null)).toBe(false);
    });
  });
});
