/**
 * ARKA Testing Library
 *
 * Comprehensive testing utilities for ARKA Engine components.
 * Provides mocks, factories, fixtures, and helpers for testing
 * rules, events, decisions, and plugins.
 *
 * @packageDocumentation
 */

// ============================================================================
// Mock Utilities
// ============================================================================

export {
  // Event mocks
  mockEvent,
  mockEvents,
  type MockEventOptions,

  // Entity mocks
  mockEntity,
  type MockEntityOptions,

  // Rule mocks
  mockRule,
  mockRules,
  type MockRuleOptions,

  // Decision mocks
  mockDecision,
  mockRuleEvaluation,
  type MockDecisionOptions,

  // Condition builders
  conditions,

  // Consequence builders
  consequences,

  // Utilities
  resetMockCounters,
} from './mocks/index.js';

// ============================================================================
// Factory Utilities
// ============================================================================

export {
  // Transaction factories
  createTransactionEvent,
  createHighRiskTransaction,
  createLowRiskTransaction,
  type TransactionEventData,

  // Customer factories
  createCustomerEvent,
  type CustomerEventData,

  // Rule factories
  createAmountThresholdRule,
  createCountryRestrictionRule,
  createPEPCheckRule,
  createVelocityCheckRule,
  createCompoundRule,

  // Decision factories
  createAllowDecision,
  createDenyDecision,
  createFlagDecision,

  // Scenario factories
  createTestScenario,
  amlScenarios,
  type TestScenario,
} from './factories/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

export {
  // Sample rules
  sampleRules,
  getAllSampleRules,

  // Sample events
  sampleEvents,
  getAllSampleEvents,

  // Sample entities
  sampleEntities,
  getAllSampleEntities,

  // Integration test data
  integrationTestData,
  expectedResults,
} from './fixtures/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

export {
  // Async helpers
  wait,
  waitFor,
  retry,

  // Assertion helpers
  expectAllow,
  expectDeny,
  expectFlag,
  expectRulesEvaluated,
  expectRuleTriggered,
  expectRuleNotTriggered,

  // Performance helpers
  measureTime,
  expectWithinTime,
  benchmark,

  // Mock helpers
  createSpy,
  createMockFn,
  createMockAsyncFn,

  // Test suite helpers
  describeRule,
  testEach,

  // Data generation helpers
  randomString,
  randomNumber,
  randomInt,
  randomChoice,
  randomDate,
  uuid,

  // Cleanup helpers
  createCleanupStack,

  // Environment helpers
  withEnv,
} from './helpers/index.js';
