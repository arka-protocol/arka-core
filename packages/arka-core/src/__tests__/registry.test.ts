/**
 * Tests for RuleRegistry and EntityTypeRegistry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RuleRegistry,
  EntityTypeRegistry,
  getDefaultRuleRegistry,
  getDefaultEntityTypeRegistry,
  resetDefaultRegistries,
} from '../registry.js';
import type { ArkaRule, ArkaEntityType, ArkaEvent, ArkaEntity } from '@arka/types';

// Helper to create a test rule
function createTestRule(overrides: Partial<ArkaRule> = {}): ArkaRule {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: 'Test Rule',
    description: 'A test rule',
    status: 'ACTIVE',
    severity: 'MEDIUM',
    tags: ['test'],
    metadata: {},
    condition: { type: 'compare', field: 'enabled', operator: '==', value: true },
    consequence: { decision: 'ALLOW', code: 'TEST_ALLOWED', message: 'Test allowed' },
    ...overrides,
  };
}

// Helper to create a test entity type
function createTestEntityType(overrides: Partial<ArkaEntityType> = {}): ArkaEntityType {
  return {
    name: `TestEntity_${Date.now()}`,
    description: 'A test entity type',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        value: { type: 'number' },
      },
      required: ['name'],
    },
    metadata: {},
    ...overrides,
  };
}

describe('RuleRegistry', () => {
  let registry: RuleRegistry;

  beforeEach(() => {
    registry = new RuleRegistry();
  });

  describe('registerRule', () => {
    it('should register a rule successfully', () => {
      const rule = createTestRule({ id: 'rule-1' });
      registry.registerRule(rule);

      expect(registry.getRule('rule-1')).toEqual({ ...rule, version: 1 });
    });

    it('should register a rule with a specific version', () => {
      const rule = createTestRule({ id: 'rule-1' });
      registry.registerRule(rule, 2);

      expect(registry.getRule('rule-1')?.version).toBe(2);
    });

    it('should update existing rule when re-registering', () => {
      const rule1 = createTestRule({ id: 'rule-1', name: 'Original' });
      const rule2 = createTestRule({ id: 'rule-1', name: 'Updated' });

      registry.registerRule(rule1, 1);
      registry.registerRule(rule2, 2);

      expect(registry.getRule('rule-1')?.name).toBe('Updated');
      expect(registry.getRule('rule-1')?.version).toBe(2);
    });
  });

  describe('getRule', () => {
    it('should return undefined for non-existent rule', () => {
      expect(registry.getRule('non-existent')).toBeUndefined();
    });

    it('should return the latest version of a rule', () => {
      const rule = createTestRule({ id: 'rule-1' });
      registry.registerRule(rule, 1);
      registry.registerRule({ ...rule, name: 'V2' }, 2);

      expect(registry.getRule('rule-1')?.name).toBe('V2');
    });
  });

  describe('getRuleVersion', () => {
    it('should return a specific version of a rule', () => {
      const rule = createTestRule({ id: 'rule-1' });
      registry.registerRule({ ...rule, name: 'V1' }, 1);
      registry.registerRule({ ...rule, name: 'V2' }, 2);

      expect(registry.getRuleVersion('rule-1', 1)?.name).toBe('V1');
      expect(registry.getRuleVersion('rule-1', 2)?.name).toBe('V2');
    });

    it('should return undefined for non-existent version', () => {
      const rule = createTestRule({ id: 'rule-1' });
      registry.registerRule(rule, 1);

      expect(registry.getRuleVersion('rule-1', 99)).toBeUndefined();
    });
  });

  describe('getRuleVersions', () => {
    it('should return all versions sorted', () => {
      const rule = createTestRule({ id: 'rule-1' });
      registry.registerRule({ ...rule, name: 'V1' }, 1);
      registry.registerRule({ ...rule, name: 'V3' }, 3);
      registry.registerRule({ ...rule, name: 'V2' }, 2);

      const versions = registry.getRuleVersions('rule-1');
      expect(versions).toHaveLength(3);
      expect(versions[0]!.version).toBe(1);
      expect(versions[1]!.version).toBe(2);
      expect(versions[2]!.version).toBe(3);
    });

    it('should return empty array for non-existent rule', () => {
      expect(registry.getRuleVersions('non-existent')).toEqual([]);
    });
  });

  describe('unregisterRule', () => {
    it('should remove a rule and return true', () => {
      const rule = createTestRule({ id: 'rule-1' });
      registry.registerRule(rule);

      expect(registry.unregisterRule('rule-1')).toBe(true);
      expect(registry.getRule('rule-1')).toBeUndefined();
    });

    it('should return false for non-existent rule', () => {
      expect(registry.unregisterRule('non-existent')).toBe(false);
    });

    it('should remove all versions when unregistering', () => {
      const rule = createTestRule({ id: 'rule-1' });
      registry.registerRule(rule, 1);
      registry.registerRule(rule, 2);

      registry.unregisterRule('rule-1');

      expect(registry.getRuleVersions('rule-1')).toEqual([]);
    });
  });

  describe('getAllRules', () => {
    it('should return empty array when no rules registered', () => {
      expect(registry.getAllRules()).toEqual([]);
    });

    it('should return all registered rules', () => {
      registry.registerRule(createTestRule({ id: 'rule-1' }));
      registry.registerRule(createTestRule({ id: 'rule-2' }));
      registry.registerRule(createTestRule({ id: 'rule-3' }));

      expect(registry.getAllRules()).toHaveLength(3);
    });
  });

  describe('getRules with filters', () => {
    beforeEach(() => {
      registry.registerRule(createTestRule({
        id: 'rule-1',
        status: 'ACTIVE',
        severity: 'HIGH',
        appliesToEntityType: 'Customer',
        appliesToEventType: 'KYC_CHECK',
        jurisdiction: 'US',
        tags: ['aml', 'kyc'],
      }));
      registry.registerRule(createTestRule({
        id: 'rule-2',
        status: 'ACTIVE',
        severity: 'MEDIUM',
        appliesToEntityType: 'Transaction',
        appliesToEventType: 'TRANSACTION_SCREEN',
        jurisdiction: 'EU',
        tags: ['sanctions'],
      }));
      registry.registerRule(createTestRule({
        id: 'rule-3',
        status: 'DRAFT',
        severity: 'LOW',
        appliesToEntityType: 'Customer',
        tags: ['test'],
      }));
    });

    it('should filter by entityType', () => {
      const rules = registry.getRules({ entityType: 'Customer' });
      expect(rules).toHaveLength(2);
    });

    it('should filter by eventType', () => {
      const rules = registry.getRules({ eventType: 'KYC_CHECK' });
      // Rules without appliesToEventType match all event types, so rule-3 also matches
      expect(rules).toHaveLength(2);
      expect(rules.some(r => r.id === 'rule-1')).toBe(true);
    });

    it('should filter by jurisdiction', () => {
      const rules = registry.getRules({ jurisdiction: 'EU' });
      // Rules without jurisdiction match all jurisdictions, so rule-3 also matches
      expect(rules).toHaveLength(2);
      expect(rules.some(r => r.id === 'rule-2')).toBe(true);
    });

    it('should filter by status', () => {
      const rules = registry.getRules({ status: 'ACTIVE' });
      expect(rules).toHaveLength(2);
    });

    it('should filter by severity', () => {
      const rules = registry.getRules({ severity: 'HIGH' });
      expect(rules).toHaveLength(1);
      expect(rules[0]!.id).toBe('rule-1');
    });

    it('should filter by tags', () => {
      const rules = registry.getRules({ tags: ['aml'] });
      expect(rules).toHaveLength(1);
      expect(rules[0]!.id).toBe('rule-1');
    });

    it('should combine multiple filters', () => {
      const rules = registry.getRules({
        status: 'ACTIVE',
        entityType: 'Customer',
      });
      expect(rules).toHaveLength(1);
      expect(rules[0]!.id).toBe('rule-1');
    });
  });

  describe('clear', () => {
    it('should remove all rules', () => {
      registry.registerRule(createTestRule({ id: 'rule-1' }));
      registry.registerRule(createTestRule({ id: 'rule-2' }));

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getAllRules()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return correct count', () => {
      expect(registry.size).toBe(0);

      registry.registerRule(createTestRule({ id: 'rule-1' }));
      expect(registry.size).toBe(1);

      registry.registerRule(createTestRule({ id: 'rule-2' }));
      expect(registry.size).toBe(2);

      registry.unregisterRule('rule-1');
      expect(registry.size).toBe(1);
    });
  });
});

describe('EntityTypeRegistry', () => {
  let registry: EntityTypeRegistry;

  beforeEach(() => {
    registry = new EntityTypeRegistry();
  });

  describe('registerEntityType', () => {
    it('should register an entity type successfully', () => {
      const type = createTestEntityType({ name: 'Customer' });
      registry.registerEntityType(type);

      expect(registry.getEntityType('Customer')).toEqual(type);
    });

    it('should update existing entity type', () => {
      const type1 = createTestEntityType({ name: 'Customer', description: 'Original' });
      const type2 = createTestEntityType({ name: 'Customer', description: 'Updated' });

      registry.registerEntityType(type1);
      registry.registerEntityType(type2);

      expect(registry.getEntityType('Customer')?.description).toBe('Updated');
    });
  });

  describe('getEntityType', () => {
    it('should return undefined for non-existent type', () => {
      expect(registry.getEntityType('NonExistent')).toBeUndefined();
    });
  });

  describe('unregisterEntityType', () => {
    it('should remove an entity type and return true', () => {
      const type = createTestEntityType({ name: 'Customer' });
      registry.registerEntityType(type);

      expect(registry.unregisterEntityType('Customer')).toBe(true);
      expect(registry.getEntityType('Customer')).toBeUndefined();
    });

    it('should return false for non-existent type', () => {
      expect(registry.unregisterEntityType('NonExistent')).toBe(false);
    });
  });

  describe('getAllEntityTypes', () => {
    it('should return all registered entity types', () => {
      registry.registerEntityType(createTestEntityType({ name: 'Customer' }));
      registry.registerEntityType(createTestEntityType({ name: 'Transaction' }));

      expect(registry.getAllEntityTypes()).toHaveLength(2);
    });
  });

  describe('hasEntityType', () => {
    it('should return true for existing type', () => {
      registry.registerEntityType(createTestEntityType({ name: 'Customer' }));
      expect(registry.hasEntityType('Customer')).toBe(true);
    });

    it('should return false for non-existing type', () => {
      expect(registry.hasEntityType('NonExistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entity types', () => {
      registry.registerEntityType(createTestEntityType({ name: 'Customer' }));
      registry.registerEntityType(createTestEntityType({ name: 'Transaction' }));

      registry.clear();

      expect(registry.size).toBe(0);
    });
  });

  describe('size', () => {
    it('should return correct count', () => {
      expect(registry.size).toBe(0);

      registry.registerEntityType(createTestEntityType({ name: 'Customer' }));
      expect(registry.size).toBe(1);

      registry.registerEntityType(createTestEntityType({ name: 'Transaction' }));
      expect(registry.size).toBe(2);
    });
  });
});

describe('Default Registries', () => {
  beforeEach(() => {
    resetDefaultRegistries();
  });

  it('should return singleton rule registry', () => {
    const registry1 = getDefaultRuleRegistry();
    const registry2 = getDefaultRuleRegistry();

    expect(registry1).toBe(registry2);
  });

  it('should return singleton entity type registry', () => {
    const registry1 = getDefaultEntityTypeRegistry();
    const registry2 = getDefaultEntityTypeRegistry();

    expect(registry1).toBe(registry2);
  });

  it('should reset default registries', () => {
    const ruleRegistry = getDefaultRuleRegistry();
    const entityRegistry = getDefaultEntityTypeRegistry();

    ruleRegistry.registerRule(createTestRule({ id: 'test' }));
    entityRegistry.registerEntityType(createTestEntityType({ name: 'Test' }));

    resetDefaultRegistries();

    expect(ruleRegistry.size).toBe(0);
    expect(entityRegistry.size).toBe(0);
  });
});
