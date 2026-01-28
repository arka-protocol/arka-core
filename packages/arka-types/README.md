<p align="center">
  <img src="https://www.arkaprotocol.com/logo.svg" alt="ARKA Protocol" width="120" />
</p>

<h1 align="center">@arka-protocol/types</h1>

<p align="center">
  <strong>Official TypeScript type definitions for ARKA Protocol</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@arka-protocol/types">
    <img src="https://img.shields.io/npm/v/@arka-protocol/types?style=flat-square&color=0070f3" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@arka-protocol/types">
    <img src="https://img.shields.io/npm/dm/@arka-protocol/types?style=flat-square&color=0070f3" alt="npm downloads" />
  </a>
  <a href="https://github.com/arka-protocol/arka-core/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square" alt="license" />
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5.0+-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  </a>
</p>

<p align="center">
  Complete type definitions for building compliance automation solutions with ARKA Protocol.<br/>
  Covers rules, decisions, events, entities, AI governance, blockchain, and more.
</p>

---

## Overview

`@arka-protocol/types` provides comprehensive TypeScript type definitions for the ARKA Protocol ecosystem. Whether you're building plugins, integrating with the rules engine, or developing compliance workflows, these types ensure type safety across your entire application.

### Key Features

- **Complete Coverage** - Types for all ARKA Protocol domains
- **Zero Dependencies** - Pure TypeScript definitions with no runtime overhead
- **Tree-Shakeable** - Import only what you need
- **Well-Documented** - JSDoc comments for IDE intellisense

---

## Installation

```bash
# npm
npm install @arka-protocol/types

# yarn
yarn add @arka-protocol/types

# pnpm
pnpm add @arka-protocol/types
```

---

## Quick Start

```typescript
import type {
  ArkaEvent,
  ArkaRule,
  ArkaDecision,
  ArkaEntity,
} from '@arka-protocol/types';

// Define a compliance event
const event: ArkaEvent = {
  id: 'evt_123',
  source: 'loan-service',
  type: 'LOAN_CREATED',
  entityId: 'loan_456',
  entityType: 'Loan',
  jurisdiction: 'US-CA',
  payload: {
    amount: 50000,
    apr: 8.5,
    term: 36,
  },
  occurredAt: new Date().toISOString(),
  receivedAt: new Date().toISOString(),
};

// Type-safe rule definition
const rule: ArkaRule = {
  id: 'rule_001',
  name: 'APR Cap Rule',
  description: 'Ensures APR does not exceed state limits',
  severity: 'HIGH',
  jurisdiction: 'US-CA',
  condition: {
    type: 'compare',
    field: 'payload.apr',
    operator: '>',
    value: 36,
  },
  consequence: {
    decision: 'DENY',
    code: 'APR_EXCEEDED',
    message: 'APR exceeds maximum allowed rate',
  },
  tags: ['lending', 'consumer-protection'],
  metadata: {},
};
```

---

## Type Categories

### Core Domain Types

| Type | Description |
|------|-------------|
| `ArkaEvent` | Canonical event format for rule evaluation |
| `ArkaEntity` | Entities subject to compliance rules |
| `ArkaEntityType` | Entity type schema definitions |
| `ArkaRule` | Rule definitions with conditions and consequences |
| `ArkaDecision` | Output from rule evaluations |
| `ArkaAuditRecord` | Immutable audit trail records |

```typescript
import type {
  ArkaEvent,
  CreateEventInput,
  ArkaEntity,
  ArkaEntityType,
  CreateEntityInput,
  UpdateEntityInput,
} from '@arka-protocol/types';
```

### Rule System Types

| Type | Description |
|------|-------------|
| `ArkaCondition` | Union of all condition types (AND, OR, NOT, Compare) |
| `ArkaConsequence` | Rule outcomes (ALLOW, DENY, FLAG) |
| `RuleSeverity` | LOW, MEDIUM, HIGH, CRITICAL |
| `RuleStatus` | DRAFT, ACTIVE, INACTIVE, DEPRECATED |
| `ComparisonOperator` | Operators for field comparisons |
| `RuleRelationship` | Dependencies between rules |
| `RuleGraphAnalysis` | Rule graph analysis results |

```typescript
import type {
  ArkaRule,
  ArkaCondition,
  AndCondition,
  OrCondition,
  CompareCondition,
  ArkaConsequence,
  RuleSeverity,
  RuleStatus,
  DecisionType,
  ComparisonOperator,
  CreateRuleInput,
  UpdateRuleInput,
  RuleFilterParams,
  RuleRelationship,
  ArkaRuleWithGraph,
  RuleGraphAnalysis,
  RuleConflict,
} from '@arka-protocol/types';
```

### Decision & Audit Types

| Type | Description |
|------|-------------|
| `ArkaDecision` | Complete decision with rule evaluations |
| `ArkaRuleEvaluation` | Individual rule evaluation result |
| `DecisionStatus` | ALLOW, DENY, ALLOW_WITH_FLAGS |
| `DecisionSummary` | Lightweight decision summary |
| `ArkaAuditRecord` | Full audit record with snapshots |

```typescript
import type {
  ArkaDecision,
  ArkaRuleEvaluation,
  DecisionStatus,
  RuleEvaluationResult,
  DecisionSummary,
  ArkaAuditRecord,
  EventProcessingResult,
} from '@arka-protocol/types';
```

### AI & Cortex Types

| Type | Description |
|------|-------------|
| `AIRuleProposal` | AI-generated rule proposals |
| `RiskScore` | Predictive risk assessments |
| `AnomalySignal` | Anomaly detection signals |
| `RemediationSuggestion` | AI remediation recommendations |
| `IncidentSummary` | AI-generated incident reports |
| `SimulationResult` | Rule simulation outcomes |

```typescript
import type {
  // AI Proposals
  AIRuleProposal,
  AITestCase,
  ProposalStatus,
  ProposalType,

  // Risk Scoring
  RiskScore,
  RiskPattern,
  RiskAnalysisInput,
  RiskAnalysisOutput,
  ThresholdRecommendation,

  // Anomaly Detection
  AnomalySignal,
  AnomalySeverity,
  AnomalyType,

  // Remediation
  RemediationSuggestion,
  IncidentSummary,
  RemediationContext,

  // NL to Rule
  NLToRuleInput,
  NLToRuleOutput,

  // Legal Analysis
  LegalDiffInput,
  LegalDiffOutput,
  ProposedRuleChange,
  LegalSource,

  // Simulation
  SimulationInput,
  SimulationResult,

  // Decision Explanation
  ExplainDecisionInput,
  ExplainDecisionOutput,
  DecisionExplanationRequest,
  DecisionExplanationResponse,

  // AI Configuration
  AIModelConfig,
  AIModelProvider,
  AIOutputSchema,
  GuardrailValidationResult,
} from '@arka-protocol/types';
```

### Governance Types

| Type | Description |
|------|-------------|
| `AIProposal` | AI proposal audit records |
| `AIEvaluation` | AI critique results |
| `RuleApproval` | Rule approval workflows |
| `RuleGovernancePolicy` | Approval requirements |
| `EntityRiskScore` | Entity-level risk scores |
| `CompliancePattern` | Detected compliance patterns |
| `ComplianceAgentConfig` | Distributed agent configuration |

```typescript
import type {
  // AI Governance
  AIProposal,
  AIProposalType,
  AIEvaluation,
  AIEvaluationIssue,

  // Rule Approvals
  RuleApproval,
  ApproverRole,
  ApprovalRequirement,
  RuleGovernancePolicy,

  // Risk Scoring
  EntityRiskScore,
  RiskBand,
  RiskFactor,

  // Compliance Patterns
  CompliancePattern,

  // Compliance Graph
  GraphNode,
  GraphEdge,
  GraphNodeType,
  GraphEdgeType,

  // Distributed Agents
  ComplianceAgentConfig,
  AgentHeartbeat,
  AgentDecisionReport,

  // Simulation
  TimeTravelSimulationRequest,
  TimeTravelSimulationResult,
} from '@arka-protocol/types';
```

### Blockchain Types

| Type | Description |
|------|-------------|
| `Block` | Blockchain block with transactions |
| `BlockHeader` | Block metadata |
| `ChainTransaction` | Union of transaction types |
| `ChainState` | Current blockchain state |
| `NodeStatus` | Node health information |
| `ChainStats` | Chain statistics |

```typescript
import type {
  // Primitives
  ChainId,
  BlockHash,
  TxHash,
  NodeId,

  // Blocks
  Block,
  BlockHeader,
  BlockSummary,

  // Transactions
  ChainTransaction,
  ArkaEventTransaction,
  GovernanceTransaction,
  AuditTransaction,

  // State & Config
  ChainState,
  ChainConfig,
  ChainNodeConfig,
  NodeStatus,

  // API Responses
  SubmitTxResponse,
  BlockListResponse,
  TxLookupResponse,

  // Explorer
  ChainSearchResult,
  ChainStats,
  ChainStorageInfo,
} from '@arka-protocol/types';
```

### Plugin Types

| Type | Description |
|------|-------------|
| `ArkaPlugin` | Plugin interface definition |
| `ArkaPluginHooks` | Plugin lifecycle hooks |
| `ArkaCoreContext` | Core services for plugins |
| `ArkaTransaction` | Normalized transaction data |
| `AuditRecord` | Plugin audit records |
| `Alert` | System alerts |
| `RiskScoreBundle` | Complete risk assessment |

```typescript
import type {
  // Plugin Interface
  ArkaPlugin,
  ArkaPluginHooks,
  ArkaCoreContext,

  // Transactions
  ArkaTransaction,
  ArkaTransactionParty,
  AssetType,

  // Audit
  AuditRecord,
  AuditEventType,
  AuditActor,
  AuditCorrelationIds,
  AuditCategory,
  AuditSeverity,
  AuditQuery,
  EvidenceAttachment,
  EvidenceType,

  // Risk Scoring
  RiskScoreBundle,
  RiskLevel,
  PluginRiskFactor,
  RiskFactorCategory,
  PluginEntityRiskScore,
  RiskInput,
  RiskHistoryContext,

  // Alerts
  Alert,
  AlertType,
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  AlertReferences,
  AlertChannelConfig,
  AlertChannelType,

  // Regulatory
  RegulationReference,
  RuleRegMapping,
  RequirementType,
  ExplanationRequest,
  ExplanationResponse,
  ExplanationType,
  ExplanationAudience,

  // Reports
  ReportContext,
  ReportType,
  ReportFormat,
  ReportDraft,
  ReportSection,

  // Data Sources
  GrpcSourceConfig,
  KafkaSourceConfig,
  ChainSourceConfig,
  ChainType,
  RetryConfig,
  ProtocolEvent,

  // AML/Compliance
  MonitoringProfile,
  MonitoringRule,
  MonitoringThresholds,
  SuspiciousActivity,
  AmlFlag,

  // Service Interfaces
  RuleEngineAccess,
  EntityRegistryAccess,
  TransactionStreamAccess,
  AuditLogServiceAccess,
  AlertServiceAccess,
  ConfigAccess,
  SecretsAccess,
} from '@arka-protocol/types';
```

### API Types

| Type | Description |
|------|-------------|
| `ApiResponse<T>` | Standard API response wrapper |
| `ApiError` | Error structure |
| `PaginationMeta` | Pagination metadata |
| `ProcessEventRequest` | Event processing request |
| `HealthCheckResponse` | Health check response |

```typescript
import type {
  // Response Wrappers
  ApiResponse,
  ApiError,
  ResponseMeta,
  PaginationMeta,
  PaginationParams,

  // Event API
  ProcessEventRequest,
  ProcessEventResponse,

  // Decision API
  GetDecisionResponse,
  ListDecisionsParams,

  // Audit API
  GetAuditResponse,

  // Rule API
  CreateRuleRequest,
  CreateRuleResponse,
  UpdateRuleRequest,
  ListRulesParams,
  ListRulesResponse,

  // Entity API
  CreateEntityRequest,
  UpdateEntityRequest,
  ListEntitiesParams,

  // Health
  HealthCheckResponse,
} from '@arka-protocol/types';
```

### Schema Types

```typescript
import type {
  JSONSchema,
  JSONSchemaType,
} from '@arka-protocol/types';
```

---

## Usage Examples

### Creating a Rule with Complex Conditions

```typescript
import type { ArkaRule, ArkaCondition } from '@arka-protocol/types';

const complexCondition: ArkaCondition = {
  type: 'and',
  conditions: [
    {
      type: 'compare',
      field: 'payload.amount',
      operator: '>',
      value: 10000,
    },
    {
      type: 'or',
      conditions: [
        {
          type: 'compare',
          field: 'jurisdiction',
          operator: 'in',
          value: ['US-CA', 'US-NY'],
        },
        {
          type: 'compare',
          field: 'payload.riskLevel',
          operator: '==',
          value: 'HIGH',
        },
      ],
    },
  ],
};

const rule: ArkaRule = {
  id: 'rule_complex_001',
  name: 'High-Value Transaction Review',
  description: 'Flag high-value transactions in specific jurisdictions',
  severity: 'HIGH',
  condition: complexCondition,
  consequence: {
    decision: 'FLAG',
    code: 'HIGH_VALUE_REVIEW',
    message: 'Transaction requires manual review',
    remediation: 'Submit to compliance team for approval',
  },
  tags: ['high-value', 'review-required'],
  metadata: {},
};
```

### Working with Decisions

```typescript
import type {
  ArkaDecision,
  DecisionStatus,
  ArkaRuleEvaluation,
} from '@arka-protocol/types';

function processDecision(decision: ArkaDecision): void {
  console.log(`Decision: ${decision.status}`);

  const failedRules = decision.ruleEvaluations.filter(
    (evaluation: ArkaRuleEvaluation) => evaluation.result === 'FAIL'
  );

  if (failedRules.length > 0) {
    console.log(`Failed rules: ${failedRules.map(r => r.ruleId).join(', ')}`);
  }
}
```

### Building a Plugin

```typescript
import type {
  ArkaPlugin,
  ArkaCoreContext,
  ArkaTransaction,
  Alert,
} from '@arka-protocol/types';

const myPlugin: ArkaPlugin = {
  id: 'my-custom-plugin',
  version: '1.0.0',
  name: 'Custom Compliance Plugin',
  description: 'Adds custom compliance checks',

  async init(core: ArkaCoreContext): Promise<void> {
    console.log('Plugin initialized');
  },

  hooks: {
    async onTransaction(tx: ArkaTransaction): Promise<void> {
      if (tx.amount > 50000) {
        // Handle high-value transaction
      }
    },

    async onAlert(alert: Alert): Promise<void> {
      if (alert.severity === 'critical') {
        // Escalate critical alerts
      }
    },
  },
};
```

---

## Documentation

For complete documentation, guides, and API reference:

**[https://www.arkaprotocol.com/docs](https://www.arkaprotocol.com/docs)**

---

## Related Packages

| Package | Description |
|---------|-------------|
| `@arka-protocol/core` | Core rules engine and services |
| `@arka-protocol/sdk` | Plugin development SDK |
| `@arka-protocol/cli` | Command-line interface |

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/arka-protocol/arka-core/blob/main/CONTRIBUTING.md) for details.

---

## License

Apache-2.0 - see [LICENSE](https://github.com/arka-protocol/arka-core/blob/main/LICENSE) for details.

---

<p align="center">
  <sub>Built with care by <a href="https://www.arkaprotocol.com">ARKA Protocol</a></sub>
</p>
