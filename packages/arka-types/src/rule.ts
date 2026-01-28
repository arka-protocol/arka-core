/**
 * ARKA Rule Types
 *
 * Rules are the core of the ARKA system. They define conditions and consequences
 * that are evaluated against events and entities.
 */

/**
 * Severity levels for rules
 */
export type RuleSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Status of a rule in the system
 */
export type RuleStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DEPRECATED';

/**
 * Decision types that a rule can produce
 */
export type DecisionType = 'ALLOW' | 'DENY' | 'FLAG';

/**
 * Comparison operators for rule conditions
 */
export type ComparisonOperator =
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches'
  | 'exists'
  | 'not_exists';

/**
 * Base interface for all condition nodes
 */
export interface ConditionBase {
  type: string;
}

/**
 * Logical AND condition - all child conditions must be true
 */
export interface AndCondition extends ConditionBase {
  type: 'and';
  conditions: ArkaCondition[];
}

/**
 * Logical OR condition - at least one child condition must be true
 */
export interface OrCondition extends ConditionBase {
  type: 'or';
  conditions: ArkaCondition[];
}

/**
 * Logical NOT condition - negates the child condition
 */
export interface NotCondition extends ConditionBase {
  type: 'not';
  condition: ArkaCondition;
}

/**
 * Comparison condition - compares a field value against a target value
 */
export interface CompareCondition extends ConditionBase {
  type: 'compare';
  /** Path to the field (supports dot notation, e.g., "loan.apr") */
  field: string;
  /** Comparison operator */
  operator: ComparisonOperator;
  /** Value to compare against (can be null for exists/not_exists operators) */
  value: unknown;
}

/**
 * Union type for all possible condition types
 */
export type ArkaCondition = AndCondition | OrCondition | NotCondition | CompareCondition;

/**
 * Consequence of a rule evaluation
 */
export interface ArkaConsequence {
  /** The decision type */
  decision: DecisionType;
  /** Unique code for this consequence (e.g., "APR_EXCEEDED") */
  code: string;
  /** Human-readable message */
  message: string;
  /** Optional remediation guidance */
  remediation?: string | null;
}

/**
 * Represents a rule in the ARKA system
 */
export interface ArkaRule {
  /** Unique identifier for the rule */
  id: string;

  /** Human-readable name */
  name: string;

  /** Detailed description of what the rule does */
  description: string;

  /** Entity type this rule applies to (null means all types) */
  appliesToEntityType?: string | null;

  /** Event type this rule applies to (null means all types) */
  appliesToEventType?: string | null;

  /** Jurisdiction this rule applies to (null means all jurisdictions) */
  jurisdiction?: string | null;

  /** ISO timestamp when the rule becomes effective */
  effectiveFrom?: string | null;

  /** ISO timestamp when the rule expires */
  effectiveTo?: string | null;

  /** Rule severity */
  severity: RuleSeverity;

  /** The condition tree that determines if the rule matches */
  condition: ArkaCondition;

  /** The consequence if the rule condition evaluates to true */
  consequence: ArkaConsequence;

  /** Tags for categorization and filtering */
  tags: string[];

  /** Additional metadata */
  metadata: Record<string, unknown>;

  /** Current status of the rule */
  status?: RuleStatus;

  /** Version number of this rule */
  version?: number;

  /** ISO timestamp when the rule was created */
  createdAt?: string;

  /** ISO timestamp when the rule was last updated */
  updatedAt?: string;
}

/**
 * A versioned snapshot of a rule
 */
export interface ArkaRuleVersion {
  /** Unique identifier for this version */
  id: string;

  /** Reference to the rule ID */
  ruleId: string;

  /** Version number */
  version: number;

  /** Complete rule definition at this version */
  rule: ArkaRule;

  /** ISO timestamp when this version was created */
  createdAt: string;

  /** User or system that created this version */
  createdBy?: string;

  /** Change description */
  changeDescription?: string;
}

/**
 * Input DTO for creating a new rule
 */
export interface CreateRuleInput {
  name: string;
  description: string;
  appliesToEntityType?: string | null;
  appliesToEventType?: string | null;
  jurisdiction?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  severity: RuleSeverity;
  condition: ArkaCondition;
  consequence: ArkaConsequence;
  tags?: string[];
  metadata?: Record<string, unknown>;
  status?: RuleStatus;
}

/**
 * Input DTO for updating an existing rule
 */
export interface UpdateRuleInput {
  name?: string;
  description?: string;
  appliesToEntityType?: string | null;
  appliesToEventType?: string | null;
  jurisdiction?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  severity?: RuleSeverity;
  condition?: ArkaCondition;
  consequence?: ArkaConsequence;
  tags?: string[];
  metadata?: Record<string, unknown>;
  status?: RuleStatus;
}

/**
 * Query parameters for filtering rules
 */
export interface RuleFilterParams {
  entityType?: string;
  eventType?: string;
  jurisdiction?: string;
  status?: RuleStatus;
  severity?: RuleSeverity;
  tags?: string[];
  effectiveAt?: string;
}

/**
 * Rule relationship types for the Rule Graph
 */
export type RuleRelationshipType =
  | 'DEPENDS_ON'      // This rule requires another rule to be evaluated first
  | 'OVERRIDES'       // This rule can override another rule's decision
  | 'CONFLICTS_WITH'  // This rule conflicts with another (detected automatically)
  | 'REFERENCES'      // This rule references fields from another rule's context
  | 'SUPERSEDES';     // This rule completely replaces another (versioning)

/**
 * Defines a relationship between two rules in the Rule Graph
 */
export interface RuleRelationship {
  /** The rule that has the relationship */
  sourceRuleId: string;

  /** The rule being related to */
  targetRuleId: string;

  /** Type of relationship */
  type: RuleRelationshipType;

  /** Optional condition for when this relationship applies */
  condition?: string;

  /** Weight/priority of this relationship (higher = more important) */
  weight?: number;

  /** Additional metadata about the relationship */
  metadata?: Record<string, unknown>;
}

/**
 * Extended ArkaRule with graph metadata
 */
export interface ArkaRuleWithGraph extends ArkaRule {
  /** Rules this rule depends on (must be evaluated first) */
  dependsOnRules?: string[];

  /** Rules this rule can override */
  overridesRules?: string[];

  /** Execution priority (higher = evaluated earlier within same dependency level) */
  priority?: number;

  /** Rule group for batch processing */
  ruleGroup?: string;
}

/**
 * Result of rule graph analysis
 */
export interface RuleGraphAnalysis {
  /** Execution order (rule IDs in order they should be evaluated) */
  executionOrder: string[];

  /** Detected cycles (arrays of rule IDs forming cycles) */
  cycles: string[][];

  /** Detected conflicts between rules */
  conflicts: RuleConflict[];

  /** Rules with no dependencies (can be evaluated in parallel) */
  independentRules: string[];

  /** Dependency levels (each level can be evaluated in parallel) */
  levels: string[][];

  /** Statistics about the graph */
  stats: {
    totalRules: number;
    totalEdges: number;
    maxDepth: number;
    avgDependencies: number;
  };
}

/**
 * Represents a conflict between two rules
 */
export interface RuleConflict {
  /** First rule in the conflict */
  ruleA: string;

  /** Second rule in the conflict */
  ruleB: string;

  /** Type of conflict */
  conflictType: 'CONTRADICTING_DECISIONS' | 'OVERLAPPING_CONDITIONS' | 'CIRCULAR_OVERRIDE';

  /** Description of the conflict */
  description: string;

  /** Suggested resolution */
  suggestedResolution?: string;

  /** Severity of the conflict */
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
