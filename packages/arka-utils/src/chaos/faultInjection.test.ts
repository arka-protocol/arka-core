/**
 * Fault Injection Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FaultInjector,
  FaultInjectionError,
  runExperiment,
  chaosExperiments,
} from './faultInjection.js';

describe('FaultInjector', () => {
  let injector: FaultInjector;

  beforeEach(() => {
    injector = new FaultInjector();
  });

  describe('shouldInject', () => {
    it('should not inject when disabled', () => {
      injector.configure({ enabled: false, probability: 1.0 });

      let injected = false;
      for (let i = 0; i < 100; i++) {
        if (injector.shouldInject()) injected = true;
      }

      expect(injected).toBe(false);
    });

    it('should inject based on probability', () => {
      injector.configure({ enabled: true, probability: 0.5, type: 'error' });

      let injectedCount = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        if (injector.shouldInject()) injectedCount++;
      }

      // With probability 0.5, expect roughly 50% injection rate
      expect(injectedCount).toBeGreaterThan(iterations * 0.3);
      expect(injectedCount).toBeLessThan(iterations * 0.7);
    });

    it('should always inject when probability is 1.0', () => {
      injector.configure({ enabled: true, probability: 1.0, type: 'error' });

      for (let i = 0; i < 10; i++) {
        expect(injector.shouldInject()).toBe(true);
      }
    });

    it('should never inject when probability is 0', () => {
      injector.configure({ enabled: true, probability: 0, type: 'error' });

      for (let i = 0; i < 10; i++) {
        expect(injector.shouldInject()).toBe(false);
      }
    });
  });

  describe('maybeInject', () => {
    it('should execute operation when fault not injected', async () => {
      injector.configure({ enabled: false, probability: 1.0, type: 'error' });

      const result = await injector.maybeInject(async () => 'success');
      expect(result).toBe('success');
    });

    it('should inject latency fault', async () => {
      injector.configure({
        enabled: true,
        probability: 1.0,
        type: 'latency',
        options: { latencyMs: 100 },
      });

      const start = Date.now();
      const result = await injector.maybeInject(async () => 'success');
      const elapsed = Date.now() - start;

      expect(result).toBe('success');
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some timing variance
    });

    it('should inject error fault', async () => {
      injector.configure({
        enabled: true,
        probability: 1.0,
        type: 'error',
        options: { errorCode: 503, errorMessage: 'Test error' },
      });

      await expect(injector.maybeInject(async () => 'success'))
        .rejects.toThrow(FaultInjectionError);

      try {
        await injector.maybeInject(async () => 'success');
      } catch (e) {
        expect((e as FaultInjectionError).statusCode).toBe(503);
        expect((e as Error).message).toBe('Test error');
      }
    });

    it('should inject exception fault', async () => {
      const customError = new Error('Custom exception');
      injector.configure({
        enabled: true,
        probability: 1.0,
        type: 'exception',
        options: { exception: customError },
      });

      await expect(injector.maybeInject(async () => 'success'))
        .rejects.toThrow('Custom exception');
    });

    it('should corrupt data', async () => {
      injector.configure({
        enabled: true,
        probability: 1.0,
        type: 'corruption',
      });

      const original = { name: 'test', value: 42, active: true };
      const result = await injector.maybeInject(async () => ({ ...original }));

      // At least one field should be different
      const hasCorruption =
        result.name !== original.name ||
        result.value !== original.value ||
        result.active !== original.active;

      expect(hasCorruption).toBe(true);
    });

    it('should truncate data (partial fault)', async () => {
      injector.configure({
        enabled: true,
        probability: 1.0,
        type: 'partial',
      });

      const original = { a: 1, b: 2, c: 3, d: 4 };
      const result = await injector.maybeInject(async () => ({ ...original }));

      expect(Object.keys(result).length).toBeLessThan(Object.keys(original).length);
    });
  });

  describe('stats', () => {
    it('should track injection statistics', () => {
      injector.configure({ enabled: true, probability: 1.0, type: 'error' });

      for (let i = 0; i < 5; i++) {
        injector.shouldInject();
      }

      const stats = injector.getStats();
      expect(stats.checked).toBe(5);
      expect(stats.injected).toBe(5);
      expect(stats.skipped).toBe(0);
      expect(stats.injectionRate).toBe(1);
    });

    it('should reset stats', () => {
      injector.configure({ enabled: true, probability: 1.0, type: 'error' });
      injector.shouldInject();
      injector.resetStats();

      const stats = injector.getStats();
      expect(stats.checked).toBe(0);
    });
  });

  describe('enable/disable', () => {
    it('should enable fault injection', () => {
      injector.configure({ enabled: false, probability: 1.0, type: 'error' });
      expect(injector.shouldInject()).toBe(false);

      injector.enable();
      expect(injector.shouldInject()).toBe(true);
    });

    it('should disable fault injection', () => {
      injector.configure({ enabled: true, probability: 1.0, type: 'error' });
      expect(injector.shouldInject()).toBe(true);

      injector.disable();
      expect(injector.shouldInject()).toBe(false);
    });
  });
});

describe('runExperiment', () => {
  it('should run chaos experiment successfully', async () => {
    const injector = new FaultInjector();
    let healthCheckCalls = 0;

    const experiment = {
      name: 'Test Experiment',
      description: 'Test',
      target: 'test-service',
      faultConfig: {
        enabled: true,
        probability: 0.5,
        type: 'latency' as const,
        options: { latencyMs: 10 },
      },
      duration: 50, // Short duration for test
      steadyStateCheck: async () => {
        healthCheckCalls++;
        return true;
      },
    };

    const result = await runExperiment(experiment, injector);

    expect(result.name).toBe('Test Experiment');
    expect(result.success).toBe(true);
    expect(result.steadyStateMaintained).toBe(true);
    expect(healthCheckCalls).toBe(2); // Before and after
  }, 10000); // Increase timeout

  it('should fail if initial steady state check fails', async () => {
    const injector = new FaultInjector();

    const experiment = {
      name: 'Test Experiment',
      description: 'Test',
      target: 'test-service',
      faultConfig: {
        enabled: true,
        probability: 1.0,
        type: 'error' as const,
      },
      duration: 100,
      steadyStateCheck: async () => false,
    };

    const result = await runExperiment(experiment, injector);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('System not in steady state before experiment');
  });
});

describe('chaosExperiments', () => {
  it('should create high latency experiment', () => {
    const experiment = chaosExperiments.highLatency(async () => true);

    expect(experiment.name).toBe('High Latency');
    expect(experiment.faultConfig.type).toBe('latency');
    expect(experiment.faultConfig.probability).toBe(0.3);
  });

  it('should create intermittent errors experiment', () => {
    const experiment = chaosExperiments.intermittentErrors(async () => true);

    expect(experiment.name).toBe('Intermittent Errors');
    expect(experiment.faultConfig.type).toBe('error');
    expect(experiment.faultConfig.probability).toBe(0.1);
  });

  it('should create circuit breaker test experiment', () => {
    const experiment = chaosExperiments.circuitBreakerTest(async () => true);

    expect(experiment.name).toBe('Circuit Breaker Test');
    expect(experiment.faultConfig.probability).toBe(1.0);
  });
});

describe('FaultInjectionError', () => {
  it('should create error with status code', () => {
    const error = new FaultInjectionError('Test error', 503);

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(503);
    expect(error.name).toBe('FaultInjectionError');
  });
});
