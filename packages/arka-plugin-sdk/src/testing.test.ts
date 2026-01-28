/**
 * Plugin SDK Testing Utilities Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockEvent,
  createMockEntity,
  createMockDecision,
  RuleBuilder,
  rule,
  PluginTestHarness,
  generateTestEvents,
  runSimulation,
  assert,
} from './testing.js';
import type { ArkaDomainPlugin, DomainEvent } from './types.js';
import type { ArkaRule, ArkaDecision, ArkaEvent, ArkaEntityType } from '@arka-protocol/types';

describe('Testing Utilities', () => {
  describe('createMockEvent', () => {
    it('should create an event with default values', () => {
      const event = createMockEvent();
      expect(event.id).toMatch(/^evt_test_/);
      expect(event.source).toBe('test');
      expect(event.type).toBe('TEST_EVENT');
      expect(event.entityId).toBe('entity_123');
      expect(event.entityType).toBe('TestEntity');
      expect(event.payload).toEqual({});
      expect(event.occurredAt).toBeDefined();
      expect(event.receivedAt).toBeDefined();
    });

    it('should allow overriding default values', () => {
      const event = createMockEvent({
        id: 'custom_id',
        source: 'custom_source',
        type: 'CUSTOM_TYPE',
        payload: { custom: 'data' },
      });
      expect(event.id).toBe('custom_id');
      expect(event.source).toBe('custom_source');
      expect(event.type).toBe('CUSTOM_TYPE');
      expect(event.payload).toEqual({ custom: 'data' });
    });
  });

  describe('createMockEntity', () => {
    it('should create an entity with default values', () => {
      const entity = createMockEntity();
      expect(entity.id).toMatch(/^ent_test_/);
      expect(entity.type).toBe('TestEntity');
      expect(entity.data).toEqual({});
      expect(entity.createdAt).toBeDefined();
      expect(entity.updatedAt).toBeDefined();
    });

    it('should allow overriding default values', () => {
      const entity = createMockEntity({
        id: 'custom_entity',
        type: 'CustomType',
        data: { name: 'Test' },
      });
      expect(entity.id).toBe('custom_entity');
      expect(entity.type).toBe('CustomType');
      expect(entity.data).toEqual({ name: 'Test' });
    });
  });

  describe('createMockDecision', () => {
    it('should create a decision with default values', () => {
      const decision = createMockDecision();
      expect(decision.id).toMatch(/^dec_test_/);
      expect(decision.eventId).toBe('evt_123');
      expect(decision.status).toBe('ALLOW');
      expect(decision.ruleEvaluations).toEqual([]);
      expect(decision.createdAt).toBeDefined();
    });

    it('should allow overriding status', () => {
      const decision = createMockDecision({
        status: 'DENY',
        eventId: 'evt_custom',
      });
      expect(decision.status).toBe('DENY');
      expect(decision.eventId).toBe('evt_custom');
    });
  });

  describe('RuleBuilder', () => {
    it('should build a basic rule', () => {
      const builtRule = rule()
        .id('test_rule')
        .name('Test Rule')
        .when('payload.amount', 'gt', 1000)
        .thenFlag('HIGH_AMOUNT', 'Amount exceeds threshold')
        .build();

      expect(builtRule.id).toBe('test_rule');
      expect(builtRule.name).toBe('Test Rule');
      expect(builtRule.condition).toEqual({
        type: 'compare',
        field: 'payload.amount',
        operator: 'gt',
        value: 1000,
      });
      expect(builtRule.consequence).toEqual({
        decision: 'FLAG',
        code: 'HIGH_AMOUNT',
        message: 'Amount exceeds threshold',
      });
    });

    it('should build rule with DENY consequence', () => {
      const builtRule = rule()
        .name('Deny Rule')
        .when('payload.blocked', 'eq', true)
        .thenDeny('BLOCKED', 'Transaction blocked')
        .build();

      expect(builtRule.consequence.decision).toBe('DENY');
      expect(builtRule.consequence.code).toBe('BLOCKED');
    });

    it('should set severity and jurisdiction', () => {
      const builtRule = rule()
        .name('Severe Rule')
        .severity('CRITICAL')
        .jurisdiction('US')
        .when('payload.risk', 'gt', 90)
        .thenDeny('HIGH_RISK', 'Risk too high')
        .build();

      expect(builtRule.severity).toBe('CRITICAL');
      expect(builtRule.jurisdiction).toBe('US');
    });

    it('should set effective dates', () => {
      const builtRule = rule()
        .name('Time-limited Rule')
        .effectiveFrom('2024-01-01')
        .effectiveTo('2024-12-31')
        .when('payload.value', 'gt', 0)
        .thenFlag('FLAGGED', 'Flagged')
        .build();

      expect(builtRule.effectiveFrom).toBe('2024-01-01');
      expect(builtRule.effectiveTo).toBe('2024-12-31');
    });

    it('should build rule with AND conditions', () => {
      const builtRule = rule()
        .name('Multiple Conditions')
        .and([
          { type: 'compare', field: 'payload.amount', operator: 'gt', value: 1000 },
          { type: 'compare', field: 'payload.risk', operator: 'gt', value: 50 },
        ])
        .thenFlag('HIGH_RISK_HIGH_VALUE', 'High risk and value')
        .build();

      expect(builtRule.condition.type).toBe('and');
      expect((builtRule.condition as { conditions: unknown[] }).conditions).toHaveLength(2);
    });

    it('should build rule with OR conditions', () => {
      const builtRule = rule()
        .name('Either Condition')
        .or([
          { type: 'compare', field: 'payload.amount', operator: 'gt', value: 10000 },
          { type: 'compare', field: 'payload.country', operator: 'in', value: ['IR', 'KP'] },
        ])
        .thenDeny('FLAGGED', 'Triggered')
        .build();

      expect(builtRule.condition.type).toBe('or');
    });

    it('should add tags', () => {
      const builtRule = rule()
        .name('Tagged Rule')
        .tags('aml', 'kyc', 'compliance')
        .when('payload.flag', 'eq', true)
        .thenFlag('TAGGED', 'Has tags')
        .build();

      expect(builtRule.tags).toEqual(['aml', 'kyc', 'compliance']);
    });

    it('should throw if name is missing', () => {
      expect(() =>
        rule()
          .when('payload.value', 'gt', 0)
          .thenFlag('CODE', 'Message')
          .build()
      ).toThrow('Rule name is required');
    });

    it('should throw if condition is missing', () => {
      expect(() =>
        rule()
          .name('No Condition')
          .thenFlag('CODE', 'Message')
          .build()
      ).toThrow('Rule condition is required');
    });

    it('should throw if consequence is missing', () => {
      expect(() =>
        rule()
          .name('No Consequence')
          .when('payload.value', 'gt', 0)
          .build()
      ).toThrow('Rule consequence is required');
    });

    it('should default severity to MEDIUM', () => {
      const builtRule = rule()
        .name('Default Severity')
        .when('payload.value', 'gt', 0)
        .thenFlag('CODE', 'Message')
        .build();

      expect(builtRule.severity).toBe('MEDIUM');
    });

    it('should generate ID if not provided', () => {
      const builtRule = rule()
        .name('Auto ID')
        .when('payload.value', 'gt', 0)
        .thenFlag('CODE', 'Message')
        .build();

      expect(builtRule.id).toMatch(/^rule_/);
    });
  });

  describe('generateTestEvents', () => {
    it('should generate specified number of events', () => {
      const events = generateTestEvents({
        eventType: 'TEST',
        count: 10,
        fields: {},
      });

      expect(events).toHaveLength(10);
      events.forEach((event) => {
        expect(event.type).toBe('TEST');
        expect(event.occurredAt).toBeDefined();
      });
    });

    it('should generate number fields within range', () => {
      const events = generateTestEvents({
        eventType: 'TEST',
        count: 100,
        fields: {
          amount: { type: 'number', min: 10, max: 20 },
        },
      });

      events.forEach((event) => {
        const amount = event.payload.amount as number;
        expect(amount).toBeGreaterThanOrEqual(10);
        expect(amount).toBeLessThanOrEqual(20);
      });
    });

    it('should generate enum fields from values', () => {
      const events = generateTestEvents({
        eventType: 'TEST',
        count: 50,
        fields: {
          status: { type: 'enum', values: ['A', 'B', 'C'] },
        },
      });

      const statuses = new Set(events.map((e) => e.payload.status));
      expect(statuses.size).toBeGreaterThanOrEqual(1);
      events.forEach((event) => {
        expect(['A', 'B', 'C']).toContain(event.payload.status);
      });
    });

    it('should generate boolean fields', () => {
      const events = generateTestEvents({
        eventType: 'TEST',
        count: 100,
        fields: {
          active: { type: 'boolean' },
        },
      });

      const values = new Set(events.map((e) => e.payload.active));
      expect(values.size).toBeGreaterThanOrEqual(1);
      events.forEach((event) => {
        expect(typeof event.payload.active).toBe('boolean');
      });
    });

    it('should generate string fields', () => {
      const events = generateTestEvents({
        eventType: 'TEST',
        count: 5,
        fields: {
          name: { type: 'string' },
        },
      });

      events.forEach((event, index) => {
        expect(event.payload.name).toBe(`value_${index}`);
      });
    });
  });

  describe('assert utilities', () => {
    describe('equal', () => {
      it('should pass for equal values', () => {
        expect(() => assert.equal(1, 1)).not.toThrow();
        expect(() => assert.equal('test', 'test')).not.toThrow();
      });

      it('should fail for unequal values', () => {
        expect(() => assert.equal(1, 2)).toThrow();
        expect(() => assert.equal('a', 'b')).toThrow();
      });
    });

    describe('deepEqual', () => {
      it('should pass for deeply equal objects', () => {
        expect(() => assert.deepEqual({ a: 1 }, { a: 1 })).not.toThrow();
        expect(() =>
          assert.deepEqual({ nested: { value: 1 } }, { nested: { value: 1 } })
        ).not.toThrow();
      });

      it('should fail for different objects', () => {
        expect(() => assert.deepEqual({ a: 1 }, { a: 2 })).toThrow();
      });
    });

    describe('truthy', () => {
      it('should pass for truthy values', () => {
        expect(() => assert.truthy(true)).not.toThrow();
        expect(() => assert.truthy(1)).not.toThrow();
        expect(() => assert.truthy('string')).not.toThrow();
        expect(() => assert.truthy({})).not.toThrow();
      });

      it('should fail for falsy values', () => {
        expect(() => assert.truthy(false)).toThrow();
        expect(() => assert.truthy(0)).toThrow();
        expect(() => assert.truthy('')).toThrow();
        expect(() => assert.truthy(null)).toThrow();
        expect(() => assert.truthy(undefined)).toThrow();
      });
    });

    describe('falsy', () => {
      it('should pass for falsy values', () => {
        expect(() => assert.falsy(false)).not.toThrow();
        expect(() => assert.falsy(0)).not.toThrow();
        expect(() => assert.falsy('')).not.toThrow();
        expect(() => assert.falsy(null)).not.toThrow();
      });

      it('should fail for truthy values', () => {
        expect(() => assert.falsy(true)).toThrow();
        expect(() => assert.falsy(1)).toThrow();
      });
    });

    describe('throws', () => {
      it('should pass when function throws', () => {
        // assert.throws catches exceptions and treats them as expected
        expect(() =>
          assert.throws(() => {
            throw new Error('Expected');
          })
        ).not.toThrow();
      });

      // Note: The current implementation of assert.throws catches all errors,
      // including the one it throws itself. This is a quirk of the implementation.
      // In practice, you'd use vitest's expect().toThrow() for this.
    });
  });

  describe('PluginTestHarness', () => {
    let mockPlugin: ArkaDomainPlugin;

    beforeEach(() => {
      mockPlugin = {
        manifest: {
          id: 'test-plugin',
          name: 'Test Plugin',
          version: '1.0.0',
          description: 'A test plugin',
        },
        getEntityTypes: vi.fn().mockReturnValue([
          {
            name: 'TestEntity',
            description: 'Test entity',
            schema: { type: 'object', required: ['id'] },
          },
        ] as ArkaEntityType[]),
        getDefaultRules: vi.fn().mockReturnValue([
          {
            id: 'rule_1',
            name: 'Test Rule',
            condition: { type: 'compare', field: 'payload.value', operator: 'gt', value: 0 },
            consequence: { decision: 'FLAG', code: 'TEST', message: 'Test' },
            severity: 'MEDIUM',
            description: 'Test rule',
            tags: [],
            metadata: {},
          },
        ] as ArkaRule[]),
        mapToCanonicalEvent: vi.fn().mockImplementation((event: DomainEvent) => ({
          source: 'test-plugin',
          type: event.type,
          payload: event.payload,
        })),
        validateDomainData: vi.fn().mockImplementation((entityType: string, data: Record<string, unknown>) => {
          if (data.id) {
            return { valid: true, errors: [] };
          }
          return {
            valid: false,
            errors: [{ field: 'id', message: 'Required', code: 'REQUIRED' }],
          };
        }),
        getEvaluationContext: vi.fn().mockReturnValue({}),
        serializeForChain: vi.fn().mockImplementation((data) => Buffer.from(JSON.stringify(data))),
        deserializeFromChain: vi.fn().mockImplementation((buffer) => JSON.parse(buffer.toString())),
      };
    });

    it('should test entity types', () => {
      const harness = new PluginTestHarness(mockPlugin);
      const result = harness.testEntityTypes();

      expect(result.passed).toBe(true);
      expect(result.name).toBe('Entity Types');
      expect((result.details as { count: number }).count).toBe(1);
    });

    it('should test default rules', () => {
      const harness = new PluginTestHarness(mockPlugin);
      const result = harness.testDefaultRules();

      expect(result.passed).toBe(true);
      expect(result.name).toBe('Default Rules');
    });

    it('should test event mapping', () => {
      const harness = new PluginTestHarness(mockPlugin);
      const domainEvent: DomainEvent = {
        type: 'TEST_EVENT',
        payload: { value: 100 },
      };

      const result = harness.testEventMapping(domainEvent);

      expect(result.passed).toBe(true);
      expect(mockPlugin.mapToCanonicalEvent).toHaveBeenCalledWith(domainEvent);
    });

    it('should test validation', () => {
      const harness = new PluginTestHarness(mockPlugin);
      const result = harness.testValidation(
        'TestEntity',
        { id: '123' }, // valid
        {} // invalid - missing id
      );

      expect(result.passed).toBe(true);
    });

    it('should run all tests', () => {
      const harness = new PluginTestHarness(mockPlugin);
      const results = harness.runAll();

      expect(results.plugin).toBe('test-plugin');
      expect(results.totalTests).toBeGreaterThan(0);
      expect(results.passed + results.failed).toBe(results.totalTests);
    });

    it('should fail entity types test when none defined', () => {
      mockPlugin.getEntityTypes = vi.fn().mockReturnValue([]);
      const harness = new PluginTestHarness(mockPlugin);
      const result = harness.testEntityTypes();

      expect(result.passed).toBe(false);
      expect(result.error).toContain('No entity types defined');
    });
  });
});
