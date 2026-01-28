<p align="center">
  <img src="https://www.arkaprotocol.com/logo.svg" alt="ARKA Protocol" width="200" />
</p>

<h1 align="center">@arka-protocol/plugin-sdk</h1>

<p align="center">
  <strong>Build powerful compliance plugins for the ARKA Protocol platform</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@arka-protocol/plugin-sdk">
    <img src="https://img.shields.io/npm/v/@arka-protocol/plugin-sdk.svg?style=flat-square&color=blue" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@arka-protocol/plugin-sdk">
    <img src="https://img.shields.io/npm/dm/@arka-protocol/plugin-sdk.svg?style=flat-square&color=green" alt="npm downloads" />
  </a>
  <a href="https://github.com/arka-protocol/arka-core/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-orange.svg?style=flat-square" alt="license" />
  </a>
  <a href="https://www.arkaprotocol.com/docs">
    <img src="https://img.shields.io/badge/docs-arkaprotocol.com-purple.svg?style=flat-square" alt="documentation" />
  </a>
</p>

<p align="center">
  <a href="#features">Features</a> |
  <a href="#installation">Installation</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#api-reference">API Reference</a> |
  <a href="#documentation">Documentation</a>
</p>

---

## Overview

The **ARKA Protocol Plugin SDK** enables developers to extend the ARKA compliance automation platform with custom domain plugins. Build plugins for specific industries (lending, insurance, trade), regulatory frameworks (AML, KYC, GDPR), or custom compliance workflows.

Plugins integrate seamlessly with ARKA's:
- **Rules Engine** - Define domain-specific compliance rules
- **Event Processing** - Transform domain events to canonical format
- **AI Cortex** - Register prompts, risk models, and legal mappings
- **CLI** - Add custom commands to the `arka` CLI
- **Blockchain Audit** - Serialize data for immutable audit trails

## Features

| Feature | Description |
|---------|-------------|
| **BaseArkaPlugin** | Abstract base class with common plugin functionality |
| **Plugin Registry** | Central registry with dependency management |
| **Hot Loading** | Load/reload plugins without service restart |
| **AI Extensions** | Register AI prompts, risk models, and simulation templates |
| **CLI Builder** | Fluent API for adding custom CLI commands |
| **Testing Utilities** | Mocks, rule builders, and simulation runners |
| **License Enforcement** | Built-in license validation for commercial plugins |

## Installation

```bash
# npm
npm install @arka-protocol/plugin-sdk

# yarn
yarn add @arka-protocol/plugin-sdk

# pnpm
pnpm add @arka-protocol/plugin-sdk
```

## Quick Start

### 1. Create Your Plugin

```typescript
import {
  BaseArkaPlugin,
  type PluginManifest,
  type ArkaEntityType,
  type ArkaRule,
} from '@arka-protocol/plugin-sdk';

export class MyCompliancePlugin extends BaseArkaPlugin {
  readonly manifest: PluginManifest = {
    id: 'my-compliance-plugin',
    name: 'My Compliance Plugin',
    version: '1.0.0',
    author: 'Your Organization',
    description: 'Custom compliance rules for my domain',
    entityTypes: ['Transaction', 'Account'],
    eventTypes: ['TRANSACTION_CREATED', 'ACCOUNT_UPDATED'],
    arkaCoreVersion: '^1.0.0',
  };

  protected entityTypes: ArkaEntityType[] = [
    {
      name: 'Transaction',
      description: 'Financial transaction entity',
      schema: {
        type: 'object',
        required: ['amount', 'currency', 'accountId'],
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
          accountId: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  ];

  protected defaultRules: ArkaRule[] = [
    this.createRule({
      name: 'High Value Transaction Alert',
      description: 'Flag transactions over $10,000 for review',
      jurisdiction: 'US',
      severity: 'HIGH',
      condition: {
        type: 'compare',
        field: 'payload.amount',
        operator: 'gt',
        value: 10000,
      },
      consequence: {
        decision: 'FLAG',
        code: 'HIGH_VALUE_TXN',
        message: 'Transaction exceeds $10,000 threshold',
      },
    }),
  ];
}

export default MyCompliancePlugin;
```

### 2. Register Your Plugin

```typescript
import { getPluginRegistry } from '@arka-protocol/plugin-sdk';
import MyCompliancePlugin from './my-plugin';

const registry = getPluginRegistry();

await registry.register(new MyCompliancePlugin(), {
  autoRegisterRules: true,
  autoRegisterEntityTypes: true,
});

console.log('Plugin registered:', registry.getStats());
```

### 3. Create Plugin Manifest File

Create `arka-plugin.json` in your plugin root:

```json
{
  "name": "my-compliance-plugin",
  "version": "1.0.0",
  "description": "Custom compliance rules for my domain",
  "main": "./dist/index.js",
  "author": "Your Organization",
  "license": "MIT",
  "pact": {
    "coreVersion": "^1.0.0",
    "entityTypes": ["Transaction", "Account"],
    "eventTypes": ["TRANSACTION_CREATED", "ACCOUNT_UPDATED"],
    "dependencies": []
  }
}
```

## Plugin Lifecycle

### Hooks

Plugins can implement lifecycle hooks to execute code at key moments:

```typescript
import { BaseArkaPlugin, type PluginHooks } from '@arka-protocol/plugin-sdk';

class MyPlugin extends BaseArkaPlugin {
  readonly hooks: PluginHooks = {
    // Called when plugin is loaded
    onLoad: async () => {
      console.log('Plugin loaded, initializing resources...');
      await this.initializeDatabase();
    },

    // Called when plugin is unloaded
    onUnload: async () => {
      console.log('Plugin unloading, cleaning up...');
      await this.closeConnections();
    },

    // Called before each event is processed
    beforeEventProcess: async (event) => {
      // Enrich event with additional data
      return {
        ...event,
        metadata: { ...event.metadata, enrichedAt: new Date().toISOString() },
      };
    },

    // Called after a decision is made
    afterDecision: async (event, decision) => {
      // Log decision to external system
      await this.auditLogger.log({ event, decision });
    },

    // Called when rules are updated
    onRulesUpdated: async (rules) => {
      console.log(`Rules updated: ${rules.length} rules`);
      await this.invalidateCache();
    },
  };
}
```

### Registry Events

Subscribe to plugin registry events:

```typescript
import { getPluginRegistry } from '@arka-protocol/plugin-sdk';

const registry = getPluginRegistry();

const unsubscribe = registry.on((event) => {
  switch (event.type) {
    case 'plugin:registered':
      console.log(`Plugin registered: ${event.pluginId}`);
      break;
    case 'plugin:unregistered':
      console.log(`Plugin unregistered: ${event.pluginId}`);
      break;
    case 'plugin:error':
      console.error(`Plugin error: ${event.pluginId}`, event.error);
      break;
  }
});

// Later: unsubscribe();
```

## Domain Event Mapping

Transform domain-specific events to ARKA's canonical format:

```typescript
import {
  BaseArkaPlugin,
  type DomainEvent,
  type CreateEventInput,
} from '@arka-protocol/plugin-sdk';

class LendingPlugin extends BaseArkaPlugin {
  // Override to customize event mapping
  mapToCanonicalEvent(domainEvent: DomainEvent): CreateEventInput {
    // Domain event from your system
    const { type, payload, metadata } = domainEvent;

    return {
      source: this.manifest.id,
      type: this.mapEventType(type),
      entityId: payload.loanId,
      entityType: 'Loan',
      jurisdiction: payload.jurisdiction || 'US',
      payload: {
        amount: payload.principalAmount,
        currency: payload.currency,
        interestRate: payload.apr,
        term: payload.termMonths,
        borrowerId: payload.customerId,
      },
      occurredAt: metadata?.timestamp || new Date().toISOString(),
    };
  }

  private mapEventType(domainType: string): string {
    const mapping: Record<string, string> = {
      'loan.created': 'LOAN_ORIGINATED',
      'loan.approved': 'LOAN_APPROVED',
      'loan.disbursed': 'LOAN_DISBURSED',
      'payment.received': 'PAYMENT_RECEIVED',
    };
    return mapping[domainType] || domainType.toUpperCase();
  }
}
```

## AI Extensions

Register AI capabilities for your domain:

```typescript
import {
  getAIExtensionRegistry,
  type PluginAIExtension,
} from '@arka-protocol/plugin-sdk';

const aiExtension: PluginAIExtension = {
  pluginId: 'lending-plugin',

  prompts: [
    {
      id: 'lending-rule-generator',
      name: 'Lending Rule Generator',
      domain: 'lending',
      type: 'rule_generation',
      systemPrompt: `You are an expert in lending compliance. Generate ARKA rules
        based on regulatory requirements. Output valid JSON rule definitions.`,
      userPromptTemplate: `Generate compliance rules for the following regulation:

        Jurisdiction: {{jurisdiction}}
        Regulation: {{regulation}}
        Requirements: {{requirements}}

        Output rules in ARKA format with conditions and consequences.`,
      outputSchema: {
        type: 'array',
        items: { $ref: '#/definitions/ArkaRule' },
      },
    },
  ],

  riskModels: [
    {
      id: 'lending-credit-risk',
      name: 'Credit Risk Model',
      domain: 'lending',
      description: 'Evaluates credit risk based on loan parameters',
      factors: [
        {
          name: 'DTI Ratio',
          field: 'payload.dtiRatio',
          weight: 0.3,
          thresholds: [
            { value: 0.36, risk: 'low' },
            { value: 0.43, risk: 'medium' },
            { value: 0.50, risk: 'high' },
            { value: 0.60, risk: 'critical' },
          ],
        },
        {
          name: 'Loan Amount',
          field: 'payload.amount',
          weight: 0.2,
          thresholds: [
            { value: 100000, risk: 'low' },
            { value: 500000, risk: 'medium' },
            { value: 1000000, risk: 'high' },
          ],
        },
      ],
      aggregation: 'weighted_average',
    },
  ],

  simulationTemplates: [],
  legalMappings: [],
  tuningStrategies: [],
};

// Register with AI Cortex
const aiRegistry = getAIExtensionRegistry();
aiRegistry.register(aiExtension);

// Use risk model
const riskResult = aiRegistry.evaluateRisk('lending-credit-risk', {
  payload: { dtiRatio: 0.45, amount: 250000 },
});
console.log('Risk:', riskResult.overallRisk); // 'medium'
```

## CLI Extensions

Add custom commands to the `arka` CLI:

```typescript
import {
  defineCLI,
  defineGroup,
  defineCommand,
  defineArg,
  defineFlag,
  type PluginCLIExtension,
} from '@arka-protocol/plugin-sdk/cli';

export const cliExtension: PluginCLIExtension = {
  getCLIManifest: () =>
    defineCLI('lending-plugin', '1.0.0')
      .commandGroup(
        defineGroup('loans', 'Lending compliance commands')
          .subcommand(
            defineCommand('analyze', 'Analyze a loan for compliance')
              .argument(defineArg('loanId', 'Loan ID to analyze').required())
              .flag(defineFlag('detailed', 'Show detailed analysis').alias('d'))
              .flag(defineFlag('format', 'Output format').string().choices(['json', 'table']).default('table'))
              .handler(async (ctx) => {
                const loanId = ctx.args.loanId as string;
                const detailed = ctx.flags.detailed as boolean;

                // Perform analysis
                const result = await analyzeLoan(loanId, { detailed });

                return {
                  success: true,
                  data: result,
                };
              })
              .example('arka loans analyze LOAN-123')
              .example('arka loans analyze LOAN-123 --detailed --format json')
          )
          .subcommand(
            defineCommand('simulate', 'Simulate loan portfolio')
              .flag(defineFlag('count', 'Number of loans to simulate').number().default(100))
              .flag(defineFlag('jurisdiction', 'Jurisdiction').string().default('US'))
              .handler(async (ctx) => {
                const count = ctx.flags.count as number;
                const jurisdiction = ctx.flags.jurisdiction as string;

                const results = await simulatePortfolio({ count, jurisdiction });

                return { success: true, data: results };
              })
          )
      )
      .build(),
};
```

## Testing Utilities

### Rule Builder DSL

Build rules fluently for testing:

```typescript
import { rule, RuleBuilder } from '@arka-protocol/plugin-sdk';

const testRule = rule()
  .name('Test High Value Rule')
  .description('Flags high value transactions')
  .jurisdiction('US')
  .severity('HIGH')
  .when('payload.amount', 'gt', 10000)
  .thenFlag('HIGH_VALUE', 'Transaction exceeds threshold')
  .tags('test', 'high-value')
  .build();
```

### Plugin Test Harness

Test your plugin thoroughly:

```typescript
import {
  PluginTestHarness,
  createMockEvent,
  createMockEntity,
} from '@arka-protocol/plugin-sdk';
import MyPlugin from './my-plugin';

const plugin = new MyPlugin();
const harness = new PluginTestHarness(plugin);

// Run built-in tests
const results = harness.runAll();
console.log(`Passed: ${results.passed}/${results.totalTests}`);

// Test event mapping
const mappingResult = harness.testEventMapping({
  type: 'transaction.created',
  payload: { amount: 5000, currency: 'USD' },
});
console.log('Event mapping:', mappingResult.passed ? 'PASS' : 'FAIL');

// Test validation
const validationResult = harness.testValidation(
  'Transaction',
  { amount: 100, currency: 'USD', accountId: 'ACC-1' }, // valid
  { amount: 100 } // invalid - missing required fields
);
console.log('Validation:', validationResult.passed ? 'PASS' : 'FAIL');
```

### Simulation Runner

Generate test events and run simulations:

```typescript
import {
  generateTestEvents,
  runSimulation,
} from '@arka-protocol/plugin-sdk';
import MyPlugin from './my-plugin';

// Generate random test events
const testEvents = generateTestEvents({
  eventType: 'TRANSACTION_CREATED',
  count: 1000,
  fields: {
    amount: { type: 'number', min: 100, max: 50000 },
    currency: { type: 'enum', values: ['USD', 'EUR', 'GBP'] },
    risk: { type: 'enum', values: ['low', 'medium', 'high'] },
  },
});

// Run simulation
const simResult = await runSimulation(
  new MyPlugin(),
  testEvents,
  async (event, rules) => {
    // Your rule evaluation logic
    return evaluateRules(event, rules);
  }
);

console.log('Simulation Results:');
console.log(`  Total events: ${simResult.totalEvents}`);
console.log(`  Allowed: ${simResult.decisions.allow}`);
console.log(`  Flagged: ${simResult.decisions.allowWithFlags}`);
console.log(`  Denied: ${simResult.decisions.deny}`);
console.log(`  Duration: ${simResult.duration}ms`);
```

## Hot Loading

Load plugins dynamically without restart:

```typescript
import {
  initializeHotLoader,
  getHotLoader,
} from '@arka-protocol/plugin-sdk';

// Initialize with watch mode
const loader = await initializeHotLoader({
  pluginsDir: './plugins',
  watch: true,
  watchInterval: 5000,
  autoRegister: true,
});

// Get loaded plugins
const plugins = loader.getAllLoadedPlugins();
console.log(`Loaded ${plugins.length} plugins`);

// Install a new plugin
await loader.installPlugin('./my-new-plugin');

// Reload a plugin
await loader.reloadPlugin('my-plugin-id');

// Graceful shutdown
await shutdownHotLoader();
```

## API Reference

### Core Exports

| Export | Description |
|--------|-------------|
| `BaseArkaPlugin` | Abstract base class for plugins |
| `PluginRegistry` | Central plugin registry |
| `getPluginRegistry()` | Get global registry instance |
| `PluginHotLoader` | Dynamic plugin loader |
| `AIExtensionRegistry` | AI capabilities registry |
| `LicenseEnforcer` | Commercial license validation |

### Types

| Type | Description |
|------|-------------|
| `ArkaDomainPlugin` | Core plugin interface |
| `PluginManifest` | Plugin metadata |
| `PluginHooks` | Lifecycle hook definitions |
| `DomainEvent` | Domain-specific event |
| `ValidationResult` | Validation result |
| `PluginConfig` | Plugin configuration |

### Testing Exports

| Export | Description |
|--------|-------------|
| `createMockEvent()` | Create mock ARKA event |
| `createMockEntity()` | Create mock entity |
| `createMockDecision()` | Create mock decision |
| `RuleBuilder` | Fluent rule builder |
| `PluginTestHarness` | Plugin test harness |
| `generateTestEvents()` | Generate test events |
| `runSimulation()` | Run event simulation |

### CLI Exports

| Export | Description |
|--------|-------------|
| `defineCLI()` | Create CLI manifest builder |
| `defineGroup()` | Create command group |
| `defineCommand()` | Create subcommand |
| `defineArg()` | Create argument |
| `defineFlag()` | Create flag |

## Documentation

- **[Full Documentation](https://www.arkaprotocol.com/docs)** - Complete guides and tutorials
- **[Plugin Development Guide](https://www.arkaprotocol.com/docs/plugins)** - In-depth plugin development
- **[API Reference](https://www.arkaprotocol.com/docs/api)** - Full API documentation
- **[Examples](https://github.com/arka-protocol/arka-plugins)** - Example plugins repository

## Support

- **[Discord Community](https://discord.gg/arka-protocol)** - Join our developer community
- **[GitHub Issues](https://github.com/arka-protocol/arka-core/issues)** - Report bugs and request features
- **[Enterprise Support](https://www.arkaprotocol.com/enterprise)** - For commercial deployments

## License

Apache-2.0 - See [LICENSE](https://github.com/arka-protocol/arka-core/blob/main/LICENSE) for details.

---

<p align="center">
  Built with care by the <a href="https://www.arkaprotocol.com">ARKA Protocol</a> team
</p>
