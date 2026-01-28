/**
 * ARKA Testing - Factory Utilities
 *
 * Provides factory functions for creating complex test data structures.
 */

import type {
  ArkaEvent,
  ArkaRule,
  ArkaDecision,
  ArkaCondition,
  ArkaConsequence,
} from '@arka-protocol/types';
import { mockEvent, mockRule, mockDecision, mockRuleEvaluation } from '../mocks/index.js';

// ============================================================================
// Transaction Event Factory
// ============================================================================

export interface TransactionEventData {
  transactionId?: string;
  amount: number;
  currency?: string;
  sourceAccount?: string;
  destinationAccount?: string;
  transactionType?: 'TRANSFER' | 'WITHDRAWAL' | 'DEPOSIT' | 'PAYMENT';
  country?: string;
  riskScore?: number;
}

/**
 * Creates a transaction event for testing
 */
export function createTransactionEvent(data: TransactionEventData): ArkaEvent {
  return mockEvent({
    type: 'TRANSACTION',
    entityType: 'Transaction',
    entityId: data.transactionId ?? `txn_${Date.now()}`,
    payload: {
      transactionId: data.transactionId ?? `txn_${Date.now()}`,
      amount: data.amount,
      currency: data.currency ?? 'USD',
      sourceAccount: data.sourceAccount ?? 'ACC_001',
      destinationAccount: data.destinationAccount ?? 'ACC_002',
      transactionType: data.transactionType ?? 'TRANSFER',
      country: data.country ?? 'US',
      riskScore: data.riskScore ?? 0,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Creates a high-risk transaction event
 */
export function createHighRiskTransaction(amount: number = 50000): ArkaEvent {
  return createTransactionEvent({
    amount,
    riskScore: 85,
    country: 'HIGH_RISK_COUNTRY',
    transactionType: 'TRANSFER',
  });
}

/**
 * Creates a low-risk transaction event
 */
export function createLowRiskTransaction(amount: number = 100): ArkaEvent {
  return createTransactionEvent({
    amount,
    riskScore: 10,
    country: 'US',
    transactionType: 'PAYMENT',
  });
}

// ============================================================================
// Customer Event Factory
// ============================================================================

export interface CustomerEventData {
  customerId?: string;
  customerType?: 'INDIVIDUAL' | 'BUSINESS';
  kycStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  country?: string;
  isPEP?: boolean;
}

/**
 * Creates a customer event for testing
 */
export function createCustomerEvent(data: CustomerEventData): ArkaEvent {
  return mockEvent({
    type: 'CUSTOMER_ONBOARDING',
    entityType: 'Customer',
    entityId: data.customerId ?? `cust_${Date.now()}`,
    payload: {
      customerId: data.customerId ?? `cust_${Date.now()}`,
      customerType: data.customerType ?? 'INDIVIDUAL',
      kycStatus: data.kycStatus ?? 'PENDING',
      riskLevel: data.riskLevel ?? 'LOW',
      country: data.country ?? 'US',
      isPEP: data.isPEP ?? false,
      createdAt: new Date().toISOString(),
    },
  });
}

// ============================================================================
// Rule Factory
// ============================================================================

/**
 * Creates an amount threshold rule
 */
export function createAmountThresholdRule(
  threshold: number,
  decision: 'DENY' | 'FLAG' = 'FLAG'
): ArkaRule {
  return mockRule({
    name: `Amount Threshold Rule (>${threshold})`,
    description: `Triggers when transaction amount exceeds ${threshold}`,
    condition: {
      type: 'compare',
      field: 'payload.amount',
      operator: '>',
      value: threshold,
    },
    consequence: {
      decision,
      code: 'AMOUNT_THRESHOLD_EXCEEDED',
      message: `Transaction amount exceeds ${threshold}`,
    },
    severity: decision === 'DENY' ? 'HIGH' : 'MEDIUM',
    tags: ['aml', 'threshold'],
  });
}

/**
 * Creates a country restriction rule
 */
export function createCountryRestrictionRule(
  restrictedCountries: string[],
  decision: 'DENY' | 'FLAG' = 'DENY'
): ArkaRule {
  return mockRule({
    name: 'Country Restriction Rule',
    description: `Blocks transactions from restricted countries: ${restrictedCountries.join(', ')}`,
    condition: {
      type: 'compare',
      field: 'payload.country',
      operator: 'in',
      value: restrictedCountries,
    },
    consequence: {
      decision,
      code: 'RESTRICTED_COUNTRY',
      message: 'Transaction from restricted country',
    },
    severity: 'HIGH',
    tags: ['sanctions', 'country'],
  });
}

/**
 * Creates a PEP check rule
 */
export function createPEPCheckRule(): ArkaRule {
  return mockRule({
    name: 'PEP Check Rule',
    description: 'Flags transactions involving Politically Exposed Persons',
    condition: {
      type: 'compare',
      field: 'payload.isPEP',
      operator: '==',
      value: true,
    },
    consequence: {
      decision: 'FLAG',
      code: 'PEP_INVOLVED',
      message: 'Customer is a Politically Exposed Person',
    },
    severity: 'HIGH',
    tags: ['kyc', 'pep'],
  });
}

/**
 * Creates a velocity check rule (multiple conditions)
 */
export function createVelocityCheckRule(
  maxTransactions: number,
  timeWindowHours: number
): ArkaRule {
  return mockRule({
    name: `Velocity Check Rule (${maxTransactions} txns/${timeWindowHours}h)`,
    description: `Flags accounts with more than ${maxTransactions} transactions in ${timeWindowHours} hours`,
    condition: {
      type: 'compare',
      field: 'payload.transactionCount',
      operator: '>',
      value: maxTransactions,
    },
    consequence: {
      decision: 'FLAG',
      code: 'VELOCITY_EXCEEDED',
      message: `Transaction velocity exceeded: >${maxTransactions} in ${timeWindowHours}h`,
    },
    severity: 'MEDIUM',
    tags: ['aml', 'velocity'],
    metadata: {
      timeWindowHours,
      maxTransactions,
    },
  });
}

/**
 * Creates a compound rule with AND conditions
 */
export function createCompoundRule(
  name: string,
  conditions: ArkaCondition[],
  consequence: ArkaConsequence
): ArkaRule {
  return mockRule({
    name,
    condition: {
      type: 'and',
      conditions,
    },
    consequence,
  });
}

// ============================================================================
// Decision Factory
// ============================================================================

/**
 * Creates an ALLOW decision
 */
export function createAllowDecision(eventId: string): ArkaDecision {
  return mockDecision({
    eventId,
    status: 'ALLOW',
    ruleEvaluations: [],
  });
}

/**
 * Creates a DENY decision with rule evaluation
 */
export function createDenyDecision(eventId: string, rule: ArkaRule): ArkaDecision {
  return mockDecision({
    eventId,
    status: 'DENY',
    ruleEvaluations: [
      mockRuleEvaluation({
        ruleId: rule.id,
        result: 'FAIL',
        consequenceSnapshot: rule.consequence as unknown as Record<string, unknown>,
      }),
    ],
  });
}

/**
 * Creates a FLAG decision with rule evaluation
 */
export function createFlagDecision(eventId: string, rules: ArkaRule[]): ArkaDecision {
  return mockDecision({
    eventId,
    status: 'ALLOW_WITH_FLAGS',
    ruleEvaluations: rules.map((rule) =>
      mockRuleEvaluation({
        ruleId: rule.id,
        result: 'FAIL',
        consequenceSnapshot: rule.consequence as unknown as Record<string, unknown>,
      })
    ),
  });
}

// ============================================================================
// Test Scenario Factory
// ============================================================================

export interface TestScenario {
  name: string;
  description: string;
  event: ArkaEvent;
  rules: ArkaRule[];
  expectedDecision: 'ALLOW' | 'ALLOW_WITH_FLAGS' | 'DENY';
  expectedFlags?: string[];
}

/**
 * Creates a test scenario for rule evaluation
 */
export function createTestScenario(config: {
  name: string;
  description?: string;
  event: ArkaEvent;
  rules: ArkaRule[];
  expectedDecision: 'ALLOW' | 'ALLOW_WITH_FLAGS' | 'DENY';
  expectedFlags?: string[];
}): TestScenario {
  return {
    name: config.name,
    description: config.description ?? config.name,
    event: config.event,
    rules: config.rules,
    expectedDecision: config.expectedDecision,
    expectedFlags: config.expectedFlags,
  };
}

/**
 * Pre-built test scenarios for common AML cases
 */
export const amlScenarios = {
  /**
   * High-value transaction that should be flagged
   */
  highValueTransaction: (): TestScenario =>
    createTestScenario({
      name: 'High Value Transaction',
      description: 'Transaction over $10,000 should be flagged for review',
      event: createHighRiskTransaction(15000),
      rules: [createAmountThresholdRule(10000, 'FLAG')],
      expectedDecision: 'ALLOW_WITH_FLAGS',
      expectedFlags: ['AMOUNT_THRESHOLD_EXCEEDED'],
    }),

  /**
   * Transaction from sanctioned country that should be denied
   */
  sanctionedCountryTransaction: (): TestScenario =>
    createTestScenario({
      name: 'Sanctioned Country Transaction',
      description: 'Transaction from sanctioned country should be denied',
      event: createTransactionEvent({
        amount: 1000,
        country: 'NORTH_KOREA',
      }),
      rules: [createCountryRestrictionRule(['NORTH_KOREA', 'IRAN', 'SYRIA'])],
      expectedDecision: 'DENY',
    }),

  /**
   * Low-risk transaction that should be allowed
   */
  lowRiskTransaction: (): TestScenario =>
    createTestScenario({
      name: 'Low Risk Transaction',
      description: 'Standard transaction under threshold should be allowed',
      event: createLowRiskTransaction(500),
      rules: [createAmountThresholdRule(10000, 'FLAG')],
      expectedDecision: 'ALLOW',
    }),

  /**
   * PEP transaction that should be flagged
   */
  pepTransaction: (): TestScenario =>
    createTestScenario({
      name: 'PEP Transaction',
      description: 'Transaction involving PEP should be flagged',
      event: mockEvent({
        type: 'TRANSACTION',
        payload: {
          amount: 5000,
          isPEP: true,
          country: 'US',
        },
      }),
      rules: [createPEPCheckRule()],
      expectedDecision: 'ALLOW_WITH_FLAGS',
      expectedFlags: ['PEP_INVOLVED'],
    }),
};
