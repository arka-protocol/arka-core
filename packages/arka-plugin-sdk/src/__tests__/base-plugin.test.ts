/**
 * Tests for BaseArkaPlugin
 */

import { describe, it, expect } from 'vitest';
import { BaseArkaPlugin } from '../base-plugin.js';
import type { ArkaEntityType, ArkaRule, ArkaEvent, ArkaEntity } from '@arka-protocol/types';
import type { PluginManifest, DomainEvent, ValidationResult } from '../types.js';

// Concrete implementation for testing
class TestPlugin extends BaseArkaPlugin {
  manifest: PluginManifest = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test',
    entityTypes: ['TestEntity', 'AnotherEntity'],
    eventTypes: ['TEST_EVENT', 'ANOTHER_EVENT'],
  };

  protected entityTypes: ArkaEntityType[] = [
    {
      name: 'TestEntity',
      description: 'A test entity',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'number' },
        },
        required: ['name', 'value'],
      },
    },
    {
      name: 'AnotherEntity',
      description: 'Another test entity',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  ];

  protected defaultRules: ArkaRule[] = [
    {
      id: 'test-rule-1',
      name: 'Test Rule 1',
      description: 'A test rule',
      status: 'ACTIVE',
      severity: 'MEDIUM',
      tags: ['test'],
      condition: { type: 'ALWAYS_TRUE' },
      action: { type: 'ALLOW' },
    },
  ];
}

describe('BaseArkaPlugin', () => {
  let plugin: TestPlugin;

  beforeEach(() => {
    plugin = new TestPlugin();
  });

  describe('getEntityTypes', () => {
    it('should return entity types defined by the plugin', () => {
      const types = plugin.getEntityTypes();

      expect(types).toHaveLength(2);
      expect(types[0].name).toBe('TestEntity');
      expect(types[1].name).toBe('AnotherEntity');
    });
  });

  describe('getDefaultRules', () => {
    it('should return default rules defined by the plugin', () => {
      const rules = plugin.getDefaultRules();

      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('test-rule-1');
    });
  });

  describe('mapToCanonicalEvent', () => {
    it('should convert domain event to canonical ARKA format', () => {
      const domainEvent: DomainEvent = {
        type: 'LOAN_CREATED',
        entityId: 'loan-123',
        jurisdiction: 'US',
        payload: { amount: 10000 },
      };

      const canonicalEvent = plugin.mapToCanonicalEvent(domainEvent);

      expect(canonicalEvent.source).toBe('test-plugin');
      expect(canonicalEvent.type).toBe('LOAN_CREATED');
      expect(canonicalEvent.entityId).toBe('loan-123');
      expect(canonicalEvent.jurisdiction).toBe('US');
      expect(canonicalEvent.payload).toEqual({ amount: 10000 });
    });

    it('should infer entity type from event type', () => {
      const domainEvent: DomainEvent = {
        type: 'CUSTOMER_UPDATED',
        entityId: 'customer-123',
        payload: {},
      };

      const canonicalEvent = plugin.mapToCanonicalEvent(domainEvent);

      expect(canonicalEvent.entityType).toBe('Customer');
    });

    it('should use provided occurredAt or generate timestamp', () => {
      const domainEvent1: DomainEvent = {
        type: 'TEST_EVENT',
        entityId: 'entity-1',
        payload: {},
        occurredAt: '2024-01-01T00:00:00.000Z',
      };

      const domainEvent2: DomainEvent = {
        type: 'TEST_EVENT',
        entityId: 'entity-2',
        payload: {},
      };

      const event1 = plugin.mapToCanonicalEvent(domainEvent1);
      const event2 = plugin.mapToCanonicalEvent(domainEvent2);

      expect(event1.occurredAt).toBe('2024-01-01T00:00:00.000Z');
      expect(event2.occurredAt).toBeDefined();
    });
  });

  describe('validateDomainData', () => {
    it('should validate valid data against entity schema', () => {
      const data = { name: 'Test', value: 100 };

      const result = plugin.validateDomainData('TestEntity', data);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject data missing required fields', () => {
      const data = { name: 'Test' }; // missing 'value'

      const result = plugin.validateDomainData('TestEntity', data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'value')).toBe(true);
    });

    it('should reject unknown entity type', () => {
      const data = { name: 'Test' };

      const result = plugin.validateDomainData('UnknownEntity', data);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('UNKNOWN_ENTITY_TYPE');
    });
  });

  describe('getEvaluationContext', () => {
    it('should return empty context by default', () => {
      const event: ArkaEvent = {
        id: 'event-1',
        type: 'TEST_EVENT',
        timestamp: new Date().toISOString(),
        source: 'test',
        data: {},
      };

      const context = plugin.getEvaluationContext(event);

      expect(context).toEqual({});
    });
  });

  describe('serializeForChain', () => {
    it('should serialize data to Buffer', () => {
      const data = { name: 'Test', value: 100 };

      const buffer = plugin.serializeForChain(data);

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should use canonical JSON serialization with sorted keys', () => {
      const data = { z: 1, a: 2, m: 3 };

      const buffer = plugin.serializeForChain(data);
      const parsed = JSON.parse(buffer.toString('utf8'));

      // Keys should be sorted in the string representation
      const keys = Object.keys(parsed);
      expect(keys).toEqual(['a', 'm', 'z']);
    });

    it('should handle nested objects with sorted keys', () => {
      const data = {
        z: { c: 1, a: 2 },
        a: { z: 1, b: 2 },
      };

      const buffer = plugin.serializeForChain(data);
      const str = buffer.toString('utf8');

      // Verify keys are sorted at all levels
      expect(str).toMatch(/"a":\{.*"b":2.*"z":1.*\}.*"z":\{.*"a":2.*"c":1.*\}/);
    });
  });

  describe('deserializeFromChain', () => {
    it('should deserialize Buffer back to data', () => {
      const originalData = { name: 'Test', value: 100 };
      const buffer = Buffer.from(JSON.stringify(originalData), 'utf8');

      const deserialized = plugin.deserializeFromChain(buffer);

      expect(deserialized).toEqual(originalData);
    });

    it('should roundtrip serialize/deserialize', () => {
      const originalData = { name: 'Test', nested: { a: 1, b: 2 } };

      const serialized = plugin.serializeForChain(originalData);
      const deserialized = plugin.deserializeFromChain(serialized);

      expect(deserialized).toEqual(originalData);
    });
  });
});

// Test subclass with custom behavior
class CustomPlugin extends BaseArkaPlugin {
  manifest: PluginManifest = {
    id: 'custom-plugin',
    name: 'Custom Plugin',
    version: '1.0.0',
    description: 'Custom plugin with overrides',
    author: 'Test',
    entityTypes: ['Loan'],
    eventTypes: ['LOAN_ORIGINATED'],
  };

  protected entityTypes: ArkaEntityType[] = [
    {
      name: 'Loan',
      description: 'A loan entity',
      schema: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
        },
        required: ['amount'],
      },
    },
  ];

  protected defaultRules: ArkaRule[] = [];

  // Custom entity type inference
  protected override inferEntityType(domainEvent: DomainEvent): string | undefined {
    if (domainEvent.type.startsWith('LOAN_')) {
      return 'Loan';
    }
    return super.inferEntityType(domainEvent);
  }

  // Custom evaluation context
  override getEvaluationContext(
    event: ArkaEvent,
    entity?: ArkaEntity | null
  ): Record<string, unknown> {
    return {
      domain: 'lending',
      loanType: entity?.data?.loanType ?? 'unknown',
    };
  }
}

describe('BaseArkaPlugin - Custom Subclass', () => {
  let plugin: CustomPlugin;

  beforeEach(() => {
    plugin = new CustomPlugin();
  });

  it('should use custom entity type inference', () => {
    const domainEvent: DomainEvent = {
      type: 'LOAN_ORIGINATED',
      entityId: 'loan-123',
      payload: {},
    };

    const canonicalEvent = plugin.mapToCanonicalEvent(domainEvent);

    expect(canonicalEvent.entityType).toBe('Loan');
  });

  it('should provide custom evaluation context', () => {
    const event: ArkaEvent = {
      id: 'event-1',
      type: 'LOAN_ORIGINATED',
      timestamp: new Date().toISOString(),
      source: 'test',
      data: {},
    };
    const entity: ArkaEntity = {
      id: 'loan-1',
      type: 'Loan',
      data: { loanType: 'mortgage' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const context = plugin.getEvaluationContext(event, entity);

    expect(context.domain).toBe('lending');
    expect(context.loanType).toBe('mortgage');
  });
});
