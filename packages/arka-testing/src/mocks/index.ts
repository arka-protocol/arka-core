/**
 * ARKA Testing - Mock Utilities
 *
 * Provides mock implementations for testing ARKA components.
 */

import type {
  ArkaEvent,
  ArkaEntity,
  ArkaRule,
  ArkaDecision,
  ArkaCondition,
  ArkaConsequence,
  ArkaRuleEvaluation,
  ComparisonOperator,
} from '@arka-protocol/types';

// ============================================================================
// Mock Event
// ============================================================================

export interface MockEventOptions extends Partial<ArkaEvent> {}

let eventCounter = 0;

/**
 * Creates a mock ArkaEvent for testing
 */
export function mockEvent(options: MockEventOptions = {}): ArkaEvent {
  eventCounter++;
  const timestamp = new Date().toISOString();

  return {
    id: options.id ?? `evt_mock_${eventCounter}_${Date.now()}`,
    source: options.source ?? 'test-source',
    type: options.type ?? 'TEST_EVENT',
    entityId: options.entityId ?? `ent_mock_${eventCounter}`,
    entityType: options.entityType ?? 'TestEntity',
    payload: options.payload ?? { test: true },
    occurredAt: options.occurredAt ?? timestamp,
    receivedAt: options.receivedAt ?? timestamp,
  };
}

/**
 * Creates a batch of mock events
 */
export function mockEvents(count: number, options: MockEventOptions = {}): ArkaEvent[] {
  return Array.from({ length: count }, (_, i) =>
    mockEvent({
      ...options,
      id: options.id ? `${options.id}_${i}` : undefined,
    })
  );
}

// ============================================================================
// Mock Entity
// ============================================================================

export interface MockEntityOptions extends Partial<ArkaEntity> {}

let entityCounter = 0;

/**
 * Creates a mock ArkaEntity for testing
 */
export function mockEntity(options: MockEntityOptions = {}): ArkaEntity {
  entityCounter++;
  const timestamp = new Date().toISOString();

  return {
    id: options.id ?? `ent_mock_${entityCounter}_${Date.now()}`,
    type: options.type ?? 'TestEntity',
    data: options.data ?? { name: 'Test Entity' },
    createdAt: options.createdAt ?? timestamp,
    updatedAt: options.updatedAt ?? timestamp,
  };
}

// ============================================================================
// Mock Rule
// ============================================================================

export interface MockRuleOptions extends Partial<ArkaRule> {}

let ruleCounter = 0;

/**
 * Creates a mock ArkaRule for testing
 */
export function mockRule(options: MockRuleOptions = {}): ArkaRule {
  ruleCounter++;

  const defaultCondition: ArkaCondition = {
    type: 'compare',
    field: 'payload.amount',
    operator: '>',
    value: 1000,
  };

  const defaultConsequence: ArkaConsequence = {
    decision: 'FLAG',
    code: 'TEST_FLAG',
    message: 'Test flag triggered',
  };

  return {
    id: options.id ?? `rule_mock_${ruleCounter}_${Date.now()}`,
    name: options.name ?? `Test Rule ${ruleCounter}`,
    description: options.description ?? 'A mock rule for testing',
    condition: options.condition ?? defaultCondition,
    consequence: options.consequence ?? defaultConsequence,
    severity: options.severity ?? 'MEDIUM',
    tags: options.tags ?? ['test'],
    metadata: options.metadata ?? {},
    jurisdiction: options.jurisdiction,
    effectiveFrom: options.effectiveFrom,
    effectiveTo: options.effectiveTo,
  };
}

/**
 * Creates a batch of mock rules
 */
export function mockRules(count: number, options: MockRuleOptions = {}): ArkaRule[] {
  return Array.from({ length: count }, (_, i) =>
    mockRule({
      ...options,
      name: options.name ? `${options.name} ${i + 1}` : undefined,
    })
  );
}

// ============================================================================
// Mock Decision
// ============================================================================

export interface MockDecisionOptions extends Partial<ArkaDecision> {}

let decisionCounter = 0;

/**
 * Creates a mock ArkaDecision for testing
 */
export function mockDecision(options: MockDecisionOptions = {}): ArkaDecision {
  decisionCounter++;
  const timestamp = new Date().toISOString();

  return {
    id: options.id ?? `dec_mock_${decisionCounter}_${Date.now()}`,
    eventId: options.eventId ?? `evt_mock_${decisionCounter}`,
    status: options.status ?? 'ALLOW',
    ruleEvaluations: options.ruleEvaluations ?? [],
    createdAt: options.createdAt ?? timestamp,
    metadata: options.metadata ?? {},
  };
}

/**
 * Creates a mock ArkaRuleEvaluation for testing
 */
export function mockRuleEvaluation(options: Partial<ArkaRuleEvaluation> = {}): ArkaRuleEvaluation {
  return {
    ruleId: options.ruleId ?? `rule_mock_${Date.now()}`,
    version: options.version ?? 1,
    applied: options.applied ?? true,
    result: options.result ?? 'PASS',
    evaluationTimeMs: options.evaluationTimeMs ?? 1,
    consequenceSnapshot: options.consequenceSnapshot,
  };
}

// ============================================================================
// Mock Condition Builder
// ============================================================================

export const conditions = {
  /**
   * Creates a comparison condition
   */
  compare(
    field: string,
    operator: ComparisonOperator,
    value: unknown
  ): ArkaCondition {
    return { type: 'compare', field, operator, value };
  },

  /**
   * Creates an AND condition
   */
  and(...conditions: ArkaCondition[]): ArkaCondition {
    return { type: 'and', conditions };
  },

  /**
   * Creates an OR condition
   */
  or(...conditions: ArkaCondition[]): ArkaCondition {
    return { type: 'or', conditions };
  },

  /**
   * Creates a NOT condition
   */
  not(condition: ArkaCondition): ArkaCondition {
    return { type: 'not', condition };
  },

  /**
   * Creates an EXISTS condition
   */
  exists(field: string): ArkaCondition {
    return { type: 'compare', field, operator: 'exists', value: null };
  },

  /**
   * Creates a simple equals condition
   */
  eq(field: string, value: unknown): ArkaCondition {
    return { type: 'compare', field, operator: '==', value };
  },

  /**
   * Creates a greater than condition
   */
  gt(field: string, value: number): ArkaCondition {
    return { type: 'compare', field, operator: '>', value };
  },

  /**
   * Creates a less than condition
   */
  lt(field: string, value: number): ArkaCondition {
    return { type: 'compare', field, operator: '<', value };
  },
};

// ============================================================================
// Mock Consequence Builder
// ============================================================================

export const consequences = {
  /**
   * Creates a DENY consequence
   */
  deny(code: string, message: string): ArkaConsequence {
    return { decision: 'DENY', code, message };
  },

  /**
   * Creates a FLAG consequence
   */
  flag(code: string, message: string): ArkaConsequence {
    return { decision: 'FLAG', code, message };
  },

  /**
   * Creates an ALLOW consequence (explicit allow)
   */
  allow(): ArkaConsequence {
    return { decision: 'ALLOW' as never, code: 'ALLOWED', message: 'Allowed' };
  },
};

// ============================================================================
// Reset Counters (for test isolation)
// ============================================================================

/**
 * Resets all mock counters (useful between tests)
 */
export function resetMockCounters(): void {
  eventCounter = 0;
  entityCounter = 0;
  ruleCounter = 0;
  decisionCounter = 0;
}
