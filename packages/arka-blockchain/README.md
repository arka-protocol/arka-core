<p align="center">
  <img src="https://www.arkaprotocol.com/logo.svg" alt="ARKA Protocol" width="120" />
</p>

<h1 align="center">@arka-protocol/blockchain</h1>

<p align="center">
  <strong>Multi-Chain Blockchain Anchoring for Enterprise Compliance</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@arka-protocol/blockchain">
    <img src="https://img.shields.io/npm/v/@arka-protocol/blockchain?style=flat-square&color=0073e6" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@arka-protocol/blockchain">
    <img src="https://img.shields.io/npm/dm/@arka-protocol/blockchain?style=flat-square&color=0073e6" alt="npm downloads" />
  </a>
  <a href="https://github.com/arka-protocol/arka-core/blob/main/packages/arka-blockchain/LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square" alt="license" />
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5.3+-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  </a>
</p>

<p align="center">
  <a href="#features">Features</a> |
  <a href="#supported-chains">Supported Chains</a> |
  <a href="#installation">Installation</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#api-reference">API Reference</a> |
  <a href="https://www.arkaprotocol.com/docs">Documentation</a>
</p>

---

## Overview

`@arka-protocol/blockchain` provides **tamper-proof, cryptographic anchoring** of compliance audit records to multiple blockchain networks. Part of the ARKA Protocol suite, this package enables enterprises to create immutable proof-of-compliance that satisfies regulatory requirements and provides forensic traceability.

```
                    +------------------+
                    |   ARKA Engine    |
                    |  (Audit Events)  |
                    +--------+---------+
                             |
                             v
              +-----------------------------+
              |   @arka-protocol/blockchain |
              |   - Batch Manager           |
              |   - Merkle Tree             |
              |   - Chain Adapters          |
              +-------------+---------------+
                            |
          +-----------------+-----------------+
          |         |           |             |
          v         v           v             v
      +-------+ +--------+ +---------+ +------------+
      |  EVM  | | Solana | | Cosmos  | | Hyperledger|
      +-------+ +--------+ +---------+ +------------+
```

## Features

- **Immutable Audit Anchoring** - SHA-256 hash anchoring with Merkle proofs for tamper-proof audit trails
- **Rule NFTs** - Soulbound NFTs representing versioned compliance rules with on-chain verification
- **Entity Identity (DID)** - Decentralized identity binding for regulated entities
- **Compliance Oracle** - Bridge off-chain regulatory events to on-chain attestations
- **Multi-Chain Support** - Single API for all major blockchain ecosystems
- **Batch Optimization** - Efficient batching with automatic Merkle tree generation
- **Cross-Chain Verification** - Anchor to multiple chains for redundancy

## Supported Chains

| Chain | Network | Status |
|-------|---------|--------|
| **Ethereum** | Mainnet, Sepolia, Goerli | Production |
| **Polygon** | Mainnet, Mumbai | Production |
| **Solana** | Mainnet, Devnet | Production |
| **Cosmos** | Hub, Osmosis | Production |
| **Polkadot** | Mainnet, Kusama, Westend | Production |
| **Hyperledger Fabric** | v2.2+ | Production |
| **AWS Managed Blockchain** | Hyperledger Fabric | Production |
| **Avalanche** | C-Chain | Beta |
| **Arbitrum** | One, Nova | Beta |
| **Optimism** | Mainnet | Beta |

## Installation

```bash
npm install @arka-protocol/blockchain
```

```bash
yarn add @arka-protocol/blockchain
```

```bash
pnpm add @arka-protocol/blockchain
```

### Optional Peer Dependencies

For enterprise blockchain support:

```bash
# Hyperledger Fabric
npm install fabric-network

# AWS Managed Blockchain
npm install @aws-sdk/client-managedblockchain
```

## Quick Start

### Basic Audit Anchoring

```typescript
import {
  BlockchainOrchestrator,
  initializeOrchestrator,
} from '@arka-protocol/blockchain';

// Initialize the orchestrator
const orchestrator = await initializeOrchestrator({
  blockchain: {
    network: 'ethereum',
    endpoints: ['https://mainnet.infura.io/v3/YOUR_KEY'],
    contractName: '0xYourAuditAnchorContract',
  },
  batch: {
    maxBatchSize: 100,
    maxBatchAge: 60000, // 1 minute
  },
  autoAnchorInterval: 300000, // 5 minutes
});

// Add audit records (automatically batched)
const hash1 = orchestrator.addRecord({
  eventType: 'TRANSACTION_APPROVED',
  entityId: 'user-123',
  amount: 50000,
  timestamp: new Date().toISOString(),
  ruleId: 'AML-001',
  decision: 'APPROVED',
});

// Force immediate anchor (optional)
const anchor = await orchestrator.anchorNow();
console.log('Anchored:', anchor?.transactionHash);

// Verify a record
const verification = await orchestrator.verifyRecord(hash1);
console.log('Verified:', verification.verified);
```

### Using the Audit Anchor Service

```typescript
import {
  AuditAnchorService,
  createEthereumAdapter,
} from '@arka-protocol/blockchain';

// Create an EVM adapter
const adapter = createEthereumAdapter({
  chainId: 1,
  rpcUrl: 'https://mainnet.infura.io/v3/YOUR_KEY',
  contracts: {
    auditAnchor: '0xYourContractAddress',
  },
});

await adapter.connect({ network: 'ethereum', endpoints: [] });

// Create audit anchor service
const auditService = new AuditAnchorService(adapter);

// Anchor a compliance decision
const anchor = await auditService.createAndAnchor({
  eventSnapshot: {
    type: 'WIRE_TRANSFER',
    amount: 100000,
    currency: 'USD',
    sender: 'ACME Corp',
    recipient: 'Global Trading Ltd',
  },
  ruleSetSnapshot: {
    rules: ['AML-001', 'SANCTIONS-CHECK', 'KYC-VERIFY'],
    version: '2024.1',
  },
  decision: {
    result: 'APPROVED',
    confidence: 0.98,
    approvedBy: 'auto-compliance-engine',
  },
  aiProposal: {
    recommendation: 'APPROVE',
    riskScore: 0.12,
    factors: ['known-counterparty', 'below-threshold'],
  },
});

console.log('Anchor ID:', anchor.anchorId);
console.log('Transaction:', anchor.blockchain?.transactionHash);
console.log('Block:', anchor.blockchain?.blockNumber);
```

### Multi-Chain Anchoring

```typescript
import {
  MultiChainManager,
  createEthereumAdapter,
  createSolanaAdapter,
  createCosmosHubAdapter,
} from '@arka-protocol/blockchain';

const multiChain = new MultiChainManager();

// Register multiple chains
multiChain.registerAdapter('ethereum', createEthereumAdapter({
  chainId: 1,
  rpcUrl: 'https://mainnet.infura.io/v3/YOUR_KEY',
  contracts: { auditAnchor: '0x...' },
}));

multiChain.registerAdapter('solana', createSolanaAdapter({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  programIds: { auditAnchor: 'YourProgramId...' },
}));

multiChain.registerAdapter('cosmos', createCosmosHubAdapter({
  rpcUrl: 'https://cosmos-rpc.publicnode.com',
  chainId: 'cosmoshub-4',
  prefix: 'cosmos',
}));

// Connect all chains
await multiChain.connectAll(configs);

// Anchor to all chains simultaneously
const results = await multiChain.anchorAuditMultiChain({
  eventSnapshot: { /* ... */ },
  ruleSetSnapshot: { /* ... */ },
  decision: { /* ... */ },
});

// Verify across chains
const verifications = await multiChain.verifyAuditMultiChain(hash);
for (const [chainId, result] of verifications) {
  console.log(`${chainId}: ${result.verified ? 'Verified' : 'Not Found'}`);
}
```

### Rule NFT Minting

```typescript
import {
  RuleNFTRegistry,
  createPolygonAdapter,
} from '@arka-protocol/blockchain';

const adapter = createPolygonAdapter({
  chainId: 137,
  rpcUrl: 'https://polygon-rpc.com',
  contracts: { ruleNFT: '0xYourRuleNFTContract' },
});

await adapter.connect({ network: 'polygon', endpoints: [] });

const registry = new RuleNFTRegistry(
  adapter,
  '0xYourRuleNFTContract',
  'ARKA-Compliance-Authority'
);

// Mint a rule as an NFT
const ruleNFT = await registry.mintRuleNFT({
  id: 'AML-2024-001',
  name: 'Anti-Money Laundering Check',
  description: 'Validates transactions against AML requirements',
  jurisdiction: 'US',
  severity: 'critical',
  condition: {
    type: 'and',
    conditions: [
      { type: 'comparison', field: 'amount', operator: 'gt', value: 10000 },
      { type: 'comparison', field: 'type', operator: 'eq', value: 'WIRE' },
    ],
  },
  consequence: { action: 'require_review' },
  effectiveFrom: '2024-01-01T00:00:00Z',
}, 1); // version 1

console.log('Rule NFT minted:', ruleNFT.metadata.tokenId);
console.log('DSL Hash:', ruleNFT.metadata.dslHash);

// Verify rule integrity
const verification = await registry.verifyRule(rule);
console.log('Rule verified:', verification.verified);
console.log('Hash matches:', verification.hashMatches);
```

### Entity Identity (DID) Registration

```typescript
import {
  EntityIdentityService,
  createEthereumAdapter,
} from '@arka-protocol/blockchain';

const adapter = createEthereumAdapter({
  chainId: 1,
  rpcUrl: process.env.ETH_RPC_URL!,
  contracts: { didRegistry: '0xYourDIDRegistry' },
});

// Register entity identity
const binding = await adapter.registerEntityIdentity({
  bindingId: 'bind-001',
  entityId: 'entity-acme-corp',
  entityType: 'organization',
  entityHash: 'sha256-of-entity-data',
  blockchainIdentity: 'did:ethr:0x1234...',
  did: {
    id: 'did:ethr:0x1234...',
    controller: 'did:ethr:0x1234...',
    verificationMethod: [],
    authentication: [],
  },
  status: 'active',
  createdAt: new Date().toISOString(),
});

console.log('Entity registered on-chain');
console.log('Transaction:', binding.blockchain?.transactionHash);
```

## API Reference

### Core Classes

#### `BlockchainOrchestrator`

Main orchestration class for batch anchoring.

```typescript
class BlockchainOrchestrator {
  constructor(config: OrchestratorConfig);
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  addRecord(record: unknown): string;
  anchorNow(): Promise<AnchoredRecord | null>;
  verifyRecord(hash: string): Promise<VerificationResult>;
  getProof(hash: string): MerkleProof | null;
  getStats(): OrchestratorStats;
}
```

#### `AuditAnchorService`

Service for creating and verifying audit anchors.

```typescript
class AuditAnchorService {
  constructor(adapter: BlockchainAdapter, contractAddress?: string);
  createAnchor(components: AuditAnchorComponents): AuditAnchor;
  anchorToBlockchain(anchor: AuditAnchor): Promise<AuditAnchor>;
  createAndAnchor(components: AuditAnchorComponents): Promise<AuditAnchor>;
  verify(anchorId: string): Promise<AuditVerificationResult>;
  verifyData(anchorId: string, components: AuditAnchorComponents): Promise<AuditVerificationResult>;
}
```

#### `MultiChainManager`

Manages multiple blockchain adapters for cross-chain operations.

```typescript
class MultiChainManager {
  registerAdapter(chainId: string, adapter: ARKAChainAdapter): void;
  setPrimaryChain(chainId: string): void;
  getAdapter(chainId: string): ARKAChainAdapter | undefined;
  connectAll(configs: Map<string, BlockchainConfig>): Promise<void>;
  disconnectAll(): Promise<void>;
  anchorAuditMultiChain(components: AuditAnchorComponents, chainIds?: string[]): Promise<Map<string, AuditAnchor>>;
  verifyAuditMultiChain(hash: string, chainIds?: string[]): Promise<Map<string, VerificationResult>>;
  getHealthAll(): Promise<Map<string, BlockchainHealth>>;
}
```

### Adapter Factory Functions

```typescript
// EVM Chains
createEthereumAdapter(config: EVMConfig): EVMBlockchainAdapter;
createPolygonAdapter(config: EVMConfig): EVMBlockchainAdapter;
createEVMAdapter(id: string, network: BlockchainNetwork, config: EVMConfig): EVMBlockchainAdapter;

// Solana
createSolanaAdapter(config: SolanaConfig): SolanaBlockchainAdapter;
createSolanaDevnetAdapter(config?: Partial<SolanaConfig>): SolanaBlockchainAdapter;

// Cosmos
createCosmosHubAdapter(config?: Partial<CosmosConfig>): CosmosBlockchainAdapter;
createOsmosisAdapter(config?: Partial<CosmosConfig>): CosmosBlockchainAdapter;
createCosmosAdapter(config: CosmosConfig): CosmosBlockchainAdapter;

// Polkadot
createPolkadotAdapter(config?: Partial<PolkadotConfig>): PolkadotBlockchainAdapter;
createKusamaAdapter(config?: Partial<PolkadotConfig>): PolkadotBlockchainAdapter;
createSubstrateAdapter(config: PolkadotConfig): PolkadotBlockchainAdapter;

// Enterprise
registerHyperledgerAdapter(): Promise<boolean>;
createAMBAdapter(config: AMBConfig): Promise<BlockchainAdapter>;
```

### Types

```typescript
interface AuditAnchorComponents {
  eventSnapshot: unknown;
  ruleSetSnapshot: unknown;
  decision: unknown;
  aiProposal?: unknown;
  simulationResults?: unknown;
  metadata?: Record<string, unknown>;
}

interface AnchoredRecord {
  anchorId: string;
  transactionHash: string;
  blockNumber: number;
  blockHash?: string;
  merkleRoot: string;
  recordCount: number;
  timestamp: string;
  network: BlockchainNetwork;
  metadata?: Record<string, unknown>;
}

interface VerificationResult {
  verified: boolean;
  anchor?: AnchoredRecord;
  proof?: MerkleProof;
  error?: string;
  chain?: AnchoredRecord[];
}
```

## Smart Contract Interfaces

The package includes Solidity-compatible ABI definitions for on-chain contracts:

- `AUDIT_ANCHOR_CONTRACT_ABI` - Audit anchoring contract
- `RULE_NFT_CONTRACT_ABI` - ERC-721 Rule NFT contract
- `DID_REGISTRY_CONTRACT_ABI` - Entity DID registry
- `COMPLIANCE_ORACLE_CONTRACT_ABI` - Compliance oracle attestations

## Configuration Examples

### Ethereum Configuration

```typescript
const ethConfig: EVMConfig = {
  chainId: 1,
  rpcUrl: 'https://mainnet.infura.io/v3/YOUR_KEY',
  wsUrl: 'wss://mainnet.infura.io/ws/v3/YOUR_KEY', // optional
  contracts: {
    auditAnchor: '0x...',
    ruleNFT: '0x...',
    didRegistry: '0x...',
    complianceOracle: '0x...',
  },
  privateKey: process.env.PRIVATE_KEY, // for signing
  gasSettings: {
    maxFeePerGas: BigInt('50000000000'), // 50 gwei
    maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
    gasLimit: 200000,
  },
  confirmations: 2,
};
```

### Solana Configuration

```typescript
const solanaConfig: SolanaConfig = {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  wsUrl: 'wss://api.mainnet-beta.solana.com',
  programIds: {
    auditAnchor: 'YourAuditProgramId...',
    ruleNFT: 'YourRuleNFTProgramId...',
    didRegistry: 'YourDIDProgramId...',
    complianceOracle: 'YourOracleProgramId...',
  },
  keypair: process.env.SOLANA_KEYPAIR,
  commitment: 'confirmed',
};
```

### AWS Managed Blockchain Configuration

```typescript
const ambConfig: AMBConfig = {
  region: 'us-east-1',
  networkId: 'n-XXXXXXXXXXXXXXXXX',
  memberId: 'm-XXXXXXXXXXXXXXXXX',
  nodeIds: ['nd-XXXXXXXXXXXXXXXXX'],
  channelName: 'compliance-channel',
  contractName: 'audit-anchor',
  mspId: 'YourOrgMSP',
};
```

## Documentation

For comprehensive documentation, guides, and examples, visit:

**[https://www.arkaprotocol.com/docs](https://www.arkaprotocol.com/docs)**

- [Getting Started Guide](https://www.arkaprotocol.com/docs/blockchain/getting-started)
- [Architecture Overview](https://www.arkaprotocol.com/docs/blockchain/architecture)
- [Chain-Specific Guides](https://www.arkaprotocol.com/docs/blockchain/chains)
- [Smart Contract Deployment](https://www.arkaprotocol.com/docs/blockchain/contracts)
- [Security Best Practices](https://www.arkaprotocol.com/docs/blockchain/security)

## Related Packages

| Package | Description |
|---------|-------------|
| [`@arka-protocol/core`](https://www.npmjs.com/package/@arka-protocol/core) | Core compliance engine |
| [`@arka-protocol/crypto`](https://www.npmjs.com/package/@arka-protocol/crypto) | Cryptographic primitives |
| [`@arka-protocol/types`](https://www.npmjs.com/package/@arka-protocol/types) | TypeScript type definitions |
| [`@arka-protocol/cli`](https://www.npmjs.com/package/@arka-protocol/cli) | Command-line interface |

## License

Apache-2.0 - see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <sub>Built with care by <a href="https://www.arkaprotocol.com">ARKA Protocol</a></sub>
</p>
