/**
 * ARKA Plugin Testing Utilities
 *
 * Provides utilities for testing ARKA domain plugins:
 * - Event mapper testing
 * - Entity validation testing
 * - Rule DSL builder
 * - Simulation runner
 * - Mock services
 */

import { createLogger } from '@arka-protocol/utils';
import type {
  ArkaEvent,
  ArkaEntity,
  ArkaEntityType,
  ArkaRule,
  ArkaDecision,
  ArkaCondition,
  ArkaConsequence,
  CreateEventInput,
} from '@arka-protocol/types';
import type { ArkaDomainPlugin, DomainEvent, ValidationResult } from './types.js';

const logger = createLogger({ service: 'arka-testing' });

// ============================================================================
// Mock Services
// ============================================================================

/**
 * Mock event for testing
 */
export function createMockEvent(overrides: Partial<ArkaEvent> = {}): ArkaEvent {
  return {
    id: `evt_test_${Date.now()}`,
    source: 'test',
    type: 'TEST_EVENT',
    entityId: 'entity_123',
    entityType: 'TestEntity',
    payload: {},
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock entity for testing
 */
export function createMockEntity(overrides: Partial<ArkaEntity> = {}): ArkaEntity {
  return {
    id: `ent_test_${Date.now()}`,
    type: 'TestEntity',
    data: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock decision for testing
 */
export function createMockDecision(overrides: Partial<ArkaDecision> = {}): ArkaDecision {
  return {
    id: `dec_test_${Date.now()}`,
    eventId: 'evt_123',
    status: 'ALLOW',
    ruleEvaluations: [],
    createdAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

// ============================================================================
// Rule DSL Builder
// ============================================================================

/**
 * Fluent builder for creating ARKA rules
 */
export class RuleBuilder {
  private rule: Partial<ArkaRule> = {};

  /**
   * Sets the rule ID
   */
  id(id: string): this {
    this.rule.id = id;
    return this;
  }

  /**
   * Sets the rule name
   */
  name(name: string): this {
    this.rule.name = name;
    return this;
  }

  /**
   * Sets the description
   */
  description(description: string): this {
    this.rule.description = description;
    return this;
  }

  /**
   * Sets the jurisdiction
   */
  jurisdiction(jurisdiction: string): this {
    this.rule.jurisdiction = jurisdiction;
    return this;
  }

  /**
   * Sets the severity
   */
  severity(severity: ArkaRule['severity']): this {
    this.rule.severity = severity;
    return this;
  }

  /**
   * Sets the effective from date
   */
  effectiveFrom(date: string): this {
    this.rule.effectiveFrom = date;
    return this;
  }

  /**
   * Sets the effective to date
   */
  effectiveTo(date: string): this {
    this.rule.effectiveTo = date;
    return this;
  }

  /**
   * Sets a comparison condition
   */
  when(field: string, operator: string, value: unknown): this {
    this.rule.condition = {
      type: 'compare',
      field,
      operator: operator as import('@arka-protocol/types').ComparisonOperator,
      value,
    };
    return this;
  }

  /**
   * Adds an AND condition
   */
  and(conditions: ArkaCondition[]): this {
    this.rule.condition = {
      type: 'and',
      conditions,
    };
    return this;
  }

  /**
   * Adds an OR condition
   */
  or(conditions: ArkaCondition[]): this {
    this.rule.condition = {
      type: 'or',
      conditions,
    };
    return this;
  }

  /**
   * Sets the condition directly
   */
  condition(condition: ArkaCondition): this {
    this.rule.condition = condition;
    return this;
  }

  /**
   * Sets the consequence to DENY
   */
  thenDeny(code: string, message: string): this {
    this.rule.consequence = {
      decision: 'DENY',
      code,
      message,
    };
    return this;
  }

  /**
   * Sets the consequence to FLAG
   */
  thenFlag(code: string, message: string): this {
    this.rule.consequence = {
      decision: 'FLAG',
      code,
      message,
    };
    return this;
  }

  /**
   * Sets the consequence directly
   */
  consequence(consequence: ArkaConsequence): this {
    this.rule.consequence = consequence;
    return this;
  }

  /**
   * Adds tags
   */
  tags(...tags: string[]): this {
    this.rule.tags = tags;
    return this;
  }

  /**
   * Builds the rule
   */
  build(): ArkaRule {
    if (!this.rule.id) {
      this.rule.id = `rule_${Date.now()}`;
    }
    if (!this.rule.name) {
      throw new Error('Rule name is required');
    }
    if (!this.rule.condition) {
      throw new Error('Rule condition is required');
    }
    if (!this.rule.consequence) {
      throw new Error('Rule consequence is required');
    }
    if (!this.rule.severity) {
      this.rule.severity = 'MEDIUM';
    }
    if (!this.rule.description) {
      this.rule.description = this.rule.name;
    }
    if (!this.rule.tags) {
      this.rule.tags = [];
    }
    if (!this.rule.metadata) {
      this.rule.metadata = {};
    }

    return this.rule as ArkaRule;
  }
}

/**
 * Creates a new rule builder
 */
export function rule(): RuleBuilder {
  return new RuleBuilder();
}

// ============================================================================
// Plugin Test Harness
// ============================================================================

/**
 * Test result for a single test case
 */
export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: unknown;
}

/**
 * Test suite results
 */
export interface TestSuiteResult {
  plugin: string;
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  results: TestResult[];
}

/**
 * Plugin test harness
 */
export class PluginTestHarness {
  private plugin: ArkaDomainPlugin;
  private results: TestResult[] = [];

  constructor(plugin: ArkaDomainPlugin) {
    this.plugin = plugin;
  }

  /**
   * Tests entity type definitions
   */
  testEntityTypes(): TestResult {
    const start = Date.now();
    try {
      const entityTypes = this.plugin.getEntityTypes();

      if (entityTypes.length === 0) {
        return {
          name: 'Entity Types',
          passed: false,
          duration: Date.now() - start,
          error: 'No entity types defined',
        };
      }

      for (const type of entityTypes) {
        if (!type.name) {
          throw new Error('Entity type missing name');
        }
        if (!type.schema) {
          throw new Error(`Entity type ${type.name} missing schema`);
        }
      }

      return {
        name: 'Entity Types',
        passed: true,
        duration: Date.now() - start,
        details: { count: entityTypes.length, types: entityTypes.map((t) => t.name) },
      };
    } catch (error) {
      return {
        name: 'Entity Types',
        passed: false,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Tests default rules
   */
  testDefaultRules(): TestResult {
    const start = Date.now();
    try {
      const rules = this.plugin.getDefaultRules();

      for (const rule of rules) {
        if (!rule.id) {
          throw new Error('Rule missing ID');
        }
        if (!rule.name) {
          throw new Error(`Rule ${rule.id} missing name`);
        }
        if (!rule.condition) {
          throw new Error(`Rule ${rule.id} missing condition`);
        }
        if (!rule.consequence) {
          throw new Error(`Rule ${rule.id} missing consequence`);
        }
      }

      return {
        name: 'Default Rules',
        passed: true,
        duration: Date.now() - start,
        details: { count: rules.length, rules: rules.map((r) => r.name) },
      };
    } catch (error) {
      return {
        name: 'Default Rules',
        passed: false,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Tests event mapping
   */
  testEventMapping(domainEvent: DomainEvent): TestResult {
    const start = Date.now();
    try {
      const canonicalEvent = this.plugin.mapToCanonicalEvent(domainEvent);

      if (!canonicalEvent.source) {
        throw new Error('Mapped event missing source');
      }
      if (!canonicalEvent.type) {
        throw new Error('Mapped event missing type');
      }

      return {
        name: 'Event Mapping',
        passed: true,
        duration: Date.now() - start,
        details: { input: domainEvent.type, output: canonicalEvent.type },
      };
    } catch (error) {
      return {
        name: 'Event Mapping',
        passed: false,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Tests domain data validation
   */
  testValidation(entityType: string, validData: unknown, invalidData: unknown): TestResult {
    const start = Date.now();
    try {
      // Test valid data passes
      const validResult = this.plugin.validateDomainData(
        entityType,
        validData as Record<string, unknown>
      );
      if (!validResult.valid) {
        throw new Error(`Valid data was rejected: ${validResult.errors.map((e) => e.message).join(', ')}`);
      }

      // Test invalid data fails
      const invalidResult = this.plugin.validateDomainData(
        entityType,
        invalidData as Record<string, unknown>
      );
      if (invalidResult.valid) {
        throw new Error('Invalid data was accepted');
      }

      return {
        name: 'Validation',
        passed: true,
        duration: Date.now() - start,
        details: {
          validDataPassed: true,
          invalidDataRejected: true,
          errorsFound: invalidResult.errors.length,
        },
      };
    } catch (error) {
      return {
        name: 'Validation',
        passed: false,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Runs all tests
   */
  runAll(): TestSuiteResult {
    const start = Date.now();
    this.results = [];

    this.results.push(this.testEntityTypes());
    this.results.push(this.testDefaultRules());

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;

    return {
      plugin: this.plugin.manifest.id,
      totalTests: this.results.length,
      passed,
      failed,
      duration: Date.now() - start,
      results: this.results,
    };
  }

  /**
   * Adds a custom test result
   */
  addResult(result: TestResult): void {
    this.results.push(result);
  }

  /**
   * Gets all results
   */
  getResults(): TestResult[] {
    return this.results;
  }
}

// ============================================================================
// Simulation Utilities
// ============================================================================

/**
 * Event generator configuration
 */
export interface EventGeneratorConfig {
  /** Event type to generate */
  eventType: string;
  /** Number of events to generate */
  count: number;
  /** Field value ranges */
  fields: Record<string, {
    type: 'number' | 'string' | 'boolean' | 'enum';
    min?: number;
    max?: number;
    values?: unknown[];
  }>;
}

/**
 * Generates test events for simulation
 */
export function generateTestEvents(config: EventGeneratorConfig): DomainEvent[] {
  const events: DomainEvent[] = [];

  for (let i = 0; i < config.count; i++) {
    const payload: Record<string, unknown> = {};

    for (const [field, fieldConfig] of Object.entries(config.fields)) {
      switch (fieldConfig.type) {
        case 'number':
          payload[field] = randomNumber(fieldConfig.min ?? 0, fieldConfig.max ?? 100);
          break;
        case 'string':
          payload[field] = fieldConfig.values
            ? randomChoice(fieldConfig.values)
            : `value_${i}`;
          break;
        case 'boolean':
          payload[field] = Math.random() > 0.5;
          break;
        case 'enum':
          payload[field] = randomChoice(fieldConfig.values ?? []);
          break;
      }
    }

    events.push({
      type: config.eventType,
      payload,
      occurredAt: new Date().toISOString(),
    });
  }

  return events;
}

/**
 * Simulation result
 */
export interface SimulationResult {
  totalEvents: number;
  decisions: {
    allow: number;
    allowWithFlags: number;
    deny: number;
  };
  triggeredRules: Map<string, number>;
  duration: number;
}

/**
 * Runs a simulation with generated events
 */
export async function runSimulation(
  plugin: ArkaDomainPlugin,
  events: DomainEvent[],
  evaluateRules: (event: ArkaEvent, rules: ArkaRule[]) => Promise<ArkaDecision>
): Promise<SimulationResult> {
  const start = Date.now();
  const rules = plugin.getDefaultRules();
  const triggeredRules = new Map<string, number>();
  const decisions = { allow: 0, allowWithFlags: 0, deny: 0 };

  for (const domainEvent of events) {
    const canonicalInput = plugin.mapToCanonicalEvent(domainEvent);
    const pactEvent = createMockEvent({
      ...canonicalInput,
      id: `evt_sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    });

    const decision = await evaluateRules(pactEvent, rules);

    // Count decisions
    switch (decision.status) {
      case 'ALLOW':
        decisions.allow++;
        break;
      case 'ALLOW_WITH_FLAGS':
        decisions.allowWithFlags++;
        break;
      case 'DENY':
        decisions.deny++;
        break;
    }

    // Count triggered rules (rules that failed = triggered an action)
    for (const evaluation of decision.ruleEvaluations) {
      if (evaluation.result === 'FAIL') {
        const count = triggeredRules.get(evaluation.ruleId) ?? 0;
        triggeredRules.set(evaluation.ruleId, count + 1);
      }
    }
  }

  return {
    totalEvents: events.length,
    decisions,
    triggeredRules,
    duration: Date.now() - start,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function randomNumber(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)]!;
}

/**
 * Assertion utilities for testing
 */
export const assert = {
  equal<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(message ?? `Expected ${expected} but got ${actual}`);
    }
  },

  deepEqual(actual: unknown, expected: unknown, message?: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message ?? `Objects are not equal`);
    }
  },

  truthy(value: unknown, message?: string): void {
    if (!value) {
      throw new Error(message ?? `Expected truthy value but got ${value}`);
    }
  },

  falsy(value: unknown, message?: string): void {
    if (value) {
      throw new Error(message ?? `Expected falsy value but got ${value}`);
    }
  },

  throws(fn: () => void, message?: string): void {
    try {
      fn();
      throw new Error(message ?? 'Expected function to throw');
    } catch {
      // Expected
    }
  },

  async asyncThrows(fn: () => Promise<void>, message?: string): Promise<void> {
    try {
      await fn();
      throw new Error(message ?? 'Expected async function to throw');
    } catch {
      // Expected
    }
  },
};
