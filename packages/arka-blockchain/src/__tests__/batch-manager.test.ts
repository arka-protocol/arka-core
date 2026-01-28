/**
 * Tests for Batch Manager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DefaultBatchManager, AutoAnchoringBatchManager } from '../batch-manager.js';
import type { AnchorRequest } from '../types.js';

describe('DefaultBatchManager', () => {
  let batchManager: DefaultBatchManager;

  beforeEach(() => {
    batchManager = new DefaultBatchManager({
      maxBatchSize: 10,
      maxBatchAge: 60000, // 1 minute
      minBatchSize: 1,
    });
  });

  describe('addRecord', () => {
    it('should add a record and return hash', () => {
      const record = { id: 'test-1', data: 'test data' };

      const hash = batchManager.addRecord(record);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should increment batch size', () => {
      expect(batchManager.getBatchSize()).toBe(0);

      batchManager.addRecord({ id: '1' });
      expect(batchManager.getBatchSize()).toBe(1);

      batchManager.addRecord({ id: '2' });
      expect(batchManager.getBatchSize()).toBe(2);
    });

    it('should throw when batch is full', () => {
      // Fill the batch
      for (let i = 0; i < 10; i++) {
        batchManager.addRecord({ id: i });
      }

      expect(() => batchManager.addRecord({ id: 'overflow' })).toThrow(
        'Batch is full'
      );
    });

    it('should return same hash for identical records', () => {
      const record = { id: 'test', value: 123 };

      const hash1 = batchManager.addRecord(record);

      // Create a new batch manager and add the same record
      const newManager = new DefaultBatchManager({ maxBatchSize: 10 });
      const hash2 = newManager.addRecord(record);

      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different records', () => {
      const hash1 = batchManager.addRecord({ id: '1' });
      const hash2 = batchManager.addRecord({ id: '2' });

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getBatchSize', () => {
    it('should return 0 for empty batch', () => {
      expect(batchManager.getBatchSize()).toBe(0);
    });
  });

  describe('isReadyToAnchor', () => {
    it('should return false when below minimum batch size', () => {
      const manager = new DefaultBatchManager({
        maxBatchSize: 10,
        minBatchSize: 3,
      });

      manager.addRecord({ id: '1' });
      manager.addRecord({ id: '2' });

      expect(manager.isReadyToAnchor()).toBe(false);
    });

    it('should return true when max batch size reached', () => {
      for (let i = 0; i < 10; i++) {
        batchManager.addRecord({ id: i });
      }

      expect(batchManager.isReadyToAnchor()).toBe(true);
    });

    it('should return true when batch age exceeds threshold', () => {
      vi.useFakeTimers();

      batchManager.addRecord({ id: '1' });

      // Advance time past the max age
      vi.advanceTimersByTime(61000);

      expect(batchManager.isReadyToAnchor()).toBe(true);

      vi.useRealTimers();
    });

    it('should return false for empty batch', () => {
      expect(batchManager.isReadyToAnchor()).toBe(false);
    });
  });

  describe('finalizeBatch', () => {
    it('should return anchor request with merkle root', () => {
      batchManager.addRecord({ id: '1' });
      batchManager.addRecord({ id: '2' });
      batchManager.addRecord({ id: '3' });

      const request = batchManager.finalizeBatch();

      expect(request.batchId).toBeDefined();
      expect(request.merkleRoot).toBeDefined();
      expect(request.recordCount).toBe(3);
      expect(request.recordHashes).toHaveLength(3);
      expect(request.metadata).toBeDefined();
    });

    it('should throw for empty batch', () => {
      expect(() => batchManager.finalizeBatch()).toThrow(
        'Cannot finalize empty batch'
      );
    });

    it('should include timing metadata', () => {
      batchManager.addRecord({ id: '1' });

      const request = batchManager.finalizeBatch();

      expect(request.metadata?.batchStartTime).toBeDefined();
      expect(request.metadata?.batchEndTime).toBeDefined();
      expect(request.metadata!.batchEndTime! >= request.metadata!.batchStartTime!).toBe(true);
    });

    it('should generate unique batch IDs', () => {
      batchManager.addRecord({ id: '1' });
      const request1 = batchManager.finalizeBatch();

      batchManager.clearBatch();
      batchManager.addRecord({ id: '2' });
      const request2 = batchManager.finalizeBatch();

      expect(request1.batchId).not.toBe(request2.batchId);
    });
  });

  describe('clearBatch', () => {
    it('should reset batch to empty state', () => {
      batchManager.addRecord({ id: '1' });
      batchManager.addRecord({ id: '2' });

      batchManager.clearBatch();

      expect(batchManager.getBatchSize()).toBe(0);
      expect(batchManager.getBatchAge()).toBe(0);
    });
  });

  describe('getProof', () => {
    it('should return merkle proof for existing record', () => {
      const hash = batchManager.addRecord({ id: '1' });
      batchManager.addRecord({ id: '2' });
      batchManager.addRecord({ id: '3' });

      const proof = batchManager.getProof(hash);

      expect(proof).toBeDefined();
      expect(proof!.leaf).toBeDefined();
      expect(proof!.root).toBeDefined();
      expect(proof!.proof).toBeDefined();
      expect(Array.isArray(proof!.proof)).toBe(true);
    });

    it('should return null for non-existent record', () => {
      batchManager.addRecord({ id: '1' });

      const proof = batchManager.getProof('non-existent-hash');

      expect(proof).toBeNull();
    });
  });

  describe('getRecordHashes', () => {
    it('should return hashes in order', () => {
      const hash1 = batchManager.addRecord({ id: '1' });
      const hash2 = batchManager.addRecord({ id: '2' });
      const hash3 = batchManager.addRecord({ id: '3' });

      const hashes = batchManager.getRecordHashes();

      expect(hashes).toEqual([hash1, hash2, hash3]);
    });

    it('should return empty array for empty batch', () => {
      expect(batchManager.getRecordHashes()).toEqual([]);
    });
  });

  describe('hasRecord', () => {
    it('should return true for existing record', () => {
      const hash = batchManager.addRecord({ id: '1' });

      expect(batchManager.hasRecord(hash)).toBe(true);
    });

    it('should return false for non-existent record', () => {
      expect(batchManager.hasRecord('non-existent')).toBe(false);
    });
  });

  describe('getBatchAge', () => {
    it('should return 0 for empty batch', () => {
      expect(batchManager.getBatchAge()).toBe(0);
    });

    it('should return elapsed time since first record', () => {
      vi.useFakeTimers();

      batchManager.addRecord({ id: '1' });

      vi.advanceTimersByTime(5000);

      expect(batchManager.getBatchAge()).toBe(5000);

      vi.useRealTimers();
    });
  });
});

describe('AutoAnchoringBatchManager', () => {
  let batchManager: AutoAnchoringBatchManager;

  beforeEach(() => {
    vi.useFakeTimers();
    batchManager = new AutoAnchoringBatchManager({
      maxBatchSize: 5,
      maxBatchAge: 1000,
      minBatchSize: 1,
    });
  });

  afterEach(() => {
    batchManager.stopAutoAnchor();
    vi.useRealTimers();
  });

  describe('startAutoAnchor', () => {
    it('should trigger anchor callback when batch is ready', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);

      // Fill batch to max
      for (let i = 0; i < 5; i++) {
        batchManager.addRecord({ id: i });
      }

      batchManager.startAutoAnchor(callback, 100);

      // Advance past check interval
      await vi.advanceTimersByTimeAsync(150);

      expect(callback).toHaveBeenCalled();
    });

    it('should clear batch after successful anchor', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);

      for (let i = 0; i < 5; i++) {
        batchManager.addRecord({ id: i });
      }

      batchManager.startAutoAnchor(callback, 100);

      await vi.advanceTimersByTimeAsync(150);

      expect(batchManager.getBatchSize()).toBe(0);
    });

    it('should not clear batch if anchor fails', async () => {
      const callback = vi.fn().mockRejectedValue(new Error('Anchor failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      for (let i = 0; i < 5; i++) {
        batchManager.addRecord({ id: i });
      }

      batchManager.startAutoAnchor(callback, 100);

      await vi.advanceTimersByTimeAsync(150);

      // Batch should NOT be cleared on failure
      expect(batchManager.getBatchSize()).toBe(5);

      consoleSpy.mockRestore();
    });
  });

  describe('stopAutoAnchor', () => {
    it('should stop auto-anchoring checks', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);

      batchManager.startAutoAnchor(callback, 100);
      batchManager.stopAutoAnchor();

      for (let i = 0; i < 5; i++) {
        batchManager.addRecord({ id: i });
      }

      await vi.advanceTimersByTimeAsync(500);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('forceAnchor', () => {
    it('should anchor immediately regardless of batch state', async () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      batchManager = new AutoAnchoringBatchManager(
        { maxBatchSize: 10 },
        callback
      );

      batchManager.addRecord({ id: '1' });

      const request = await batchManager.forceAnchor();

      expect(request).toBeDefined();
      expect(request!.recordCount).toBe(1);
      expect(callback).toHaveBeenCalled();
    });

    it('should return null for empty batch', async () => {
      const request = await batchManager.forceAnchor();

      expect(request).toBeNull();
    });

    it('should clear batch after force anchor', async () => {
      batchManager.addRecord({ id: '1' });
      batchManager.addRecord({ id: '2' });

      await batchManager.forceAnchor();

      expect(batchManager.getBatchSize()).toBe(0);
    });
  });
});
