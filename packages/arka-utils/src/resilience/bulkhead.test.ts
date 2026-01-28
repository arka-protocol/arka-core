/**
 * Bulkhead Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Bulkhead,
  BulkheadError,
  BulkheadRegistry,
  withBulkhead,
} from './bulkhead.js';

describe('Bulkhead', () => {
  let bulkhead: Bulkhead;

  beforeEach(() => {
    bulkhead = new Bulkhead({
      name: 'test',
      maxConcurrent: 2,
      maxQueue: 2,
      queueTimeout: 100,
    });
  });

  describe('concurrent execution', () => {
    it('should execute when slots available', async () => {
      const result = await bulkhead.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should track active calls', async () => {
      let resolve1: () => void;
      const promise1 = bulkhead.execute(() => new Promise<void>(r => {
        resolve1 = r;
      }));

      // Wait a tick for the execution to start
      await new Promise(r => setTimeout(r, 0));

      expect(bulkhead.getStats().activeCalls).toBe(1);
      expect(bulkhead.getAvailableSlots()).toBe(1);

      resolve1!();
      await promise1;

      expect(bulkhead.getStats().activeCalls).toBe(0);
    });

    it('should allow up to maxConcurrent executions', async () => {
      const calls: Promise<string>[] = [];
      const resolvers: Array<(value: string) => void> = [];

      for (let i = 0; i < 2; i++) {
        calls.push(bulkhead.execute(() => new Promise<string>(r => {
          resolvers.push(r);
        })));
      }

      await new Promise(r => setTimeout(r, 0));
      expect(bulkhead.getStats().activeCalls).toBe(2);

      // Resolve all
      resolvers.forEach((r, i) => r(`result-${i}`));
      const results = await Promise.all(calls);
      expect(results).toEqual(['result-0', 'result-1']);
    });
  });

  describe('queuing', () => {
    it('should queue when at capacity', async () => {
      const resolvers: Array<() => void> = [];
      const calls: Promise<number>[] = [];

      // Fill up concurrent slots
      for (let i = 0; i < 2; i++) {
        calls.push(bulkhead.execute(() => new Promise<number>(r => {
          resolvers.push(() => r(i));
        })));
      }

      await new Promise(r => setTimeout(r, 0));

      // This should be queued
      const queuedCall = bulkhead.execute(async () => 'queued');

      await new Promise(r => setTimeout(r, 0));
      expect(bulkhead.getQueueLength()).toBe(1);

      // Complete first call
      resolvers[0]();
      await calls[0];

      // Queued call should now execute
      const queuedResult = await queuedCall;
      expect(queuedResult).toBe('queued');
    });

    it('should reject when queue is full', async () => {
      // Create a fresh bulkhead for this test
      const fullBulkhead = new Bulkhead({
        name: 'full-test',
        maxConcurrent: 2,
        maxQueue: 2,
        queueTimeout: 1000,
      });

      const resolvers: Array<() => void> = [];

      // Fill up concurrent slots + queue
      for (let i = 0; i < 4; i++) {
        fullBulkhead.execute(() => new Promise<void>((resolve) => {
          resolvers.push(resolve);
        })).catch(() => {}); // Ignore errors
      }

      await new Promise(r => setTimeout(r, 0));

      // This should be rejected
      await expect(fullBulkhead.execute(async () => 'overflow'))
        .rejects.toThrow(BulkheadError);

      // Clean up
      resolvers.forEach(r => r());
    });

    it('should timeout queued calls', async () => {
      // Create a new bulkhead for this test to avoid interference
      const timeoutBulkhead = new Bulkhead({
        name: 'timeout-test',
        maxConcurrent: 2,
        maxQueue: 2,
        queueTimeout: 50,
      });

      const blockingCalls: Array<{ resolve: () => void }> = [];

      // Fill up concurrent slots with controllable promises
      for (let i = 0; i < 2; i++) {
        const controller = { resolve: () => {} };
        timeoutBulkhead.execute(() => new Promise<void>((resolve) => {
          controller.resolve = resolve;
        })).catch(() => {}); // Ignore errors from these
        blockingCalls.push(controller);
      }

      await new Promise(r => setTimeout(r, 0));

      // Queue a call that will timeout
      const queuedCall = timeoutBulkhead.execute(async () => 'timeout');

      await expect(queuedCall).rejects.toThrow(BulkheadError);

      const stats = timeoutBulkhead.getStats();
      expect(stats.totalQueueTimeout).toBe(1);

      // Clean up - resolve blocking calls
      blockingCalls.forEach(c => c.resolve());
    });
  });

  describe('stats', () => {
    it('should track execution stats', async () => {
      await bulkhead.execute(async () => 'a');
      await bulkhead.execute(async () => 'b');

      const stats = bulkhead.getStats();
      expect(stats.totalExecuted).toBe(2);
      expect(stats.name).toBe('test');
      expect(stats.maxConcurrent).toBe(2);
    });

    it('should track rejected calls', async () => {
      const noQueueBulkhead = new Bulkhead({
        name: 'no-queue',
        maxConcurrent: 1,
        maxQueue: 0,
      });

      // Fill the slot
      noQueueBulkhead.execute(() => new Promise<void>(() => {}));

      await new Promise(r => setTimeout(r, 0));

      // Try another call
      try {
        await noQueueBulkhead.execute(async () => 'reject');
      } catch {
        // Expected
      }

      expect(noQueueBulkhead.getStats().totalRejected).toBe(1);
    });
  });

  describe('availability', () => {
    it('should report availability', () => {
      expect(bulkhead.isAvailable()).toBe(true);
    });

    it('should report unavailable when full', async () => {
      const noQueueBulkhead = new Bulkhead({
        name: 'no-queue',
        maxConcurrent: 1,
        maxQueue: 0,
      });

      noQueueBulkhead.execute(() => new Promise<void>(() => {}));

      await new Promise(r => setTimeout(r, 0));
      expect(noQueueBulkhead.isAvailable()).toBe(false);
    });

    it('should report available when queue has space', async () => {
      // Fill concurrent slots
      for (let i = 0; i < 2; i++) {
        bulkhead.execute(() => new Promise<void>(() => {}));
      }

      await new Promise(r => setTimeout(r, 0));

      // Queue has space
      expect(bulkhead.isAvailable()).toBe(true);
      expect(bulkhead.getAvailableSlots()).toBe(0);
    });
  });

  describe('callbacks', () => {
    it('should call onExecute', async () => {
      const onExecute = vi.fn();
      const callbackBulkhead = new Bulkhead({
        name: 'callback',
        maxConcurrent: 1,
        onExecute,
      });

      await callbackBulkhead.execute(async () => 'success');
      expect(onExecute).toHaveBeenCalled();
    });

    it('should call onComplete with duration', async () => {
      const onComplete = vi.fn();
      const callbackBulkhead = new Bulkhead({
        name: 'callback',
        maxConcurrent: 1,
        onComplete,
      });

      await callbackBulkhead.execute(async () => {
        await new Promise(r => setTimeout(r, 20));
        return 'success';
      });

      expect(onComplete).toHaveBeenCalledWith(expect.any(Number));
      // Allow some timing variance (should be at least 15ms for 20ms sleep)
      expect(onComplete.mock.calls[0][0]).toBeGreaterThanOrEqual(15);
    });

    it('should call onReject with reason', async () => {
      const onReject = vi.fn();
      const callbackBulkhead = new Bulkhead({
        name: 'callback',
        maxConcurrent: 1,
        maxQueue: 0,
        onReject,
      });

      callbackBulkhead.execute(() => new Promise<void>(() => {}));

      await new Promise(r => setTimeout(r, 0));

      try {
        await callbackBulkhead.execute(async () => 'reject');
      } catch {
        // Expected
      }

      expect(onReject).toHaveBeenCalledWith('full');
    });
  });
});

describe('BulkheadRegistry', () => {
  let registry: BulkheadRegistry;

  beforeEach(() => {
    registry = new BulkheadRegistry({
      maxConcurrent: 5,
    });
  });

  it('should create and cache bulkheads', () => {
    const bh1 = registry.get('service-a');
    const bh2 = registry.get('service-a');
    expect(bh1).toBe(bh2);
  });

  it('should create different bulkheads for different names', () => {
    const bh1 = registry.get('service-a');
    const bh2 = registry.get('service-b');
    expect(bh1).not.toBe(bh2);
  });

  it('should apply default options', () => {
    const bh = registry.get('test');
    expect(bh.getStats().maxConcurrent).toBe(5);
  });

  it('should allow override options', () => {
    const bh = registry.get('test', { maxConcurrent: 10 });
    expect(bh.getStats().maxConcurrent).toBe(10);
  });

  it('should get all stats', async () => {
    const bh1 = registry.get('service-a');
    const bh2 = registry.get('service-b');

    await bh1.execute(async () => 'a');
    await bh2.execute(async () => 'b');

    const stats = registry.getAllStats();
    expect(stats['service-a'].totalExecuted).toBe(1);
    expect(stats['service-b'].totalExecuted).toBe(1);
  });

  it('should remove bulkhead', () => {
    registry.get('test');
    expect(registry.remove('test')).toBe(true);
    expect(registry.remove('test')).toBe(false);
  });

  it('should clear all bulkheads', () => {
    registry.get('a');
    registry.get('b');
    registry.clear();
    expect(registry.getAll().size).toBe(0);
  });
});

describe('withBulkhead', () => {
  it('should wrap function with bulkhead', async () => {
    const bulkhead = new Bulkhead({ name: 'wrap', maxConcurrent: 1 });
    const fn = async (x: number) => x * 2;
    const wrapped = withBulkhead(fn, bulkhead);

    const result = await wrapped(5);
    expect(result).toBe(10);
    expect(bulkhead.getStats().totalExecuted).toBe(1);
  });
});
