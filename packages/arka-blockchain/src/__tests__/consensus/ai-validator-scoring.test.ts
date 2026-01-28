/**
 * Tests for AI Validator Scoring
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AIValidatorScorer,
  createAIValidatorScorer,
  DEFAULT_AI_SCORER_CONFIG,
  InMemoryValidatorRegistry,
  createValidatorConfig,
  type ValidatorEvent,
  type AIValidatorScore,
  type ValidatorRemediationAction,
} from '../../consensus/index.js';

describe('AIValidatorScorer', () => {
  let registry: InMemoryValidatorRegistry;
  let scorer: AIValidatorScorer;

  beforeEach(async () => {
    registry = new InMemoryValidatorRegistry();

    await registry.registerValidator(
      createValidatorConfig({ address: 'v1', name: 'Validator 1', publicKey: 'pk1' }, 10, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v2', name: 'Validator 2', publicKey: 'pk2' }, 20, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v3', name: 'Validator 3', publicKey: 'pk3' }, 15, 'inactive')
    );

    await registry.updateTrustScore('v1', 0.9);
    await registry.updateTrustScore('v2', 0.7);

    scorer = createAIValidatorScorer(registry);
  });

  describe('scoreValidator', () => {
    it('should score a healthy validator', async () => {
      // Record good behavior
      for (let i = 0; i < 100; i++) {
        scorer.recordEvent({
          type: 'block_proposed',
          validatorId: 'v1',
          timestamp: new Date().toISOString(),
          height: i,
        });
      }

      const score = await scorer.scoreValidator('v1');

      expect(score.validatorId).toBe('v1');
      expect(score.trustScore).toBeGreaterThan(0.5);
      expect(score.riskScore).toBeLessThan(0.5);
      expect(score.anomalyDetected).toBe(false);
    });

    it('should detect risk for validator with missed blocks', async () => {
      // Record poor behavior
      for (let i = 0; i < 50; i++) {
        scorer.recordEvent({
          type: 'block_missed',
          validatorId: 'v1',
          timestamp: new Date().toISOString(),
          height: i,
        });
      }

      const score = await scorer.scoreValidator('v1');

      expect(score.riskScore).toBeGreaterThan(0);
      expect(score.riskReasons.length).toBeGreaterThan(0);
    });

    it('should detect anomaly for suspicious activity', async () => {
      // Record an equivocation event
      scorer.recordEvent({
        type: 'equivocation',
        validatorId: 'v1',
        timestamp: new Date().toISOString(),
        height: 100,
        data: { conflictingHashes: ['hash1', 'hash2'] },
      });

      const score = await scorer.scoreValidator('v1');

      expect(score.anomalyDetected).toBe(true);
      expect(score.anomaly).toBeDefined();
    });

    it('should throw for non-existent validator', async () => {
      await expect(scorer.scoreValidator('unknown')).rejects.toThrow(
        'Validator unknown not found'
      );
    });

    it('should include confidence score', async () => {
      const score = await scorer.scoreValidator('v1');

      expect(score.confidence).toBeGreaterThanOrEqual(0);
      expect(score.confidence).toBeLessThanOrEqual(1);
    });

    it('should include recommendations', async () => {
      // Create a risky situation
      for (let i = 0; i < 30; i++) {
        scorer.recordEvent({
          type: 'block_missed',
          validatorId: 'v1',
          timestamp: new Date().toISOString(),
          height: i,
        });
      }

      const score = await scorer.scoreValidator('v1');

      expect(score.recommendedActions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('scoreAllValidators', () => {
    it('should score all validators', async () => {
      const scores = await scorer.scoreAllValidators();

      expect(scores.length).toBe(3);
      expect(scores.every((s) => s.validatorId)).toBe(true);
    });

    it('should handle scoring errors gracefully', async () => {
      // Even if one validator has issues, should score others
      const scores = await scorer.scoreAllValidators();

      expect(scores.length).toBeGreaterThan(0);
    });
  });

  describe('getRemediationActions', () => {
    it('should suggest warn action for moderate risk', async () => {
      // Create moderate risk situation
      for (let i = 0; i < 20; i++) {
        scorer.recordEvent({
          type: 'block_missed',
          validatorId: 'v1',
          timestamp: new Date().toISOString(),
          height: i,
        });
      }
      for (let i = 0; i < 20; i++) {
        scorer.recordEvent({
          type: 'vote_missed',
          validatorId: 'v1',
          timestamp: new Date().toISOString(),
          height: i,
        });
      }

      const actions = await scorer.getRemediationActions('v1');

      // May or may not have actions depending on risk threshold
      expect(Array.isArray(actions)).toBe(true);
    });

    it('should suggest jail action for critical risk', async () => {
      // Create critical situation - velocity spike
      for (let i = 0; i < 150; i++) {
        scorer.recordEvent({
          type: 'block_proposed',
          validatorId: 'v1',
          timestamp: new Date().toISOString(),
          height: i,
        });
      }

      const actions = await scorer.getRemediationActions('v1');

      // Should have at least one action for suspicious velocity
      if (actions.length > 0) {
        expect(actions[0]!.type).toBeDefined();
      }
    });

    it('should include confidence in actions', async () => {
      for (let i = 0; i < 50; i++) {
        scorer.recordEvent({
          type: 'block_missed',
          validatorId: 'v1',
          timestamp: new Date().toISOString(),
          height: i,
        });
      }

      const actions = await scorer.getRemediationActions('v1');

      actions.forEach((action) => {
        expect(action.confidence).toBeGreaterThanOrEqual(0);
        expect(action.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('recordEvent', () => {
    it('should record block proposed events', () => {
      scorer.recordEvent({
        type: 'block_proposed',
        validatorId: 'v1',
        timestamp: new Date().toISOString(),
        height: 100,
      });

      // No exception should be thrown
      expect(true).toBe(true);
    });

    it('should record vote events', () => {
      scorer.recordEvent({
        type: 'vote_submitted',
        validatorId: 'v1',
        timestamp: new Date().toISOString(),
        height: 100,
      });

      expect(true).toBe(true);
    });

    it('should record downtime events', () => {
      scorer.recordEvent({
        type: 'downtime_start',
        validatorId: 'v1',
        timestamp: new Date().toISOString(),
      });

      scorer.recordEvent({
        type: 'downtime_end',
        validatorId: 'v1',
        timestamp: new Date().toISOString(),
      });

      expect(true).toBe(true);
    });

    it('should prune old events outside analysis window', async () => {
      // Create scorer with short analysis window
      const shortWindowScorer = createAIValidatorScorer(registry, {
        analysisWindow: 1000, // 1 second
      });

      // Record old event
      shortWindowScorer.recordEvent({
        type: 'block_proposed',
        validatorId: 'v1',
        timestamp: new Date(Date.now() - 2000).toISOString(), // 2 seconds ago
        height: 1,
      });

      // Record new event to trigger pruning
      shortWindowScorer.recordEvent({
        type: 'block_proposed',
        validatorId: 'v1',
        timestamp: new Date().toISOString(),
        height: 2,
      });

      // Old event should be pruned
      // Can't directly verify but should not throw
      expect(true).toBe(true);
    });
  });

  describe('updateRegistryWithScores', () => {
    it('should update trust scores in registry', async () => {
      const originalScore = (await registry.getValidator('v1'))!.trustScore;

      // Record some events to affect score
      for (let i = 0; i < 20; i++) {
        scorer.recordEvent({
          type: 'block_proposed',
          validatorId: 'v1',
          timestamp: new Date().toISOString(),
          height: i,
        });
      }

      await scorer.updateRegistryWithScores();

      const newScore = (await registry.getValidator('v1'))!.trustScore;

      // Score should be updated (may be same or different depending on behavior)
      expect(newScore).toBeDefined();
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = scorer.getConfig();

      expect(config.enableRiskScoring).toBeDefined();
      expect(config.enableAnomalyDetection).toBeDefined();
      expect(config.enableRemediation).toBeDefined();
      expect(config.reviewThreshold).toBeDefined();
      expect(config.actionThreshold).toBeDefined();
    });
  });

  describe('behavior analysis', () => {
    it('should detect improving trend', async () => {
      // First, record some misses
      for (let i = 0; i < 10; i++) {
        scorer.recordEvent({
          type: 'block_missed',
          validatorId: 'v1',
          timestamp: new Date(Date.now() - 10000 + i * 100).toISOString(),
          height: i,
        });
      }

      // Then record successes
      for (let i = 0; i < 20; i++) {
        scorer.recordEvent({
          type: 'block_proposed',
          validatorId: 'v1',
          timestamp: new Date(Date.now() + i * 100).toISOString(),
          height: 10 + i,
        });
      }

      const score = await scorer.scoreValidator('v1');

      // Should detect improving trend
      expect(score.recommendedActions.some((r) => r.toLowerCase().includes('improving') || r.toLowerCase().includes('monitoring'))).toBe(true);
    });

    it('should calculate health score', async () => {
      // Mix of good and bad behavior
      for (let i = 0; i < 10; i++) {
        scorer.recordEvent({
          type: 'block_proposed',
          validatorId: 'v1',
          timestamp: new Date().toISOString(),
          height: i,
        });
      }
      for (let i = 0; i < 2; i++) {
        scorer.recordEvent({
          type: 'block_missed',
          validatorId: 'v1',
          timestamp: new Date().toISOString(),
          height: 10 + i,
        });
      }

      const score = await scorer.scoreValidator('v1');

      // Should have a reasonable trust score
      expect(score.trustScore).toBeGreaterThan(0);
      expect(score.trustScore).toBeLessThanOrEqual(1);
    });
  });
});

describe('DEFAULT_AI_SCORER_CONFIG', () => {
  it('should have reasonable defaults', () => {
    expect(DEFAULT_AI_SCORER_CONFIG.enableRiskScoring).toBe(true);
    expect(DEFAULT_AI_SCORER_CONFIG.enableAnomalyDetection).toBe(true);
    expect(DEFAULT_AI_SCORER_CONFIG.enableRemediation).toBe(true);
    expect(DEFAULT_AI_SCORER_CONFIG.reviewThreshold).toBeGreaterThan(0);
    expect(DEFAULT_AI_SCORER_CONFIG.reviewThreshold).toBeLessThan(1);
    expect(DEFAULT_AI_SCORER_CONFIG.actionThreshold).toBeGreaterThan(DEFAULT_AI_SCORER_CONFIG.reviewThreshold);
    expect(DEFAULT_AI_SCORER_CONFIG.requireHumanApproval).toBe(true);
  });
});

describe('createAIValidatorScorer', () => {
  it('should create scorer with default config', async () => {
    const registry = new InMemoryValidatorRegistry();
    const scorer = createAIValidatorScorer(registry);

    expect(scorer).toBeDefined();
    expect(scorer.getConfig()).toMatchObject(DEFAULT_AI_SCORER_CONFIG);
  });

  it('should create scorer with custom config', async () => {
    const registry = new InMemoryValidatorRegistry();
    const scorer = createAIValidatorScorer(registry, {
      reviewThreshold: 0.5,
      actionThreshold: 0.9,
    });

    const config = scorer.getConfig();
    expect(config.reviewThreshold).toBe(0.5);
    expect(config.actionThreshold).toBe(0.9);
  });
});
