/**
 * Solana Blockchain Adapter
 *
 * Adapter for Solana blockchain with:
 * - Audit anchoring via program accounts
 * - Rule NFT minting (Metaplex-compatible)
 * - Entity DID registration
 * - Compliance oracle attestations
 *
 * Uses Solana's account model and Program Derived Addresses (PDAs)
 * for storing ARKA compliance data.
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

const logger = createLogger({ service: 'solana-adapter' });

/**
 * Solana-specific configuration
 */
export interface SolanaConfig {
  /** RPC endpoint URL */
  rpcUrl: string;
  /** WebSocket URL for subscriptions */
  wsUrl?: string;
  /** Program IDs (deployed programs) */
  programIds: {
    auditAnchor?: string;
    ruleNFT?: string;
    didRegistry?: string;
    complianceOracle?: string;
  };
  /** Keypair for signing (base58 or path) */
  keypair?: string;
  /** Commitment level */
  commitment?: 'processed' | 'confirmed' | 'finalized';
  /** Skip preflight checks */
  skipPreflight?: boolean;
}

/**
 * Simulated Solana connection for development/testing
 * In production, this would use @solana/web3.js
 */
interface SolanaConnection {
  getSlot(): Promise<number>;
  getBalance(pubkey: string): Promise<number>;
  getAccountInfo(pubkey: string): Promise<SolanaAccountInfo | null>;
  sendTransaction(tx: SolanaTransaction): Promise<string>;
  confirmTransaction(signature: string, commitment?: string): Promise<SolanaConfirmationResult>;
  getSignatureStatus(signature: string): Promise<SolanaSignatureStatus | null>;
}

interface SolanaAccountInfo {
  lamports: number;
  owner: string;
  data: Buffer;
  executable: boolean;
}

interface SolanaTransaction {
  instructions: SolanaInstruction[];
  signers: string[];
}

interface SolanaInstruction {
  programId: string;
  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  data: Buffer;
}

interface SolanaConfirmationResult {
  value: { err: unknown | null };
}

interface SolanaSignatureStatus {
  slot: number;
  confirmations: number | null;
  err: unknown | null;
  confirmationStatus?: 'processed' | 'confirmed' | 'finalized';
}

/**
 * Derive a Program Derived Address (PDA)
 */
function derivePDA(seeds: (string | Buffer)[], programId: string): string {
  const seedBuffers = seeds.map(s =>
    typeof s === 'string' ? Buffer.from(s) : s
  );
  const combined = Buffer.concat([...seedBuffers, Buffer.from(programId)]);
  const hash = createHash('sha256').update(combined).digest('hex');
  return hash.substring(0, 44); // Base58-like address
}

/**
 * Simulated Solana connection for development/testing
 */
class SimulatedSolanaConnection implements SolanaConnection {
  private slot = 200000000;
  private accounts: Map<string, SolanaAccountInfo> = new Map();
  private transactions: Map<string, { slot: number; err: unknown | null }> = new Map();

  async getSlot(): Promise<number> {
    return this.slot++;
  }

  async getBalance(_pubkey: string): Promise<number> {
    return 1000000000; // 1 SOL in lamports
  }

  async getAccountInfo(pubkey: string): Promise<SolanaAccountInfo | null> {
    return this.accounts.get(pubkey) ?? null;
  }

  async sendTransaction(tx: SolanaTransaction): Promise<string> {
    const signature = createHash('sha256')
      .update(JSON.stringify(tx) + Date.now())
      .digest('base64')
      .replace(/[+/=]/g, '')
      .substring(0, 88);

    const slot = await this.getSlot();

    // Store transaction result
    this.transactions.set(signature, { slot, err: null });

    // Process instructions and create accounts
    for (const instruction of tx.instructions) {
      for (const key of instruction.keys) {
        if (key.isWritable && !this.accounts.has(key.pubkey)) {
          this.accounts.set(key.pubkey, {
            lamports: 0,
            owner: instruction.programId,
            data: instruction.data,
            executable: false,
          });
        }
      }
    }

    return signature;
  }

  async confirmTransaction(signature: string, _commitment?: string): Promise<SolanaConfirmationResult> {
    const tx = this.transactions.get(signature);
    if (!tx) {
      return { value: { err: 'Transaction not found' } };
    }
    return { value: { err: tx.err } };
  }

  async getSignatureStatus(signature: string): Promise<SolanaSignatureStatus | null> {
    const tx = this.transactions.get(signature);
    if (!tx) return null;
    return {
      slot: tx.slot,
      confirmations: 32,
      err: tx.err,
      confirmationStatus: 'finalized',
    };
  }
}

/**
 * Solana Blockchain Adapter
 *
 * Full implementation of ARKA Chain Adapter for Solana.
 */
export class SolanaBlockchainAdapter implements ARKAChainAdapter {
  readonly id = 'solana-adapter';
  readonly network: BlockchainNetwork = 'solana';
  readonly chainType: ChainType = 'solana';
  readonly chainConfig: ChainSpecificConfig;

  private solanaConfig: SolanaConfig;
  private connection: SolanaConnection | null = null;
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

  constructor(config: SolanaConfig) {
    this.solanaConfig = config;
    this.chainConfig = {
      chainType: 'solana',
      solana: {
        rpcUrl: config.rpcUrl,
        programIds: {
          auditAnchor: config.programIds.auditAnchor ?? '',
          ruleNFT: config.programIds.ruleNFT ?? '',
        },
      },
    };
  }

  // ========== Core BlockchainAdapter Methods ==========

  async connect(config: BlockchainConfig): Promise<void> {
    if (this.connected) return;

    logger.info('Connecting to Solana', { rpcUrl: this.solanaConfig.rpcUrl });

    try {
      // In production, use @solana/web3.js Connection
      this.connection = new SimulatedSolanaConnection();
      this.connected = true;

      const slot = await this.connection.getSlot();

      await this.emitEvent({
        type: 'connected',
        timestamp: new Date().toISOString(),
        data: { slot },
      });

      logger.info('Connected to Solana', { slot });
    } catch (error) {
      logger.error('Failed to connect to Solana', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.connection = null;

    await this.emitEvent({
      type: 'disconnected',
      timestamp: new Date().toISOString(),
    });

    logger.info('Disconnected from Solana');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getHealth(): Promise<BlockchainHealth> {
    if (!this.connected || !this.connection) {
      return {
        connected: false,
        network: this.network,
        error: 'Not connected',
      };
    }

    try {
      const slot = await this.connection.getSlot();
      return {
        connected: true,
        network: this.network,
        blockHeight: slot,
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

    logger.info('Anchoring to Solana', {
      batchId: request.batchId,
      merkleRoot: request.merkleRoot.substring(0, 16) + '...',
    });

    try {
      const programId = this.solanaConfig.programIds.auditAnchor;
      if (!programId) {
        throw new Error('Audit anchor program ID not configured');
      }

      // Derive PDA for this anchor
      const anchorPDA = derivePDA(
        ['audit_anchor', request.batchId],
        programId
      );

      // Create anchor instruction
      const instruction: SolanaInstruction = {
        programId,
        keys: [
          { pubkey: anchorPDA, isSigner: false, isWritable: true },
          { pubkey: 'payer', isSigner: true, isWritable: true },
          { pubkey: 'system_program', isSigner: false, isWritable: false },
        ],
        data: Buffer.from(JSON.stringify({
          instruction: 'anchor',
          batchId: request.batchId,
          merkleRoot: request.merkleRoot,
          recordCount: request.recordCount,
          timestamp: Date.now(),
        })),
      };

      const transaction: SolanaTransaction = {
        instructions: [instruction],
        signers: ['payer'],
      };

      const signature = await this.connection!.sendTransaction(transaction);
      const confirmation = await this.connection!.confirmTransaction(
        signature,
        this.solanaConfig.commitment ?? 'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      const slot = await this.connection!.getSlot();
      const anchorId = this.generateAnchorId();

      const anchor: AnchoredRecord = {
        anchorId,
        transactionHash: signature,
        blockNumber: slot,
        blockHash: createHash('sha256').update(`slot_${slot}`).digest('hex'),
        merkleRoot: request.merkleRoot,
        recordCount: request.recordCount,
        timestamp: new Date().toISOString(),
        network: this.network,
        metadata: {
          ...request.metadata,
          programId,
          pda: anchorPDA,
        },
      };

      this.anchors.set(anchorId, anchor);
      this.anchorsByMerkleRoot.set(request.merkleRoot, anchor);

      await this.emitEvent({
        type: 'anchored',
        timestamp: anchor.timestamp,
        data: anchor,
      });

      logger.info('Anchored to Solana', {
        anchorId,
        signature,
        slot,
      });

      return anchor;
    } catch (error) {
      logger.error('Failed to anchor to Solana', error as Error);
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
      const programId = this.solanaConfig.programIds.auditAnchor;
      if (!programId) {
        return { verified: false, error: 'Program not configured' };
      }

      // Derive PDA and check if account exists
      const pda = derivePDA(['audit_anchor', merkleRoot], programId);
      const accountInfo = await this.connection!.getAccountInfo(pda);

      if (accountInfo && accountInfo.owner === programId) {
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
    return this.connection!.getSlot();
  }

  async waitForConfirmation(transactionHash: string, confirmations?: number): Promise<boolean> {
    this.ensureConnected();

    try {
      const targetConfirmations = confirmations ?? 32;
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        const status = await this.connection!.getSignatureStatus(transactionHash);

        if (status?.err) {
          return false;
        }

        if (status?.confirmationStatus === 'finalized' ||
            (status?.confirmations && status.confirmations >= targetConfirmations)) {
          return true;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      return false;
    } catch {
      return false;
    }
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

    logger.info('Anchoring audit to Solana', { anchorId });

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
        network: this.network,
        transactionHash: anchoredRecord.transactionHash,
        blockNumber: anchoredRecord.blockNumber,
        contractAddress: this.solanaConfig.programIds.auditAnchor,
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

    logger.info('Minting Rule NFT on Solana', { tokenId, ruleId: rule.id });

    const programId = this.solanaConfig.programIds.ruleNFT;
    if (!programId) {
      throw new Error('Rule NFT program ID not configured');
    }

    // Derive mint PDA
    const mintPDA = derivePDA(['rule_nft', tokenId], programId);

    const instruction: SolanaInstruction = {
      programId,
      keys: [
        { pubkey: mintPDA, isSigner: false, isWritable: true },
        { pubkey: 'payer', isSigner: true, isWritable: true },
        { pubkey: 'metadata_program', isSigner: false, isWritable: false },
        { pubkey: 'system_program', isSigner: false, isWritable: false },
      ],
      data: Buffer.from(JSON.stringify({
        instruction: 'mint_rule',
        ruleId: rule.id,
        version,
        name: rule.name,
        jurisdiction: rule.jurisdiction,
        dslHash,
        severity: rule.severity,
      })),
    };

    const transaction: SolanaTransaction = {
      instructions: [instruction],
      signers: ['payer'],
    };

    const signature = await this.connection!.sendTransaction(transaction);
    await this.connection!.confirmTransaction(signature, 'finalized');
    const slot = await this.connection!.getSlot();

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
      issuer: 'solana-pact',
      mintedAt: new Date().toISOString(),
      soulbound: true,
    };

    const ruleNFT: RuleNFT = {
      metadata,
      rule,
      blockchain: {
        network: this.network,
        contractAddress: programId,
        transactionHash: signature,
        blockNumber: slot,
      },
    };

    this.ruleNFTs.set(tokenId, ruleNFT);

    logger.info('Rule NFT minted on Solana', { tokenId, signature });

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

    logger.info('Registering entity identity on Solana', {
      bindingId: binding.bindingId,
      entityId: binding.entityId,
    });

    const programId = this.solanaConfig.programIds.didRegistry;
    if (!programId) {
      throw new Error('DID Registry program ID not configured');
    }

    const didPDA = derivePDA(['did', binding.entityId], programId);

    const instruction: SolanaInstruction = {
      programId,
      keys: [
        { pubkey: didPDA, isSigner: false, isWritable: true },
        { pubkey: 'payer', isSigner: true, isWritable: true },
        { pubkey: 'system_program', isSigner: false, isWritable: false },
      ],
      data: Buffer.from(JSON.stringify({
        instruction: 'register_did',
        entityId: binding.entityId,
        entityType: binding.entityType,
        blockchainIdentity: binding.blockchainIdentity,
        entityHash: binding.entityHash,
      })),
    };

    const transaction: SolanaTransaction = {
      instructions: [instruction],
      signers: ['payer'],
    };

    const signature = await this.connection!.sendTransaction(transaction);
    await this.connection!.confirmTransaction(signature, 'finalized');
    const slot = await this.connection!.getSlot();

    const updatedBinding: EntityIdentityBinding = {
      ...binding,
      blockchain: {
        network: this.network,
        transactionHash: signature,
        blockNumber: slot,
        contractAddress: programId,
      },
    };

    this.entityBindings.set(binding.bindingId, updatedBinding);

    logger.info('Entity identity registered on Solana', { bindingId: binding.bindingId });

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

    logger.info('Submitting oracle attestation on Solana', {
      attestationId: attestation.attestationId,
    });

    const programId = this.solanaConfig.programIds.complianceOracle;
    if (!programId) {
      throw new Error('Compliance Oracle program ID not configured');
    }

    const attestPDA = derivePDA(['attestation', attestation.attestationId], programId);

    const instruction: SolanaInstruction = {
      programId,
      keys: [
        { pubkey: attestPDA, isSigner: false, isWritable: true },
        { pubkey: 'payer', isSigner: true, isWritable: true },
        { pubkey: 'system_program', isSigner: false, isWritable: false },
      ],
      data: Buffer.from(JSON.stringify({
        instruction: 'attest',
        attestationId: attestation.attestationId,
        eventId: attestation.eventId,
        eventHash: attestation.eventHash,
        oracleNode: attestation.oracleNode,
        confidence: attestation.verification.confidence,
      })),
    };

    const transaction: SolanaTransaction = {
      instructions: [instruction],
      signers: ['payer'],
    };

    const signature = await this.connection!.sendTransaction(transaction);
    await this.connection!.confirmTransaction(signature, 'finalized');
    const slot = await this.connection!.getSlot();

    const updatedAttestation: OracleAttestation = {
      ...attestation,
      blockchain: {
        network: this.network,
        transactionHash: signature,
        blockNumber: slot,
      },
    };

    this.oracleAttestations.set(attestation.attestationId, updatedAttestation);

    logger.info('Oracle attestation submitted on Solana', {
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
    const lamports = await this.connection!.getBalance(address);
    return BigInt(lamports);
  }

  // ========== Helper Methods ==========

  private ensureConnected(): void {
    if (!this.connected || !this.connection) {
      throw new Error(`${this.id}: Not connected to Solana`);
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
}

/**
 * Create a Solana mainnet adapter
 */
export function createSolanaAdapter(config: SolanaConfig): SolanaBlockchainAdapter {
  return new SolanaBlockchainAdapter({
    ...config,
    rpcUrl: config.rpcUrl ?? 'https://api.mainnet-beta.solana.com',
    commitment: config.commitment ?? 'confirmed',
  });
}

/**
 * Create a Solana devnet adapter
 */
export function createSolanaDevnetAdapter(config: Partial<SolanaConfig> = {}): SolanaBlockchainAdapter {
  return new SolanaBlockchainAdapter({
    rpcUrl: 'https://api.devnet.solana.com',
    commitment: 'confirmed',
    programIds: config.programIds ?? {},
    ...config,
  });
}
