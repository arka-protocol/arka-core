/**
 * ARKA Test Assertions
 *
 * Custom assertions for testing ARKA services and contracts.
 */

import { expect } from 'vitest';
import type { MockResponse } from './mocks.js';
import type { ApiResponseFixture } from './fixtures.js';

/**
 * Assert that a response has the expected status code
 */
export function assertStatus(res: MockResponse, expectedStatus: number): void {
  expect(res._statusCode).toBe(expectedStatus);
}

/**
 * Assert that a response is a success response
 */
export function assertSuccess<T>(res: MockResponse, expectedData?: T): void {
  expect(res._statusCode).toBeGreaterThanOrEqual(200);
  expect(res._statusCode).toBeLessThan(300);

  if (expectedData !== undefined) {
    const body = res._body as ApiResponseFixture<T>;
    expect(body.success).toBe(true);
    expect(body.data).toEqual(expectedData);
  }
}

/**
 * Assert that a response is an error response
 */
export function assertError(
  res: MockResponse,
  expectedStatus: number,
  expectedCode?: string
): void {
  expect(res._statusCode).toBe(expectedStatus);

  const body = res._body as ApiResponseFixture;
  expect(body.success).toBe(false);
  expect(body.error).toBeDefined();

  if (expectedCode) {
    expect(body.error?.code).toBe(expectedCode);
  }
}

/**
 * Assert that a response has a specific header
 */
export function assertHeader(
  res: MockResponse,
  headerName: string,
  expectedValue?: string
): void {
  const headerValue = res._headers[headerName];
  expect(headerValue).toBeDefined();

  if (expectedValue !== undefined) {
    expect(headerValue).toBe(expectedValue);
  }
}

/**
 * Assert that a response has JSON content type
 */
export function assertJsonContentType(res: MockResponse): void {
  const contentType = res._headers['Content-Type'] || '';
  expect(contentType).toMatch(/application\/json/);
}

/**
 * Assert that a response body matches a schema shape
 */
export function assertShape<T extends Record<string, unknown>>(
  body: unknown,
  shape: { [K in keyof T]: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'undefined' }
): void {
  expect(typeof body).toBe('object');
  expect(body).not.toBeNull();

  const obj = body as Record<string, unknown>;

  for (const [key, expectedType] of Object.entries(shape)) {
    const value = obj[key];

    switch (expectedType) {
      case 'array':
        expect(Array.isArray(value)).toBe(true);
        break;
      case 'undefined':
        expect(value).toBeUndefined();
        break;
      default:
        expect(typeof value).toBe(expectedType);
    }
  }
}

/**
 * Assert that a value is a valid UUID
 */
export function assertUuid(value: unknown): void {
  expect(typeof value).toBe('string');
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  expect((value as string).match(uuidRegex)).toBeTruthy();
}

/**
 * Assert that a value is a valid ARKA ID with prefix
 */
export function assertPactId(value: unknown, expectedPrefix?: string): void {
  expect(typeof value).toBe('string');
  const str = value as string;

  if (expectedPrefix) {
    expect(str.startsWith(`${expectedPrefix}_`)).toBe(true);
  }

  // ARKA IDs are prefix_nanoid format
  expect(str).toMatch(/^[a-z]+_[a-zA-Z0-9_-]+$/);
}

/**
 * Assert that a value is a valid ISO date string
 */
export function assertIsoDate(value: unknown): void {
  expect(typeof value).toBe('string');
  const date = new Date(value as string);
  expect(date.toISOString()).toBe(value);
}

/**
 * Assert that a value is within a numeric range
 */
export function assertInRange(value: number, min: number, max: number): void {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

/**
 * Assert that an array contains exactly the expected items (order-independent)
 */
export function assertArrayContainsExactly<T>(actual: T[], expected: T[]): void {
  expect(actual).toHaveLength(expected.length);
  for (const item of expected) {
    expect(actual).toContainEqual(item);
  }
}

/**
 * Assert that an object has only the specified keys
 */
export function assertOnlyKeys(obj: Record<string, unknown>, keys: string[]): void {
  const actualKeys = Object.keys(obj).sort();
  const expectedKeys = [...keys].sort();
  expect(actualKeys).toEqual(expectedKeys);
}

/**
 * Assert that an async function throws a specific error
 */
export async function assertThrowsAsync<T extends Error>(
  fn: () => Promise<unknown>,
  errorType?: new (...args: unknown[]) => T,
  messageMatch?: string | RegExp
): Promise<T> {
  let error: unknown;

  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (e) {
    error = e;
  }

  if (errorType) {
    expect(error).toBeInstanceOf(errorType);
  }

  if (messageMatch) {
    const message = (error as Error).message;
    if (typeof messageMatch === 'string') {
      expect(message).toContain(messageMatch);
    } else {
      expect(message).toMatch(messageMatch);
    }
  }

  return error as T;
}

/**
 * Assert that a sync function throws a specific error
 */
export function assertThrows<T extends Error>(
  fn: () => unknown,
  errorType?: new (...args: unknown[]) => T,
  messageMatch?: string | RegExp
): T {
  let error: unknown;

  try {
    fn();
    throw new Error('Expected function to throw');
  } catch (e) {
    error = e;
  }

  if (errorType) {
    expect(error).toBeInstanceOf(errorType);
  }

  if (messageMatch) {
    const message = (error as Error).message;
    if (typeof messageMatch === 'string') {
      expect(message).toContain(messageMatch);
    } else {
      expect(message).toMatch(messageMatch);
    }
  }

  return error as T;
}

/**
 * Assert that a function was called with specific arguments
 */
export function assertCalledWith(
  mockFn: { mock: { calls: unknown[][] } },
  ...expectedArgs: unknown[]
): void {
  const calls = mockFn.mock.calls;
  const matchingCall = calls.find(call =>
    expectedArgs.every((arg, i) => {
      if (typeof arg === 'object' && arg !== null) {
        return JSON.stringify(call[i]) === JSON.stringify(arg);
      }
      return call[i] === arg;
    })
  );
  expect(matchingCall).toBeDefined();
}

/**
 * Assert that a function was called exactly n times
 */
export function assertCallCount(
  mockFn: { mock: { calls: unknown[][] } },
  expectedCount: number
): void {
  expect(mockFn.mock.calls).toHaveLength(expectedCount);
}

/**
 * Contract testing: Assert that a response matches an API contract
 */
export interface ApiContract {
  status: number;
  headers?: Record<string, string>;
  body?: {
    required?: string[];
    optional?: string[];
    shape?: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array' | 'undefined'>;
  };
}

export function assertMatchesContract(res: MockResponse, contract: ApiContract): void {
  // Check status
  expect(res._statusCode).toBe(contract.status);

  // Check headers
  if (contract.headers) {
    for (const [name, value] of Object.entries(contract.headers)) {
      expect(res._headers[name]).toBe(value);
    }
  }

  // Check body
  if (contract.body && res._body !== null) {
    const body = res._body as Record<string, unknown>;

    // Check required fields
    if (contract.body.required) {
      for (const field of contract.body.required) {
        expect(body[field]).toBeDefined();
      }
    }

    // Check shape
    if (contract.body.shape) {
      assertShape(body, contract.body.shape as Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array' | 'undefined'>);
    }
  }
}

/**
 * Assert that two dates are close (within tolerance in ms)
 */
export function assertDatesClose(
  actual: Date | string,
  expected: Date | string,
  toleranceMs = 1000
): void {
  const actualTime = new Date(actual).getTime();
  const expectedTime = new Date(expected).getTime();
  const diff = Math.abs(actualTime - expectedTime);
  expect(diff).toBeLessThanOrEqual(toleranceMs);
}

/**
 * Assert that execution time is within limit
 */
export async function assertExecutionTime(
  fn: () => Promise<unknown>,
  maxMs: number
): Promise<void> {
  const start = Date.now();
  await fn();
  const duration = Date.now() - start;
  expect(duration).toBeLessThanOrEqual(maxMs);
}

/**
 * Assert that a value is deeply frozen
 */
export function assertDeepFrozen(obj: unknown): void {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  expect(Object.isFrozen(obj)).toBe(true);

  for (const value of Object.values(obj as Record<string, unknown>)) {
    assertDeepFrozen(value);
  }
}
