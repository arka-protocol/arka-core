/**
 * Multi-Ledger Chain Adapter
 *
 * Abstraction layer for interacting with multiple blockchain networks
 * for compliance proofs and audit trails (Enhancement #12).
 */

import { createLogger } from '@arka-protocol/utils';

const logger = createLogger({ service: 'chain-adapter' });

/**
 * Supported chain types
 */
export type ChainType =
  | 'ETHEREUM'
  | 'POLYGON'
  | 'HYPERLEDGER_FABRIC'
  | 'SOLANA'
  | 'AVALANCHE'
  | 'CUSTOM';

/**
 * Chain configuration
 */
export interface ChainConfig {
  /** Chain identifier */
  chainId: string;

  /** Chain type */
  type: ChainType;

  /** Display name */
  name: string;

  /** RPC endpoint(s) */
  rpcUrls: string[];

  /** Current RPC index for rotation */
  currentRpcIndex?: number;

  /** Contract addresses */
  contracts?: {
    complianceRegistry?: string;
    auditLog?: string;
    proofVerifier?: string;
  };

  /** Authentication */
  auth?: {
    privateKey?: string;
    mnemonic?: string;
    walletProvider?: string;
  };

  /** Network-specific options */
  options?: Record<string, unknown>;

  /** Whether chain is active */
  active: boolean;
}

/**
 * Transaction result
 */
export interface TransactionResult {
  /** Transaction hash */
  txHash: string;

  /** Block number */
  blockNumber?: number;

  /** Block hash */
  blockHash?: string;

  /** Gas used */
  gasUsed?: string;

  /** Status */
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';

  /** Error if failed */
  error?: string;

  /** Chain ID */
  chainId: string;

  /** Timestamp */
  timestamp: string;
}

/**
 * Compliance proof structure
 */
export interface ComplianceProof {
  /** Proof identifier */
  id: string;

  /** Entity this proof is for */
  entityId: string;

  /** Rule ID that was satisfied */
  ruleId: string;

  /** Decision record hash */
  decisionHash: string;

  /** Merkle root of supporting evidence */
  evidenceRoot: string;

  /** Timestamp */
  timestamp: string;

  /** Signature */
  signature?: string;

  /** Chain where proof is anchored */
  chainId: string;

  /** Transaction hash */
  txHash?: string;

  /** Block number */
  blockNumber?: number;
}

/**
 * Audit log entry for blockchain
 */
export interface BlockchainAuditEntry {
  /** Entry identifier */
  id: string;

  /** Event type */
  eventType: string;

  /** Entity ID */
  entityId: string;

  /** Data hash */
  dataHash: string;

  /** Timestamp */
  timestamp: string;

  /** Actor */
  actor: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Abstract chain client interface
 */
export interface ChainClient {
  /** Connect to the chain */
  connect(): Promise<void>;

  /** Disconnect */
  disconnect(): Promise<void>;

  /** Check connection status */
  isConnected(): boolean;

  /** Get current block number */
  getBlockNumber(): Promise<number>;

  /** Submit compliance proof */
  submitProof(proof: ComplianceProof): Promise<TransactionResult>;

  /** Verify proof on chain */
  verifyProof(proofId: string): Promise<boolean>;

  /** Get proof from chain */
  getProof(proofId: string): Promise<ComplianceProof | null>;

  /** Submit audit entry */
  submitAuditEntry(entry: BlockchainAuditEntry): Promise<TransactionResult>;

  /** Get audit entries for entity */
  getAuditEntries(entityId: string, limit?: number): Promise<BlockchainAuditEntry[]>;

  /** Get transaction status */
  getTransactionStatus(txHash: string): Promise<TransactionResult>;
}

/**
 * Chain Adapter Manager
 */
export class ChainAdapterManager {
  private chains: Map<string, ChainConfig> = new Map();
  private clients: Map<string, ChainClient> = new Map();
  private defaultChainId: string | null = null;

  /**
   * Register a chain configuration
   */
  registerChain(config: ChainConfig): void {
    this.chains.set(config.chainId, config);

    if (!this.defaultChainId && config.active) {
      this.defaultChainId = config.chainId;
    }

    logger.info('Chain registered', { chainId: config.chainId, type: config.type });
  }

  /**
   * Set default chain
   */
  setDefaultChain(chainId: string): void {
    if (!this.chains.has(chainId)) {
      throw new Error(`Chain not found: ${chainId}`);
    }
    this.defaultChainId = chainId;
  }

  /**
   * Get chain configuration
   */
  getChainConfig(chainId: string): ChainConfig | undefined {
    return this.chains.get(chainId);
  }

  /**
   * Get all chain configurations
   */
  getAllChains(): ChainConfig[] {
    return Array.from(this.chains.values());
  }

  /**
   * Get active chains
   */
  getActiveChains(): ChainConfig[] {
    return Array.from(this.chains.values()).filter((c) => c.active);
  }

  /**
   * Set chain client implementation
   */
  setClient(chainId: string, client: ChainClient): void {
    if (!this.chains.has(chainId)) {
      throw new Error(`Chain not found: ${chainId}`);
    }
    this.clients.set(chainId, client);
  }

  /**
   * Get chain client
   */
  getClient(chainId?: string): ChainClient {
    const id = chainId ?? this.defaultChainId;
    if (!id) {
      throw new Error('No chain specified and no default chain set');
    }

    const client = this.clients.get(id);
    if (!client) {
      throw new Error(`No client registered for chain: ${id}`);
    }

    return client;
  }

  /**
   * Connect to all registered chains
   */
  async connectAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [chainId, client] of this.clients) {
      const config = this.chains.get(chainId);
      if (!config?.active) continue;

      try {
        await client.connect();
        results.set(chainId, true);
        logger.info('Connected to chain', { chainId });
      } catch (error) {
        results.set(chainId, false);
        logger.error('Failed to connect to chain', error instanceof Error ? error : new Error(String(error)), { chainId });
      }
    }

    return results;
  }

  /**
   * Disconnect from all chains
   */
  async disconnectAll(): Promise<void> {
    for (const [chainId, client] of this.clients) {
      try {
        await client.disconnect();
        logger.info('Disconnected from chain', { chainId });
      } catch (error) {
        logger.error('Error disconnecting from chain', error instanceof Error ? error : new Error(String(error)), { chainId });
      }
    }
  }

  /**
   * Submit proof to multiple chains
   */
  async submitProofMultiChain(
    proof: ComplianceProof,
    chainIds?: string[]
  ): Promise<Map<string, TransactionResult>> {
    const results = new Map<string, TransactionResult>();
    const chains = chainIds ?? Array.from(this.getActiveChains().map((c) => c.chainId));

    await Promise.all(
      chains.map(async (chainId) => {
        try {
          const client = this.getClient(chainId);
          const result = await client.submitProof({ ...proof, chainId });
          results.set(chainId, result);
        } catch (error) {
          results.set(chainId, {
            txHash: '',
            status: 'FAILED',
            error: (error as Error).message,
            chainId,
            timestamp: new Date().toISOString(),
          });
        }
      })
    );

    return results;
  }

  /**
   * Verify proof across chains
   */
  async verifyProofMultiChain(
    proofId: string,
    chainIds?: string[]
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const chains = chainIds ?? Array.from(this.getActiveChains().map((c) => c.chainId));

    await Promise.all(
      chains.map(async (chainId) => {
        try {
          const client = this.getClient(chainId);
          const verified = await client.verifyProof(proofId);
          results.set(chainId, verified);
        } catch {
          results.set(chainId, false);
        }
      })
    );

    return results;
  }

  /**
   * Get consensus verification (majority of chains agree)
   */
  async getConsensusVerification(proofId: string, threshold: number = 0.51): Promise<boolean> {
    const verifications = await this.verifyProofMultiChain(proofId);
    const verified = Array.from(verifications.values()).filter((v) => v).length;
    const total = verifications.size;

    return total > 0 && verified / total >= threshold;
  }
}

/**
 * Create chain adapter manager
 */
export function createChainAdapterManager(): ChainAdapterManager {
  return new ChainAdapterManager();
}

/**
 * Stub Ethereum client for development/testing
 */
export class StubEthereumClient implements ChainClient {
  private connected = false;
  private blockNumber = 0;
  private proofs: Map<string, ComplianceProof> = new Map();
  private auditEntries: BlockchainAuditEntry[] = [];

  async connect(): Promise<void> {
    this.connected = true;
    this.blockNumber = Math.floor(Math.random() * 1000000);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getBlockNumber(): Promise<number> {
    return this.blockNumber++;
  }

  async submitProof(proof: ComplianceProof): Promise<TransactionResult> {
    this.proofs.set(proof.id, proof);
    return {
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      blockNumber: await this.getBlockNumber(),
      status: 'CONFIRMED',
      chainId: proof.chainId,
      timestamp: new Date().toISOString(),
    };
  }

  async verifyProof(proofId: string): Promise<boolean> {
    return this.proofs.has(proofId);
  }

  async getProof(proofId: string): Promise<ComplianceProof | null> {
    return this.proofs.get(proofId) ?? null;
  }

  async submitAuditEntry(entry: BlockchainAuditEntry): Promise<TransactionResult> {
    this.auditEntries.push(entry);
    return {
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      blockNumber: await this.getBlockNumber(),
      status: 'CONFIRMED',
      chainId: 'ethereum-stub',
      timestamp: new Date().toISOString(),
    };
  }

  async getAuditEntries(entityId: string, limit?: number): Promise<BlockchainAuditEntry[]> {
    const entries = this.auditEntries.filter((e) => e.entityId === entityId);
    return limit ? entries.slice(-limit) : entries;
  }

  async getTransactionStatus(txHash: string): Promise<TransactionResult> {
    return {
      txHash,
      status: 'CONFIRMED',
      chainId: 'ethereum-stub',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Default chain configurations
 */
export const DEFAULT_CHAIN_CONFIGS: ChainConfig[] = [
  {
    chainId: 'ethereum-mainnet',
    type: 'ETHEREUM',
    name: 'Ethereum Mainnet',
    rpcUrls: ['https://mainnet.infura.io/v3/YOUR_KEY'],
    active: false,
  },
  {
    chainId: 'polygon-mainnet',
    type: 'POLYGON',
    name: 'Polygon Mainnet',
    rpcUrls: ['https://polygon-rpc.com'],
    active: false,
  },
  {
    chainId: 'ethereum-goerli',
    type: 'ETHEREUM',
    name: 'Ethereum Goerli Testnet',
    rpcUrls: ['https://goerli.infura.io/v3/YOUR_KEY'],
    active: false,
  },
  {
    chainId: 'avalanche-fuji',
    type: 'AVALANCHE',
    name: 'Avalanche Fuji Testnet',
    rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
    active: false,
  },
];
