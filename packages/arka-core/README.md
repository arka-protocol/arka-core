<p align="center">
  <img src="https://www.arkaprotocol.com/logo.svg" alt="ARKA Protocol" width="120" height="120" />
</p>

<h1 align="center">@arka-protocol/core</h1>

<p align="center">
  <strong>Pure, deterministic compliance rules engine for the modern enterprise</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@arka-protocol/core"><img src="https://img.shields.io/npm/v/@arka-protocol/core.svg?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@arka-protocol/core"><img src="https://img.shields.io/npm/dm/@arka-protocol/core.svg?style=flat-square&color=green" alt="npm downloads" /></a>
  <a href="https://github.com/arka-protocol/arka-core/actions"><img src="https://img.shields.io/github/actions/workflow/status/arka-protocol/arka-core/ci.yml?style=flat-square" alt="build status" /></a>
  <a href="https://github.com/arka-protocol/arka-core/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=flat-square" alt="license" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.3-blue.svg?style=flat-square" alt="TypeScript" /></a>
</p>

<p align="center">
  <a href="https://www.arkaprotocol.com/docs">Documentation</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#api-reference">API Reference</a> |
  <a href="https://github.com/arka-protocol/arka-core/tree/main/examples">Examples</a>
</p>

---

## Overview

`@arka-protocol/core` is a **zero-dependency** (runtime), **pure**, and **deterministic** rules engine designed for building sophisticated compliance, regulatory, and policy enforcement systems. It provides a powerful foundation for applications requiring auditable decision-making with full traceability.

### Key Features

- **Deterministic Evaluation** - Same inputs always produce identical outputs, perfect for audit trails
- **Bytecode Compilation (RTVM)** - Compile rules to optimized bytecode for high-performance evaluation
- **Multi-Jurisdiction Harmonization** - Handle overlapping regulatory requirements across regions
- **Time-Travel Simulation** - Test rule changes against historical data before deployment
- **Adaptive Risk Scoring** - Dynamic entity risk assessment with configurable factors
- **Rule Dependency Graphs** - Visualize and manage complex rule relationships
- **JSON Schema Validation** - Built-in entity validation with comprehensive error reporting
- **Zero Side Effects** - Pure library with no network I/O or external dependencies

---

## Installation

```bash
npm install @arka-protocol/core
```

```bash
yarn add @arka-protocol/core
```

```bash
pnpm add @arka-protocol/core
```

---

## Quick Start

### Basic Rule Evaluation

```typescript
import { ArkaEngine } from '@arka-protocol/core';

// Create the engine
const engine = new ArkaEngine();

// Register an entity type with schema
engine.registerEntityType({
  name: 'Transaction',
  description: 'Financial transaction',
  schema: {
    type: 'object',
    properties: {
      amount: { type: 'number' },
      currency: { type: 'string' },
      country: { type: 'string' }
    },
    required: ['amount', 'currency']
  }
});

// Register a compliance rule
engine.registerRule({
  id: 'large-transaction-check',
  name: 'Large Transaction Review',
  description: 'Flag transactions over $10,000 for review',
  severity: 'MEDIUM',
  tags: ['aml', 'transaction-monitoring'],
  condition: {
    type: 'compare',
    field: 'amount',
    operator: '>=',
    value: 10000
  },
  consequence: {
    decision: 'FLAG',
    message: 'Transaction exceeds $10,000 threshold - requires manual review'
  }
});

// Evaluate an event
const decision = engine.evaluateRules({
  event: {
    id: 'evt_123',
    type: 'transaction.created',
    payload: { amount: 15000, currency: 'USD' },
    occurredAt: new Date().toISOString()
  },
  entity: {
    id: 'txn_456',
    type: 'Transaction',
    data: { amount: 15000, currency: 'USD', country: 'US' }
  }
});

console.log(decision.status); // 'ALLOW_WITH_FLAGS'
console.log(decision.ruleEvaluations[0].details);
// 'Transaction exceeds $10,000 threshold - requires manual review'
```

### Compound Conditions

```typescript
import { evaluateCondition } from '@arka-protocol/core';

// Complex condition with AND/OR/NOT logic
const condition = {
  type: 'and',
  conditions: [
    {
      type: 'compare',
      field: 'amount',
      operator: '>=',
      value: 5000
    },
    {
      type: 'or',
      conditions: [
        { type: 'compare', field: 'country', operator: 'in', value: ['RU', 'IR', 'KP'] },
        { type: 'compare', field: 'risk_score', operator: '>', value: 80 }
      ]
    }
  ]
};

const data = { amount: 7500, country: 'RU', risk_score: 45 };
const result = evaluateCondition(condition, data); // true
```

### Bytecode Compilation (RTVM)

Compile rules to bytecode for faster evaluation in high-throughput scenarios:

```typescript
import { compileRule, executeProgram } from '@arka-protocol/core';

// Compile rule to bytecode
const bytecode = compileRule(myRule);

// Execute compiled bytecode
const context = {
  event: eventData,
  entity: entityData
};

const result = executeProgram(bytecode, context);
console.log(result.value); // true/false
console.log(result.executionTimeMs); // < 0.1ms typically
```

### Risk Scoring Engine

```typescript
import { createRiskScoringEngine } from '@arka-protocol/core';

const scoringEngine = createRiskScoringEngine();

// Compute risk score for an entity
const score = await scoringEngine.computeScore({
  entityId: 'user_123',
  entityType: 'Customer',
  entityData: { /* customer data */ },
  decisions: [/* historical decisions */],
  timestamp: new Date().toISOString()
});

console.log(score.riskScore);    // 0-100
console.log(score.riskBand);     // 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
console.log(score.trend);        // 'IMPROVING' | 'STABLE' | 'WORSENING'
console.log(score.confidence);   // 0-1 based on data availability
```

### Time-Travel Simulation

Test rule changes against historical data before deploying:

```typescript
import { createTimeTravelSimulator } from '@arka-protocol/core';

const simulator = createTimeTravelSimulator({
  getRulesAtTime: async (timestamp) => fetchRulesFromDB(timestamp),
  getEntityAtTime: async (id, timestamp) => fetchEntitySnapshot(id, timestamp),
  getEventsInRange: async (start, end) => fetchEvents(start, end),
  evaluateRule: async (rule, event, entity) => evaluateWithEngine(rule, event, entity)
});

// Simulate impact of proposed rules
const result = await simulator.simulate({
  asOfDate: '2024-01-01T00:00:00Z',
  eventTimeRange: {
    start: '2023-06-01T00:00:00Z',
    end: '2023-12-31T23:59:59Z'
  },
  proposedRules: newRuleSet,
  includeDecisionDiffs: true
});

console.log(result.comparison);
// { unchanged: 950, allowToDeny: 30, denyToAllow: 15, otherChanges: 5 }
```

---

## API Reference

### Core Engine

| Export | Description |
|--------|-------------|
| `ArkaEngine` | Main engine class coordinating rules, entities, and evaluation |
| `getDefaultEngine()` | Get or create the singleton engine instance |
| `setDefaultEngine(engine)` | Set the default engine instance |
| `resetDefaultEngine()` | Reset the default engine to initial state |

### Rule Evaluation

| Export | Description |
|--------|-------------|
| `evaluateRules(input)` | Evaluate multiple rules against an event/entity |
| `evaluateSingleRule(input)` | Evaluate a single rule and return detailed result |
| `evaluateCondition(condition, data)` | Evaluate a condition against data |
| `getApplicableRules(rules, event, entity)` | Filter rules applicable to event/entity |

### Registry

| Export | Description |
|--------|-------------|
| `RuleRegistry` | In-memory registry for rule management |
| `EntityTypeRegistry` | In-memory registry for entity type schemas |
| `getDefaultRuleRegistry()` | Get singleton rule registry |
| `getDefaultEntityTypeRegistry()` | Get singleton entity type registry |

### Validation

| Export | Description |
|--------|-------------|
| `validateEntity(entity, type)` | Validate entity against its type schema |
| `validateEntityOrThrow(entity, type)` | Validate and throw on failure |
| `validateAgainstSchema(data, schema)` | Validate data against JSON Schema |
| `createValidator(schema)` | Create reusable validator function |

### RTVM (Bytecode Engine)

| Export | Description |
|--------|-------------|
| `compileRule(rule)` | Compile rule to bytecode program |
| `compileRules(rules)` | Batch compile multiple rules |
| `executeProgram(program, context)` | Execute compiled bytecode |
| `validateProgram(program)` | Validate bytecode program integrity |

### Time-Travel Simulation

| Export | Description |
|--------|-------------|
| `TimeTravelSimulator` | Main simulator class |
| `createTimeTravelSimulator(options)` | Create simulator with data providers |

### Risk Scoring

| Export | Description |
|--------|-------------|
| `RiskScoringEngine` | Adaptive risk scoring engine |
| `createRiskScoringEngine(model?)` | Create scoring engine with optional model |
| `DEFAULT_RISK_BANDS` | Default risk band configuration |
| `DEFAULT_SCORING_MODEL` | Default scoring model configuration |

### Additional Modules

| Module | Description |
|--------|-------------|
| `harmonization/*` | Multi-jurisdiction rule harmonization |
| `diff/*` | Rule set comparison and diff generation |
| `grl/*` | Global Rule Language (GRL) specification |
| `graph/*` | Global compliance graph representation |
| `temporal/*` | Point-in-time entity snapshots |
| `rule-graph/*` | Rule dependency graph management |

---

## Condition Operators

The engine supports a rich set of comparison operators:

| Operator | Description | Example |
|----------|-------------|---------|
| `==` | Equal | `{ field: 'status', operator: '==', value: 'active' }` |
| `!=` | Not equal | `{ field: 'type', operator: '!=', value: 'internal' }` |
| `<` | Less than | `{ field: 'age', operator: '<', value: 18 }` |
| `<=` | Less than or equal | `{ field: 'score', operator: '<=', value: 100 }` |
| `>` | Greater than | `{ field: 'amount', operator: '>', value: 0 }` |
| `>=` | Greater than or equal | `{ field: 'balance', operator: '>=', value: 1000 }` |
| `in` | Value in array | `{ field: 'country', operator: 'in', value: ['US', 'CA'] }` |
| `not_in` | Value not in array | `{ field: 'status', operator: 'not_in', value: ['blocked'] }` |
| `contains` | String/array contains | `{ field: 'tags', operator: 'contains', value: 'vip' }` |
| `starts_with` | String starts with | `{ field: 'email', operator: 'starts_with', value: 'admin' }` |
| `ends_with` | String ends with | `{ field: 'domain', operator: 'ends_with', value: '.gov' }` |
| `matches` | Regex match | `{ field: 'phone', operator: 'matches', value: '^\\+1' }` |
| `exists` | Field exists | `{ field: 'metadata.verified', operator: 'exists', value: true }` |
| `not_exists` | Field does not exist | `{ field: 'deleted_at', operator: 'not_exists', value: true }` |

---

## TypeScript Support

This package is written in TypeScript and includes full type definitions. All exports are fully typed:

```typescript
import type {
  ArkaEngineConfig,
  EvaluationContext,
  EvaluateRulesInput,
  ValidationResult,
  EntityRiskScore,
  RiskBandConfig,
  TimeTravelSimulationResult
} from '@arka-protocol/core';
```

---

## Use Cases

- **Financial Compliance** - AML transaction monitoring, sanctions screening, fraud detection
- **Healthcare** - HIPAA compliance, clinical decision support, patient data access control
- **Insurance** - Underwriting rules, claims adjudication, policy compliance
- **Government** - Regulatory enforcement, benefits eligibility, permit processing
- **E-commerce** - Order validation, seller compliance, marketplace policies
- **Gaming** - Responsible gaming limits, age verification, regional restrictions

---

## Documentation

For comprehensive documentation, tutorials, and best practices, visit:

**[https://www.arkaprotocol.com/docs](https://www.arkaprotocol.com/docs)**

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/arka-protocol/arka-core/blob/main/CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the **Apache License 2.0** - see the [LICENSE](https://github.com/arka-protocol/arka-core/blob/main/LICENSE) file for details.

---

<p align="center">
  Built with care by <a href="https://www.arkaprotocol.com">ARKA Protocol</a>
</p>
