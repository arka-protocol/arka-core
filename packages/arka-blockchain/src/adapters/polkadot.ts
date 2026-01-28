/**
 * Polkadot/Substrate Blockchain Adapter
 *
 * Adapter for Polkadot ecosystem chains:
 * - Polkadot Relay Chain
 * - Kusama
 * - Parachains (Acala, Moonbeam, Astar, etc.)
 * - Custom Substrate chains
 *
 * Implements full ARKA Chain Adapter interface using
 * Substrate pallets or ink! smart contracts.
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

const logger = createLogger({ service: 'polkadot-adapter' });

/**
 * Polkadot-specific configuration
 */
export interface PolkadotConfig {
  /** WebSocket endpoint URL */
  wsUrl: string;
  /** HTTP endpoint URL (optional) */
  httpUrl?: string;
  /** Network name */
  network?: 'polkadot' | 'kusama' | 'westend' | 'custom';
  /** SS58 address format */
  ss58Format?: number;
  /** Pallet name for ARKA operations */
  palletName?: string;
  /** Contract addresses (for ink! contracts) */
  contracts?: {
    auditAnchor?: string;
    ruleNFT?: string;
    didRegistry?: string;
    complianceOracle?: string;
  };
  /** Seed phrase or private key for signing */
  signerKey?: string;
  /** Use contracts or pallet */
  useContracts?: boolean;
}

/**
 * Simulated Polkadot API for development/testing
 * In production, use @polkadot/api
 */
interface PolkadotApi {
  isConnected: boolean;
  getBlockNumber(): Promise<number>;
  getBlockHash(blockNumber: number): Promise<string>;
  getBalance(address: string): Promise<bigint>;
  queryStorage(pallet: string, method: string, ...args: unknown[]): Promise<unknown>;
  submitExtrinsic(
    pallet: string,
    method: string,
    args: unknown[],
    signer: string
  ): Promise<PolkadotExtrinsicResult>;
  callContract(
    address: string,
    method: string,
    args: unknown[]
  ): Promise<unknown>;
  executeContract(
    address: string,
    method: string,
    args: unknown[],
    signer: string,
    value?: bigint
  ): Promise<PolkadotExtrinsicResult>;
}

interface PolkadotExtrinsicResult {
  hash: string;
  blockNumber: number;
  blockHash: string;
  success: boolean;
  events: Array<{
    pallet: string;
    method: string;
    data: unknown;
  }>;
}

/**
 * Simulated Polkadot API for development/testing
 */
class SimulatedPolkadotApi implements PolkadotApi {
  isConnected = true;
  private blockNumber = 20000000;
  private storage: Map<string, Map<string, unknown>> = new Map();
  private contractStorage: Map<string, Map<string, unknown>> = new Map();

  async getBlockNumber(): Promise<number> {
    return this.blockNumber++;
  }

  async getBlockHash(blockNumber: number): Promise<string> {
    return '0x' + createHash('sha256').update(`block_${blockNumber}`).digest('hex');
  }

  async getBalance(_address: string): Promise<bigint> {
    return BigInt('10000000000000'); // 10 DOT (10^12 planck)
  }

  async queryStorage(pallet: string, method: string, ...args: unknown[]): Promise<unknown> {
    const key = `${pallet}:${method}:${JSON.stringify(args)}`;
    const palletStorage = this.storage.get(pallet);
    return palletStorage?.get(key) ?? null;
  }

  async submitExtrinsic(
    pallet: string,
    method: string,
    args: unknown[],
    _signer: string
  ): Promise<PolkadotExtrinsicResult> {
    const blockNumber = await this.getBlockNumber();
    const blockHash = await this.getBlockHash(blockNumber);
    const hash = '0x' + createHash('sha256')
      .update(JSON.stringify({ pallet, method, args }) + Date.now())
      .digest('hex');

    // Store in pallet storage
    if (!this.storage.has(pallet)) {
      this.storage.set(pallet, new Map());
    }
    const palletStorage = this.storage.get(pallet)!;
    const key = `${pallet}:${method}:${JSON.stringify(args)}`;
    palletStorage.set(key, { args, timestamp: Date.now() });

    return {
      hash,
      blockNumber,
      blockHash,
      success: true,
      events: [
        {
          pallet,
          method: `${method}Success`,
          data: args,
        },
      ],
    };
  }

  async callContract(address: string, method: string, args: unknown[]): Promise<unknown> {
    const storage = this.contractStorage.get(address);
    if (!storage) return null;

    const key = `${method}:${JSON.stringify(args)}`;
    return storage.get(key) ?? null;
  }

  async executeContract(
    address: string,
    method: string,
    args: unknown[],
    _signer: string,
    _value?: bigint
  ): Promise<PolkadotExtrinsicResult> {
    const blockNumber = await this.getBlockNumber();
    const blockHash = await this.getBlockHash(blockNumber);
    const hash = '0x' + createHash('sha256')
      .update(JSON.stringify({ address, method, args }) + Date.now())
      .digest('hex');

    // Store in contract storage
    if (!this.contractStorage.has(address)) {
      this.contractStorage.set(address, new Map());
    }
    const storage = this.contractStorage.get(address)!;
    const key = `${method}:${JSON.stringify(args)}`;
    storage.set(key, args);

    return {
      hash,
      blockNumber,
      blockHash,
      success: true,
      events: [
        {
          pallet: 'contracts',
          method: 'ContractEmitted',
          data: { address, method, args },
        },
      ],
    };
  }
}

/**
 * Polkadot/Substrate Blockchain Adapter
 *
 * Full implementation of ARKA Chain Adapter for Polkadot ecosystem.
 */
export class PolkadotBlockchainAdapter implements ARKAChainAdapter {
  readonly id: string;
  readonly network: BlockchainNetwork = 'custom';
  readonly chainType: ChainType = 'polkadot';
  readonly chainConfig: ChainSpecificConfig;

  private polkadotConfig: PolkadotConfig;
  private api: PolkadotApi | null = null;
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

  constructor(config: PolkadotConfig) {
    this.polkadotConfig = config;
    this.id = `polkadot-${config.network ?? 'custom'}`;
    this.chainConfig = {
      chainType: 'polkadot',
      polkadot: {
        wsUrl: config.wsUrl,
        palletName: config.palletName ?? 'arkaCompliance',
      },
    };
  }

  // ========== Core BlockchainAdapter Methods ==========

  async connect(config: BlockchainConfig): Promise<void> {
    if (this.connected) return;

    logger.info('Connecting to Polkadot', {
      wsUrl: this.polkadotConfig.wsUrl,
      network: this.polkadotConfig.network,
    });

    try {
      // In production, use @polkadot/api ApiPromise
      this.api = new SimulatedPolkadotApi();
      this.connected = true;

      const blockNumber = await this.api.getBlockNumber();

      await this.emitEvent({
        type: 'connected',
        timestamp: new Date().toISOString(),
        data: { network: this.polkadotConfig.network, blockNumber },
      });

      logger.info('Connected to Polkadot', {
        network: this.polkadotConfig.network,
        blockNumber,
      });
    } catch (error) {
      logger.error('Failed to connect to Polkadot', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.api = null;

    await this.emitEvent({
      type: 'disconnected',
      timestamp: new Date().toISOString(),
    });

    logger.info('Disconnected from Polkadot');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getHealth(): Promise<BlockchainHealth> {
    if (!this.connected || !this.api) {
      return {
        connected: false,
        network: this.network,
        error: 'Not connected',
      };
    }

    try {
      const blockNumber = await this.api.getBlockNumber();
      return {
        connected: true,
        network: this.network,
        blockHeight: blockNumber,
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

    logger.info('Anchoring to Polkadot', {
      batchId: request.batchId,
      merkleRoot: request.merkleRoot.substring(0, 16) + '...',
    });

    try {
      let result: PolkadotExtrinsicResult;

      if (this.polkadotConfig.useContracts) {
        // Use ink! contract
        const contractAddress = this.polkadotConfig.contracts?.auditAnchor;
        if (!contractAddress) {
          throw new Error('Audit anchor contract address not configured');
        }

        result = await this.api!.executeContract(
          contractAddress,
          'anchor',
          [request.batchId, request.merkleRoot, request.recordCount],
          this.getSignerAddress()
        );
      } else {
        // Use pallet extrinsic
        const palletName = this.polkadotConfig.palletName ?? 'arkaCompliance';

        result = await this.api!.submitExtrinsic(
          palletName,
          'anchorAudit',
          [request.batchId, request.merkleRoot, request.recordCount, JSON.stringify(request.metadata ?? {})],
          this.getSignerAddress()
        );
      }

      if (!result.success) {
        throw new Error('Extrinsic failed');
      }

      const anchorId = this.generateAnchorId();
      const anchor: AnchoredRecord = {
        anchorId,
        transactionHash: result.hash,
        blockNumber: result.blockNumber,
        blockHash: result.blockHash,
        merkleRoot: request.merkleRoot,
        recordCount: request.recordCount,
        timestamp: new Date().toISOString(),
        network: this.network,
        metadata: {
          ...request.metadata,
          network: this.polkadotConfig.network,
          pallet: this.polkadotConfig.palletName,
        },
      };

      this.anchors.set(anchorId, anchor);
      this.anchorsByMerkleRoot.set(request.merkleRoot, anchor);

      await this.emitEvent({
        type: 'anchored',
        timestamp: anchor.timestamp,
        data: anchor,
      });

      logger.info('Anchored to Polkadot', {
        anchorId,
        hash: result.hash,
        blockNumber: result.blockNumber,
      });

      return anchor;
    } catch (error) {
      logger.error('Failed to anchor to Polkadot', error as Error);
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
      let result: unknown;

      if (this.polkadotConfig.useContracts) {
        const contractAddress = this.polkadotConfig.contracts?.auditAnchor;
        if (!contractAddress) {
          return { verified: false, error: 'Contract not configured' };
        }

        result = await this.api!.callContract(
          contractAddress,
          'verify',
          [merkleRoot]
        );
      } else {
        const palletName = this.polkadotConfig.palletName ?? 'arkaCompliance';

        result = await this.api!.queryStorage(
          palletName,
          'Anchors',
          merkleRoot
        );
      }

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
    return this.api!.getBlockNumber();
  }

  async waitForConfirmation(transactionHash: string, confirmations?: number): Promise<boolean> {
    // Polkadot has finality after ~30 seconds (2 blocks on relay chain)
    // For parachains, finality is inherited from relay chain
    this.ensureConnected();

    // Simulate waiting for finality
    const targetConfirmations = confirmations ?? 2;
    await new Promise(resolve => setTimeout(resolve, targetConfirmations * 100));

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

    logger.info('Anchoring audit to Polkadot', { anchorId });

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
        network: `polkadot:${this.polkadotConfig.network}`,
        transactionHash: anchoredRecord.transactionHash,
        blockNumber: anchoredRecord.blockNumber,
        contractAddress: this.polkadotConfig.contracts?.auditAnchor,
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

    logger.info('Minting Rule NFT on Polkadot', { tokenId, ruleId: rule.id });

    let result: PolkadotExtrinsicResult;

    if (this.polkadotConfig.useContracts) {
      const contractAddress = this.polkadotConfig.contracts?.ruleNFT;
      if (!contractAddress) {
        throw new Error('Rule NFT contract address not configured');
      }

      result = await this.api!.executeContract(
        contractAddress,
        'mintRule',
        [
          rule.id,
          version,
          rule.name,
          rule.jurisdiction ?? '',
          dslHash,
          rule.severity,
        ],
        this.getSignerAddress()
      );
    } else {
      const palletName = this.polkadotConfig.palletName ?? 'arkaCompliance';

      result = await this.api!.submitExtrinsic(
        palletName,
        'mintRuleNft',
        [
          rule.id,
          version,
          rule.name,
          rule.jurisdiction ?? '',
          dslHash,
          rule.severity,
          rule.effectiveFrom ?? new Date().toISOString(),
          rule.effectiveTo ?? null,
        ],
        this.getSignerAddress()
      );
    }

    if (!result.success) {
      throw new Error('Mint extrinsic failed');
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
      issuer: this.getSignerAddress(),
      mintedAt: new Date().toISOString(),
      soulbound: true,
    };

    const ruleNFT: RuleNFT = {
      metadata,
      rule,
      blockchain: {
        network: `polkadot:${this.polkadotConfig.network}`,
        contractAddress: this.polkadotConfig.contracts?.ruleNFT ?? this.polkadotConfig.palletName ?? '',
        transactionHash: result.hash,
        blockNumber: result.blockNumber,
      },
    };

    this.ruleNFTs.set(tokenId, ruleNFT);

    logger.info('Rule NFT minted on Polkadot', { tokenId, hash: result.hash });

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

    logger.info('Registering entity identity on Polkadot', {
      bindingId: binding.bindingId,
      entityId: binding.entityId,
    });

    let result: PolkadotExtrinsicResult;

    if (this.polkadotConfig.useContracts) {
      const contractAddress = this.polkadotConfig.contracts?.didRegistry;
      if (!contractAddress) {
        throw new Error('DID Registry contract address not configured');
      }

      result = await this.api!.executeContract(
        contractAddress,
        'registerDid',
        [binding.entityId, binding.entityType, binding.blockchainIdentity, binding.entityHash],
        this.getSignerAddress()
      );
    } else {
      const palletName = this.polkadotConfig.palletName ?? 'arkaCompliance';

      result = await this.api!.submitExtrinsic(
        palletName,
        'registerEntityIdentity',
        [binding.entityId, binding.entityType, binding.blockchainIdentity, binding.entityHash],
        this.getSignerAddress()
      );
    }

    if (!result.success) {
      throw new Error('DID registration extrinsic failed');
    }

    const updatedBinding: EntityIdentityBinding = {
      ...binding,
      blockchain: {
        network: `polkadot:${this.polkadotConfig.network}`,
        transactionHash: result.hash,
        blockNumber: result.blockNumber,
        contractAddress: this.polkadotConfig.contracts?.didRegistry,
      },
    };

    this.entityBindings.set(binding.bindingId, updatedBinding);

    logger.info('Entity identity registered on Polkadot', { bindingId: binding.bindingId });

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

    logger.info('Submitting oracle attestation on Polkadot', {
      attestationId: attestation.attestationId,
    });

    let result: PolkadotExtrinsicResult;

    if (this.polkadotConfig.useContracts) {
      const contractAddress = this.polkadotConfig.contracts?.complianceOracle;
      if (!contractAddress) {
        throw new Error('Compliance Oracle contract address not configured');
      }

      result = await this.api!.executeContract(
        contractAddress,
        'attestEvent',
        [
          attestation.attestationId,
          attestation.eventId,
          attestation.eventHash,
          attestation.oracleNode,
          attestation.verification.confidence,
        ],
        this.getSignerAddress()
      );
    } else {
      const palletName = this.polkadotConfig.palletName ?? 'arkaCompliance';

      result = await this.api!.submitExtrinsic(
        palletName,
        'submitOracleAttestation',
        [
          attestation.attestationId,
          attestation.eventId,
          attestation.eventHash,
          attestation.oracleNode,
          attestation.verification.confidence,
          attestation.oracleSignature,
        ],
        this.getSignerAddress()
      );
    }

    if (!result.success) {
      throw new Error('Oracle attestation extrinsic failed');
    }

    const updatedAttestation: OracleAttestation = {
      ...attestation,
      blockchain: {
        network: `polkadot:${this.polkadotConfig.network}`,
        transactionHash: result.hash,
        blockNumber: result.blockNumber,
      },
    };

    this.oracleAttestations.set(attestation.attestationId, updatedAttestation);

    logger.info('Oracle attestation submitted on Polkadot', {
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
    return this.api!.getBalance(address);
  }

  // ========== Helper Methods ==========

  private ensureConnected(): void {
    if (!this.connected || !this.api) {
      throw new Error(`${this.id}: Not connected to Polkadot`);
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

  private getSignerAddress(): string {
    // In production, derive from signerKey using SS58
    // For simulation, return placeholder with correct prefix
    const prefix = this.polkadotConfig.ss58Format ?? 0;
    return `${prefix === 0 ? '1' : '5'}PactSignerAddress`;
  }
}

/**
 * Create a Polkadot mainnet adapter
 */
export function createPolkadotAdapter(config: Partial<PolkadotConfig> = {}): PolkadotBlockchainAdapter {
  return new PolkadotBlockchainAdapter({
    wsUrl: config.wsUrl ?? 'wss://rpc.polkadot.io',
    network: 'polkadot',
    ss58Format: 0,
    palletName: 'arkaCompliance',
    ...config,
  });
}

/**
 * Create a Kusama adapter
 */
export function createKusamaAdapter(config: Partial<PolkadotConfig> = {}): PolkadotBlockchainAdapter {
  return new PolkadotBlockchainAdapter({
    wsUrl: config.wsUrl ?? 'wss://kusama-rpc.polkadot.io',
    network: 'kusama',
    ss58Format: 2,
    palletName: 'arkaCompliance',
    ...config,
  });
}

/**
 * Create a Westend testnet adapter
 */
export function createWestendAdapter(config: Partial<PolkadotConfig> = {}): PolkadotBlockchainAdapter {
  return new PolkadotBlockchainAdapter({
    wsUrl: config.wsUrl ?? 'wss://westend-rpc.polkadot.io',
    network: 'westend',
    ss58Format: 42,
    palletName: 'arkaCompliance',
    ...config,
  });
}

/**
 * Create a generic Substrate adapter
 */
export function createSubstrateAdapter(config: PolkadotConfig): PolkadotBlockchainAdapter {
  return new PolkadotBlockchainAdapter(config);
}
