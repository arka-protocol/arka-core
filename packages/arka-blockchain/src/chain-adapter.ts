/**
 * ARKA Chain Adapter - Cross-Chain Support
 *
 * Universal interface for ARKA Protocol to work with ANY blockchain.
 *
 * Supported chains:
 * - EVM (Ethereum, Polygon, Avalanche, etc.)
 * - Cosmos
 * - Polkadot
 * - Solana
 * - Hyperledger Fabric
 * - Custom L1 chains (e.g., Habify L1)
 * - Government chains
 */

import { createLogger } from '@arka/utils';
import type { ArkaRule } from '@arka/types';
import type {
  BlockchainAdapter,
  BlockchainConfig,
  AnchoredRecord,
  VerificationResult,
  BlockchainHealth,
  BlockchainNetwork,
  BlockchainEventHandler,
} from './types.js';
import type { AuditAnchor, AuditAnchorComponents } from './audit-anchor.js';
import type { RuleNFT } from './rule-nft.js';
import type { EntityIdentityBinding } from './entity-identity.js';
import type { OracleAttestation, OffChainEvent } from './compliance-oracle.js';

const logger = createLogger({ service: 'arka-chain-adapter' });

/**
 * Supported chain types
 */
export type ChainType =
  | 'evm' // Ethereum, Polygon, Avalanche, BSC, etc.
  | 'cosmos' // Cosmos SDK chains
  | 'polkadot' // Polkadot/Substrate
  | 'solana' // Solana
  | 'hyperledger' // Hyperledger Fabric
  | 'custom'; // Custom L1 (Habify, government chains, etc.)

/**
 * Chain-specific configuration
 */
export interface ChainSpecificConfig {
  /** Chain type */
  chainType: ChainType;

  /** EVM-specific config */
  evm?: {
    chainId: number;
    rpcUrl: string;
    contractAddresses: {
      auditAnchor: string;
      ruleNFT: string;
      didRegistry: string;
      complianceOracle: string;
    };
    gasSettings?: {
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
      gasLimit?: number;
    };
  };

  /** Cosmos-specific config */
  cosmos?: {
    rpcUrl: string;
    chainId: string;
    prefix: string;
    contractAddresses: {
      auditAnchor: string;
      ruleNFT: string;
    };
  };

  /** Polkadot-specific config */
  polkadot?: {
    wsUrl: string;
    palletName: string;
  };

  /** Solana-specific config */
  solana?: {
    rpcUrl: string;
    programIds: {
      auditAnchor: string;
      ruleNFT: string;
    };
  };

  /** Custom chain config */
  custom?: {
    endpoints: string[];
    protocol: string;
    customParams: Record<string, unknown>;
  };
}

/**
 * Unified ARKA Chain Adapter Interface
 *
 * This is the standard interface that all blockchain implementations must provide.
 * Makes ARKA plug-in ready for ANY blockchain.
 */
export interface ARKAChainAdapter extends BlockchainAdapter {
  /** Chain type */
  readonly chainType: ChainType;

  /** Chain-specific configuration */
  readonly chainConfig: ChainSpecificConfig;

  // ========== Audit Anchoring ==========

  /**
   * Anchors an audit record to the blockchain
   */
  anchorAudit(components: AuditAnchorComponents): Promise<AuditAnchor>;

  /**
   * Verifies an audit anchor exists on chain
   */
  verifyAuditAnchor(hash: string): Promise<VerificationResult>;

  /**
   * Gets audit anchor details from chain
   */
  getAuditAnchor(anchorId: string): Promise<AuditAnchor | null>;

  // ========== Rule NFTs ==========

  /**
   * Mints a rule as an NFT on chain
   */
  mintRuleNFT(rule: ArkaRule, version: number): Promise<RuleNFT>;

  /**
   * Gets a rule NFT from chain
   */
  getRuleNFT(tokenId: string): Promise<RuleNFT | null>;

  /**
   * Verifies a rule's integrity against chain
   */
  verifyRuleVersion(rule: ArkaRule): Promise<VerificationResult>;

  /**
   * Gets all versions of a rule from chain
   */
  getRuleVersions(ruleId: string): Promise<RuleNFT[]>;

  // ========== Entity Identity ==========

  /**
   * Registers an entity identity (DID) on chain
   */
  registerEntityIdentity(binding: EntityIdentityBinding): Promise<EntityIdentityBinding>;

  /**
   * Gets an entity binding from chain
   */
  getEntityBinding(entityId: string): Promise<EntityIdentityBinding | null>;

  /**
   * Resolves a DID to entity binding
   */
  resolveDID(did: string): Promise<EntityIdentityBinding | null>;

  /**
   * Revokes an entity identity
   */
  revokeEntityIdentity(bindingId: string): Promise<boolean>;

  // ========== Oracle ==========

  /**
   * Submits an oracle attestation to chain
   */
  submitOracleAttestation(attestation: OracleAttestation): Promise<OracleAttestation>;

  /**
   * Verifies an oracle attestation on chain
   */
  verifyOracleAttestation(attestationId: string): Promise<VerificationResult>;

  // ========== Chain Utilities ==========

  /**
   * Gets the current gas price (for EVM chains)
   */
  getGasPrice?(): Promise<bigint>;

  /**
   * Estimates gas for a transaction (for EVM chains)
   */
  estimateGas?(method: string, params: unknown[]): Promise<bigint>;

  /**
   * Gets native token balance
   */
  getBalance?(address: string): Promise<bigint>;
}

/**
 * Abstract base implementation of ARKAChainAdapter
 */
export abstract class BaseARKAChainAdapter implements ARKAChainAdapter {
  abstract readonly id: string;
  abstract readonly network: BlockchainNetwork;
  abstract readonly chainType: ChainType;
  abstract readonly chainConfig: ChainSpecificConfig;

  protected connected = false;

  abstract connect(config: BlockchainConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getHealth(): Promise<BlockchainHealth>;
  abstract anchor(request: {
    batchId: string;
    merkleRoot: string;
    recordCount: number;
    metadata?: Record<string, unknown>;
  }): Promise<AnchoredRecord>;
  abstract verify(merkleRoot: string): Promise<VerificationResult>;
  abstract verifyItem(merkleRoot: string, proof: unknown): Promise<VerificationResult>;
  abstract query(query: unknown): Promise<AnchoredRecord[]>;
  abstract getAnchor(anchorId: string): Promise<AnchoredRecord | null>;
  abstract getBlockNumber(): Promise<number>;
  abstract waitForConfirmation(txHash: string, confirmations?: number): Promise<boolean>;
  abstract subscribe(handler: BlockchainEventHandler): () => void;

  // ARKA-specific methods
  abstract anchorAudit(components: AuditAnchorComponents): Promise<AuditAnchor>;
  abstract verifyAuditAnchor(hash: string): Promise<VerificationResult>;
  abstract getAuditAnchor(anchorId: string): Promise<AuditAnchor | null>;
  abstract mintRuleNFT(rule: ArkaRule, version: number): Promise<RuleNFT>;
  abstract getRuleNFT(tokenId: string): Promise<RuleNFT | null>;
  abstract verifyRuleVersion(rule: ArkaRule): Promise<VerificationResult>;
  abstract getRuleVersions(ruleId: string): Promise<RuleNFT[]>;
  abstract registerEntityIdentity(binding: EntityIdentityBinding): Promise<EntityIdentityBinding>;
  abstract getEntityBinding(entityId: string): Promise<EntityIdentityBinding | null>;
  abstract resolveDID(did: string): Promise<EntityIdentityBinding | null>;
  abstract revokeEntityIdentity(bindingId: string): Promise<boolean>;
  abstract submitOracleAttestation(attestation: OracleAttestation): Promise<OracleAttestation>;
  abstract verifyOracleAttestation(attestationId: string): Promise<VerificationResult>;

  isConnected(): boolean {
    return this.connected;
  }

  protected ensureConnected(): void {
    if (!this.connected) {
      throw new Error(`${this.id}: Not connected to chain`);
    }
  }
}

/**
 * Multi-chain manager - orchestrates multiple chain adapters
 */
export class MultiChainManager {
  private adapters: Map<string, ARKAChainAdapter> = new Map();
  private primaryChain: string | null = null;

  /**
   * Registers a chain adapter
   */
  registerAdapter(chainId: string, adapter: ARKAChainAdapter): void {
    this.adapters.set(chainId, adapter);
    if (this.adapters.size === 1) {
      this.primaryChain = chainId;
    }
    logger.info('Registered chain adapter', {
      chainId,
      chainType: adapter.chainType,
    });
  }

  /**
   * Sets the primary chain for operations
   */
  setPrimaryChain(chainId: string): void {
    if (!this.adapters.has(chainId)) {
      throw new Error(`Chain ${chainId} not registered`);
    }
    this.primaryChain = chainId;
  }

  /**
   * Gets an adapter by chain ID
   */
  getAdapter(chainId: string): ARKAChainAdapter | undefined {
    return this.adapters.get(chainId);
  }

  /**
   * Gets the primary adapter
   */
  getPrimaryAdapter(): ARKAChainAdapter | undefined {
    if (!this.primaryChain) return undefined;
    return this.adapters.get(this.primaryChain);
  }

  /**
   * Gets all registered adapters
   */
  getAllAdapters(): Map<string, ARKAChainAdapter> {
    return new Map(this.adapters);
  }

  /**
   * Connects all adapters
   */
  async connectAll(configs: Map<string, BlockchainConfig>): Promise<void> {
    for (const [chainId, adapter] of this.adapters) {
      const config = configs.get(chainId);
      if (config) {
        await adapter.connect(config);
        logger.info('Connected to chain', { chainId });
      }
    }
  }

  /**
   * Disconnects all adapters
   */
  async disconnectAll(): Promise<void> {
    for (const [chainId, adapter] of this.adapters) {
      await adapter.disconnect();
      logger.info('Disconnected from chain', { chainId });
    }
  }

  /**
   * Anchors audit to multiple chains (for redundancy)
   */
  async anchorAuditMultiChain(
    components: AuditAnchorComponents,
    chainIds?: string[]
  ): Promise<Map<string, AuditAnchor>> {
    const results = new Map<string, AuditAnchor>();
    const targetChains = chainIds ?? Array.from(this.adapters.keys());

    for (const chainId of targetChains) {
      const adapter = this.adapters.get(chainId);
      if (adapter) {
        try {
          const anchor = await adapter.anchorAudit(components);
          results.set(chainId, anchor);
          logger.info('Anchored audit to chain', {
            chainId,
            anchorId: anchor.anchorId,
          });
        } catch (error) {
          logger.error('Failed to anchor to chain', error as Error, { chainId });
        }
      }
    }

    return results;
  }

  /**
   * Verifies audit across multiple chains
   */
  async verifyAuditMultiChain(
    hash: string,
    chainIds?: string[]
  ): Promise<Map<string, VerificationResult>> {
    const results = new Map<string, VerificationResult>();
    const targetChains = chainIds ?? Array.from(this.adapters.keys());

    for (const chainId of targetChains) {
      const adapter = this.adapters.get(chainId);
      if (adapter) {
        try {
          const result = await adapter.verifyAuditAnchor(hash);
          results.set(chainId, result);
        } catch (error) {
          results.set(chainId, {
            verified: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return results;
  }

  /**
   * Gets health status of all chains
   */
  async getHealthAll(): Promise<Map<string, BlockchainHealth>> {
    const results = new Map<string, BlockchainHealth>();

    for (const [chainId, adapter] of this.adapters) {
      try {
        const health = await adapter.getHealth();
        results.set(chainId, health);
      } catch (error) {
        results.set(chainId, {
          connected: false,
          network: adapter.network,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }
}

// Global multi-chain manager
let multiChainManager: MultiChainManager | null = null;

/**
 * Gets the global multi-chain manager
 */
export function getMultiChainManager(): MultiChainManager {
  if (!multiChainManager) {
    multiChainManager = new MultiChainManager();
  }
  return multiChainManager;
}

/**
 * Resets the global multi-chain manager
 */
export function resetMultiChainManager(): void {
  multiChainManager = null;
}
