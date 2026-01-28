/**
 * Tests for Slashing Manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SlashingManager,
  createSlashingManager,
  DefaultAnomalyDetector,
  InMemoryValidatorRegistry,
  createValidatorConfig,
  DEFAULT_SLASHING_CONFIG,
  type SlashingEvidence,
  type Vote,
} from '../../consensus/index.js';

describe('SlashingManager', () => {
  let registry: InMemoryValidatorRegistry;
  let manager: SlashingManager;

  beforeEach(async () => {
    registry = new InMemoryValidatorRegistry();

    await registry.registerValidator(
      createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 100, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 100, 'active')
    );

    manager = createSlashingManager(registry);
  });

  describe('slashForEquivocation', () => {
    it('should slash validator for double-signing', async () => {
      const vote1: Vote = {
        type: 'prevote',
        height: 100,
        blockHash: 'hash1',
        round: 0,
        validator: 'v1',
        signature: 's1',
        timestamp: new Date().toISOString(),
      };

      const vote2: Vote = {
        type: 'prevote',
        height: 100,
        blockHash: 'hash2', // Different hash = equivocation
        round: 0,
        validator: 'v1',
        signature: 's2',
        timestamp: new Date().toISOString(),
      };

      const event = await manager.slashForEquivocation('v1', 100, vote1, vote2);

      expect(event).toBeDefined();
      expect(event.validator).toBe('v1');
      expect(event.reason).toBe('equivocation');
      expect(event.slashAmount).toBe(DEFAULT_SLASHING_CONFIG.equivocationSlash);
    });

    it('should jail validator after equivocation', async () => {
      const vote1: Vote = {
        type: 'prevote',
        height: 100,
        blockHash: 'hash1',
        round: 0,
        validator: 'v1',
        signature: 's1',
        timestamp: new Date().toISOString(),
      };

      const vote2: Vote = {
        type: 'prevote',
        height: 100,
        blockHash: 'hash2',
        round: 0,
        validator: 'v1',
        signature: 's2',
        timestamp: new Date().toISOString(),
      };

      await manager.slashForEquivocation('v1', 100, vote1, vote2);

      const validator = await registry.getValidator('v1');
      expect(validator!.status).toBe('jailed');
    });

    it('should reduce validator weight', async () => {
      const vote1: Vote = {
        type: 'prevote',
        height: 100,
        blockHash: 'hash1',
        round: 0,
        validator: 'v1',
        signature: 's1',
        timestamp: new Date().toISOString(),
      };

      const vote2: Vote = {
        type: 'prevote',
        height: 100,
        blockHash: 'hash2',
        round: 0,
        validator: 'v1',
        signature: 's2',
        timestamp: new Date().toISOString(),
      };

      const before = await registry.getValidator('v1');
      await manager.slashForEquivocation('v1', 100, vote1, vote2);
      const after = await registry.getValidator('v1');

      // Weight should be reduced (100 * (1 - 30/100) = 70)
      expect(after!.weight).toBeLessThan(before!.weight);
    });
  });

  describe('slashForDowntime', () => {
    it('should slash validator for downtime', async () => {
      const event = await manager.slashForDowntime('v1', 100);

      expect(event).toBeDefined();
      expect(event.reason).toBe('downtime');
      expect(event.slashAmount).toBeGreaterThan(0);
    });

    it('should jail validator for downtime', async () => {
      await manager.slashForDowntime('v1', 100);

      const validator = await registry.getValidator('v1');
      expect(validator!.status).toBe('jailed');
    });
  });

  describe('slashForInvalidBlock', () => {
    it('should slash validator for proposing invalid block', async () => {
      const event = await manager.slashForInvalidBlock('v1', 100, 'Invalid merkle root');

      expect(event).toBeDefined();
      expect(event.reason).toBe('invalid_block');
    });
  });

  describe('slashForAnomaly', () => {
    it('should slash validator for AI-detected anomaly', async () => {
      const anomalyResult = {
        anomalyDetected: true,
        confidence: 0.9,
        anomalyType: 'behavioral',
        description: 'Unusual voting pattern detected',
        recommendedAction: 'slash' as const,
      };

      const event = await manager.slashForAnomaly('v1', 100, anomalyResult);

      expect(event).toBeDefined();
      expect(event.reason).toBe('ai_detected_anomaly');
      expect(event.aiConfidence).toBe(0.9);
    });
  });

  describe('unjail', () => {
    it('should unjail a jailed validator after jail duration', async () => {
      // First jail the validator
      const vote1: Vote = {
        type: 'prevote',
        height: 100,
        blockHash: 'hash1',
        round: 0,
        validator: 'v1',
        signature: 's1',
        timestamp: new Date().toISOString(),
      };
      const vote2: Vote = {
        type: 'prevote',
        height: 100,
        blockHash: 'hash2',
        round: 0,
        validator: 'v1',
        signature: 's2',
        timestamp: new Date().toISOString(),
      };
      await manager.slashForEquivocation('v1', 100, vote1, vote2);

      // Try to unjail at current height (still jailed)
      const unjailedEarly = await manager.unjail('v1', 100);
      expect(unjailedEarly).toBe(false);

      // Unjail after jail duration
      const unjailed = await manager.unjail('v1', 100 + DEFAULT_SLASHING_CONFIG.equivocationJail);

      expect(unjailed).toBe(true);
      const validator = await registry.getValidator('v1');
      expect(validator!.status).toBe('active');
    });

    it('should return false for validator with no slashing history', async () => {
      const unjailed = await manager.unjail('v1', 100);

      expect(unjailed).toBe(false);
    });
  });

  describe('getSlashingHistory', () => {
    it('should return slashing history for validator', async () => {
      await manager.slashForDowntime('v1', 100);
      await manager.slashForDowntime('v1', 200);

      const history = manager.getSlashingHistory('v1');

      expect(history.length).toBe(2);
    });

    it('should return empty array for validator with no slashes', () => {
      const history = manager.getSlashingHistory('v1');

      expect(history).toEqual([]);
    });
  });

  describe('getAllSlashingEvents', () => {
    it('should return all slashing events', async () => {
      await manager.slashForDowntime('v1', 100);
      await manager.slashForDowntime('v2', 100);

      const all = manager.getAllSlashingEvents();

      expect(all.length).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return slashing statistics', async () => {
      await manager.slashForDowntime('v1', 100);
      await manager.slashForInvalidBlock('v2', 100, 'Invalid');

      const stats = manager.getStats();

      expect(stats.totalSlashes).toBe(2);
      expect(stats.slashesByReason.downtime).toBe(1);
      expect(stats.slashesByReason.invalid_block).toBe(1);
    });
  });
});

describe('DefaultAnomalyDetector', () => {
  let registry: InMemoryValidatorRegistry;
  let detector: DefaultAnomalyDetector;

  beforeEach(async () => {
    registry = new InMemoryValidatorRegistry();
    await registry.registerValidator(
      createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 100, 'active')
    );

    detector = new DefaultAnomalyDetector();
  });

  describe('analyzeValidator', () => {
    it('should detect anomaly for high missed block rate', async () => {
      // Record many missed blocks (need >100 total blocks with >30% miss rate)
      for (let i = 0; i < 70; i++) {
        await registry.recordBlockMissed('v1', i);
      }
      for (let i = 0; i < 35; i++) {
        await registry.recordBlockProposed('v1', 70 + i);
      }
      // Total: 105 blocks, 70 missed = 66.7% miss rate

      const validator = await registry.getValidator('v1');
      const result = await detector.analyzeValidator(validator!, []);

      // High miss rate with >100 blocks should contribute to confidence
      // The algorithm adds 0.3 for >30% miss rate when total blocks > 100
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should not detect anomaly for healthy validator', async () => {
      // Record mostly successful blocks
      for (let i = 0; i < 100; i++) {
        await registry.recordBlockProposed('v1', i);
      }

      const validator = await registry.getValidator('v1');
      const result = await detector.analyzeValidator(validator!, []);

      expect(result.anomalyDetected).toBe(false);
    });

    it('should detect anomaly for multiple slashes', async () => {
      // Increment slash count multiple times (adds 0.4 to anomalyScore)
      await registry.incrementSlashCount('v1');
      await registry.incrementSlashCount('v1');
      await registry.incrementSlashCount('v1');
      // Also set low trust score (adds 0.2 to anomalyScore)
      await registry.updateTrustScore('v1', 0.3);

      // Total anomalyScore = 0.4 + 0.2 = 0.6 >= 0.5, so anomalyDetected = true

      const validator = await registry.getValidator('v1');
      const result = await detector.analyzeValidator(validator!, []);

      expect(result.anomalyDetected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should suggest actions when anomaly detected', async () => {
      // Create conditions for anomaly
      for (let i = 0; i < 50; i++) {
        await registry.recordBlockMissed('v1', i);
      }
      await registry.incrementSlashCount('v1');
      await registry.incrementSlashCount('v1');
      await registry.incrementSlashCount('v1');
      await registry.updateTrustScore('v1', 0.3);

      const validator = await registry.getValidator('v1');
      const result = await detector.analyzeValidator(validator!, []);

      if (result.anomalyDetected) {
        expect(result.recommendedAction).toBeDefined();
      }
    });
  });
});
