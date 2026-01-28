/**
 * ARKA Rule Evaluator
 *
 * Pure functions for evaluating rules against events and entities.
 * This is the core of the rules engine - deterministic and side-effect free.
 */

import type {
  ArkaCondition,
  ArkaRule,
  ArkaEvent,
  ArkaEntity,
  ArkaDecision,
  ArkaRuleEvaluation,
  DecisionStatus,
  RuleEvaluationResult,
  CompareCondition,
} from '@arka-protocol/types';
import { getNestedValue } from '@arka-protocol/utils';
import { ids, now } from '@arka-protocol/utils';

/**
 * Context passed to rule evaluation
 */
export interface EvaluationContext {
  /** Additional data for condition evaluation (e.g., jurisdiction-specific values) */
  data?: Record<string, unknown>;
  /** Current timestamp for evaluation (defaults to now) */
  evaluationTime?: string;
}

/**
 * Input for rule evaluation
 */
export interface EvaluateRulesInput {
  event: ArkaEvent;
  entity?: ArkaEntity | null;
  rules: ArkaRule[];
  context?: EvaluationContext;
}

/**
 * Input for single rule evaluation
 */
export interface EvaluateSingleRuleInput {
  event: ArkaEvent;
  entity?: ArkaEntity | null;
  rule: ArkaRule;
  context?: EvaluationContext;
}

/**
 * Builds the evaluation data object from event, entity, and context
 */
function buildEvaluationData(
  event: ArkaEvent,
  entity?: ArkaEntity | null,
  context?: EvaluationContext
): Record<string, unknown> {
  return {
    event: event.payload,
    entity: entity?.data ?? {},
    context: context?.data ?? {},
    // Add top-level access to common fields
    ...event.payload,
    ...(entity?.data ?? {}),
  };
}

/**
 * Compares two values using the specified operator
 */
function compare(
  fieldValue: unknown,
  operator: CompareCondition['operator'],
  targetValue: unknown
): boolean {
  switch (operator) {
    case '==':
      return fieldValue === targetValue;

    case '!=':
      return fieldValue !== targetValue;

    case '<':
      return typeof fieldValue === 'number' && typeof targetValue === 'number'
        ? fieldValue < targetValue
        : false;

    case '<=':
      return typeof fieldValue === 'number' && typeof targetValue === 'number'
        ? fieldValue <= targetValue
        : false;

    case '>':
      return typeof fieldValue === 'number' && typeof targetValue === 'number'
        ? fieldValue > targetValue
        : false;

    case '>=':
      return typeof fieldValue === 'number' && typeof targetValue === 'number'
        ? fieldValue >= targetValue
        : false;

    case 'in':
      return Array.isArray(targetValue) && targetValue.includes(fieldValue);

    case 'not_in':
      return Array.isArray(targetValue) && !targetValue.includes(fieldValue);

    case 'contains':
      if (typeof fieldValue === 'string' && typeof targetValue === 'string') {
        return fieldValue.includes(targetValue);
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(targetValue);
      }
      return false;

    case 'not_contains':
      if (typeof fieldValue === 'string' && typeof targetValue === 'string') {
        return !fieldValue.includes(targetValue);
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(targetValue);
      }
      return true;

    case 'starts_with':
      return typeof fieldValue === 'string' && typeof targetValue === 'string'
        ? fieldValue.startsWith(targetValue)
        : false;

    case 'ends_with':
      return typeof fieldValue === 'string' && typeof targetValue === 'string'
        ? fieldValue.endsWith(targetValue)
        : false;

    case 'matches':
      if (typeof fieldValue === 'string' && typeof targetValue === 'string') {
        try {
          const regex = new RegExp(targetValue);
          return regex.test(fieldValue);
        } catch {
          return false;
        }
      }
      return false;

    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;

    case 'not_exists':
      return fieldValue === undefined || fieldValue === null;

    default:
      return false;
  }
}

/**
 * Evaluates a condition against the data
 */
export function evaluateCondition(
  condition: ArkaCondition,
  data: Record<string, unknown>
): boolean {
  switch (condition.type) {
    case 'and':
      return condition.conditions.every((c) => evaluateCondition(c, data));

    case 'or':
      return condition.conditions.some((c) => evaluateCondition(c, data));

    case 'not':
      return !evaluateCondition(condition.condition, data);

    case 'compare': {
      const fieldValue = getNestedValue(data, condition.field);
      return compare(fieldValue, condition.operator, condition.value);
    }

    default:
      // Unknown condition type - fail safe
      return false;
  }
}

/**
 * Checks if a rule applies to the given event and entity
 */
function ruleApplies(
  rule: ArkaRule,
  event: ArkaEvent,
  entity?: ArkaEntity | null,
  evaluationTime?: string
): boolean {
  // Check entity type filter
  if (rule.appliesToEntityType) {
    if (!entity || entity.type !== rule.appliesToEntityType) {
      return false;
    }
  }

  // Check event type filter
  if (rule.appliesToEventType && event.type !== rule.appliesToEventType) {
    return false;
  }

  // Check jurisdiction filter
  if (rule.jurisdiction) {
    const effectiveJurisdiction = entity?.jurisdiction || event.jurisdiction;
    if (effectiveJurisdiction !== rule.jurisdiction) {
      return false;
    }
  }

  // Check effective dates
  const checkTime = evaluationTime ? new Date(evaluationTime) : new Date();

  if (rule.effectiveFrom) {
    const fromDate = new Date(rule.effectiveFrom);
    if (checkTime < fromDate) {
      return false;
    }
  }

  if (rule.effectiveTo) {
    const toDate = new Date(rule.effectiveTo);
    if (checkTime > toDate) {
      return false;
    }
  }

  // Check rule status
  if (rule.status && rule.status !== 'ACTIVE') {
    return false;
  }

  return true;
}

/**
 * Evaluates a single rule against an event and entity
 */
export function evaluateSingleRule(input: EvaluateSingleRuleInput): ArkaRuleEvaluation {
  const { event, entity, rule, context } = input;
  const startTime = performance.now();

  // Check if rule applies
  if (!ruleApplies(rule, event, entity, context?.evaluationTime)) {
    return {
      ruleId: rule.id,
      version: rule.version ?? 1,
      applied: false,
      result: 'NOT_APPLICABLE',
      details: 'Rule does not apply to this event/entity combination',
      evaluationTimeMs: performance.now() - startTime,
    };
  }

  // Build evaluation data
  const data = buildEvaluationData(event, entity, context);

  // Evaluate the condition
  const conditionMet = evaluateCondition(rule.condition, data);

  // Determine result based on condition and consequence
  // If the condition is met and consequence is DENY or FLAG, the rule "fails"
  // If the condition is met and consequence is ALLOW, the rule "passes"
  let result: RuleEvaluationResult;
  let details: string;

  if (conditionMet) {
    if (rule.consequence.decision === 'DENY' || rule.consequence.decision === 'FLAG') {
      result = 'FAIL';
      details = rule.consequence.message;
    } else {
      result = 'PASS';
      details = 'Rule condition met - allowed';
    }
  } else {
    // Condition not met - inverse logic
    if (rule.consequence.decision === 'DENY' || rule.consequence.decision === 'FLAG') {
      result = 'PASS';
      details = 'Rule condition not met - no violation';
    } else {
      result = 'FAIL';
      details = 'Required condition not met';
    }
  }

  return {
    ruleId: rule.id,
    version: rule.version ?? 1,
    applied: true,
    result,
    details,
    evaluationTimeMs: performance.now() - startTime,
    conditionSnapshot: rule.condition as unknown as Record<string, unknown>,
    consequenceSnapshot: rule.consequence as unknown as Record<string, unknown>,
  };
}

/**
 * Evaluates multiple rules and produces a decision
 */
export function evaluateRules(input: EvaluateRulesInput): ArkaDecision {
  const { event, entity, rules, context } = input;
  const startTime = performance.now();

  // Evaluate all rules
  const evaluations: ArkaRuleEvaluation[] = rules.map((rule) =>
    evaluateSingleRule({ event, entity, rule, context })
  );

  // Determine overall status
  const appliedEvaluations = evaluations.filter((e) => e.applied);
  const failedEvaluations = appliedEvaluations.filter((e) => e.result === 'FAIL');
  const hasDenials = failedEvaluations.some((e) => {
    const consequence = e.consequenceSnapshot as { decision?: string } | undefined;
    return consequence?.decision === 'DENY';
  });
  const hasFlags = failedEvaluations.some((e) => {
    const consequence = e.consequenceSnapshot as { decision?: string } | undefined;
    return consequence?.decision === 'FLAG';
  });

  let status: DecisionStatus;
  if (hasDenials) {
    status = 'DENY';
  } else if (hasFlags) {
    status = 'ALLOW_WITH_FLAGS';
  } else {
    status = 'ALLOW';
  }

  return {
    id: ids.decision(),
    eventId: event.id,
    entityId: entity?.id ?? null,
    status,
    ruleEvaluations: evaluations,
    totalEvaluationTimeMs: performance.now() - startTime,
    createdAt: now(),
    metadata: {},
  };
}

/**
 * Filters rules to get only those that apply to a given event/entity
 */
export function getApplicableRules(
  rules: ArkaRule[],
  event: ArkaEvent,
  entity?: ArkaEntity | null,
  evaluationTime?: string
): ArkaRule[] {
  return rules.filter((rule) => ruleApplies(rule, event, entity, evaluationTime));
}
