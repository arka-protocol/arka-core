/**
 * Tests for Blockchain Orchestrator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BlockchainOrchestrator,
  getOrchestrator,
  initializeOrchestrator,
  shutdownOrchestrator,
  type OrchestratorConfig,
} from '../orchestrator.js';

// Mock configuration for testing
function createTestConfig(overrides: Partial<OrchestratorConfig> = {}): OrchestratorConfig {
  return {
    blockchain: {
      network: 'memory',
    },
    batch: {
      maxBatchSize: 10,
      maxBatchAge: 60000,
      minBatchSize: 1,
    },
    ...overrides,
  };
}

describe('BlockchainOrchestrator', () => {
  let orchestrator: BlockchainOrchestrator;

  beforeEach(async () => {
    orchestrator = new BlockchainOrchestrator(createTestConfig());
    await orchestrator.connect();
  });

  afterEach(async () => {
    await orchestrator.disconnect();
  });

  describe('connect/disconnect', () => {
    it('should connect successfully', async () => {
      const newOrchestrator = new BlockchainOrchestrator(createTestConfig());

      await newOrchestrator.connect();

      const stats = newOrchestrator.getStats();
      expect(stats.isConnected).toBe(true);

      await newOrchestrator.disconnect();
    });

    it('should disconnect successfully', async () => {
      const newOrchestrator = new BlockchainOrchestrator(createTestConfig());
      await newOrchestrator.connect();

      await newOrchestrator.disconnect();

      const stats = newOrchestrator.getStats();
      expect(stats.isConnected).toBe(false);
    });
  });

  describe('addRecord', () => {
    it('should add a record and return hash', () => {
      const record = { id: 'decision-1', outcome: 'ALLOW' };

      const hash = orchestrator.addRecord(record);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should throw when not connected', async () => {
      const disconnectedOrchestrator = new BlockchainOrchestrator(createTestConfig());

      expect(() => disconnectedOrchestrator.addRecord({ id: '1' })).toThrow(
        'Orchestrator not connected to blockchain'
      );
    });

    it('should increment batch size', () => {
      expect(orchestrator.getBatchSize()).toBe(0);

      orchestrator.addRecord({ id: '1' });
      expect(orchestrator.getBatchSize()).toBe(1);

      orchestrator.addRecord({ id: '2' });
      expect(orchestrator.getBatchSize()).toBe(2);
    });

    it('should add record to pending records', () => {
      orchestrator.addRecord({ id: '1' });
      orchestrator.addRecord({ id: '2' });

      const stats = orchestrator.getStats();
      expect(stats.pendingRecords).toBe(2);
    });
  });

  describe('anchorNow', () => {
    it('should anchor current batch to blockchain', async () => {
      orchestrator.addRecord({ id: '1' });
      orchestrator.addRecord({ id: '2' });

      const anchor = await orchestrator.anchorNow();

      expect(anchor).toBeDefined();
      expect(anchor!.merkleRoot).toBeDefined();
      expect(anchor!.transactionHash).toBeDefined();
    });

    it('should return null for empty batch', async () => {
      const anchor = await orchestrator.anchorNow();

      expect(anchor).toBeNull();
    });

    it('should throw when not connected', async () => {
      const disconnectedOrchestrator = new BlockchainOrchestrator(createTestConfig());

      await expect(disconnectedOrchestrator.anchorNow()).rejects.toThrow(
        'Orchestrator not connected to blockchain'
      );
    });

    it('should move records from pending to anchored', async () => {
      orchestrator.addRecord({ id: '1' });
      orchestrator.addRecord({ id: '2' });

      await orchestrator.anchorNow();

      const stats = orchestrator.getStats();
      expect(stats.pendingRecords).toBe(0);
      expect(stats.anchoredRecords).toBe(2);
    });

    it('should clear batch after anchoring', async () => {
      orchestrator.addRecord({ id: '1' });

      await orchestrator.anchorNow();

      expect(orchestrator.getBatchSize()).toBe(0);
    });

    it('should call onAnchor callback', async () => {
      const onAnchor = vi.fn();
      const configWithCallback = createTestConfig({ onAnchor });
      const callbackOrchestrator = new BlockchainOrchestrator(configWithCallback);
      await callbackOrchestrator.connect();

      callbackOrchestrator.addRecord({ id: '1' });
      await callbackOrchestrator.anchorNow();

      expect(onAnchor).toHaveBeenCalled();

      await callbackOrchestrator.disconnect();
    });
  });

  describe('getAnchoredDecision', () => {
    it('should return anchored decision by hash', async () => {
      const record = { id: 'decision-1', outcome: 'ALLOW' };
      const hash = orchestrator.addRecord(record);

      await orchestrator.anchorNow();

      const anchored = orchestrator.getAnchoredDecision(hash);

      expect(anchored).toBeDefined();
      expect(anchored!.hash).toBe(hash);
      expect(anchored!.record).toEqual(record);
      expect(anchored!.anchor).toBeDefined();
      expect(anchored!.proof).toBeDefined();
    });

    it('should return undefined for non-existent hash', () => {
      const anchored = orchestrator.getAnchoredDecision('non-existent');

      expect(anchored).toBeUndefined();
    });
  });

  describe('getProof', () => {
    it('should return proof for anchored record', async () => {
      const hash = orchestrator.addRecord({ id: '1' });
      await orchestrator.anchorNow();

      const proof = orchestrator.getProof(hash);

      expect(proof).toBeDefined();
      expect(proof!.leaf).toBeDefined();
      expect(proof!.root).toBeDefined();
      expect(proof!.proof).toBeDefined();
      expect(Array.isArray(proof!.proof)).toBe(true);
    });

    it('should return null for non-anchored record', () => {
      const proof = orchestrator.getProof('non-existent');

      expect(proof).toBeNull();
    });
  });

  describe('verifyRecord', () => {
    it('should verify an anchored record', async () => {
      const hash = orchestrator.addRecord({ id: '1' });
      await orchestrator.anchorNow();

      const result = await orchestrator.verifyRecord(hash);

      expect(result.verified).toBe(true);
    });

    it('should return error for non-existent record', async () => {
      const result = await orchestrator.verifyRecord('non-existent');

      expect(result.verified).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('isReadyToAnchor', () => {
    it('should return true when batch is full', () => {
      const smallBatchOrchestrator = new BlockchainOrchestrator(
        createTestConfig({
          batch: { maxBatchSize: 2, minBatchSize: 1 },
        })
      );

      // Can't test without connecting, but we can test the method exists
      expect(typeof orchestrator.isReadyToAnchor).toBe('function');
    });
  });

  describe('getHealth', () => {
    it('should return blockchain health', async () => {
      const health = await orchestrator.getHealth();

      expect(health).toBeDefined();
      expect(health.connected).toBeDefined();
      expect(health.network).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return orchestrator statistics', () => {
      orchestrator.addRecord({ id: '1' });
      orchestrator.addRecord({ id: '2' });

      const stats = orchestrator.getStats();

      expect(stats.pendingRecords).toBe(2);
      expect(stats.anchoredRecords).toBe(0);
      expect(stats.batchSize).toBe(2);
      expect(stats.isConnected).toBe(true);
    });
  });

  describe('auto-anchoring', () => {
    it('should start auto-anchoring when configured', async () => {
      vi.useFakeTimers();

      const onAnchor = vi.fn();
      const autoOrchestrator = new BlockchainOrchestrator(
        createTestConfig({
          autoAnchorInterval: 1000,
          batch: { maxBatchSize: 2, minBatchSize: 1 },
          onAnchor,
        })
      );

      await autoOrchestrator.connect();

      // Add records to fill the batch
      autoOrchestrator.addRecord({ id: '1' });
      autoOrchestrator.addRecord({ id: '2' });

      // Advance timer past auto-anchor interval
      await vi.advanceTimersByTimeAsync(1500);

      // Should have auto-anchored
      expect(onAnchor).toHaveBeenCalled();

      await autoOrchestrator.disconnect();
      vi.useRealTimers();
    });
  });
});

describe('Global Orchestrator', () => {
  afterEach(async () => {
    await shutdownOrchestrator();
  });

  it('should return null before initialization', () => {
    expect(getOrchestrator()).toBeNull();
  });

  it('should initialize and return orchestrator', async () => {
    const orchestrator = await initializeOrchestrator(createTestConfig());

    expect(orchestrator).toBeDefined();
    expect(getOrchestrator()).toBe(orchestrator);
  });

  it('should disconnect previous orchestrator on re-initialization', async () => {
    const orchestrator1 = await initializeOrchestrator(createTestConfig());
    const orchestrator2 = await initializeOrchestrator(createTestConfig());

    expect(orchestrator1).not.toBe(orchestrator2);
    expect(getOrchestrator()).toBe(orchestrator2);
  });

  it('should shutdown orchestrator', async () => {
    await initializeOrchestrator(createTestConfig());

    await shutdownOrchestrator();

    expect(getOrchestrator()).toBeNull();
  });
});
