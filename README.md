# ARKA Protocol Core

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

**ARKA Protocol** is an open-source compliance engine that transforms regulatory requirements into executable, auditable logic. Build compliant applications with confidence.

## Features

- **Rule Engine** - Define compliance rules using a declarative DSL
- **Multi-Chain Support** - Anchor audit trails to Ethereum, Solana, Cosmos, and more
- **Plugin Architecture** - Extend functionality with custom plugins
- **Type-Safe** - Full TypeScript support with comprehensive type definitions
- **Battle-Tested** - Production-ready with extensive test coverage

## Packages

| Package | Description |
|---------|-------------|
| `@arka/core` | Core compliance engine and rule evaluator |
| `@arka/types` | Shared TypeScript type definitions |
| `@arka/utils` | Common utilities and helpers |
| `@arka/crypto` | Cryptographic primitives and audit hashing |
| `@arka/plugin-sdk` | SDK for building custom plugins |
| `@arka/blockchain` | Multi-chain anchoring adapters |
| `@arka/testing` | Test utilities and fixtures |
| `@arka/demo` | Demo environment and examples |

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Basic Usage

```typescript
import { createEngine, Rule } from '@arka/core';
import { ArkaEvent } from '@arka/types';

// Define a compliance rule
const rule: Rule = {
  id: 'aml-001',
  name: 'Large Transaction Alert',
  conditions: {
    all: [
      { field: 'amount', operator: 'gt', value: 10000 }
    ]
  },
  consequence: {
    decision: 'FLAG',
    code: 'LARGE_TXN',
    message: 'Transaction exceeds $10,000 threshold'
  }
};

// Create engine and evaluate
const engine = createEngine({ rules: [rule] });
const decision = await engine.evaluate(event);
```

## Documentation

- [Getting Started Guide](https://www.arkaprotocol.com/docs/1.0.0/getting-started)
- [Rule DSL Reference](https://www.arkaprotocol.com/docs/1.0.0/rules)
- [Plugin Development](https://www.arkaprotocol.com/docs/1.0.0/plugins)
- [API Reference](https://www.arkaprotocol.com/docs/1.0.0/api)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

Apache 2.0 - see [LICENSE](LICENSE) for details.

## Enterprise

Looking for enterprise features like AI-powered monitoring, predictive compliance, and managed deployment? Contact us at [arkaprotocol.com](https://www.arkaprotocol.com/#contact-form).

---

Built with ❤️ by [ARKA Protocol](https://www.arkaprotocol.com)
