/**
 * ARKA Testing - Helper Utilities
 *
 * Provides test helper functions and utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import type { ArkaRule, ArkaEvent, ArkaDecision } from '@arka/types';

// ============================================================================
// Async Test Helpers
// ============================================================================

/**
 * Waits for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await wait(interval);
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * Retries an async function until it succeeds or max retries reached
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; delay?: number } = {}
): Promise<T> {
  const { maxRetries = 3, delay = 1000 } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await wait(delay);
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Asserts that a decision is ALLOW
 */
export function expectAllow(decision: ArkaDecision): void {
  expect(decision.status).toBe('ALLOW');
  expect(decision.ruleEvaluations.filter((e) => e.result === 'FAIL')).toHaveLength(0);
}

/**
 * Asserts that a decision is DENY
 */
export function expectDeny(decision: ArkaDecision, expectedCode?: string): void {
  expect(decision.status).toBe('DENY');

  if (expectedCode) {
    const denyEval = decision.ruleEvaluations.find(
      (e) => e.result === 'FAIL' && (e.consequenceSnapshot as Record<string, unknown>)?.code === expectedCode
    );
    expect(denyEval).toBeDefined();
  }
}

/**
 * Asserts that a decision is ALLOW_WITH_FLAGS
 */
export function expectFlag(decision: ArkaDecision, expectedCodes?: string[]): void {
  expect(decision.status).toBe('ALLOW_WITH_FLAGS');

  if (expectedCodes) {
    const flagCodes = decision.ruleEvaluations
      .filter((e) => e.result === 'FAIL' && (e.consequenceSnapshot as Record<string, unknown>)?.decision === 'FLAG')
      .map((e) => (e.consequenceSnapshot as Record<string, unknown>)?.code);

    for (const code of expectedCodes) {
      expect(flagCodes).toContain(code);
    }
  }
}

/**
 * Asserts that specific rules were evaluated
 */
export function expectRulesEvaluated(decision: ArkaDecision, ruleIds: string[]): void {
  const evaluatedRuleIds = decision.ruleEvaluations.map((e) => e.ruleId);

  for (const ruleId of ruleIds) {
    expect(evaluatedRuleIds).toContain(ruleId);
  }
}

/**
 * Asserts that a rule triggered (result was FAIL)
 */
export function expectRuleTriggered(decision: ArkaDecision, ruleId: string): void {
  const evaluation = decision.ruleEvaluations.find((e) => e.ruleId === ruleId);
  expect(evaluation).toBeDefined();
  expect(evaluation?.result).toBe('FAIL');
}

/**
 * Asserts that a rule did not trigger (result was PASS or NOT_APPLICABLE)
 */
export function expectRuleNotTriggered(decision: ArkaDecision, ruleId: string): void {
  const evaluation = decision.ruleEvaluations.find((e) => e.ruleId === ruleId);
  expect(evaluation).toBeDefined();
  expect(evaluation?.result).not.toBe('FAIL');
}

// ============================================================================
// Performance Helpers
// ============================================================================

/**
 * Measures execution time of an async function
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Asserts that an operation completes within a time limit
 */
export async function expectWithinTime<T>(
  fn: () => Promise<T>,
  maxMs: number
): Promise<T> {
  const { result, duration } = await measureTime(fn);
  expect(duration).toBeLessThan(maxMs);
  return result;
}

/**
 * Runs a function multiple times and returns statistics
 */
export async function benchmark(
  fn: () => Promise<void>,
  iterations: number = 100
): Promise<{
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
  total: number;
}> {
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const { duration } = await measureTime(fn);
    durations.push(duration);
  }

  durations.sort((a, b) => a - b);

  const sum = durations.reduce((a, b) => a + b, 0);
  const p95Index = Math.floor(durations.length * 0.95);
  const p99Index = Math.floor(durations.length * 0.99);

  return {
    min: durations[0]!,
    max: durations[durations.length - 1]!,
    avg: sum / durations.length,
    p95: durations[p95Index]!,
    p99: durations[p99Index]!,
    total: sum,
  };
}

// ============================================================================
// Mock Helpers
// ============================================================================

/**
 * Creates a spy function that tracks calls
 */
export function createSpy<T extends (...args: unknown[]) => unknown>(
  implementation?: T
): T & { calls: Parameters<T>[]; reset: () => void } {
  const calls: Parameters<T>[] = [];

  const spy = ((...args: Parameters<T>) => {
    calls.push(args);
    return implementation?.(...args);
  }) as T & { calls: Parameters<T>[]; reset: () => void };

  spy.calls = calls;
  spy.reset = () => {
    calls.length = 0;
  };

  return spy;
}

/**
 * Creates a mock function that returns a specified value
 */
export function createMockFn<T>(returnValue: T): () => T {
  return vi.fn().mockReturnValue(returnValue);
}

/**
 * Creates a mock async function that returns a specified value
 */
export function createMockAsyncFn<T>(returnValue: T): () => Promise<T> {
  return vi.fn().mockResolvedValue(returnValue);
}

// ============================================================================
// Test Suite Helpers
// ============================================================================

/**
 * Creates a test suite for rule evaluation
 */
export function describeRule(
  rule: ArkaRule,
  testCases: Array<{
    name: string;
    event: ArkaEvent;
    expectedTriggered: boolean;
  }>,
  evaluator: (event: ArkaEvent, rules: ArkaRule[]) => Promise<ArkaDecision>
): void {
  describe(`Rule: ${rule.name}`, () => {
    for (const testCase of testCases) {
      it(testCase.name, async () => {
        const decision = await evaluator(testCase.event, [rule]);

        if (testCase.expectedTriggered) {
          expectRuleTriggered(decision, rule.id);
        } else {
          expectRuleNotTriggered(decision, rule.id);
        }
      });
    }
  });
}

/**
 * Creates a parametrized test
 */
export function testEach<T>(
  cases: Array<T & { name: string }>,
  fn: (testCase: T) => void | Promise<void>
): void {
  for (const testCase of cases) {
    it(testCase.name, () => fn(testCase));
  }
}

// ============================================================================
// Data Generation Helpers
// ============================================================================

/**
 * Generates a random string
 */
export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Generates a random number within a range
 */
export function randomNumber(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generates a random integer within a range
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(randomNumber(min, max + 1));
}

/**
 * Picks a random element from an array
 */
export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]!;
}

/**
 * Generates a random date within a range
 */
export function randomDate(start: Date, end: Date): Date {
  const startTime = start.getTime();
  const endTime = end.getTime();
  return new Date(randomNumber(startTime, endTime));
}

/**
 * Generates a UUID-like string
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// Cleanup Helpers
// ============================================================================

/**
 * Creates a cleanup stack that runs cleanup functions in reverse order
 */
export function createCleanupStack(): {
  push: (fn: () => void | Promise<void>) => void;
  cleanup: () => Promise<void>;
} {
  const stack: Array<() => void | Promise<void>> = [];

  return {
    push: (fn) => stack.push(fn),
    cleanup: async () => {
      while (stack.length > 0) {
        const fn = stack.pop()!;
        await fn();
      }
    },
  };
}

// ============================================================================
// Environment Helpers
// ============================================================================

/**
 * Sets environment variables for the duration of a test
 */
export function withEnv(
  env: Record<string, string>,
  fn: () => void | Promise<void>
): () => Promise<void> {
  return async () => {
    const originalValues: Record<string, string | undefined> = {};

    // Save original values and set new values
    for (const [key, value] of Object.entries(env)) {
      originalValues[key] = process.env[key];
      process.env[key] = value;
    }

    try {
      await fn();
    } finally {
      // Restore original values
      for (const [key, value] of Object.entries(originalValues)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  };
}
