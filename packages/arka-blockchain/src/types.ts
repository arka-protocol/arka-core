/**
 * Blockchain Adapter Types
 *
 * Core interfaces for blockchain integration in ARKA Protocol.
 */

import type { MerkleProof } from '@arka/crypto';

/**
 * Supported blockchain networks
 */
export type BlockchainNetwork =
  | 'hyperledger-fabric'
  | 'ethereum'
  | 'polygon'
  | 'solana'
  | 'custom'
  | 'memory'; // For testing

/**
 * Transaction status
 */
export type TransactionStatus =
  | 'pending'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'rejected';

/**
 * Blockchain connection configuration
 */
export interface BlockchainConfig {
  /** Network type */
  network: BlockchainNetwork;
  /** Network endpoint(s) */
  endpoints: string[];
  /** Channel name (for Hyperledger Fabric) */
  channelName?: string;
  /** Chaincode/contract name */
  contractName?: string;
  /** Organization MSP ID (for Fabric) */
  mspId?: string;
  /** Wallet/identity configuration */
  identity?: {
    certificatePath?: string;
    privateKeyPath?: string;
    walletPath?: string;
    userId?: string;
  };
  /** Connection timeout in ms */
  timeout?: number;
  /** Number of confirmations to wait for */
  confirmations?: number;
  /** Custom configuration */
  custom?: Record<string, unknown>;
}

/**
 * A record anchored to blockchain
 */
export interface AnchoredRecord {
  /** Unique anchor ID */
  anchorId: string;
  /** Transaction hash on chain */
  transactionHash: string;
  /** Block number/height */
  blockNumber: number;
  /** Block hash */
  blockHash?: string;
  /** Merkle root that was anchored */
  merkleRoot: string;
  /** Number of records in this anchor */
  recordCount: number;
  /** Timestamp of anchoring */
  timestamp: string;
  /** Network the record was anchored to */
  network: BlockchainNetwork;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Record to be anchored
 */
export interface AnchorRequest {
  /** Batch ID for this anchor request */
  batchId: string;
  /** Merkle root of the data batch */
  merkleRoot: string;
  /** Number of records in the batch */
  recordCount: number;
  /** Optional: individual record hashes for verification */
  recordHashes?: string[];
  /** Optional metadata to include */
  metadata?: Record<string, unknown>;
}

/**
 * Verification result
 */
export interface VerificationResult {
  /** Whether the record is verified */
  verified: boolean;
  /** Anchor record details */
  anchor?: AnchoredRecord;
  /** Merkle proof if available */
  proof?: MerkleProof;
  /** Error message if verification failed */
  error?: string;
  /** Chain of custody (all anchors in chain) */
  chain?: AnchoredRecord[];
}

/**
 * Query for retrieving anchored records
 */
export interface AnchorQuery {
  /** Filter by anchor ID */
  anchorId?: string;
  /** Filter by transaction hash */
  transactionHash?: string;
  /** Filter by merkle root */
  merkleRoot?: string;
  /** Filter by time range */
  fromTimestamp?: string;
  toTimestamp?: string;
  /** Filter by block range */
  fromBlock?: number;
  toBlock?: number;
  /** Pagination */
  limit?: number;
  offset?: number;
}

/**
 * Health status of blockchain connection
 */
export interface BlockchainHealth {
  /** Is connected */
  connected: boolean;
  /** Network type */
  network: BlockchainNetwork;
  /** Current block height */
  blockHeight?: number;
  /** Peer count (if applicable) */
  peerCount?: number;
  /** Latency in ms */
  latency?: number;
  /** Last successful operation timestamp */
  lastActivity?: string;
  /** Any error message */
  error?: string;
}

/**
 * Event emitted by blockchain adapter
 */
export interface BlockchainEvent {
  type: 'connected' | 'disconnected' | 'anchored' | 'verified' | 'error';
  timestamp: string;
  data?: unknown;
  error?: Error;
}

/**
 * Blockchain event handler
 */
export type BlockchainEventHandler = (event: BlockchainEvent) => void | Promise<void>;

/**
 * Core blockchain adapter interface
 *
 * All blockchain implementations must implement this interface
 * to be compatible with ARKA Protocol.
 */
export interface BlockchainAdapter {
  /**
   * Unique adapter identifier
   */
  readonly id: string;

  /**
   * Network type this adapter supports
   */
  readonly network: BlockchainNetwork;

  /**
   * Initialize the adapter and connect to network
   */
  connect(config: BlockchainConfig): Promise<void>;

  /**
   * Disconnect from network
   */
  disconnect(): Promise<void>;

  /**
   * Check if connected
   */
  isConnected(): boolean;

  /**
   * Get health status
   */
  getHealth(): Promise<BlockchainHealth>;

  /**
   * Anchor a batch of records to blockchain
   */
  anchor(request: AnchorRequest): Promise<AnchoredRecord>;

  /**
   * Verify a record exists on chain
   */
  verify(merkleRoot: string): Promise<VerificationResult>;

  /**
   * Verify a specific item within an anchored batch
   */
  verifyItem(merkleRoot: string, proof: MerkleProof): Promise<VerificationResult>;

  /**
   * Query anchored records
   */
  query(query: AnchorQuery): Promise<AnchoredRecord[]>;

  /**
   * Get a specific anchor by ID
   */
  getAnchor(anchorId: string): Promise<AnchoredRecord | null>;

  /**
   * Subscribe to blockchain events
   */
  subscribe(handler: BlockchainEventHandler): () => void;

  /**
   * Get the current block number
   */
  getBlockNumber(): Promise<number>;

  /**
   * Wait for transaction confirmation
   */
  waitForConfirmation(transactionHash: string, confirmations?: number): Promise<boolean>;
}

/**
 * Factory for creating blockchain adapters
 */
export interface BlockchainAdapterFactory {
  /**
   * Create an adapter for the specified network
   */
  create(network: BlockchainNetwork, config?: Partial<BlockchainConfig>): BlockchainAdapter;

  /**
   * Check if network is supported
   */
  supports(network: BlockchainNetwork): boolean;

  /**
   * Get list of supported networks
   */
  getSupportedNetworks(): BlockchainNetwork[];
}

/**
 * Batch manager for efficient anchoring
 */
export interface BatchManager {
  /**
   * Add a record to the current batch
   */
  addRecord(record: unknown): string; // Returns record hash

  /**
   * Get current batch size
   */
  getBatchSize(): number;

  /**
   * Check if batch is ready to anchor
   */
  isReadyToAnchor(): boolean;

  /**
   * Finalize and get the batch for anchoring
   */
  finalizeBatch(): AnchorRequest;

  /**
   * Clear the current batch
   */
  clearBatch(): void;

  /**
   * Get proof for a specific record in batch
   */
  getProof(recordHash: string): MerkleProof | null;
}

/**
 * Configuration for batch manager
 */
export interface BatchManagerConfig {
  /** Maximum records per batch */
  maxBatchSize: number;
  /** Maximum time to wait before auto-anchoring (ms) */
  maxBatchAge?: number;
  /** Minimum records before allowing anchor */
  minBatchSize?: number;
}
