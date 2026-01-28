/**
 * ARKA Decision and Audit Types
 *
 * Decisions are the output of rule evaluations. Audit records provide
 * complete snapshots for regulatory compliance and debugging.
 */

/**
 * Overall decision status
 */
export type DecisionStatus = 'ALLOW' | 'DENY' | 'ALLOW_WITH_FLAGS';

/**
 * Result of evaluating a single rule
 */
export type RuleEvaluationResult = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';

/**
 * Detailed evaluation result for a single rule
 */
export interface ArkaRuleEvaluation {
  /** ID of the rule that was evaluated */
  ruleId: string;

  /** Version of the rule that was evaluated */
  version: number;

  /** Whether the rule was actually applied (vs skipped) */
  applied: boolean;

  /** Result of the evaluation */
  result: RuleEvaluationResult;

  /** Additional details about the evaluation */
  details?: string | null;

  /** Time taken to evaluate this rule in milliseconds */
  evaluationTimeMs?: number;

  /** The condition that was evaluated */
  conditionSnapshot?: Record<string, unknown>;

  /** The consequence that would apply if rule failed */
  consequenceSnapshot?: Record<string, unknown>;
}

/**
 * Represents the decision output from the ARKA rules engine
 */
export interface ArkaDecision {
  /** Unique identifier for the decision */
  id: string;

  /** ID of the event that triggered this decision */
  eventId: string;

  /** ID of the entity involved, if any */
  entityId?: string | null;

  /** Overall decision status */
  status: DecisionStatus;

  /** Detailed evaluation results for each rule */
  ruleEvaluations: ArkaRuleEvaluation[];

  /** Total time taken for evaluation in milliseconds */
  totalEvaluationTimeMs?: number;

  /** ISO timestamp when the decision was made */
  createdAt: string;

  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Complete audit record for regulatory compliance
 */
export interface ArkaAuditRecord {
  /** Unique identifier for the audit record */
  id: string;

  /** Reference to the decision */
  decisionId: string;

  /** Snapshot of the entity at decision time */
  entitySnapshot: Record<string, unknown> | null;

  /** Snapshot of the event at decision time */
  eventSnapshot: Record<string, unknown>;

  /** Snapshot of all rules evaluated */
  rulesetSnapshot: Record<string, unknown>;

  /** Additional context (jurisdiction lookup values, etc.) */
  context: Record<string, unknown>;

  /** ISO timestamp when the audit was created */
  createdAt: string;

  /** Hash of the audit data for integrity verification */
  integrityHash?: string;
}

/**
 * Summary of a decision for API responses
 */
export interface DecisionSummary {
  id: string;
  eventId: string;
  status: DecisionStatus;
  rulesEvaluated: number;
  rulesFailed: number;
  rulesPassed: number;
  createdAt: string;
}

/**
 * Result from processing an event
 */
export interface EventProcessingResult {
  decision: ArkaDecision;
  auditId: string;
  summary: DecisionSummary;
}
