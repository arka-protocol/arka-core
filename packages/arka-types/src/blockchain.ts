/**
 * ARKA Blockchain Types
 *
 * Type definitions for the ARKA blockchain layer including blocks,
 * transactions, and chain-related interfaces.
 *
 * @packageDocumentation
 */

// ============================================================================
// Basic Blockchain Primitives
// ============================================================================

/**
 * Unique identifier for a blockchain network
 */
export type ChainId = string;

/**
 * SHA-256 hash of a block
 */
export type BlockHash = string;

/**
 * SHA-256 hash of a transaction
 */
export type TxHash = string;

/**
 * Node identifier in the network
 */
export type NodeId = string;

// ============================================================================
// Block Types
// ============================================================================

/**
 * Block header containing metadata about a block
 */
export interface BlockHeader {
  /** Chain identifier this block belongs to */
  chainId: ChainId;

  /** Block number (0-indexed, genesis = 0) */
  height: number;

  /** Hash of the previous block (null for genesis) */
  previousHash: BlockHash | null;

  /** ISO timestamp when block was created */
  timestamp: string;

  /** Merkle root of all transactions in the block */
  merkleRoot: string;

  /** Node ID that proposed/mined this block */
  proposerId: NodeId;

  /** Number of transactions in this block */
  txCount: number;
}

/**
 * A complete block with header, transactions, and hash
 */
export interface Block<TTx = ChainTransaction> {
  /** Block header metadata */
  header: BlockHeader;

  /** Array of transactions included in this block */
  transactions: TTx[];

  /** SHA-256 hash of the block (header + transactions) */
  hash: BlockHash;
}

/**
 * Lightweight block summary for listing/pagination
 */
export interface BlockSummary {
  /** Block number */
  height: number;

  /** Block hash */
  hash: BlockHash;

  /** ISO timestamp */
  timestamp: string;

  /** Number of transactions */
  txCount: number;

  /** Proposer node ID */
  proposerId: NodeId;
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Base interface for all chain transactions
 */
export interface ChainTransactionBase {
  /** SHA-256 hash of the transaction */
  hash: TxHash;

  /** Transaction type discriminator */
  type: string;

  /** ISO timestamp when transaction was created */
  timestamp: string;

  /** Optional nonce for uniqueness */
  nonce?: number;
}

/**
 * Transaction type for ARKA compliance events
 */
export interface ArkaEventTransaction extends ChainTransactionBase {
  /** Transaction type discriminator */
  type: 'ARKA_EVENT';

  /** Reference to the ARKA event ID */
  eventId: string;

  /** Entity ID the event relates to */
  entityId: string;

  /** Optional rule ID that was evaluated */
  ruleId?: string;

  /** Optional decision ID from rule evaluation */
  decisionId?: string;

  /** Event source (e.g., plugin ID) */
  source?: string;

  /** Event type (e.g., TRANSACTION_POSTED) */
  eventType?: string;

  /** Raw event payload or summary */
  payload: unknown;
}

/**
 * Transaction type for governance actions
 */
export interface GovernanceTransaction extends ChainTransactionBase {
  /** Transaction type discriminator */
  type: 'GOVERNANCE';

  /** Type of governance action */
  action: 'PROPOSAL_CREATED' | 'VOTE_CAST' | 'PROPOSAL_EXECUTED' | 'RULE_UPDATED';

  /** Actor who initiated the action */
  actorId: string;

  /** Reference to proposal if applicable */
  proposalId?: string;

  /** Governance action payload */
  payload: unknown;
}

/**
 * Transaction type for audit trail entries
 */
export interface AuditTransaction extends ChainTransactionBase {
  /** Transaction type discriminator */
  type: 'AUDIT';

  /** Type of audit action */
  action: 'ACCESS' | 'MODIFICATION' | 'EXPORT' | 'QUERY';

  /** User or service that performed the action */
  actorId: string;

  /** Resource that was accessed/modified */
  resourceId: string;

  /** Resource type */
  resourceType: string;

  /** Audit details */
  payload: unknown;
}

/**
 * Union of all supported transaction types
 */
export type ChainTransaction =
  | ArkaEventTransaction
  | GovernanceTransaction
  | AuditTransaction;

/**
 * Input for creating a new ARKA event transaction (hash and timestamp filled by node)
 */
export interface ArkaEventTransactionInput extends Omit<ArkaEventTransaction, 'hash' | 'timestamp'> {
  hash?: TxHash;
  timestamp?: string;
}

// ============================================================================
// Chain State & Configuration
// ============================================================================

/**
 * Current state of the blockchain
 */
export interface ChainState {
  /** Chain identifier */
  chainId: ChainId;

  /** Current head block (null if no blocks yet) */
  head: Block | null;

  /** Current chain height (-1 if no blocks) */
  height: number;

  /** Total number of transactions processed */
  totalTransactions: number;

  /** Genesis block timestamp */
  genesisTimestamp?: string;
}

/**
 * Configuration for initializing a chain
 */
export interface ChainConfig {
  /** Unique chain identifier */
  chainId: ChainId;

  /** Optional genesis timestamp (defaults to now) */
  genesisTimestamp?: string;

  /** Maximum transactions per block */
  maxTxPerBlock?: number;

  /** Block time in milliseconds (for auto-mining) */
  blockTimeMs?: number;
}

// ============================================================================
// Node Types
// ============================================================================

/**
 * Configuration for a chain node
 */
export interface ChainNodeConfig {
  /** Unique node identifier */
  nodeId: NodeId;

  /** Chain configuration */
  chainId: ChainId;

  /** Auto-mine blocks when transactions are submitted */
  autoMine?: boolean;

  /** Block time for auto-mining (ms) */
  blockTimeMs?: number;

  /** Maximum pending transactions before forced mining */
  maxPendingTx?: number;
}

/**
 * Node status information
 */
export interface NodeStatus {
  /** Node identifier */
  nodeId: NodeId;

  /** Chain identifier */
  chainId: ChainId;

  /** Current chain height */
  height: number;

  /** Number of pending transactions */
  pendingTxCount: number;

  /** Whether the node is syncing */
  isSyncing: boolean;

  /** Connected peers (for future multi-node) */
  peerCount: number;

  /** Node uptime in milliseconds */
  uptimeMs: number;

  /** Node version */
  version: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from submitting a transaction
 */
export interface SubmitTxResponse {
  /** Transaction hash */
  txHash: TxHash;

  /** Whether tx is pending or already in block */
  status: 'pending' | 'included';

  /** Block height if already included */
  blockHeight?: number;
}

/**
 * Paginated response for listing blocks
 */
export interface BlockListResponse {
  /** Array of block summaries */
  blocks: BlockSummary[];

  /** Total number of blocks */
  total: number;

  /** Current offset */
  offset: number;

  /** Page size */
  limit: number;

  /** Whether there are more blocks */
  hasMore: boolean;
}

/**
 * Transaction lookup response
 */
export interface TxLookupResponse {
  /** The transaction if found */
  transaction: ChainTransaction | null;

  /** Block the transaction is in (if confirmed) */
  block?: BlockSummary;

  /** Number of confirmations */
  confirmations: number;
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Interface for chain storage backends
 */
export interface ChainStorageInfo {
  /** Storage type identifier */
  type: 'memory' | 'file' | 'leveldb' | 's3';

  /** Storage path or location */
  path?: string;

  /** Total blocks stored */
  blockCount: number;

  /** Storage size in bytes (if known) */
  sizeBytes?: number;
}

// ============================================================================
// Explorer Types
// ============================================================================

/**
 * Search result for explorer queries
 */
export interface ChainSearchResult {
  /** Result type */
  type: 'block' | 'transaction' | 'entity';

  /** Block summary if type is block */
  block?: BlockSummary;

  /** Transaction if type is transaction */
  transaction?: ChainTransaction;

  /** Entity ID if type is entity */
  entityId?: string;

  /** Related transactions for entity search */
  relatedTxCount?: number;
}

/**
 * Chain statistics for dashboard
 */
export interface ChainStats {
  /** Chain identifier */
  chainId: ChainId;

  /** Total blocks */
  totalBlocks: number;

  /** Total transactions */
  totalTransactions: number;

  /** Transactions in last 24 hours */
  txLast24h: number;

  /** Average block time (ms) */
  avgBlockTimeMs: number;

  /** Average transactions per block */
  avgTxPerBlock: number;

  /** Chain start time */
  genesisTime: string;

  /** Last block time */
  lastBlockTime: string;
}
