/**
 * Circuit Breaker Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitBreakerTimeoutError,
  CircuitBreakerRegistry,
  withCircuitBreaker,
} from './circuitBreaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 3,
      successThreshold: 2,
      resetTimeout: 100,
      callTimeout: 50,
    });
  });

  describe('CLOSED state', () => {
    it('should execute successfully in closed state', async () => {
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should track successful calls', async () => {
      await breaker.execute(async () => 'success');
      const stats = breaker.getStats();
      expect(stats.totalCalls).toBe(1);
      expect(stats.totalSuccesses).toBe(1);
      expect(stats.totalFailures).toBe(0);
    });

    it('should remain closed after failures below threshold', async () => {
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getStats().failures).toBe(2);
    });

    it('should open after reaching failure threshold', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }
      expect(breaker.getState()).toBe('OPEN');
    });

    it('should reset failure count on success', async () => {
      // Add some failures
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // Expected
      }

      expect(breaker.getStats().failures).toBe(1);

      // Success should reset
      await breaker.execute(async () => 'success');
      expect(breaker.getStats().failures).toBe(0);
    });
  });

  describe('OPEN state', () => {
    beforeEach(async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }
    });

    it('should reject calls immediately', async () => {
      await expect(breaker.execute(async () => 'success'))
        .rejects.toThrow(CircuitBreakerError);
    });

    it('should track rejected calls', async () => {
      try {
        await breaker.execute(async () => 'success');
      } catch {
        // Expected
      }
      expect(breaker.getStats().totalRejected).toBe(1);
    });

    it('should transition to half-open after reset timeout', async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(breaker.getState()).toBe('HALF_OPEN');
    });
  });

  describe('HALF_OPEN state', () => {
    beforeEach(async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    it('should allow test calls', async () => {
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should close after success threshold', async () => {
      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should open immediately on failure', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // Expected
      }
      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('timeout handling', () => {
    it('should timeout slow calls', async () => {
      await expect(breaker.execute(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'slow';
      })).rejects.toThrow(CircuitBreakerTimeoutError);
    });

    it('should count timeout as failure', async () => {
      try {
        await breaker.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });
      } catch {
        // Expected
      }
      expect(breaker.getStats().totalFailures).toBe(1);
    });
  });

  describe('custom failure detection', () => {
    it('should use custom isFailure function', async () => {
      const customBreaker = new CircuitBreaker({
        name: 'custom',
        failureThreshold: 2,
        isFailure: (error) => {
          // Only count specific errors as failures
          return error instanceof Error && error.message === 'critical';
        },
      });

      // Non-critical error should not count
      try {
        await customBreaker.execute(async () => {
          throw new Error('minor');
        });
      } catch {
        // Expected
      }
      expect(customBreaker.getStats().failures).toBe(0);

      // Critical error should count
      try {
        await customBreaker.execute(async () => {
          throw new Error('critical');
        });
      } catch {
        // Expected
      }
      expect(customBreaker.getStats().failures).toBe(1);
    });
  });

  describe('callbacks', () => {
    it('should call onStateChange', async () => {
      const onStateChange = vi.fn();
      const callbackBreaker = new CircuitBreaker({
        name: 'callback',
        failureThreshold: 1,
        onStateChange,
      });

      try {
        await callbackBreaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // Expected
      }

      expect(onStateChange).toHaveBeenCalledWith('CLOSED', 'OPEN');
    });

    it('should call onCall with result and duration', async () => {
      const onCall = vi.fn();
      const callbackBreaker = new CircuitBreaker({
        name: 'callback',
        onCall,
      });

      await callbackBreaker.execute(async () => 'success');

      expect(onCall).toHaveBeenCalledWith('success', expect.any(Number));
    });
  });

  describe('forceState', () => {
    it('should force state to OPEN', () => {
      breaker.forceState('OPEN');
      expect(breaker.getState()).toBe('OPEN');
    });

    it('should force state to CLOSED', async () => {
      // Trip the circuit first
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }
      expect(breaker.getState()).toBe('OPEN');

      breaker.forceState('CLOSED');
      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  describe('reset', () => {
    it('should reset all state', async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }

      breaker.reset();
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getStats().failures).toBe(0);
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry({
      failureThreshold: 5,
    });
  });

  it('should create and cache circuit breakers', () => {
    const breaker1 = registry.get('service-a');
    const breaker2 = registry.get('service-a');
    expect(breaker1).toBe(breaker2);
  });

  it('should create different breakers for different names', () => {
    const breaker1 = registry.get('service-a');
    const breaker2 = registry.get('service-b');
    expect(breaker1).not.toBe(breaker2);
  });

  it('should apply default options', async () => {
    const breaker = registry.get('test');
    // With failureThreshold: 5, should not open after 3 failures
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // Expected
      }
    }
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should get all stats', async () => {
    const breaker1 = registry.get('service-a');
    const breaker2 = registry.get('service-b');

    await breaker1.execute(async () => 'a');
    await breaker2.execute(async () => 'b');

    const stats = registry.getAllStats();
    expect(stats['service-a'].totalCalls).toBe(1);
    expect(stats['service-b'].totalCalls).toBe(1);
  });

  it('should reset all breakers', async () => {
    const breaker = registry.get('test', { failureThreshold: 1 });

    try {
      await breaker.execute(async () => {
        throw new Error('fail');
      });
    } catch {
      // Expected
    }
    expect(breaker.getState()).toBe('OPEN');

    registry.resetAll();
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should remove breaker', () => {
    registry.get('test');
    expect(registry.remove('test')).toBe(true);
    expect(registry.remove('test')).toBe(false);
  });

  it('should clear all breakers', () => {
    registry.get('a');
    registry.get('b');
    registry.clear();
    expect(registry.getAll().size).toBe(0);
  });
});

describe('withCircuitBreaker', () => {
  it('should wrap function with circuit breaker', async () => {
    const breaker = new CircuitBreaker({ name: 'wrap' });
    const fn = async (x: number) => x * 2;
    const wrapped = withCircuitBreaker(fn, breaker);

    const result = await wrapped(5);
    expect(result).toBe(10);
    expect(breaker.getStats().totalCalls).toBe(1);
  });
});
