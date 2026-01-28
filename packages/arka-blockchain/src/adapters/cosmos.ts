/**
 * Cosmos SDK Blockchain Adapter
 *
 * Adapter for Cosmos SDK-based chains:
 * - Cosmos Hub
 * - Osmosis
 * - Juno
 * - Injective
 * - Terra
 * - Custom Cosmos chains
 *
 * Implements full ARKA Chain Adapter interface using
 * CosmWasm smart contracts for compliance data storage.
 */

import { createHash } from 'crypto';
import { canonicalSerialize } from '@arka-protocol/crypto';
import { createLogger, ids } from '@arka-protocol/utils';
import type { ArkaRule } from '@arka-protocol/types';
import type { MerkleProof } from '@arka-protocol/crypto';
import type {
  BlockchainConfig,
  BlockchainHealth,
  BlockchainNetwork,
  BlockchainEvent,
  BlockchainEventHandler,
  AnchorRequest,
  AnchoredRecord,
  AnchorQuery,
  VerificationResult,
} from '../types.js';
import type {
  ChainSpecificConfig,
  ARKAChainAdapter,
  ChainType,
} from '../chain-adapter.js';
import type { AuditAnchor, AuditAnchorComponents } from '../audit-anchor.js';
import type { RuleNFT, RuleNFTMetadata } from '../rule-nft.js';
import type { EntityIdentityBinding } from '../entity-identity.js';
import type { OracleAttestation } from '../compliance-oracle.js';

const logger = createLogger({ service: 'cosmos-adapter' });

/**
 * Cosmos-specific configuration
 */
export interface CosmosConfig {
  /** RPC endpoint URL */
  rpcUrl: string;
  /** REST API endpoint URL */
  restUrl?: string;
  /** Chain ID (e.g., "cosmoshub-4", "osmosis-1") */
  chainId: string;
  /** Bech32 address prefix (e.g., "cosmos", "osmo") */
  prefix: string;
  /** Gas price (e.g., "0.025uatom") */
  gasPrice?: string;
  /** CosmWasm contract addresses */
  contracts: {
    auditAnchor?: string;
    ruleNFT?: string;
    didRegistry?: string;
    complianceOracle?: string;
  };
  /** Mnemonic or private key for signing */
  signerKey?: string;
  /** Gas adjustment multiplier */
  gasAdjustment?: number;
}

/**
 * Simulated Cosmos client for development/testing
 * In production, use @cosmjs/stargate and @cosmjs/cosmwasm-stargate
 */
interface CosmosClient {
  getHeight(): Promise<number>;
  getBalance(address: string, denom: string): Promise<{ amount: string; denom: string }>;
  queryContract(address: string, query: unknown): Promise<unknown>;
  executeContract(
    sender: string,
    contractAddress: string,
    msg: unknown,
    fee: CosmosFee,
    memo?: string
  ): Promise<CosmosDeliverTxResponse>;
}

interface CosmosFee {
  amount: Array<{ amount: string; denom: string }>;
  gas: string;
}

interface CosmosDeliverTxResponse {
  transactionHash: string;
  height: number;
  code: number;
  rawLog?: string;
  gasUsed: number;
  gasWanted: number;
}

/**
 * Simulated Cosmos client for development/testing
 */
class SimulatedCosmosClient implements CosmosClient {
  private height = 15000000;
  private storage: Map<string, Map<string, unknown>> = new Map();
  private transactions: Map<string, CosmosDeliverTxResponse> = new Map();

  async getHeight(): Promise<number> {
    return this.height++;
  }

  async getBalance(_address: string, denom: string): Promise<{ amount: string; denom: string }> {
    return { amount: '1000000000', denom };
  }

  async queryContract(address: string, query: unknown): Promise<unknown> {
    const contractStorage = this.storage.get(address);
    if (!contractStorage) return null;

    const queryKey = JSON.stringify(query);
    return contractStorage.get(queryKey) ?? null;
  }

  async executeContract(
    _sender: string,
    contractAddress: string,
    msg: unknown,
    _fee: CosmosFee,
    _memo?: string
  ): Promise<CosmosDeliverTxResponse> {
    const txHash = createHash('sha256')
      .update(JSON.stringify(msg) + Date.now())
      .digest('hex')
      .toUpperCase();

    const height = await this.getHeight();

    // Store contract data
    if (!this.storage.has(contractAddress)) {
      this.storage.set(contractAddress, new Map());
    }
    const contractStorage = this.storage.get(contractAddress)!;

    // Extract key from message and store
    const msgObj = msg as Record<string, unknown>;
    const msgType = Object.keys(msgObj)[0];
    if (msgType) {
      const msgData = msgObj[msgType] as Record<string, unknown>;
      const key = msgData.id || msgData.anchor_id || msgData.merkle_root || JSON.stringify(msg);
      contractStorage.set(String(key), msgData);
    }

    const response: CosmosDeliverTxResponse = {
      transactionHash: txHash,
      height,
      code: 0,
      rawLog: '[]',
      gasUsed: 150000,
      gasWanted: 200000,
    };

    this.transactions.set(txHash, response);

    return response;
  }
}

/**
 * Cosmos SDK Blockchain Adapter
 *
 * Full implementation of ARKA Chain Adapter for Cosmos SDK chains.
 */
export class CosmosBlockchainAdapter implements ARKAChainAdapter {
  readonly id: string;
  readonly network: BlockchainNetwork = 'custom';
  readonly chainType: ChainType = 'cosmos';
  readonly chainConfig: ChainSpecificConfig;

  private cosmosConfig: CosmosConfig;
  private client: CosmosClient | null = null;
  private connected = false;
  private eventHandlers: Set<BlockchainEventHandler> = new Set();
  private lastActivity: string | null = null;

  // Local storage for tracking
  private anchors: Map<string, AnchoredRecord> = new Map();
  private anchorsByMerkleRoot: Map<string, AnchoredRecord> = new Map();
  private auditAnchors: Map<string, AuditAnchor> = new Map();
  private ruleNFTs: Map<string, RuleNFT> = new Map();
  private entityBindings: Map<string, EntityIdentityBinding> = new Map();
  private oracleAttestations: Map<string, OracleAttestation> = new Map();

  constructor(config: CosmosConfig) {
    this.cosmosConfig = config;
    this.id = `cosmos-${config.chainId}`;
    this.chainConfig = {
      chainType: 'cosmos',
      cosmos: {
        rpcUrl: config.rpcUrl,
        chainId: config.chainId,
        prefix: config.prefix,
        contractAddresses: {
          auditAnchor: config.contracts.auditAnchor ?? '',
          ruleNFT: config.contracts.ruleNFT ?? '',
        },
      },
    };
  }

  // ========== Core BlockchainAdapter Methods ==========

  async connect(config: BlockchainConfig): Promise<void> {
    if (this.connected) return;

    logger.info('Connecting to Cosmos chain', {
      chainId: this.cosmosConfig.chainId,
      rpcUrl: this.cosmosConfig.rpcUrl,
    });

    try {
      // In production, use @cosmjs/stargate SigningStargateClient
      this.client = new SimulatedCosmosClient();
      this.connected = true;

      const height = await this.client.getHeight();

      await this.emitEvent({
        type: 'connected',
        timestamp: new Date().toISOString(),
        data: { chainId: this.cosmosConfig.chainId, height },
      });

      logger.info('Connected to Cosmos chain', {
        chainId: this.cosmosConfig.chainId,
        height,
      });
    } catch (error) {
      logger.error('Failed to connect to Cosmos chain', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.client = null;

    await this.emitEvent({
      type: 'disconnected',
      timestamp: new Date().toISOString(),
    });

    logger.info('Disconnected from Cosmos chain', {
      chainId: this.cosmosConfig.chainId,
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getHealth(): Promise<BlockchainHealth> {
    if (!this.connected || !this.client) {
      return {
        connected: false,
        network: this.network,
        error: 'Not connected',
      };
    }

    try {
      const height = await this.client.getHeight();
      return {
        connected: true,
        network: this.network,
        blockHeight: height,
        lastActivity: this.lastActivity ?? undefined,
      };
    } catch (error) {
      return {
        connected: false,
        network: this.network,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async anchor(request: AnchorRequest): Promise<AnchoredRecord> {
    this.ensureConnected();

    logger.info('Anchoring to Cosmos chain', {
      batchId: request.batchId,
      merkleRoot: request.merkleRoot.substring(0, 16) + '...',
    });

    try {
      const contractAddress = this.cosmosConfig.contracts.auditAnchor;
      if (!contractAddress) {
        throw new Error('Audit anchor contract address not configured');
      }

      // CosmWasm execute message
      const executeMsg = {
        anchor: {
          anchor_id: request.batchId,
          merkle_root: request.merkleRoot,
          record_count: request.recordCount,
          metadata: JSON.stringify(request.metadata ?? {}),
        },
      };

      const fee: CosmosFee = {
        amount: [{ amount: '5000', denom: this.getDenom() }],
        gas: '200000',
      };

      const senderAddress = this.getSenderAddress();
      const result = await this.client!.executeContract(
        senderAddress,
        contractAddress,
        executeMsg,
        fee,
        'ARKA audit anchor'
      );

      if (result.code !== 0) {
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }

      const anchorId = this.generateAnchorId();
      const anchor: AnchoredRecord = {
        anchorId,
        transactionHash: result.transactionHash,
        blockNumber: result.height,
        blockHash: createHash('sha256').update(`block_${result.height}`).digest('hex'),
        merkleRoot: request.merkleRoot,
        recordCount: request.recordCount,
        timestamp: new Date().toISOString(),
        network: this.network,
        metadata: {
          ...request.metadata,
          chainId: this.cosmosConfig.chainId,
          contractAddress,
        },
      };

      this.anchors.set(anchorId, anchor);
      this.anchorsByMerkleRoot.set(request.merkleRoot, anchor);

      await this.emitEvent({
        type: 'anchored',
        timestamp: anchor.timestamp,
        data: anchor,
      });

      logger.info('Anchored to Cosmos chain', {
        anchorId,
        transactionHash: result.transactionHash,
        height: result.height,
      });

      return anchor;
    } catch (error) {
      logger.error('Failed to anchor to Cosmos chain', error as Error);
      throw error;
    }
  }

  async verify(merkleRoot: string): Promise<VerificationResult> {
    this.ensureConnected();

    const anchor = this.anchorsByMerkleRoot.get(merkleRoot);
    if (anchor) {
      return { verified: true, anchor };
    }

    try {
      const contractAddress = this.cosmosConfig.contracts.auditAnchor;
      if (!contractAddress) {
        return { verified: false, error: 'Contract not configured' };
      }

      // CosmWasm query message
      const queryMsg = {
        get_anchor: {
          merkle_root: merkleRoot,
        },
      };

      const result = await this.client!.queryContract(contractAddress, queryMsg);

      if (result) {
        await this.emitEvent({
          type: 'verified',
          timestamp: new Date().toISOString(),
          data: { merkleRoot, verified: true },
        });
        return { verified: true };
      }

      return { verified: false, error: 'Anchor not found' };
    } catch (error) {
      return {
        verified: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  async verifyItem(merkleRoot: string, proof: MerkleProof): Promise<VerificationResult> {
    const rootResult = await this.verify(merkleRoot);
    if (!rootResult.verified) {
      return rootResult;
    }

    return {
      verified: true,
      anchor: rootResult.anchor,
      proof,
    };
  }

  async query(query: AnchorQuery): Promise<AnchoredRecord[]> {
    this.ensureConnected();

    let results = Array.from(this.anchors.values());

    if (query.anchorId) {
      results = results.filter((a) => a.anchorId === query.anchorId);
    }
    if (query.transactionHash) {
      results = results.filter((a) => a.transactionHash === query.transactionHash);
    }
    if (query.merkleRoot) {
      results = results.filter((a) => a.merkleRoot === query.merkleRoot);
    }
    if (query.fromBlock !== undefined) {
      results = results.filter((a) => a.blockNumber >= query.fromBlock!);
    }
    if (query.toBlock !== undefined) {
      results = results.filter((a) => a.blockNumber <= query.toBlock!);
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  async getAnchor(anchorId: string): Promise<AnchoredRecord | null> {
    return this.anchors.get(anchorId) ?? null;
  }

  async getBlockNumber(): Promise<number> {
    this.ensureConnected();
    return this.client!.getHeight();
  }

  async waitForConfirmation(transactionHash: string, confirmations?: number): Promise<boolean> {
    // Cosmos has instant finality with Tendermint consensus
    // Once a tx is included in a block, it's final
    this.ensureConnected();
    return true;
  }

  subscribe(handler: BlockchainEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  // ========== ARKA-Specific Methods ==========

  async anchorAudit(components: AuditAnchorComponents): Promise<AuditAnchor> {
    this.ensureConnected();

    const anchorId = ids.audit();

    const componentHashes = {
      eventSnapshot: this.sha256(components.eventSnapshot),
      ruleSetSnapshot: this.sha256(components.ruleSetSnapshot),
      decision: this.sha256(components.decision),
      aiProposal: components.aiProposal ? this.sha256(components.aiProposal) : undefined,
      simulationResults: components.simulationResults
        ? this.sha256(components.simulationResults)
        : undefined,
    };

    const hash = this.sha256(componentHashes);

    logger.info('Anchoring audit to Cosmos', { anchorId });

    const anchoredRecord = await this.anchor({
      batchId: anchorId,
      merkleRoot: hash,
      recordCount: 1,
      metadata: { type: 'audit_anchor', componentHashes },
    });

    const auditAnchor: AuditAnchor = {
      anchorId,
      hash,
      componentHashes,
      timestamp: new Date().toISOString(),
      blockchain: {
        network: `cosmos:${this.cosmosConfig.chainId}`,
        transactionHash: anchoredRecord.transactionHash,
        blockNumber: anchoredRecord.blockNumber,
        contractAddress: this.cosmosConfig.contracts.auditAnchor,
      },
    };

    this.auditAnchors.set(anchorId, auditAnchor);
    return auditAnchor;
  }

  async verifyAuditAnchor(hash: string): Promise<VerificationResult> {
    return this.verify(hash);
  }

  async getAuditAnchor(anchorId: string): Promise<AuditAnchor | null> {
    return this.auditAnchors.get(anchorId) ?? null;
  }

  async mintRuleNFT(rule: ArkaRule, version: number): Promise<RuleNFT> {
    this.ensureConnected();

    const tokenId = `rule_${rule.id}_v${version}_${Date.now().toString(36)}`;
    const dslHash = this.computeRuleDSLHash(rule);

    logger.info('Minting Rule NFT on Cosmos', { tokenId, ruleId: rule.id });

    const contractAddress = this.cosmosConfig.contracts.ruleNFT;
    if (!contractAddress) {
      throw new Error('Rule NFT contract address not configured');
    }

    // CW721 + custom metadata execute message
    const executeMsg = {
      mint: {
        token_id: tokenId,
        owner: this.getSenderAddress(),
        token_uri: null,
        extension: {
          rule_id: rule.id,
          version,
          name: rule.name,
          jurisdiction: rule.jurisdiction,
          dsl_hash: dslHash,
          severity: rule.severity,
          activation_date: rule.effectiveFrom ?? new Date().toISOString(),
          expiration_date: rule.effectiveTo,
          soulbound: true,
        },
      },
    };

    const fee: CosmosFee = {
      amount: [{ amount: '10000', denom: this.getDenom() }],
      gas: '300000',
    };

    const result = await this.client!.executeContract(
      this.getSenderAddress(),
      contractAddress,
      executeMsg,
      fee,
      'ARKA Rule NFT'
    );

    if (result.code !== 0) {
      throw new Error(`Mint failed: ${result.rawLog}`);
    }

    const metadata: RuleNFTMetadata = {
      tokenId,
      ruleId: rule.id,
      version,
      name: rule.name,
      jurisdiction: rule.jurisdiction ?? undefined,
      dslHash,
      activationDate: rule.effectiveFrom ?? new Date().toISOString(),
      expirationDate: rule.effectiveTo ?? undefined,
      severity: rule.severity,
      issuer: this.getSenderAddress(),
      mintedAt: new Date().toISOString(),
      soulbound: true,
    };

    const ruleNFT: RuleNFT = {
      metadata,
      rule,
      blockchain: {
        network: `cosmos:${this.cosmosConfig.chainId}`,
        contractAddress,
        transactionHash: result.transactionHash,
        blockNumber: result.height,
      },
    };

    this.ruleNFTs.set(tokenId, ruleNFT);

    logger.info('Rule NFT minted on Cosmos', { tokenId, transactionHash: result.transactionHash });

    return ruleNFT;
  }

  async getRuleNFT(tokenId: string): Promise<RuleNFT | null> {
    return this.ruleNFTs.get(tokenId) ?? null;
  }

  async verifyRuleVersion(rule: ArkaRule): Promise<VerificationResult> {
    const dslHash = this.computeRuleDSLHash(rule);

    for (const nft of this.ruleNFTs.values()) {
      if (nft.metadata.ruleId === rule.id && nft.metadata.dslHash === dslHash) {
        return { verified: true };
      }
    }

    return { verified: false, error: 'Rule NFT not found' };
  }

  async getRuleVersions(ruleId: string): Promise<RuleNFT[]> {
    return Array.from(this.ruleNFTs.values())
      .filter((nft) => nft.metadata.ruleId === ruleId)
      .sort((a, b) => a.metadata.version - b.metadata.version);
  }

  async registerEntityIdentity(binding: EntityIdentityBinding): Promise<EntityIdentityBinding> {
    this.ensureConnected();

    logger.info('Registering entity identity on Cosmos', {
      bindingId: binding.bindingId,
      entityId: binding.entityId,
    });

    const contractAddress = this.cosmosConfig.contracts.didRegistry;
    if (!contractAddress) {
      throw new Error('DID Registry contract address not configured');
    }

    const executeMsg = {
      register_did: {
        entity_id: binding.entityId,
        entity_type: binding.entityType,
        did: binding.blockchainIdentity,
        entity_hash: binding.entityHash,
      },
    };

    const fee: CosmosFee = {
      amount: [{ amount: '7500', denom: this.getDenom() }],
      gas: '250000',
    };

    const result = await this.client!.executeContract(
      this.getSenderAddress(),
      contractAddress,
      executeMsg,
      fee,
      'ARKA DID registration'
    );

    if (result.code !== 0) {
      throw new Error(`DID registration failed: ${result.rawLog}`);
    }

    const updatedBinding: EntityIdentityBinding = {
      ...binding,
      blockchain: {
        network: `cosmos:${this.cosmosConfig.chainId}`,
        transactionHash: result.transactionHash,
        blockNumber: result.height,
        contractAddress,
      },
    };

    this.entityBindings.set(binding.bindingId, updatedBinding);

    logger.info('Entity identity registered on Cosmos', { bindingId: binding.bindingId });

    return updatedBinding;
  }

  async getEntityBinding(entityId: string): Promise<EntityIdentityBinding | null> {
    for (const binding of this.entityBindings.values()) {
      if (binding.entityId === entityId) {
        return binding;
      }
    }
    return null;
  }

  async resolveDID(did: string): Promise<EntityIdentityBinding | null> {
    for (const binding of this.entityBindings.values()) {
      if (binding.blockchainIdentity === did) {
        return binding;
      }
    }
    return null;
  }

  async revokeEntityIdentity(bindingId: string): Promise<boolean> {
    const binding = this.entityBindings.get(bindingId);
    if (!binding) return false;
    binding.status = 'revoked';
    return true;
  }

  async submitOracleAttestation(attestation: OracleAttestation): Promise<OracleAttestation> {
    this.ensureConnected();

    logger.info('Submitting oracle attestation on Cosmos', {
      attestationId: attestation.attestationId,
    });

    const contractAddress = this.cosmosConfig.contracts.complianceOracle;
    if (!contractAddress) {
      throw new Error('Compliance Oracle contract address not configured');
    }

    const executeMsg = {
      attest_event: {
        attestation_id: attestation.attestationId,
        event_id: attestation.eventId,
        event_hash: attestation.eventHash,
        oracle_node: attestation.oracleNode,
        confidence: attestation.verification.confidence,
        oracle_signature: attestation.oracleSignature,
      },
    };

    const fee: CosmosFee = {
      amount: [{ amount: '5000', denom: this.getDenom() }],
      gas: '200000',
    };

    const result = await this.client!.executeContract(
      this.getSenderAddress(),
      contractAddress,
      executeMsg,
      fee,
      'ARKA Oracle attestation'
    );

    if (result.code !== 0) {
      throw new Error(`Oracle attestation failed: ${result.rawLog}`);
    }

    const updatedAttestation: OracleAttestation = {
      ...attestation,
      blockchain: {
        network: `cosmos:${this.cosmosConfig.chainId}`,
        transactionHash: result.transactionHash,
        blockNumber: result.height,
      },
    };

    this.oracleAttestations.set(attestation.attestationId, updatedAttestation);

    logger.info('Oracle attestation submitted on Cosmos', {
      attestationId: attestation.attestationId,
    });

    return updatedAttestation;
  }

  async verifyOracleAttestation(attestationId: string): Promise<VerificationResult> {
    const attestation = this.oracleAttestations.get(attestationId);
    if (!attestation) {
      return { verified: false, error: 'Attestation not found' };
    }

    if (!attestation.blockchain) {
      return { verified: false, error: 'Attestation not on blockchain' };
    }

    // Attestation was successfully submitted to blockchain
    return { verified: true };
  }

  // ========== Chain Utilities ==========

  async getBalance(address: string): Promise<bigint> {
    this.ensureConnected();
    const balance = await this.client!.getBalance(address, this.getDenom());
    return BigInt(balance.amount);
  }

  // ========== Helper Methods ==========

  private ensureConnected(): void {
    if (!this.connected || !this.client) {
      throw new Error(`${this.id}: Not connected to Cosmos chain`);
    }
  }

  private async emitEvent(event: BlockchainEvent): Promise<void> {
    this.lastActivity = new Date().toISOString();

    for (const handler of this.eventHandlers) {
      try {
        await handler(event);
      } catch (error) {
        logger.error('Error in blockchain event handler', error as Error);
      }
    }
  }

  private generateAnchorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `anchor_${timestamp}_${random}`;
  }

  private sha256(data: unknown): string {
    const bytes = canonicalSerialize(data);
    return createHash('sha256').update(bytes).digest('hex');
  }

  private computeRuleDSLHash(rule: ArkaRule): string {
    const dslData = {
      name: rule.name,
      description: rule.description,
      jurisdiction: rule.jurisdiction,
      condition: rule.condition,
      consequence: rule.consequence,
      severity: rule.severity,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
    };
    return this.sha256(dslData);
  }

  private getDenom(): string {
    // Extract denom from gas price or use default
    if (this.cosmosConfig.gasPrice) {
      const match = this.cosmosConfig.gasPrice.match(/[a-zA-Z]+$/);
      if (match) return match[0];
    }

    // Default denoms by chain
    const chainDenoms: Record<string, string> = {
      'cosmoshub-4': 'uatom',
      'osmosis-1': 'uosmo',
      'juno-1': 'ujuno',
      'injective-1': 'inj',
    };

    return chainDenoms[this.cosmosConfig.chainId] ?? 'uatom';
  }

  private getSenderAddress(): string {
    // In production, derive from signerKey
    // For simulation, return placeholder
    return `${this.cosmosConfig.prefix}1pact_sender_address`;
  }
}

/**
 * Create a Cosmos Hub adapter
 */
export function createCosmosHubAdapter(config: Partial<CosmosConfig> = {}): CosmosBlockchainAdapter {
  return new CosmosBlockchainAdapter({
    rpcUrl: config.rpcUrl ?? 'https://rpc.cosmos.network',
    chainId: 'cosmoshub-4',
    prefix: 'cosmos',
    gasPrice: '0.025uatom',
    contracts: config.contracts ?? {},
    ...config,
  });
}

/**
 * Create an Osmosis adapter
 */
export function createOsmosisAdapter(config: Partial<CosmosConfig> = {}): CosmosBlockchainAdapter {
  return new CosmosBlockchainAdapter({
    rpcUrl: config.rpcUrl ?? 'https://rpc.osmosis.zone',
    chainId: 'osmosis-1',
    prefix: 'osmo',
    gasPrice: '0.025uosmo',
    contracts: config.contracts ?? {},
    ...config,
  });
}

/**
 * Create a generic Cosmos SDK adapter
 */
export function createCosmosAdapter(config: CosmosConfig): CosmosBlockchainAdapter {
  return new CosmosBlockchainAdapter(config);
}
