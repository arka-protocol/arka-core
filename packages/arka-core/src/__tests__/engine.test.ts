/**
 * Tests for ArkaEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ArkaEngine,
  getDefaultEngine,
  setDefaultEngine,
  resetDefaultEngine,
} from '../engine.js';
import type { ArkaRule, ArkaEntityType, ArkaEvent, ArkaEntity } from '@arka-protocol/types';

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
    name: 'TestEntity',
    description: 'A test entity type',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        amount: { type: 'number' },
      },
      required: ['name'],
    },
    metadata: {},
    ...overrides,
  };
}

// Helper to create a test event
function createTestEvent(overrides: Partial<ArkaEvent> = {}): ArkaEvent {
  return {
    id: `event-${Date.now()}`,
    type: 'TEST_EVENT',
    source: 'test',
    payload: {},
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a test entity
function createTestEntity(overrides: Partial<ArkaEntity> = {}): ArkaEntity {
  return {
    id: `entity-${Date.now()}`,
    type: 'TestEntity',
    data: { name: 'Test' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ArkaEngine', () => {
  let engine: ArkaEngine;

  beforeEach(() => {
    engine = new ArkaEngine();
  });

  describe('Entity Type Management', () => {
    it('should register an entity type', () => {
      const entityType = createTestEntityType({ name: 'Customer' });
      engine.registerEntityType(entityType);

      expect(engine.getEntityType('Customer')).toEqual(entityType);
    });

    it('should get all entity types', () => {
      engine.registerEntityType(createTestEntityType({ name: 'Customer' }));
      engine.registerEntityType(createTestEntityType({ name: 'Transaction' }));

      const types = engine.getAllEntityTypes();
      expect(types).toHaveLength(2);
    });

    it('should check if entity type exists', () => {
      engine.registerEntityType(createTestEntityType({ name: 'Customer' }));

      expect(engine.hasEntityType('Customer')).toBe(true);
      expect(engine.hasEntityType('NonExistent')).toBe(false);
    });
  });

  describe('Rule Management', () => {
    it('should register a rule', () => {
      const rule = createTestRule({ id: 'rule-1' });
      engine.registerRule(rule);

      expect(engine.getRule('rule-1')).toBeDefined();
    });

    it('should register a rule with version', () => {
      const rule = createTestRule({ id: 'rule-1' });
      engine.registerRule(rule, 2);

      expect(engine.getRule('rule-1')?.version).toBe(2);
    });

    it('should get specific rule version', () => {
      const rule = createTestRule({ id: 'rule-1' });
      engine.registerRule({ ...rule, name: 'V1' }, 1);
      engine.registerRule({ ...rule, name: 'V2' }, 2);

      expect(engine.getRuleVersion('rule-1', 1)?.name).toBe('V1');
      expect(engine.getRuleVersion('rule-1', 2)?.name).toBe('V2');
    });

    it('should get all rule versions', () => {
      const rule = createTestRule({ id: 'rule-1' });
      engine.registerRule(rule, 1);
      engine.registerRule(rule, 2);
      engine.registerRule(rule, 3);

      expect(engine.getRuleVersions('rule-1')).toHaveLength(3);
    });

    it('should unregister a rule', () => {
      const rule = createTestRule({ id: 'rule-1' });
      engine.registerRule(rule);

      expect(engine.unregisterRule('rule-1')).toBe(true);
      expect(engine.getRule('rule-1')).toBeUndefined();
    });

    it('should get all rules', () => {
      engine.registerRule(createTestRule({ id: 'rule-1' }));
      engine.registerRule(createTestRule({ id: 'rule-2' }));

      expect(engine.getAllRules()).toHaveLength(2);
    });

    it('should filter rules', () => {
      engine.registerRule(createTestRule({ id: 'rule-1', status: 'ACTIVE' }));
      engine.registerRule(createTestRule({ id: 'rule-2', status: 'DRAFT' }));

      const activeRules = engine.getRules({ status: 'ACTIVE' });
      expect(activeRules).toHaveLength(1);
      expect(activeRules[0]!.id).toBe('rule-1');
    });
  });

  describe('Entity Validation', () => {
    beforeEach(() => {
      engine.registerEntityType(createTestEntityType({ name: 'Customer' }));
    });

    it('should validate a valid entity', () => {
      const entity = createTestEntity({
        type: 'Customer',
        data: { name: 'John', amount: 100 },
      });

      const result = engine.validateEntity(entity);
      expect(result.valid).toBe(true);
    });

    it('should reject an invalid entity', () => {
      const entity = createTestEntity({
        type: 'Customer',
        data: { amount: 100 }, // missing required 'name'
      });

      const result = engine.validateEntity(entity);
      expect(result.valid).toBe(false);
    });

    it('should return error for unknown entity type', () => {
      const entity = createTestEntity({ type: 'Unknown' });

      const result = engine.validateEntity(entity);
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.message).toContain('Unknown');
    });

    it('should throw for invalid entity when configured', () => {
      const strictEngine = new ArkaEngine({
        validateEntities: true,
        throwOnValidationError: true,
      });
      strictEngine.registerEntityType(createTestEntityType({ name: 'Customer' }));

      const entity = createTestEntity({ type: 'Unknown' });

      expect(() => strictEngine.validateEntityOrThrow(entity)).toThrow();
    });
  });

  describe('Rule Evaluation', () => {
    beforeEach(() => {
      engine.registerEntityType(createTestEntityType({ name: 'Customer' }));
    });

    it('should evaluate rules and return a decision', () => {
      const rule = createTestRule({
        id: 'rule-1',
        status: 'ACTIVE',
        consequence: { decision: 'ALLOW', code: 'ALLOWED', message: 'Allowed' },
      });
      engine.registerRule(rule);

      const event = createTestEvent();
      const decision = engine.evaluateRules({ event });

      expect(decision).toBeDefined();
      expect(decision.eventId).toBe(event.id);
    });

    it('should evaluate with explicit rules', () => {
      const rules = [
        createTestRule({
          id: 'explicit-rule',
          consequence: { decision: 'FLAG', code: 'FLAGGED', message: 'Flagged' },
        }),
      ];

      const event = createTestEvent();
      const decision = engine.evaluateRules({ event, rules });

      expect(decision).toBeDefined();
    });

    it('should evaluate with entity context', () => {
      const rule = createTestRule({
        id: 'rule-1',
        status: 'ACTIVE',
        appliesToEntityType: 'Customer',
        consequence: { decision: 'ALLOW', code: 'ALLOWED', message: 'Allowed' },
      });
      engine.registerRule(rule);

      const event = createTestEvent();
      const entity = createTestEntity({
        type: 'Customer',
        data: { name: 'John' },
      });

      const decision = engine.evaluateRules({ event, entity });
      expect(decision).toBeDefined();
    });

    it('should get active rules for event', () => {
      engine.registerRule(createTestRule({
        id: 'rule-1',
        status: 'ACTIVE',
        appliesToEventType: 'KYC_CHECK',
      }));
      engine.registerRule(createTestRule({
        id: 'rule-2',
        status: 'ACTIVE',
        appliesToEventType: 'TRANSACTION_SCREEN',
      }));
      engine.registerRule(createTestRule({
        id: 'rule-3',
        status: 'DRAFT',
        appliesToEventType: 'KYC_CHECK',
      }));

      const event = createTestEvent({ type: 'KYC_CHECK' });
      const activeRules = engine.getActiveRulesFor(event);

      // Should only include active rules that match event type or have no event type filter
      expect(activeRules.every(r => r.status === 'ACTIVE')).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use default config', () => {
      const defaultEngine = new ArkaEngine();
      // Default config has validateEntities: true, throwOnValidationError: false
      expect(defaultEngine).toBeDefined();
    });

    it('should accept custom config', () => {
      const customEngine = new ArkaEngine({
        validateEntities: false,
        throwOnValidationError: true,
      });
      expect(customEngine).toBeDefined();
    });
  });

  describe('Utility Methods', () => {
    it('should reset engine state', () => {
      engine.registerRule(createTestRule({ id: 'rule-1' }));
      engine.registerEntityType(createTestEntityType({ name: 'Customer' }));

      engine.reset();

      expect(engine.getAllRules()).toHaveLength(0);
      expect(engine.getAllEntityTypes()).toHaveLength(0);
    });

    it('should return correct stats', () => {
      engine.registerRule(createTestRule({ id: 'rule-1' }));
      engine.registerRule(createTestRule({ id: 'rule-2' }));
      engine.registerEntityType(createTestEntityType({ name: 'Customer' }));

      const stats = engine.getStats();
      expect(stats.ruleCount).toBe(2);
      expect(stats.entityTypeCount).toBe(1);
    });
  });
});

describe('Default Engine', () => {
  beforeEach(() => {
    resetDefaultEngine();
  });

  it('should return singleton instance', () => {
    const engine1 = getDefaultEngine();
    const engine2 = getDefaultEngine();

    expect(engine1).toBe(engine2);
  });

  it('should allow setting custom default engine', () => {
    const customEngine = new ArkaEngine({ validateEntities: false });
    setDefaultEngine(customEngine);

    expect(getDefaultEngine()).toBe(customEngine);
  });

  it('should reset default engine', () => {
    const engine = getDefaultEngine();
    engine.registerRule(createTestRule({ id: 'test' }));

    resetDefaultEngine();

    expect(engine.getAllRules()).toHaveLength(0);
  });
});
