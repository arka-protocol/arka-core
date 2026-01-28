/**
 * ARKA Core - Rules Engine Library
 *
 * Pure, deterministic rules engine for the ARKA Protocol.
 * No network IO or side effects.
 *
 * @packageDocumentation
 */

// Core engine
export {
  ArkaEngine,
  getDefaultEngine,
  setDefaultEngine,
  resetDefaultEngine,
  type ArkaEngineConfig,
} from './engine.js';

// Evaluator
export {
  evaluateRules,
  evaluateSingleRule,
  evaluateCondition,
  getApplicableRules,
  type EvaluationContext,
  type EvaluateRulesInput,
  type EvaluateSingleRuleInput,
} from './evaluator.js';

// Registry
export {
  RuleRegistry,
  EntityTypeRegistry,
  getDefaultRuleRegistry,
  getDefaultEntityTypeRegistry,
  resetDefaultRegistries,
} from './registry.js';

// Validator
export {
  validateAgainstSchema,
  validateEntity,
  validateEntityOrThrow,
  validateEntityData,
  validateEntityDataOrThrow,
  validateSchema,
  createValidator,
  type ValidationResult,
} from './validator.js';

// RTVM (Rule-Time Virtual Machine)
export * from './rtvm/index.js';

// Rule Graph Engine
export * from './rule-graph/index.js';

// Time-Travel Simulations
export * from './time-travel/index.js';

// Multi-Jurisdiction Harmonization
export * from './harmonization/index.js';

// Compliance Policy Diff Engine
export * from './diff/index.js';

// Adaptive Compliance Scoring
export * from './scoring/index.js';

// Global Rule Language (GRL)
export * from './grl/index.js';

// Temporal Entity Snapshots
export * from './temporal/index.js';

// Global Compliance Graph
export * from './graph/index.js';
