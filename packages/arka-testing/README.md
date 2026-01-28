<p align="center">
  <img src="https://www.arkaprotocol.com/logo.svg" alt="ARKA Protocol" width="120" />
</p>

<h1 align="center">@arka-protocol/testing</h1>

<p align="center">
  <strong>Comprehensive testing utilities for ARKA Protocol plugins and rules</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@arka-protocol/testing">
    <img src="https://img.shields.io/npm/v/@arka-protocol/testing?style=flat-square&color=blue" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@arka-protocol/testing">
    <img src="https://img.shields.io/npm/dm/@arka-protocol/testing?style=flat-square&color=green" alt="npm downloads" />
  </a>
  <a href="https://github.com/arka-protocol/arka-core/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-orange?style=flat-square" alt="license" />
  </a>
  <a href="https://www.arkaprotocol.com/docs">
    <img src="https://img.shields.io/badge/docs-arkaprotocol.com-purple?style=flat-square" alt="documentation" />
  </a>
</p>

<p align="center">
  <a href="#installation">Installation</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#features">Features</a> |
  <a href="#api-reference">API Reference</a> |
  <a href="https://www.arkaprotocol.com/docs">Documentation</a>
</p>

---

## Overview

`@arka-protocol/testing` provides a complete testing toolkit for developing and testing ARKA Protocol compliance rules, plugins, and integrations. It includes mocks, factories, fixtures, and helpers designed specifically for AML/KYC workflows, transaction monitoring, and regulatory compliance testing.

## Installation

```bash
# npm
npm install --save-dev @arka-protocol/testing

# yarn
yarn add -D @arka-protocol/testing

# pnpm
pnpm add -D @arka-protocol/testing
```

**Peer Dependencies:**

```bash
npm install --save-dev vitest
```

## Quick Start

```typescript
import {
  mockEvent,
  mockRule,
  createTransactionEvent,
  expectAllow,
  expectDeny,
  expectFlag,
} from '@arka-protocol/testing';
import { describe, it } from 'vitest';

describe('Transaction Rules', () => {
  it('should flag high-value transactions', async () => {
    // Create a test event
    const event = createTransactionEvent({
      amount: 15000,
      currency: 'USD',
      country: 'US',
    });

    // Create a rule to test
    const rule = mockRule({
      name: 'High Value Alert',
      condition: {
        type: 'compare',
        field: 'payload.amount',
        operator: '>',
        value: 10000,
      },
      consequence: {
        decision: 'FLAG',
        code: 'HIGH_VALUE_TXN',
        message: 'Transaction exceeds $10,000 threshold',
      },
    });

    // Evaluate and assert
    const decision = await engine.evaluate(event, [rule]);
    expectFlag(decision, ['HIGH_VALUE_TXN']);
  });
});
```

## Features

### Mocks

Create realistic mock data for events, entities, rules, and decisions.

```typescript
import { mockEvent, mockEntity, mockRule, mockDecision } from '@arka-protocol/testing';

// Create mock events
const event = mockEvent({
  type: 'TRANSACTION',
  payload: { amount: 5000, currency: 'USD' },
});

// Create mock entities
const customer = mockEntity({
  type: 'Customer',
  data: { name: 'John Doe', kycStatus: 'VERIFIED' },
});

// Create mock rules with custom conditions
const rule = mockRule({
  name: 'Custom Rule',
  severity: 'HIGH',
  tags: ['aml', 'sanctions'],
});

// Create batch mocks
const events = mockEvents(10, { type: 'WIRE_TRANSFER' });
const rules = mockRules(5, { severity: 'MEDIUM' });
```

### Condition Builders

Fluent API for building complex rule conditions.

```typescript
import { conditions, consequences } from '@arka-protocol/testing';

// Simple comparisons
const amountCheck = conditions.gt('payload.amount', 10000);
const countryCheck = conditions.eq('payload.country', 'US');

// Compound conditions
const complexCondition = conditions.and(
  conditions.gt('payload.amount', 5000),
  conditions.or(
    conditions.eq('payload.riskLevel', 'HIGH'),
    conditions.eq('payload.isPEP', true)
  )
);

// Build consequences
const flagAction = consequences.flag('HIGH_RISK', 'Requires manual review');
const denyAction = consequences.deny('BLOCKED', 'Transaction blocked');
```

### Factories

Pre-built factory functions for common compliance scenarios.

```typescript
import {
  createTransactionEvent,
  createHighRiskTransaction,
  createLowRiskTransaction,
  createCustomerEvent,
  createAmountThresholdRule,
  createCountryRestrictionRule,
  createPEPCheckRule,
  createVelocityCheckRule,
} from '@arka-protocol/testing/factories';

// Transaction events
const transaction = createTransactionEvent({
  amount: 25000,
  currency: 'USD',
  sourceAccount: 'ACC_001',
  destinationAccount: 'ACC_002',
  country: 'US',
});

const highRisk = createHighRiskTransaction(50000);
const lowRisk = createLowRiskTransaction(100);

// Compliance rules
const thresholdRule = createAmountThresholdRule(10000, 'FLAG');
const sanctionsRule = createCountryRestrictionRule(['KP', 'IR', 'SY'], 'DENY');
const pepRule = createPEPCheckRule();
const velocityRule = createVelocityCheckRule(10, 24); // 10 txns in 24 hours
```

### Test Scenarios

Pre-built test scenarios for common AML/KYC use cases.

```typescript
import { amlScenarios, createTestScenario } from '@arka-protocol/testing';

// Use pre-built scenarios
const scenarios = [
  amlScenarios.highValueTransaction(),
  amlScenarios.sanctionedCountryTransaction(),
  amlScenarios.lowRiskTransaction(),
  amlScenarios.pepTransaction(),
];

// Run scenario tests
for (const scenario of scenarios) {
  it(scenario.name, async () => {
    const decision = await engine.evaluate(scenario.event, scenario.rules);
    expect(decision.status).toBe(scenario.expectedDecision);
  });
}

// Create custom scenarios
const customScenario = createTestScenario({
  name: 'Cross-border high value',
  event: createTransactionEvent({ amount: 50000, country: 'GB' }),
  rules: [createAmountThresholdRule(25000)],
  expectedDecision: 'ALLOW_WITH_FLAGS',
  expectedFlags: ['AMOUNT_THRESHOLD_EXCEEDED'],
});
```

### Fixtures

Ready-to-use test data for integration testing.

```typescript
import {
  sampleRules,
  sampleEvents,
  sampleEntities,
  integrationTestData,
  expectedResults,
} from '@arka-protocol/testing/fixtures';

// Use sample rules
const amountRule = sampleRules.amountThreshold;
const sanctionsRule = sampleRules.sanctionedCountries;
const pepRule = sampleRules.pepCheck;

// Use sample events
const domesticTransfer = sampleEvents.domesticTransfer;
const pepTransaction = sampleEvents.pepTransaction;

// Use sample entities
const verifiedCustomer = sampleEntities.verifiedCustomer;
const pepCustomer = sampleEntities.pepCustomer;

// Complete integration test data
const { rules, events, entities } = integrationTestData;

// Verify against expected results
const result = expectedResults.sanctionedCountryTransaction;
expect(result.decision).toBe('DENY');
expect(result.flags).toContain('SANCTIONED_COUNTRY');
```

### Assertion Helpers

Specialized assertions for compliance decisions.

```typescript
import {
  expectAllow,
  expectDeny,
  expectFlag,
  expectRulesEvaluated,
  expectRuleTriggered,
  expectRuleNotTriggered,
} from '@arka-protocol/testing';

// Decision assertions
expectAllow(decision);
expectDeny(decision, 'SANCTIONED_COUNTRY');
expectFlag(decision, ['HIGH_VALUE_TXN', 'PEP_INVOLVED']);

// Rule evaluation assertions
expectRulesEvaluated(decision, ['rule_001', 'rule_002']);
expectRuleTriggered(decision, 'rule_sanctions');
expectRuleNotTriggered(decision, 'rule_low_value');
```

### Performance Testing

Benchmark and measure rule evaluation performance.

```typescript
import { measureTime, expectWithinTime, benchmark } from '@arka-protocol/testing';

// Measure single execution
const { result, duration } = await measureTime(() => engine.evaluate(event, rules));
console.log(`Evaluation took ${duration}ms`);

// Assert performance constraints
const decision = await expectWithinTime(
  () => engine.evaluate(event, rules),
  50 // max 50ms
);

// Run benchmarks
const stats = await benchmark(
  () => engine.evaluate(event, rules),
  1000 // iterations
);

console.log(`
  Min: ${stats.min}ms
  Max: ${stats.max}ms
  Avg: ${stats.avg}ms
  P95: ${stats.p95}ms
  P99: ${stats.p99}ms
`);
```

### Test Suite Helpers

Utilities for organizing and running tests.

```typescript
import { describeRule, testEach, withEnv } from '@arka-protocol/testing';

// Describe a rule with multiple test cases
describeRule(
  myRule,
  [
    { name: 'allows low value', event: lowValueEvent, expectedTriggered: false },
    { name: 'flags high value', event: highValueEvent, expectedTriggered: true },
  ],
  (event, rules) => engine.evaluate(event, rules)
);

// Parametrized tests
testEach(
  [
    { name: 'US transaction', country: 'US', expected: 'ALLOW' },
    { name: 'UK transaction', country: 'GB', expected: 'ALLOW' },
    { name: 'Iran transaction', country: 'IR', expected: 'DENY' },
  ],
  async ({ country, expected }) => {
    const event = createTransactionEvent({ amount: 1000, country });
    const decision = await engine.evaluate(event, [sanctionsRule]);
    expect(decision.status).toBe(expected);
  }
);

// Test with environment variables
it('respects feature flags', withEnv(
  { FEATURE_STRICT_MODE: 'true' },
  async () => {
    // Test runs with env vars set, restored after
  }
));
```

### Data Generation

Generate random test data.

```typescript
import {
  randomString,
  randomNumber,
  randomInt,
  randomChoice,
  randomDate,
  uuid,
} from '@arka-protocol/testing';

const id = uuid(); // '550e8400-e29b-41d4-a716-446655440000'
const accountId = `ACC_${randomString(8)}`; // 'ACC_x7kf9m2p'
const amount = randomNumber(100, 10000); // 4532.67
const count = randomInt(1, 100); // 42
const country = randomChoice(['US', 'GB', 'DE', 'FR']); // 'DE'
const date = randomDate(new Date('2024-01-01'), new Date()); // Random date in range
```

### Async Utilities

Helpers for async test scenarios.

```typescript
import { wait, waitFor, retry, createCleanupStack } from '@arka-protocol/testing';

// Wait for fixed duration
await wait(1000);

// Wait for condition
await waitFor(() => queue.isEmpty(), { timeout: 5000, interval: 100 });

// Retry with backoff
const result = await retry(
  () => api.fetchDecision(id),
  { maxRetries: 3, delay: 1000 }
);

// Cleanup stack (LIFO)
const cleanup = createCleanupStack();
cleanup.push(() => database.disconnect());
cleanup.push(() => cache.clear());
// After tests:
await cleanup.cleanup(); // Runs in reverse order
```

## API Reference

### Mocks

| Function | Description |
|----------|-------------|
| `mockEvent(options?)` | Creates a mock `ArkaEvent` |
| `mockEvents(count, options?)` | Creates multiple mock events |
| `mockEntity(options?)` | Creates a mock `ArkaEntity` |
| `mockRule(options?)` | Creates a mock `ArkaRule` |
| `mockRules(count, options?)` | Creates multiple mock rules |
| `mockDecision(options?)` | Creates a mock `ArkaDecision` |
| `mockRuleEvaluation(options?)` | Creates a mock rule evaluation |
| `conditions.*` | Condition builder utilities |
| `consequences.*` | Consequence builder utilities |
| `resetMockCounters()` | Resets internal counters |

### Factories

| Function | Description |
|----------|-------------|
| `createTransactionEvent(data)` | Creates a transaction event |
| `createHighRiskTransaction(amount?)` | Creates a high-risk transaction |
| `createLowRiskTransaction(amount?)` | Creates a low-risk transaction |
| `createCustomerEvent(data)` | Creates a customer onboarding event |
| `createAmountThresholdRule(threshold, decision?)` | Creates an amount threshold rule |
| `createCountryRestrictionRule(countries, decision?)` | Creates a country restriction rule |
| `createPEPCheckRule()` | Creates a PEP check rule |
| `createVelocityCheckRule(max, hours)` | Creates a velocity check rule |
| `createCompoundRule(name, conditions, consequence)` | Creates a compound rule |
| `createAllowDecision(eventId)` | Creates an ALLOW decision |
| `createDenyDecision(eventId, rule)` | Creates a DENY decision |
| `createFlagDecision(eventId, rules)` | Creates a FLAG decision |
| `createTestScenario(config)` | Creates a test scenario |
| `amlScenarios.*` | Pre-built AML test scenarios |

### Fixtures

| Export | Description |
|--------|-------------|
| `sampleRules` | Collection of sample compliance rules |
| `sampleEvents` | Collection of sample transaction events |
| `sampleEntities` | Collection of sample customer entities |
| `integrationTestData` | Complete test data set |
| `expectedResults` | Expected results for sample data |

### Helpers

| Function | Description |
|----------|-------------|
| `wait(ms)` | Waits for specified duration |
| `waitFor(condition, options?)` | Waits for condition to be true |
| `retry(fn, options?)` | Retries async function |
| `expectAllow(decision)` | Asserts ALLOW decision |
| `expectDeny(decision, code?)` | Asserts DENY decision |
| `expectFlag(decision, codes?)` | Asserts FLAG decision |
| `expectRulesEvaluated(decision, ruleIds)` | Asserts rules were evaluated |
| `expectRuleTriggered(decision, ruleId)` | Asserts rule triggered |
| `expectRuleNotTriggered(decision, ruleId)` | Asserts rule did not trigger |
| `measureTime(fn)` | Measures execution time |
| `expectWithinTime(fn, maxMs)` | Asserts completes within time |
| `benchmark(fn, iterations?)` | Runs performance benchmark |
| `describeRule(rule, cases, evaluator)` | Creates rule test suite |
| `testEach(cases, fn)` | Parametrized tests |
| `randomString(length?)` | Generates random string |
| `randomNumber(min, max)` | Generates random float |
| `randomInt(min, max)` | Generates random integer |
| `randomChoice(array)` | Picks random array element |
| `randomDate(start, end)` | Generates random date |
| `uuid()` | Generates UUID string |
| `createCleanupStack()` | Creates cleanup utility |
| `withEnv(env, fn)` | Runs with env variables |

## Module Exports

The package supports multiple entry points for optimal tree-shaking:

```typescript
// Main entry - everything
import { mockEvent, createTransactionEvent, sampleRules } from '@arka-protocol/testing';

// Mocks only
import { mockEvent, mockRule, conditions } from '@arka-protocol/testing/mocks';

// Factories only
import { createTransactionEvent, amlScenarios } from '@arka-protocol/testing/factories';

// Fixtures only
import { sampleRules, sampleEvents } from '@arka-protocol/testing/fixtures';
```

## Documentation

For complete documentation, examples, and guides, visit:

**[https://www.arkaprotocol.com/docs](https://www.arkaprotocol.com/docs)**

## Related Packages

- [`@arka-protocol/core`](https://www.npmjs.com/package/@arka-protocol/core) - Core rule evaluation engine
- [`@arka-protocol/types`](https://www.npmjs.com/package/@arka-protocol/types) - TypeScript type definitions
- [`@arka-protocol/plugin-sdk`](https://www.npmjs.com/package/@arka-protocol/plugin-sdk) - Plugin development SDK

## License

Apache-2.0 - See [LICENSE](https://github.com/arka-protocol/arka-core/blob/main/LICENSE) for details.

---

<p align="center">
  Built with care by <a href="https://www.arkaprotocol.com">ARKA Protocol</a>
</p>
