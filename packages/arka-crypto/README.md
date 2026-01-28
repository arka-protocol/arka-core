<p align="center">
  <img src="https://www.arkaprotocol.com/logo.svg" alt="ARKA Protocol" width="120" />
</p>

<h1 align="center">@arka-protocol/crypto</h1>

<p align="center">
  <strong>Enterprise-grade cryptographic utilities for blockchain integration and data integrity</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@arka-protocol/crypto">
    <img src="https://img.shields.io/npm/v/@arka-protocol/crypto.svg?style=flat-square&color=blue" alt="npm version" />
  </a>
  <a href="https://github.com/arka-protocol/arka-core/blob/main/packages/arka-crypto/LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-green.svg?style=flat-square" alt="license" />
  </a>
  <a href="https://www.arkaprotocol.com">
    <img src="https://img.shields.io/badge/docs-arkaprotocol.com-purple.svg?style=flat-square" alt="documentation" />
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square" alt="node version" />
</p>

<p align="center">
  <a href="#features">Features</a> |
  <a href="#installation">Installation</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#api-reference">API Reference</a> |
  <a href="#security">Security</a> |
  <a href="#documentation">Documentation</a>
</p>

---

## Overview

`@arka-protocol/crypto` provides a comprehensive suite of cryptographic primitives designed for enterprise blockchain applications. Built for the ARKA Protocol ecosystem, this library enables secure data integrity verification, tamper-evident audit trails, and privacy-preserving compliance verification.

## Features

- **Merkle Trees** - Cryptographic proof of data integrity with customizable hash algorithms (SHA-256, SHA-384, SHA-512)
- **Canonical Serialization** - Deterministic JSON serialization ensuring identical output across all nodes for consensus
- **Append-Only Event Log** - Immutable, cryptographically-linked event sourcing with chain integrity verification
- **Zero-Knowledge Proofs** - Privacy-preserving compliance verification without revealing sensitive data

---

## Installation

```bash
# npm
npm install @arka-protocol/crypto

# yarn
yarn add @arka-protocol/crypto

# pnpm
pnpm add @arka-protocol/crypto
```

---

## Quick Start

### Merkle Tree Operations

Create tamper-evident data structures with cryptographic proofs:

```typescript
import {
  buildMerkleTree,
  getMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  hashData
} from '@arka-protocol/crypto';

// Hash individual data
const hash = hashData({ userId: 123, action: 'approve' }, 'sha256');

// Build a Merkle tree from audit records
const auditRecords = [
  { id: 1, action: 'create', timestamp: '2024-01-15T10:00:00Z' },
  { id: 2, action: 'update', timestamp: '2024-01-15T10:05:00Z' },
  { id: 3, action: 'approve', timestamp: '2024-01-15T10:10:00Z' },
];

// Get the Merkle root for blockchain anchoring
const root = getMerkleRoot(auditRecords);
console.log('Merkle Root:', root);

// Generate a proof for a specific record
const proof = generateMerkleProof(auditRecords, 1); // Index 1

// Verify the proof
const isValid = verifyMerkleProof(proof);
console.log('Proof Valid:', isValid); // true
```

### Canonical Serialization

Ensure deterministic serialization for consensus across distributed systems:

```typescript
import {
  canonicalStringify,
  canonicalEquals,
  toSignableBytes
} from '@arka-protocol/crypto';

// Objects with different key orders produce identical output
const obj1 = { z: 1, a: 2, m: 3 };
const obj2 = { a: 2, m: 3, z: 1 };

console.log(canonicalStringify(obj1));
// Output: {"a":2,"m":3,"z":1}

console.log(canonicalEquals(obj1, obj2)); // true

// Convert to bytes for signing
const signableBytes = toSignableBytes({
  action: 'transfer',
  amount: 1000,
  recipient: '0x...'
});
```

### Append-Only Event Log

Build immutable audit trails with cryptographic linking:

```typescript
import { AppendOnlyEventLog } from '@arka-protocol/crypto';

const eventLog = new AppendOnlyEventLog({
  checkpointInterval: 100,
  maxInMemory: 1000,
  onAppend: (entry) => console.log('Event recorded:', entry.type),
});

// Append events
await eventLog.append('RULE_CREATED', {
  ruleId: 'rule-001',
  name: 'Approval Threshold',
  conditions: { amount: { gt: 10000 } }
});

await eventLog.append('DECISION_MADE', {
  ruleId: 'rule-001',
  result: 'APPROVED',
  entityId: 'txn-12345'
});

// Verify chain integrity
const integrity = eventLog.verifyIntegrity();
console.log('Chain Valid:', integrity.valid); // true

// Get Merkle root for blockchain anchoring
const merkleRoot = eventLog.getMerkleRoot();

// Generate proof for specific entry
const entryProof = eventLog.generateProof(0);
```

### Zero-Knowledge Compliance Verification

Prove compliance without revealing sensitive data:

```typescript
import { createZKVerifier, COMMON_CIRCUITS } from '@arka-protocol/crypto';

const verifier = createZKVerifier();

// Create a compliance claim
const claim = verifier.createClaim(
  'user-123',
  'AGE_VERIFICATION',
  'User is 18 years or older'
);

// Generate ZK proof (private data stays private)
await verifier.proveClaim(
  claim.id,
  'age-check-v1',
  { minimum_age: 18, current_date: '2024-01-15' },  // Public inputs
  { birthdate: '1990-05-20' }                        // Private input (never revealed)
);

// Verify the claim
const result = await verifier.verifyClaim(claim.id);
console.log('Verified:', result.valid); // true
// The birthdate is never revealed, only the fact that age >= 18
```

---

## API Reference

### Merkle Tree Module

| Function | Description |
|----------|-------------|
| `hashData(data, algorithm?)` | Hash any data using SHA-256/384/512 |
| `hashPair(left, right, algorithm?)` | Combine two hashes into a parent hash |
| `buildMerkleTree(items, algorithm?)` | Build a complete Merkle tree |
| `getMerkleRoot(items, algorithm?)` | Get the root hash of items |
| `generateMerkleProof(items, index, algorithm?)` | Generate inclusion proof |
| `verifyMerkleProof(proof, algorithm?)` | Verify a Merkle proof |
| `verifyDataInTree(data, proof, algorithm?)` | Verify specific data exists in tree |
| `createMerkleBatch(batchId, items, algorithm?)` | Create a batch with Merkle root |

### Canonical Serialization Module

| Function | Description |
|----------|-------------|
| `canonicalStringify(data, options?)` | Deterministic JSON string |
| `canonicalSerialize(data)` | Convert to canonical bytes |
| `canonicalParse(json)` | Parse canonical JSON |
| `canonicalEquals(a, b)` | Compare for canonical equality |
| `toSignableBytes(data)` | Get bytes suitable for signing |

### Event Log Module

| Class/Function | Description |
|----------------|-------------|
| `AppendOnlyEventLog` | Immutable event log with chain linking |
| `getGlobalEventLog()` | Get global singleton instance |
| `resetGlobalEventLog()` | Reset global instance |

**AppendOnlyEventLog Methods:**

| Method | Description |
|--------|-------------|
| `append(type, payload, metadata?)` | Add new event |
| `getEntry(sequence)` | Get entry by sequence number |
| `getLatest()` | Get most recent entry |
| `getRange(start, end?)` | Get entries in range |
| `getByType(type)` | Filter entries by event type |
| `verifyIntegrity(fromSequence?)` | Verify chain integrity |
| `generateProof(sequence)` | Generate Merkle proof for entry |
| `getMerkleRoot()` | Get root hash of all entries |
| `export()` | Export log for persistence |
| `import(data)` | Import and verify log data |

### Zero-Knowledge Module

| Class/Function | Description |
|----------------|-------------|
| `ZKComplianceVerifier` | ZK proof generation and verification |
| `createZKVerifier()` | Create verifier with common circuits |
| `COMMON_CIRCUITS` | Pre-built circuit definitions |

**Available Circuit Types:**

| Circuit | Description |
|---------|-------------|
| `RANGE_CHECK` | Prove value is within range |
| `AGE_CHECK` | Prove age >= minimum |
| `INCOME_CHECK` | Prove income within bracket |
| `KYC_STATUS` | Prove KYC verification level |
| `JURISDICTION` | Prove jurisdiction eligibility |
| `MEMBERSHIP` | Prove set membership |
| `THRESHOLD` | Prove value exceeds threshold |

---

## Security

### Best Practices

1. **Use Strong Hash Algorithms** - Default SHA-256 is recommended; use SHA-384/512 for higher security requirements

2. **Verify Chain Integrity** - Always call `verifyIntegrity()` after importing event logs

3. **Protect Private Inputs** - ZK private inputs should never be logged or transmitted

4. **Secure Key Management** - Store verification keys securely; compromised keys invalidate proofs

5. **Audit Trail Immutability** - Never modify entries after creation; use new events for corrections

### Cryptographic Guarantees

| Feature | Guarantee |
|---------|-----------|
| Merkle Proofs | Collision-resistant inclusion proofs |
| Event Log | Tamper-evident through hash chaining |
| Canonical Serialization | Deterministic output for consensus |
| ZK Proofs | Privacy-preserving verification |

### Reporting Vulnerabilities

Please report security vulnerabilities to [security@arkaprotocol.com](mailto:security@arkaprotocol.com). Do not open public issues for security concerns.

---

## Documentation

For comprehensive documentation, tutorials, and integration guides:

- **[ARKA Protocol Documentation](https://www.arkaprotocol.com/docs)** - Complete platform documentation
- **[API Reference](https://www.arkaprotocol.com/docs/api/crypto)** - Detailed API documentation
- **[Integration Guide](https://www.arkaprotocol.com/docs/guides/blockchain-integration)** - Blockchain integration patterns
- **[Security Best Practices](https://www.arkaprotocol.com/docs/security)** - Security guidelines

---

## TypeScript Support

This package is written in TypeScript and includes full type definitions. All types are exported:

```typescript
import type {
  // Merkle types
  HashAlgorithm,
  MerkleNode,
  MerkleProof,
  MerkleBatch,
  // Serialization types
  CanonicalOptions,
  // Event log types
  PactLogEventType,
  LogEntry,
  StateCheckpoint,
  EventLogOptions,
  // ZK types
  CircuitType,
  ZKProof,
  VerificationResult,
  CircuitDefinition,
  ProofRequest,
  VerifyRequest,
  ComplianceClaim,
} from '@arka-protocol/crypto';
```

---

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0 (for development)

---

## Related Packages

| Package | Description |
|---------|-------------|
| `@arka-protocol/core` | Core ARKA Protocol engine |
| `@arka-protocol/types` | Shared TypeScript types |
| `@arka-protocol/sdk` | JavaScript/TypeScript SDK |

---

## License

Apache-2.0 - see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <sub>Built with care by <a href="https://www.arkaprotocol.com">ARKA Protocol</a></sub>
</p>
