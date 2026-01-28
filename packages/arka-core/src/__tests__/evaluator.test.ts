/**
 * ARKA Core Evaluator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ArkaEvent, ArkaEntity, ArkaRule, ArkaCondition } from '@arka/types';
import { evaluateCondition, evaluateSingleRule, evaluateRules, getApplicableRules } from '../evaluator.js';

// Test fixtures
const createEvent = (overrides: Partial<ArkaEvent> = {}): ArkaEvent => ({
  id: 'evt_test123',
  source: 'test',
  type: 'LOAN_CREATED',
  entityId: 'ent_loan123',
  entityType: 'Loan',
  jurisdiction: 'US-CA',
  payload: {
    loan: {
      apr: 0.25,
      amount: 10000,
      termMonths: 36,
    },
    borrower: {
      creditScore: 700,
      income: 50000,
    },
  },
  occurredAt: '2024-01-15T10:00:00Z',
  receivedAt: '2024-01-15T10:00:01Z',
  ...overrides,
});

const createEntity = (overrides: Partial<ArkaEntity> = {}): ArkaEntity => ({
  id: 'ent_loan123',
  type: 'Loan',
  jurisdiction: 'US-CA',
  data: {
    apr: 0.25,
    amount: 10000,
    termMonths: 36,
    status: 'PENDING',
  },
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  ...overrides,
});

const createRule = (overrides: Partial<ArkaRule> = {}): ArkaRule => ({
  id: 'rul_test123',
  name: 'Test Rule',
  description: 'A test rule',
  severity: 'MEDIUM',
  condition: {
    type: 'compare',
    field: 'loan.apr',
    operator: '<=',
    value: 0.36,
  },
  consequence: {
    decision: 'DENY',
    code: 'TEST_VIOLATION',
    message: 'Test violation occurred',
  },
  tags: [],
  metadata: {},
  status: 'ACTIVE',
  version: 1,
  ...overrides,
});

describe('evaluateCondition', () => {
  describe('comparison operators', () => {
    it('evaluates == correctly', () => {
      const data = { status: 'ACTIVE' };

      expect(evaluateCondition({ type: 'compare', field: 'status', operator: '==', value: 'ACTIVE' }, data)).toBe(true);
      expect(evaluateCondition({ type: 'compare', field: 'status', operator: '==', value: 'INACTIVE' }, data)).toBe(false);
    });

    it('evaluates != correctly', () => {
      const data = { status: 'ACTIVE' };

      expect(evaluateCondition({ type: 'compare', field: 'status', operator: '!=', value: 'INACTIVE' }, data)).toBe(true);
      expect(evaluateCondition({ type: 'compare', field: 'status', operator: '!=', value: 'ACTIVE' }, data)).toBe(false);
    });

    it('evaluates < correctly', () => {
      const data = { value: 10 };

      expect(evaluateCondition({ type: 'compare', field: 'value', operator: '<', value: 20 }, data)).toBe(true);
      expect(evaluateCondition({ type: 'compare', field: 'value', operator: '<', value: 10 }, data)).toBe(false);
      expect(evaluateCondition({ type: 'compare', field: 'value', operator: '<', value: 5 }, data)).toBe(false);
    });

    it('evaluates <= correctly', () => {
      const data = { value: 10 };

      expect(evaluateCondition({ type: 'compare', field: 'value', operator: '<=', value: 20 }, data)).toBe(true);
      expect(evaluateCondition({ type: 'compare', field: 'value', operator: '<=', value: 10 }, data)).toBe(true);
      expect(evaluateCondition({ type: 'compare', field: 'value', operator: '<=', value: 5 }, data)).toBe(false);
    });

    it('evaluates > correctly', () => {
      const data = { value: 10 };

      expect(evaluateCondition({ type: 'compare', field: 'value', operator: '>', value: 5 }, data)).toBe(true);
      expect(evaluateCondition({ type: 'compare', field: 'value', operator: '>', value: 10 }, data)).toBe(false);
      expect(evaluateCondition({ type: 'compare', field: 'value', operator: '>', value: 20 }, data)).toBe(false);
    });

    it('evaluates >= correctly', () => {
      const data = { value: 10 };

      expect(evaluateCondition({ type: 'compare', field: 'value', operator: '>=', value: 5 }, data)).toBe(true);
      expect(evaluateCondition({ type: 'compare', field: 'value', operator: '>=', value: 10 }, data)).toBe(true);
      expect(evaluateCondition({ type: 'compare', field: 'value', operator: '>=', value: 20 }, data)).toBe(false);
    });

    it('evaluates in correctly', () => {
      const data = { status: 'PENDING' };

      expect(evaluateCondition({ type: 'compare', field: 'status', operator: 'in', value: ['PENDING', 'ACTIVE'] }, data)).toBe(true);
      expect(evaluateCondition({ type: 'compare', field: 'status', operator: 'in', value: ['ACTIVE', 'CLOSED'] }, data)).toBe(false);
    });

    it('evaluates not_in correctly', () => {
      const data = { status: 'PENDING' };

      expect(evaluateCondition({ type: 'compare', field: 'status', operator: 'not_in', value: ['ACTIVE', 'CLOSED'] }, data)).toBe(true);
      expect(evaluateCondition({ type: 'compare', field: 'status', operator: 'not_in', value: ['PENDING', 'ACTIVE'] }, data)).toBe(false);
    });

    it('evaluates contains correctly', () => {
      const data = { tags: ['urgent', 'review'], name: 'Test Item' };

      expect(evaluateCondition({ type: 'compare', field: 'tags', operator: 'contains', value: 'urgent' }, data)).toBe(true);
      expect(evaluateCondition({ type: 'compare', field: 'tags', operator: 'contains', value: 'other' }, data)).toBe(false);
      expect(evaluateCondition({ type: 'compare', field: 'name', operator: 'contains', value: 'Test' }, data)).toBe(true);
    });

    it('evaluates exists correctly', () => {
      const data = { name: 'Test', value: null };

      expect(evaluateCondition({ type: 'compare', field: 'name', operator: 'exists', value: null }, data)).toBe(true);
      expect(evaluateCondition({ type: 'compare', field: 'value', operator: 'exists', value: null }, data)).toBe(false);
      expect(evaluateCondition({ type: 'compare', field: 'missing', operator: 'exists', value: null }, data)).toBe(false);
    });

    it('evaluates matches (regex) correctly', () => {
      const data = { email: 'test@example.com' };

      expect(evaluateCondition({ type: 'compare', field: 'email', operator: 'matches', value: '^[a-z]+@' }, data)).toBe(true);
      expect(evaluateCondition({ type: 'compare', field: 'email', operator: 'matches', value: '^[0-9]+' }, data)).toBe(false);
    });
  });

  describe('nested field access', () => {
    it('accesses deeply nested values', () => {
      const data = {
        loan: {
          details: {
            apr: 0.25,
          },
        },
      };

      expect(evaluateCondition({
        type: 'compare',
        field: 'loan.details.apr',
        operator: '<=',
        value: 0.36,
      }, data)).toBe(true);
    });

    it('handles missing nested paths gracefully', () => {
      const data = { loan: {} };

      expect(evaluateCondition({
        type: 'compare',
        field: 'loan.details.apr',
        operator: 'exists',
        value: null,
      }, data)).toBe(false);
    });
  });

  describe('logical operators', () => {
    it('evaluates AND correctly', () => {
      const data = { a: 10, b: 20 };

      const condition: ArkaCondition = {
        type: 'and',
        conditions: [
          { type: 'compare', field: 'a', operator: '>', value: 5 },
          { type: 'compare', field: 'b', operator: '<', value: 30 },
        ],
      };

      expect(evaluateCondition(condition, data)).toBe(true);

      const failingCondition: ArkaCondition = {
        type: 'and',
        conditions: [
          { type: 'compare', field: 'a', operator: '>', value: 5 },
          { type: 'compare', field: 'b', operator: '<', value: 10 },
        ],
      };

      expect(evaluateCondition(failingCondition, data)).toBe(false);
    });

    it('evaluates OR correctly', () => {
      const data = { a: 10, b: 20 };

      const condition: ArkaCondition = {
        type: 'or',
        conditions: [
          { type: 'compare', field: 'a', operator: '>', value: 100 },
          { type: 'compare', field: 'b', operator: '<', value: 30 },
        ],
      };

      expect(evaluateCondition(condition, data)).toBe(true);

      const failingCondition: ArkaCondition = {
        type: 'or',
        conditions: [
          { type: 'compare', field: 'a', operator: '>', value: 100 },
          { type: 'compare', field: 'b', operator: '<', value: 10 },
        ],
      };

      expect(evaluateCondition(failingCondition, data)).toBe(false);
    });

    it('evaluates NOT correctly', () => {
      const data = { status: 'ACTIVE' };

      const condition: ArkaCondition = {
        type: 'not',
        condition: { type: 'compare', field: 'status', operator: '==', value: 'INACTIVE' },
      };

      expect(evaluateCondition(condition, data)).toBe(true);

      const failingCondition: ArkaCondition = {
        type: 'not',
        condition: { type: 'compare', field: 'status', operator: '==', value: 'ACTIVE' },
      };

      expect(evaluateCondition(failingCondition, data)).toBe(false);
    });

    it('handles complex nested conditions', () => {
      const data = { a: 10, b: 20, c: 30 };

      const condition: ArkaCondition = {
        type: 'and',
        conditions: [
          {
            type: 'or',
            conditions: [
              { type: 'compare', field: 'a', operator: '>', value: 5 },
              { type: 'compare', field: 'b', operator: '>', value: 100 },
            ],
          },
          {
            type: 'not',
            condition: { type: 'compare', field: 'c', operator: '<', value: 10 },
          },
        ],
      };

      expect(evaluateCondition(condition, data)).toBe(true);
    });
  });
});

describe('evaluateSingleRule', () => {
  it('marks rule as NOT_APPLICABLE when entity type does not match', () => {
    const event = createEvent();
    const entity = createEntity({ type: 'Shipment' });
    const rule = createRule({ appliesToEntityType: 'Loan' });

    const result = evaluateSingleRule({ event, entity, rule });

    expect(result.applied).toBe(false);
    expect(result.result).toBe('NOT_APPLICABLE');
  });

  it('marks rule as NOT_APPLICABLE when event type does not match', () => {
    const event = createEvent({ type: 'SHIPMENT_DECLARED' });
    const entity = createEntity();
    const rule = createRule({ appliesToEventType: 'LOAN_CREATED' });

    const result = evaluateSingleRule({ event, entity, rule });

    expect(result.applied).toBe(false);
    expect(result.result).toBe('NOT_APPLICABLE');
  });

  it('marks rule as NOT_APPLICABLE when jurisdiction does not match', () => {
    const event = createEvent({ jurisdiction: 'US-TX' });
    const entity = createEntity({ jurisdiction: 'US-TX' });
    const rule = createRule({ jurisdiction: 'US-CA' });

    const result = evaluateSingleRule({ event, entity, rule });

    expect(result.applied).toBe(false);
    expect(result.result).toBe('NOT_APPLICABLE');
  });

  it('marks rule as NOT_APPLICABLE when not yet effective', () => {
    const event = createEvent();
    const entity = createEntity();
    const rule = createRule({ effectiveFrom: '2099-01-01T00:00:00Z' });

    const result = evaluateSingleRule({ event, entity, rule });

    expect(result.applied).toBe(false);
    expect(result.result).toBe('NOT_APPLICABLE');
  });

  it('evaluates DENY rule - fails when condition met', () => {
    const event = createEvent({
      payload: { loan: { apr: 0.50 } }, // APR exceeds 36%
    });
    const rule = createRule({
      condition: {
        type: 'compare',
        field: 'loan.apr',
        operator: '>',
        value: 0.36,
      },
      consequence: {
        decision: 'DENY',
        code: 'APR_EXCEEDED',
        message: 'APR exceeds maximum allowed rate',
      },
    });

    const result = evaluateSingleRule({ event, rule });

    expect(result.applied).toBe(true);
    expect(result.result).toBe('FAIL');
    expect(result.details).toBe('APR exceeds maximum allowed rate');
  });

  it('evaluates DENY rule - passes when condition not met', () => {
    const event = createEvent({
      payload: { loan: { apr: 0.25 } }, // APR within limit
    });
    const rule = createRule({
      condition: {
        type: 'compare',
        field: 'loan.apr',
        operator: '>',
        value: 0.36,
      },
      consequence: {
        decision: 'DENY',
        code: 'APR_EXCEEDED',
        message: 'APR exceeds maximum allowed rate',
      },
    });

    const result = evaluateSingleRule({ event, rule });

    expect(result.applied).toBe(true);
    expect(result.result).toBe('PASS');
  });

  it('tracks evaluation time', () => {
    const event = createEvent();
    const rule = createRule();

    const result = evaluateSingleRule({ event, rule });

    expect(result.evaluationTimeMs).toBeDefined();
    expect(result.evaluationTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('evaluateRules', () => {
  it('returns ALLOW when all rules pass', () => {
    const event = createEvent({
      payload: { loan: { apr: 0.25, termMonths: 36 } },
    });

    const rules: ArkaRule[] = [
      createRule({
        id: 'rul_1',
        condition: { type: 'compare', field: 'loan.apr', operator: '>', value: 0.36 },
        consequence: { decision: 'DENY', code: 'APR_TOO_HIGH', message: 'APR too high' },
      }),
      createRule({
        id: 'rul_2',
        condition: { type: 'compare', field: 'loan.termMonths', operator: '>', value: 60 },
        consequence: { decision: 'DENY', code: 'TERM_TOO_LONG', message: 'Term too long' },
      }),
    ];

    const decision = evaluateRules({ event, rules });

    expect(decision.status).toBe('ALLOW');
    expect(decision.ruleEvaluations).toHaveLength(2);
    expect(decision.ruleEvaluations.every(e => e.result === 'PASS')).toBe(true);
  });

  it('returns DENY when any DENY rule fails', () => {
    const event = createEvent({
      payload: { loan: { apr: 0.50, termMonths: 36 } }, // APR exceeds limit
    });

    const rules: ArkaRule[] = [
      createRule({
        id: 'rul_1',
        condition: { type: 'compare', field: 'loan.apr', operator: '>', value: 0.36 },
        consequence: { decision: 'DENY', code: 'APR_TOO_HIGH', message: 'APR too high' },
      }),
      createRule({
        id: 'rul_2',
        condition: { type: 'compare', field: 'loan.termMonths', operator: '>', value: 60 },
        consequence: { decision: 'DENY', code: 'TERM_TOO_LONG', message: 'Term too long' },
      }),
    ];

    const decision = evaluateRules({ event, rules });

    expect(decision.status).toBe('DENY');
    expect(decision.ruleEvaluations.filter(e => e.result === 'FAIL')).toHaveLength(1);
  });

  it('returns ALLOW_WITH_FLAGS when FLAG rule fails but no DENY', () => {
    const event = createEvent({
      payload: { loan: { apr: 0.25, amount: 100000 } }, // High amount but allowed APR
    });

    const rules: ArkaRule[] = [
      createRule({
        id: 'rul_1',
        condition: { type: 'compare', field: 'loan.apr', operator: '>', value: 0.36 },
        consequence: { decision: 'DENY', code: 'APR_TOO_HIGH', message: 'APR too high' },
      }),
      createRule({
        id: 'rul_2',
        condition: { type: 'compare', field: 'loan.amount', operator: '>', value: 50000 },
        consequence: { decision: 'FLAG', code: 'HIGH_AMOUNT', message: 'High loan amount - review required' },
      }),
    ];

    const decision = evaluateRules({ event, rules });

    expect(decision.status).toBe('ALLOW_WITH_FLAGS');
  });

  it('generates unique decision ID', () => {
    const event = createEvent();
    const rules: ArkaRule[] = [createRule()];

    const decision1 = evaluateRules({ event, rules });
    const decision2 = evaluateRules({ event, rules });

    expect(decision1.id).not.toBe(decision2.id);
    expect(decision1.id).toMatch(/^dec_/);
  });

  it('tracks total evaluation time', () => {
    const event = createEvent();
    const rules: ArkaRule[] = [createRule(), createRule({ id: 'rul_2' })];

    const decision = evaluateRules({ event, rules });

    expect(decision.totalEvaluationTimeMs).toBeDefined();
    expect(decision.totalEvaluationTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('getApplicableRules', () => {
  it('filters rules by entity type', () => {
    const event = createEvent();
    const entity = createEntity({ type: 'Loan' });

    const rules: ArkaRule[] = [
      createRule({ id: 'rul_1', appliesToEntityType: 'Loan' }),
      createRule({ id: 'rul_2', appliesToEntityType: 'Shipment' }),
      createRule({ id: 'rul_3', appliesToEntityType: null }), // Applies to all
    ];

    const applicable = getApplicableRules(rules, event, entity);

    expect(applicable).toHaveLength(2);
    expect(applicable.map(r => r.id)).toContain('rul_1');
    expect(applicable.map(r => r.id)).toContain('rul_3');
  });

  it('filters rules by jurisdiction', () => {
    const event = createEvent({ jurisdiction: 'US-CA' });
    const entity = createEntity({ jurisdiction: 'US-CA' });

    const rules: ArkaRule[] = [
      createRule({ id: 'rul_1', jurisdiction: 'US-CA' }),
      createRule({ id: 'rul_2', jurisdiction: 'US-TX' }),
      createRule({ id: 'rul_3', jurisdiction: null }), // Applies to all
    ];

    const applicable = getApplicableRules(rules, event, entity);

    expect(applicable).toHaveLength(2);
    expect(applicable.map(r => r.id)).toContain('rul_1');
    expect(applicable.map(r => r.id)).toContain('rul_3');
  });

  it('filters inactive rules', () => {
    const event = createEvent();

    const rules: ArkaRule[] = [
      createRule({ id: 'rul_1', status: 'ACTIVE' }),
      createRule({ id: 'rul_2', status: 'DRAFT' }),
      createRule({ id: 'rul_3', status: 'INACTIVE' }),
    ];

    const applicable = getApplicableRules(rules, event);

    expect(applicable).toHaveLength(1);
    expect(applicable[0]?.id).toBe('rul_1');
  });
});

describe('Real-world scenarios', () => {
  it('handles APR cap rule for California loans', () => {
    // California has a 36% APR cap
    const caAprRule = createRule({
      id: 'ca_apr_cap',
      name: 'California APR Cap',
      jurisdiction: 'US-CA',
      appliesToEntityType: 'Loan',
      condition: {
        type: 'compare',
        field: 'loan.apr',
        operator: '>',
        value: 0.36,
      },
      consequence: {
        decision: 'DENY',
        code: 'CA_APR_EXCEEDED',
        message: 'Loan APR exceeds California maximum of 36%',
        remediation: 'Reduce the APR to 36% or below',
      },
    });

    // Valid loan
    const validEvent = createEvent({
      jurisdiction: 'US-CA',
      payload: { loan: { apr: 0.25, amount: 5000 } },
    });
    const validEntity = createEntity({ jurisdiction: 'US-CA' });

    const validResult = evaluateSingleRule({ event: validEvent, entity: validEntity, rule: caAprRule });
    expect(validResult.result).toBe('PASS');

    // Invalid loan
    const invalidEvent = createEvent({
      jurisdiction: 'US-CA',
      payload: { loan: { apr: 0.45, amount: 5000 } },
    });

    const invalidResult = evaluateSingleRule({ event: invalidEvent, entity: validEntity, rule: caAprRule });
    expect(invalidResult.result).toBe('FAIL');
  });

  it('handles multi-condition loan rule', () => {
    // Rule: Deny if APR > 30% AND term > 48 months
    const multiConditionRule = createRule({
      id: 'high_risk_loan',
      name: 'High Risk Loan Detection',
      condition: {
        type: 'and',
        conditions: [
          { type: 'compare', field: 'loan.apr', operator: '>', value: 0.30 },
          { type: 'compare', field: 'loan.termMonths', operator: '>', value: 48 },
        ],
      },
      consequence: {
        decision: 'DENY',
        code: 'HIGH_RISK_COMBINATION',
        message: 'High APR combined with long term creates excessive risk',
      },
    });

    // High APR but short term - should pass
    const event1 = createEvent({ payload: { loan: { apr: 0.35, termMonths: 24 } } });
    expect(evaluateSingleRule({ event: event1, rule: multiConditionRule }).result).toBe('PASS');

    // Low APR but long term - should pass
    const event2 = createEvent({ payload: { loan: { apr: 0.20, termMonths: 60 } } });
    expect(evaluateSingleRule({ event: event2, rule: multiConditionRule }).result).toBe('PASS');

    // High APR AND long term - should fail
    const event3 = createEvent({ payload: { loan: { apr: 0.35, termMonths: 60 } } });
    expect(evaluateSingleRule({ event: event3, rule: multiConditionRule }).result).toBe('FAIL');
  });
});
