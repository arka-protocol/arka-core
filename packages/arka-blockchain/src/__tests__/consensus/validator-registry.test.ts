/**
 * Tests for Validator Registry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryValidatorRegistry,
  createValidatorConfig,
  getValidatorsByWeight,
  calculateVotingPower,
  type ValidatorConfig,
} from '../../consensus/index.js';

describe('InMemoryValidatorRegistry', () => {
  let registry: InMemoryValidatorRegistry;

  beforeEach(() => {
    registry = new InMemoryValidatorRegistry();
  });

  describe('registerValidator', () => {
    it('should register a new validator', async () => {
      const config = createValidatorConfig(
        { address: 'val-1', name: 'Validator 1', publicKey: 'pk1' },
        10,
        'active'
      );

      await registry.registerValidator(config);

      const validator = await registry.getValidator('val-1');
      expect(validator).toBeDefined();
      expect(validator!.id.address).toBe('val-1');
      expect(validator!.id.name).toBe('Validator 1');
      expect(validator!.weight).toBe(10);
      expect(validator!.status).toBe('active');
    });

    it('should reject duplicate validator addresses', async () => {
      const config1 = createValidatorConfig(
        { address: 'val-1', name: 'Validator 1', publicKey: 'pk1' },
        10,
        'active'
      );
      const config2 = createValidatorConfig(
        { address: 'val-1', name: 'Validator 1 Again', publicKey: 'pk2' },
        15,
        'active'
      );

      await registry.registerValidator(config1);
      await expect(registry.registerValidator(config2)).rejects.toThrow(
        'Validator val-1 already registered'
      );
    });

    it('should allow registering multiple validators', async () => {
      for (let i = 1; i <= 5; i++) {
        const config = createValidatorConfig(
          { address: `val-${i}`, name: `Validator ${i}`, publicKey: `pk${i}` },
          10,
          'active'
        );
        await registry.registerValidator(config);
      }

      const all = await registry.getAllValidators();
      expect(all.length).toBe(5);
    });
  });

  describe('removeValidator', () => {
    it('should remove an existing validator', async () => {
      const config = createValidatorConfig(
        { address: 'val-1', name: 'Validator 1', publicKey: 'pk1' },
        10,
        'active'
      );
      await registry.registerValidator(config);

      const removed = await registry.removeValidator('val-1');

      expect(removed).toBe(true);
      expect(await registry.getValidator('val-1')).toBeNull();
    });

    it('should return false for non-existent validator', async () => {
      const removed = await registry.removeValidator('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('getValidator', () => {
    it('should return validator by address', async () => {
      const config = createValidatorConfig(
        { address: 'val-1', name: 'Validator 1', publicKey: 'pk1' },
        10,
        'active'
      );
      await registry.registerValidator(config);

      const validator = await registry.getValidator('val-1');

      expect(validator).toBeDefined();
      expect(validator!.id.address).toBe('val-1');
    });

    it('should return null for non-existent validator', async () => {
      const validator = await registry.getValidator('non-existent');
      expect(validator).toBeNull();
    });
  });

  describe('getAllValidators', () => {
    it('should return all registered validators', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );
      await registry.registerValidator(
        createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 20, 'active')
      );

      const all = await registry.getAllValidators();

      expect(all.length).toBe(2);
      expect(all.map((v) => v.id.address)).toContain('v1');
      expect(all.map((v) => v.id.address)).toContain('v2');
    });

    it('should return empty array when no validators', async () => {
      const all = await registry.getAllValidators();
      expect(all).toEqual([]);
    });
  });

  describe('getActiveValidators', () => {
    it('should return only active validators', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );
      await registry.registerValidator(
        createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 20, 'inactive')
      );
      await registry.registerValidator(
        createValidatorConfig({ address: 'v3', name: 'V3', publicKey: 'pk3' }, 15, 'active')
      );

      const active = await registry.getActiveValidators();

      expect(active.length).toBe(2);
      expect(active.every((v) => v.status === 'active')).toBe(true);
    });
  });

  describe('isValidator', () => {
    it('should return true for registered validator', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );

      expect(await registry.isValidator('v1')).toBe(true);
    });

    it('should return false for non-registered address', async () => {
      expect(await registry.isValidator('unknown')).toBe(false);
    });
  });

  describe('isActiveValidator', () => {
    it('should return true for active validator', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );

      expect(await registry.isActiveValidator('v1')).toBe(true);
    });

    it('should return false for inactive validator', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'inactive')
      );

      expect(await registry.isActiveValidator('v1')).toBe(false);
    });

    it('should return false for jailed validator', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'jailed')
      );

      expect(await registry.isActiveValidator('v1')).toBe(false);
    });
  });

  describe('updateStatus', () => {
    it('should update validator status', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );

      await registry.updateStatus('v1', 'jailed');

      const validator = await registry.getValidator('v1');
      expect(validator!.status).toBe('jailed');
    });

    it('should throw for non-existent validator', async () => {
      await expect(registry.updateStatus('unknown', 'active')).rejects.toThrow(
        'Validator unknown not found'
      );
    });
  });

  describe('updateWeight', () => {
    it('should update validator weight', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );

      await registry.updateWeight('v1', 25);

      const validator = await registry.getValidator('v1');
      expect(validator!.weight).toBe(25);
    });

    it('should reject weights outside valid range', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );

      await expect(registry.updateWeight('v1', 0)).rejects.toThrow(
        'Weight must be between 1 and 100'
      );
      await expect(registry.updateWeight('v1', 150)).rejects.toThrow(
        'Weight must be between 1 and 100'
      );
    });
  });

  describe('updateTrustScore', () => {
    it('should update trust score', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );

      await registry.updateTrustScore('v1', 0.85);

      const validator = await registry.getValidator('v1');
      expect(validator!.trustScore).toBe(0.85);
    });

    it('should reject trust score outside 0-1 range', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );

      await expect(registry.updateTrustScore('v1', 1.5)).rejects.toThrow(
        'Trust score must be between 0 and 1'
      );
      await expect(registry.updateTrustScore('v1', -0.5)).rejects.toThrow(
        'Trust score must be between 0 and 1'
      );
    });
  });

  describe('getTotalWeight', () => {
    it('should return total weight of all validators', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );
      await registry.registerValidator(
        createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 20, 'active')
      );
      await registry.registerValidator(
        createValidatorConfig({ address: 'v3', name: 'V3', publicKey: 'pk3' }, 15, 'inactive')
      );

      const total = await registry.getTotalWeight();

      expect(total).toBe(45); // All validators
    });
  });

  describe('getActiveWeight', () => {
    it('should return weight of only active validators', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );
      await registry.registerValidator(
        createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 20, 'active')
      );
      await registry.registerValidator(
        createValidatorConfig({ address: 'v3', name: 'V3', publicKey: 'pk3' }, 15, 'inactive')
      );

      const activeWeight = await registry.getActiveWeight();

      expect(activeWeight).toBe(30); // Only active validators
    });
  });

  describe('recordBlockProposed', () => {
    it('should increment blocks proposed count', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );

      await registry.recordBlockProposed('v1', 100);
      await registry.recordBlockProposed('v1', 101);

      const validator = await registry.getValidator('v1');
      expect(validator!.blocksProposed).toBe(2);
      expect(validator!.lastActiveHeight).toBe(101);
    });
  });

  describe('recordBlockMissed', () => {
    it('should increment blocks missed count', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );

      await registry.recordBlockMissed('v1', 100);
      await registry.recordBlockMissed('v1', 101);

      const validator = await registry.getValidator('v1');
      expect(validator!.blocksMissed).toBe(2);
    });
  });

  describe('getValidatorCount', () => {
    it('should return total count of validators', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );
      await registry.registerValidator(
        createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 20, 'inactive')
      );

      const count = await registry.getValidatorCount();

      expect(count).toBe(2);
    });
  });

  describe('getActiveValidatorCount', () => {
    it('should return count of active validators', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );
      await registry.registerValidator(
        createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 20, 'inactive')
      );
      await registry.registerValidator(
        createValidatorConfig({ address: 'v3', name: 'V3', publicKey: 'pk3' }, 15, 'active')
      );

      const count = await registry.getActiveValidatorCount();

      expect(count).toBe(2);
    });
  });

  describe('incrementSlashCount', () => {
    it('should increment slash count', async () => {
      await registry.registerValidator(
        createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
      );

      await registry.incrementSlashCount('v1');
      await registry.incrementSlashCount('v1');

      const validator = await registry.getValidator('v1');
      expect(validator!.slashCount).toBe(2);
    });
  });
});

describe('createValidatorConfig', () => {
  it('should create a valid validator config', () => {
    const config = createValidatorConfig(
      { address: 'addr1', name: 'Test', publicKey: 'pk' },
      10,
      'active'
    );

    expect(config.id.address).toBe('addr1');
    expect(config.id.name).toBe('Test');
    expect(config.id.publicKey).toBe('pk');
    expect(config.weight).toBe(10);
    expect(config.status).toBe('active');
    expect(config.trustScore).toBe(1.0);
    expect(config.registeredAt).toBeDefined();
    expect(config.blocksProposed).toBe(0);
    expect(config.blocksMissed).toBe(0);
    expect(config.slashCount).toBe(0);
  });

  it('should default status to pending', () => {
    const config = createValidatorConfig(
      { address: 'addr1', name: 'Test', publicKey: 'pk' }
    );

    expect(config.status).toBe('pending');
    expect(config.weight).toBe(10); // default weight
  });
});

describe('getValidatorsByWeight', () => {
  it('should sort validators by weight descending', async () => {
    const registry = new InMemoryValidatorRegistry();
    await registry.registerValidator(
      createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 30, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v3', name: 'V3', publicKey: 'pk3' }, 20, 'active')
    );

    const sorted = await getValidatorsByWeight(registry);

    expect(sorted[0]!.weight).toBe(30);
    expect(sorted[1]!.weight).toBe(20);
    expect(sorted[2]!.weight).toBe(10);
  });

  it('should only include active validators', async () => {
    const registry = new InMemoryValidatorRegistry();
    await registry.registerValidator(
      createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 30, 'jailed')
    );

    const sorted = await getValidatorsByWeight(registry);

    expect(sorted.length).toBe(1);
    expect(sorted[0]!.id.address).toBe('v1');
  });
});

describe('calculateVotingPower', () => {
  it('should calculate voting power as weight / total', () => {
    const power = calculateVotingPower(10, 40);

    expect(power).toBeCloseTo(0.25); // 10 / 40
  });

  it('should return 0 when total weight is 0', () => {
    const power = calculateVotingPower(10, 0);

    expect(power).toBe(0);
  });

  it('should handle equal weights', () => {
    const power = calculateVotingPower(20, 20);

    expect(power).toBe(1);
  });
});
