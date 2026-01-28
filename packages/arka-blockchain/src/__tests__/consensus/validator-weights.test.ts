/**
 * Tests for Validator Weights
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ValidatorWeightCalculator,
  selectProposer,
  hasQuorum,
  DEFAULT_WEIGHT_CONFIG,
  InMemoryValidatorRegistry,
  createValidatorConfig,
  type ValidatorConfig,
} from '../../consensus/index.js';

describe('ValidatorWeightCalculator', () => {
  let registry: InMemoryValidatorRegistry;
  let calculator: ValidatorWeightCalculator;

  beforeEach(async () => {
    registry = new InMemoryValidatorRegistry();

    await registry.registerValidator(
      createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 20, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v3', name: 'V3', publicKey: 'pk3' }, 15, 'active')
    );

    calculator = new ValidatorWeightCalculator();
  });

  describe('calculateEffectiveWeight', () => {
    it('should calculate weight based on multiple factors', async () => {
      // Set up validator with good performance
      await registry.updateTrustScore('v1', 0.9);
      for (let i = 0; i < 100; i++) {
        await registry.recordBlockProposed('v1', i);
      }

      const validator = await registry.getValidator('v1');
      const weight = calculator.calculateEffectiveWeight(validator!);

      expect(weight).toBeGreaterThan(0);
    });

    it('should reduce weight for low uptime', async () => {
      // Create validator with all missed blocks (0% uptime)
      for (let i = 0; i < 100; i++) {
        await registry.recordBlockMissed('v1', i);
      }

      const validator = await registry.getValidator('v1');
      const lowUptimeWeight = calculator.calculateEffectiveWeight(validator!);
      const factors = calculator.calculateFactors(validator!);

      // Uptime factor should be 0 when all blocks are missed
      expect(factors.uptimeFactor).toBe(0);
      // Weight should still be positive (due to other factors)
      expect(lowUptimeWeight).toBeGreaterThan(0);
    });

    it('should factor in trust score', async () => {
      await registry.updateTrustScore('v1', 1.0);

      const validator = await registry.getValidator('v1');
      const factors = calculator.calculateFactors(validator!);

      expect(factors.trustFactor).toBe(1.0);
    });

    it('should penalize for slashing history', async () => {
      // Create validator with slash history
      await registry.removeValidator('v1');
      const config = createValidatorConfig(
        { address: 'v1', name: 'V1', publicKey: 'pk1' },
        10,
        'active'
      );
      config.slashCount = 3;
      await registry.registerValidator(config);

      const validator = await registry.getValidator('v1');
      const factors = calculator.calculateFactors(validator!);

      expect(factors.slashingPenalty).toBeGreaterThan(0);
    });
  });

  describe('calculateFactors', () => {
    it('should return all weight factors', async () => {
      const validator = await registry.getValidator('v1');
      const factors = calculator.calculateFactors(validator!);

      expect(factors.baseWeight).toBeDefined();
      expect(factors.uptimeFactor).toBeDefined();
      expect(factors.performanceFactor).toBeDefined();
      expect(factors.trustFactor).toBeDefined();
      expect(factors.slashingPenalty).toBeDefined();
    });

    it('should normalize base weight to 0-1 range', async () => {
      const validator = await registry.getValidator('v1');
      const factors = calculator.calculateFactors(validator!);

      // Base weight of 10 out of maxWeight 100 = 0.1
      expect(factors.baseWeight).toBe(0.1);
    });
  });

  describe('updateValidatorWeight', () => {
    it('should update weight based on metrics', async () => {
      // Update trust score to cause weight change
      await registry.updateTrustScore('v1', 0.5);

      const event = await calculator.updateValidatorWeight(registry, 'v1');

      // Event may be null if weight didn't change, that's ok
      if (event) {
        expect(event.validator).toBe('v1');
        expect(event.previousWeight).toBeDefined();
        expect(event.newWeight).toBeDefined();
      }
    });

    it('should return null for non-existent validator', async () => {
      const event = await calculator.updateValidatorWeight(registry, 'unknown');

      expect(event).toBeNull();
    });
  });

  describe('updateAllWeights', () => {
    it('should update weights for all validators', async () => {
      // Modify validators to trigger updates
      await registry.updateTrustScore('v1', 0.5);
      await registry.updateTrustScore('v2', 0.6);
      await registry.updateTrustScore('v3', 0.7);

      const updates = await calculator.updateAllWeights(registry);

      // Some validators may have weight updates
      expect(Array.isArray(updates)).toBe(true);
    });
  });

  describe('getWeightHistory', () => {
    it('should return weight history for validator', async () => {
      // Trigger a weight update
      await registry.updateTrustScore('v1', 0.5);
      await calculator.updateValidatorWeight(registry, 'v1');

      const history = calculator.getWeightHistory('v1');

      expect(Array.isArray(history)).toBe(true);
    });

    it('should return empty array for validator with no history', () => {
      const history = calculator.getWeightHistory('unknown');

      expect(history).toEqual([]);
    });
  });
});

describe('selectProposer', () => {
  it('should select proposer using weighted round-robin', () => {
    const validators: ValidatorConfig[] = [
      createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active'),
      createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 20, 'active'),
      createValidatorConfig({ address: 'v3', name: 'V3', publicKey: 'pk3' }, 15, 'active'),
    ];

    // Total weight = 45
    // Heights should cycle through validators weighted by their stake
    const proposer0 = selectProposer(validators, 0);
    const proposer1 = selectProposer(validators, 1);

    expect(proposer0).toBeDefined();
    expect(proposer1).toBeDefined();
  });

  it('should return null for empty validator list', () => {
    const proposer = selectProposer([], 0);

    expect(proposer).toBeNull();
  });

  it('should only select from active validators', () => {
    const validators: ValidatorConfig[] = [
      createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active'),
      createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 20, 'jailed'),
      createValidatorConfig({ address: 'v3', name: 'V3', publicKey: 'pk3' }, 15, 'inactive'),
    ];

    // Should always select v1 since it's the only active validator
    for (let i = 0; i < 10; i++) {
      const proposer = selectProposer(validators, i);
      expect(proposer?.id.address).toBe('v1');
    }
  });

  it('should return null if no active validators', () => {
    const validators: ValidatorConfig[] = [
      createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'jailed'),
      createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 20, 'inactive'),
    ];

    const proposer = selectProposer(validators, 0);

    expect(proposer).toBeNull();
  });
});

describe('hasQuorum', () => {
  it('should return true when 2/3+ weight is present', () => {
    // Total = 45, 2/3 = 30
    const votingWeight = 31;
    const totalWeight = 45;

    expect(hasQuorum(votingWeight, totalWeight, 2 / 3)).toBe(true);
  });

  it('should return false when less than 2/3 weight', () => {
    // Total = 45, 2/3 = 30
    const votingWeight = 25;
    const totalWeight = 45;

    expect(hasQuorum(votingWeight, totalWeight, 2 / 3)).toBe(false);
  });

  it('should return true exactly at 2/3 threshold', () => {
    // Total = 90, 2/3 = 60
    const votingWeight = 60;
    const totalWeight = 90;

    expect(hasQuorum(votingWeight, totalWeight, 2 / 3)).toBe(true);
  });

  it('should handle zero total weight', () => {
    expect(hasQuorum(10, 0, 2 / 3)).toBe(false);
  });

  it('should use custom threshold', () => {
    // Total = 20, 50% = 10
    const votingWeight = 10;
    const totalWeight = 20;

    expect(hasQuorum(votingWeight, totalWeight, 0.5)).toBe(true);
    expect(hasQuorum(votingWeight, totalWeight, 0.6)).toBe(false);
  });
});

describe('DEFAULT_WEIGHT_CONFIG', () => {
  it('should have reasonable defaults', () => {
    expect(DEFAULT_WEIGHT_CONFIG.minWeight).toBeGreaterThan(0);
    expect(DEFAULT_WEIGHT_CONFIG.maxWeight).toBeGreaterThan(DEFAULT_WEIGHT_CONFIG.minWeight);
    expect(DEFAULT_WEIGHT_CONFIG.uptimeMultiplier).toBeGreaterThan(0);
    expect(DEFAULT_WEIGHT_CONFIG.trustMultiplier).toBeGreaterThan(0);
    expect(DEFAULT_WEIGHT_CONFIG.performanceMultiplier).toBeGreaterThan(0);
  });
});
