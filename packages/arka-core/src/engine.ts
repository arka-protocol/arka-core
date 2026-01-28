/**
 * ARKA Core Engine
 *
 * High-level API for the rules engine that coordinates the registry,
 * evaluator, and validator components.
 */

import type {
  ArkaRule,
  ArkaEntityType,
  ArkaEvent,
  ArkaEntity,
  ArkaDecision,
  RuleFilterParams,
} from '@arka/types';

import { RuleRegistry, EntityTypeRegistry } from './registry.js';
import { evaluateRules, evaluateSingleRule, getApplicableRules, type EvaluationContext, type EvaluateSingleRuleInput } from './evaluator.js';
import { validateEntity, validateEntityOrThrow, type ValidationResult } from './validator.js';

/**
 * Configuration for the ARKA Engine
 */
export interface ArkaEngineConfig {
  /** Whether to validate entities before evaluation */
  validateEntities?: boolean;
  /** Whether to throw on validation errors */
  throwOnValidationError?: boolean;
}

const DEFAULT_CONFIG: ArkaEngineConfig = {
  validateEntities: true,
  throwOnValidationError: false,
};

/**
 * ARKA Core Engine
 *
 * Provides a unified interface for working with the rules engine.
 */
export class ArkaEngine {
  private ruleRegistry: RuleRegistry;
  private entityTypeRegistry: EntityTypeRegistry;
  private config: ArkaEngineConfig;

  constructor(config: ArkaEngineConfig = {}) {
    this.ruleRegistry = new RuleRegistry();
    this.entityTypeRegistry = new EntityTypeRegistry();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============ Entity Type Management ============

  /**
   * Registers an entity type with its schema
   */
  registerEntityType(type: ArkaEntityType): void {
    this.entityTypeRegistry.registerEntityType(type);
  }

  /**
   * Gets an entity type by name
   */
  getEntityType(name: string): ArkaEntityType | undefined {
    return this.entityTypeRegistry.getEntityType(name);
  }

  /**
   * Gets all registered entity types
   */
  getAllEntityTypes(): ArkaEntityType[] {
    return this.entityTypeRegistry.getAllEntityTypes();
  }

  /**
   * Checks if an entity type exists
   */
  hasEntityType(name: string): boolean {
    return this.entityTypeRegistry.hasEntityType(name);
  }

  // ============ Rule Management ============

  /**
   * Registers a rule with the specified version
   */
  registerRule(rule: ArkaRule, version: number = 1): void {
    this.ruleRegistry.registerRule(rule, version);
  }

  /**
   * Gets a rule by ID
   */
  getRule(id: string): ArkaRule | undefined {
    return this.ruleRegistry.getRule(id);
  }

  /**
   * Gets a specific version of a rule
   */
  getRuleVersion(id: string, version: number): ArkaRule | undefined {
    return this.ruleRegistry.getRuleVersion(id, version);
  }

  /**
   * Gets all versions of a rule
   */
  getRuleVersions(id: string): ArkaRule[] {
    return this.ruleRegistry.getRuleVersions(id);
  }

  /**
   * Removes a rule
   */
  unregisterRule(id: string): boolean {
    return this.ruleRegistry.unregisterRule(id);
  }

  /**
   * Gets all registered rules
   */
  getAllRules(): ArkaRule[] {
    return this.ruleRegistry.getAllRules();
  }

  /**
   * Gets rules matching the filter criteria
   */
  getRules(filter?: RuleFilterParams): ArkaRule[] {
    return this.ruleRegistry.getRules(filter);
  }

  /**
   * Gets active rules for a specific event and optional entity
   */
  getActiveRulesFor(event: ArkaEvent, entity?: ArkaEntity | null): ArkaRule[] {
    // Use the evaluator's filtering which accounts for effective dates
    const allRules = this.ruleRegistry.getAllRules();
    return getApplicableRules(allRules, event, entity);
  }

  // ============ Validation ============

  /**
   * Validates an entity against its type schema
   */
  validateEntity(entity: ArkaEntity): ValidationResult {
    const entityType = this.entityTypeRegistry.getEntityType(entity.type);
    if (!entityType) {
      return {
        valid: false,
        errors: [{ path: '/', message: `Unknown entity type: ${entity.type}` }],
      };
    }
    return validateEntity(entity, entityType);
  }

  /**
   * Validates an entity and throws if invalid
   */
  validateEntityOrThrow(entity: ArkaEntity): void {
    const entityType = this.entityTypeRegistry.getEntityType(entity.type);
    if (!entityType) {
      throw new Error(`Unknown entity type: ${entity.type}`);
    }
    validateEntityOrThrow(entity, entityType);
  }

  // ============ Rule Evaluation ============

  /**
   * Evaluates a single rule against an event and optional entity
   */
  evaluateSingleRule(
    input: Omit<EvaluateSingleRuleInput, 'rule'> & { ruleId: string }
  ): ReturnType<typeof evaluateSingleRule> | null {
    const rule = this.ruleRegistry.getRule(input.ruleId);
    if (!rule) return null;
    return evaluateSingleRule({ ...input, rule });
  }

  /**
   * Evaluates all applicable rules against an event and optional entity
   */
  evaluateRules(input: {
    event: ArkaEvent;
    entity?: ArkaEntity | null;
    context?: EvaluationContext;
    rules?: ArkaRule[];
  }): ArkaDecision {
    const { event, entity, context, rules: explicitRules } = input;

    // Optionally validate entity
    if (this.config.validateEntities && entity) {
      const validationResult = this.validateEntity(entity);
      if (!validationResult.valid) {
        if (this.config.throwOnValidationError) {
          throw new Error(`Entity validation failed: ${JSON.stringify(validationResult.errors)}`);
        }
        // Continue with evaluation but note the validation failure
      }
    }

    // Get rules to evaluate
    const rulesToEvaluate = explicitRules ?? this.getActiveRulesFor(event, entity);

    return evaluateRules({
      event,
      entity,
      rules: rulesToEvaluate,
      context,
    });
  }

  // ============ Utility Methods ============

  /**
   * Clears all rules and entity types
   */
  reset(): void {
    this.ruleRegistry.clear();
    this.entityTypeRegistry.clear();
  }

  /**
   * Gets engine statistics
   */
  getStats(): { ruleCount: number; entityTypeCount: number } {
    return {
      ruleCount: this.ruleRegistry.size,
      entityTypeCount: this.entityTypeRegistry.size,
    };
  }
}

// Default engine instance
let defaultEngine: ArkaEngine | null = null;

export function getDefaultEngine(): ArkaEngine {
  if (!defaultEngine) {
    defaultEngine = new ArkaEngine();
  }
  return defaultEngine;
}

export function setDefaultEngine(engine: ArkaEngine): void {
  defaultEngine = engine;
}

export function resetDefaultEngine(): void {
  defaultEngine?.reset();
}
