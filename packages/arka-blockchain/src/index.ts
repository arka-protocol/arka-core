/**
 * ARKA Blockchain
 *
 * Blockchain adapter interfaces and implementations for ARKA Protocol.
 *
 * Features:
 * - Immutable Audit Anchoring
 * - On-Chain Rule NFTs
 * - Entity Identity Binding (DID)
 * - Compliance Oracle
 * - Cross-Chain Support
 *
 * @packageDocumentation
 */

// Core types
export type {
  BlockchainNetwork,
  TransactionStatus,
  BlockchainConfig,
  AnchoredRecord,
  AnchorRequest,
  VerificationResult,
  AnchorQuery,
  BlockchainHealth,
  BlockchainEvent,
  BlockchainEventHandler,
  BlockchainAdapter,
  BlockchainAdapterFactory,
  BatchManager,
  BatchManagerConfig,
} from './types.js';

// Base adapter
export { BaseBlockchainAdapter } from './base-adapter.js';

// Batch manager
export { DefaultBatchManager, AutoAnchoringBatchManager } from './batch-manager.js';

// Factory
export {
  DefaultBlockchainAdapterFactory,
  getAdapterFactory,
  resetAdapterFactory,
  createAdapter,
  createConfiguredAdapter,
  registerAdapter,
  registerHyperledgerAdapter,
  registerAMBAdapter,
  createAMBAdapter,
  type ExtendedBlockchainNetwork,
  type AdapterFactoryConfig,
  type AMBConfig,
} from './factory.js';

// Orchestrator
export {
  BlockchainOrchestrator,
  getOrchestrator,
  initializeOrchestrator,
  shutdownOrchestrator,
  type OrchestratorConfig,
  type AnchoredDecision,
} from './orchestrator.js';

// Audit Anchoring
export {
  AuditAnchorService,
  AUDIT_ANCHOR_CONTRACT_ABI,
  type AuditAnchorComponents,
  type AuditAnchor,
  type AuditVerificationResult,
} from './audit-anchor.js';

// Rule NFTs
export {
  RuleNFTRegistry,
  RULE_NFT_CONTRACT_ABI,
  type RuleNFTMetadata,
  type RuleNFT,
  type RuleVerificationResult,
  type RuleNFTQuery,
} from './rule-nft.js';

// Entity Identity Binding
export {
  EntityIdentityService,
  DID_REGISTRY_CONTRACT_ABI,
  type IdentityType,
  type DIDDocument,
  type EntityIdentityBinding,
  type ComplianceAttestation,
  type EntityBindingQuery,
} from './entity-identity.js';

// Compliance Oracle
export {
  ComplianceOracleService,
  COMPLIANCE_ORACLE_CONTRACT_ABI,
  type OracleSourceType,
  type SignatureAlgorithm,
  type OffChainEvent,
  type OracleVerificationResult,
  type OracleAttestation,
  type RegisteredSource,
} from './compliance-oracle.js';

// Cross-Chain Support
export {
  BaseARKAChainAdapter,
  MultiChainManager,
  getMultiChainManager,
  resetMultiChainManager,
  type ChainType,
  type ChainSpecificConfig,
  type ARKAChainAdapter,
} from './chain-adapter.js';

// Memory adapter (always available)
export { MemoryBlockchainAdapter } from './adapters/memory.js';

// Hyperledger adapter types (adapter itself loaded dynamically)
export type { FabricConfig } from './adapters/hyperledger.js';

// EVM adapter (Ethereum, Polygon, etc.)
export {
  EVMBlockchainAdapter,
  createEthereumAdapter,
  createPolygonAdapter,
  createEVMAdapter,
  type EVMConfig,
} from './adapters/evm.js';

// Solana adapter
export {
  SolanaBlockchainAdapter,
  createSolanaAdapter,
  createSolanaDevnetAdapter,
  type SolanaConfig,
} from './adapters/solana.js';

// Cosmos SDK adapter
export {
  CosmosBlockchainAdapter,
  createCosmosHubAdapter,
  createOsmosisAdapter,
  createCosmosAdapter,
  type CosmosConfig,
} from './adapters/cosmos.js';

// Polkadot/Substrate adapter
export {
  PolkadotBlockchainAdapter,
  createPolkadotAdapter,
  createKusamaAdapter,
  createWestendAdapter,
  createSubstrateAdapter,
  type PolkadotConfig,
} from './adapters/polkadot.js';

// Consensus module
export * from './consensus/index.js';

// Amazon Managed Blockchain
export {
  // Types
  type AMBFramework,
  type AMBNetworkStatus,
  type AMBMemberStatus,
  type AMBNodeStatus,
  type AMBInstanceType,
  type FabricEdition,
  type FabricVersion,
  type AMBNetwork,
  type AMBMember,
  type AMBNode,
  type AMBBlockchainConfig,
  type AMBOperationResult,
  type AMBProposal,
  type AMBInvitation,
  type AMBHealthCheck,
  type AMBEvent,
  type AMBEventHandler,
  type AMBClientConfig,
  type CreateNetworkConfig,
  type CreateMemberConfig,
  type CreateNodeConfig,
  type ClientNetworkConfig,
  type NetworkDeploymentResult,
  type NetworkStatus,
  // Adapter
  AmazonManagedBlockchainAdapter,
  createAMBAdapterForRegion,
  // Client
  AMBClient,
  createAMBClient,
  // Network Manager
  AMBNetworkManager,
  getAMBNetworkManager,
  resetAMBNetworkManager,
} from './managed-blockchain/index.js';
