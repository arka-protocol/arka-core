/**
 * ARKA Governance Types
 *
 * Types for AI governance, rule approvals, and compliance tracking.
 */

// ============================================================================
// AI Governance Types (Enhancement #1)
// ============================================================================

/**
 * Type of AI proposal
 */
export type AIProposalType =
  | 'RULE_GENERATION'
  | 'THRESHOLD_ADJUSTMENT'
  | 'RISK_ANALYSIS'
  | 'LEGAL_DIFF'
  | 'ANOMALY_DETECTION'
  | 'PATTERN_ANALYSIS'
  | 'HARMONIZATION';

/**
 * AI proposal record for audit trail
 */
export interface AIProposal {
  /** Unique identifier */
  id: string;

  /** Type of proposal */
  proposalType: AIProposalType;

  /** Full payload (rule, analysis, etc.) */
  payload: unknown;

  /** Model that generated this proposal */
  sourceModel: string;

  /** Hash of the input that generated this */
  inputHash: string;

  /** Hash of the output for verification */
  outputHash: string;

  /** ISO timestamp */
  createdAt: string;

  /** Optional reference to related entity */
  relatedEntityId?: string;

  /** Optional reference to related rule */
  relatedRuleId?: string;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * AI evaluation/critique of a proposal
 */
export interface AIEvaluation {
  /** Unique identifier */
  id: string;

  /** Reference to the proposal being evaluated */
  proposalId: string;

  /** Model that performed the critique */
  criticModel: string;

  /** Consistency score (0-1) */
  consistencyScore: number;

  /** Detailed comments from critic */
  comments: string;

  /** Specific issues found */
  issues?: AIEvaluationIssue[];

  /** ISO timestamp */
  createdAt: string;
}

/**
 * Specific issue found during AI evaluation
 */
export interface AIEvaluationIssue {
  /** Severity level */
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  /** Issue category */
  category: 'LOGIC' | 'COVERAGE' | 'CONSISTENCY' | 'SAFETY' | 'PERFORMANCE';

  /** Description of the issue */
  description: string;

  /** Suggested fix if available */
  suggestedFix?: string;
}

// ============================================================================
// Rule Governance Types (Enhancement #15)
// ============================================================================

/**
 * Role that can approve rules
 */
export type ApproverRole =
  | 'COMPLIANCE_OFFICER'
  | 'LEGAL_COUNSEL'
  | 'BUSINESS_OWNER'
  | 'TECHNICAL_LEAD'
  | 'EXECUTIVE';

/**
 * Rule approval record
 */
export interface RuleApproval {
  /** Unique identifier */
  id: string;

  /** Rule being approved */
  ruleId: string;

  /** Version of the rule being approved */
  ruleVersion: number;

  /** Role of the approver */
  approverRole: ApproverRole;

  /** Identifier of the approver */
  approverId: string;

  /** Optional cryptographic signature */
  signature?: string;

  /** Approval notes */
  notes?: string;

  /** ISO timestamp */
  approvedAt: string;
}

/**
 * Approval requirement for rule activation
 */
export interface ApprovalRequirement {
  /** Role required */
  role: ApproverRole;

  /** Minimum number of approvals needed from this role */
  minCount: number;
}

/**
 * Rule governance policy
 */
export interface RuleGovernancePolicy {
  /** Policy identifier */
  id: string;

  /** Jurisdictions this policy applies to */
  jurisdictions: string[];

  /** Severity levels this policy applies to */
  severityLevels: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[];

  /** Required approvals */
  requiredApprovals: ApprovalRequirement[];

  /** Whether AI-generated rules need extra review */
  aiGeneratedRequiresExtraReview: boolean;

  /** Maximum time to wait for approvals (hours) */
  approvalTimeoutHours?: number;
}

// ============================================================================
// Risk Scoring Types (Enhancement #13)
// ============================================================================

/**
 * Risk band classification
 */
export type RiskBand = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Entity risk score
 */
export interface EntityRiskScore {
  /** Unique identifier */
  id: string;

  /** Entity being scored */
  entityId: string;

  /** Entity type */
  entityType: string;

  /** Numeric risk score (0-100) */
  riskScore: number;

  /** Risk band classification */
  riskBand: RiskBand;

  /** Factors contributing to the score */
  factors: RiskFactor[];

  /** ISO timestamp of calculation */
  calculatedAt: string;

  /** Previous score for trend analysis */
  previousScore?: number;

  /** Trend direction */
  trend?: 'IMPROVING' | 'STABLE' | 'WORSENING';
}

/**
 * Factor contributing to risk score
 */
export interface RiskFactor {
  /** Factor name */
  name: string;

  /** Factor weight (0-1) */
  weight: number;

  /** Factor value */
  value: number;

  /** Description */
  description: string;

  /** Source of this factor */
  source: 'RULE_VIOLATIONS' | 'DECISION_HISTORY' | 'AI_ANALYSIS' | 'EXTERNAL';
}

// ============================================================================
// Compliance Pattern Types (Enhancement #17)
// ============================================================================

/**
 * Compliance pattern identified by AI
 */
export interface CompliancePattern {
  /** Unique identifier */
  id: string;

  /** Pattern type */
  patternType: 'VIOLATION_CLUSTER' | 'ANOMALY' | 'TREND' | 'CORRELATION';

  /** Cluster identifier for grouping */
  clusterId: string;

  /** Human-readable description */
  description: string;

  /** Entities exhibiting this pattern */
  affectedEntityIds: string[];

  /** Rules involved in this pattern */
  involvedRuleIds: string[];

  /** Pattern strength (0-1) */
  strength: number;

  /** Statistical significance */
  significance: number;

  /** ISO timestamp of detection */
  detectedAt: string;

  /** Additional metadata */
  metadata: Record<string, unknown>;
}

// ============================================================================
// Compliance Graph Types (Enhancement #18)
// ============================================================================

/**
 * Node type in compliance graph
 */
export type GraphNodeType =
  | 'RULE'
  | 'ENTITY'
  | 'JURISDICTION'
  | 'PATTERN'
  | 'DECISION'
  | 'EVENT'
  | 'LEGAL_SOURCE'
  | 'REGULATION'
  | 'RISK_FACTOR';

/**
 * Edge type in compliance graph
 */
export type GraphEdgeType =
  | 'APPLIES_TO'
  | 'VIOLATED_BY'
  | 'LOCATED_IN'
  | 'DEPENDS_ON'
  | 'OVERRIDES'
  | 'RELATED_TO'
  | 'DERIVED_FROM'
  | 'EVALUATED_BY'
  | 'RESULTED_IN'
  | 'GOVERNS'
  | 'IMPLEMENTS'
  | 'CONFLICTS_WITH'
  | 'OWNED_BY'
  | 'TRIGGERED'
  | 'INDICATES'
  | 'MITIGATED_BY';

/**
 * Graph node
 */
export interface GraphNode {
  /** Unique identifier */
  id: string;

  /** Node type */
  nodeType: GraphNodeType;

  /** Reference to the actual entity */
  refId: string;

  /** Display label */
  label: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Graph edge
 */
export interface GraphEdge {
  /** Unique identifier */
  id: string;

  /** Source node ID */
  fromNodeId: string;

  /** Target node ID */
  toNodeId: string;

  /** Edge type */
  edgeType: GraphEdgeType;

  /** Edge weight/strength */
  weight?: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Agent Types (Enhancement #10)
// ============================================================================

/**
 * Compliance agent configuration
 */
export interface ComplianceAgentConfig {
  /** Agent identifier */
  agentId: string;

  /** Agent name */
  name: string;

  /** Central coordinator URL */
  coordinatorUrl: string;

  /** Jurisdictions this agent handles */
  jurisdictions: string[];

  /** Entity types this agent processes */
  entityTypes: string[];

  /** Sync interval in seconds */
  syncIntervalSeconds: number;

  /** Local rule cache TTL in seconds */
  ruleCacheTtlSeconds: number;

  /** Enable offline mode */
  offlineModeEnabled: boolean;
}

/**
 * Agent heartbeat message
 */
export interface AgentHeartbeat {
  /** Agent identifier */
  agentId: string;

  /** Agent status */
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';

  /** Last sync timestamp */
  lastSyncAt: string;

  /** Number of rules cached */
  cachedRulesCount: number;

  /** Events processed since last heartbeat */
  eventsProcessed: number;

  /** Decisions made since last heartbeat */
  decisionsMade: number;

  /** Current timestamp */
  timestamp: string;

  /** System metrics */
  metrics?: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
}

/**
 * Agent decision report (aggregated)
 */
export interface AgentDecisionReport {
  /** Agent identifier */
  agentId: string;

  /** Report period start */
  periodStart: string;

  /** Report period end */
  periodEnd: string;

  /** Decision counts by status */
  decisionCounts: {
    allowed: number;
    denied: number;
    flagged: number;
  };

  /** Top triggered rules */
  topTriggeredRules: Array<{
    ruleId: string;
    count: number;
  }>;

  /** Any errors encountered */
  errors: Array<{
    errorCode: string;
    count: number;
    lastOccurrence: string;
  }>;
}

// ============================================================================
// Simulation Types (Enhancement #5)
// ============================================================================

/**
 * Time-travel simulation request
 */
export interface TimeTravelSimulationRequest {
  /** Target point in time (ISO timestamp) */
  asOfDate: string;

  /** Event time range to replay */
  eventTimeRange: {
    start: string;
    end: string;
  };

  /** Optional specific rule set version */
  ruleSetVersion?: number;

  /** Maximum events to process */
  maxEvents?: number;

  /** Include detailed decision diffs */
  includeDecisionDiffs?: boolean;
}

/**
 * Time-travel simulation result
 */
export interface TimeTravelSimulationResult {
  /** Simulation identifier */
  id: string;

  /** Parameters used */
  parameters: TimeTravelSimulationRequest;

  /** Number of events replayed */
  eventsReplayed: number;

  /** Historical rule count */
  historicalRuleCount: number;

  /** Current rule count */
  currentRuleCount: number;

  /** Decision comparison */
  comparison: {
    /** Decisions that would be the same */
    unchanged: number;
    /** Decisions that would change from ALLOW to DENY */
    allowToDeny: number;
    /** Decisions that would change from DENY to ALLOW */
    denyToAllow: number;
    /** Other changes */
    otherChanges: number;
  };

  /** Detailed diffs (if requested) */
  decisionDiffs?: Array<{
    eventId: string;
    historicalDecision: string;
    currentDecision: string;
    changedRules: string[];
  }>;

  /** ISO timestamp */
  createdAt: string;
}
