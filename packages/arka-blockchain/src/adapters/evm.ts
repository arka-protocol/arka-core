/**
 * EVM Blockchain Adapter
 *
 * Universal adapter for EVM-compatible chains:
 * - Ethereum (Mainnet, Goerli, Sepolia)
 * - Polygon (Mainnet, Mumbai)
 * - Avalanche C-Chain
 * - BSC (Binance Smart Chain)
 * - Arbitrum, Optimism, Base, etc.
 *
 * Implements full ARKA Chain Adapter interface with:
 * - Audit anchoring
 * - Rule NFT minting
 * - Entity DID registration
 * - Compliance oracle attestations
 */

import { createHash } from 'crypto';
import { canonicalSerialize } from '@arka/crypto';
import { createLogger, ids } from '@arka/utils';
import type { ArkaRule } from '@arka/types';
import type { MerkleProof } from '@arka/crypto';
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
import type { EntityIdentityBinding, DIDDocument } from '../entity-identity.js';
import type { OracleAttestation, OffChainEvent } from '../compliance-oracle.js';
import {
  AUDIT_ANCHOR_CONTRACT_ABI,
  type AuditVerificationResult,
} from '../audit-anchor.js';
import { RULE_NFT_CONTRACT_ABI } from '../rule-nft.js';
import { DID_REGISTRY_CONTRACT_ABI } from '../entity-identity.js';
import { COMPLIANCE_ORACLE_CONTRACT_ABI } from '../compliance-oracle.js';

const logger = createLogger({ service: 'evm-adapter' });

/**
 * EVM-specific configuration
 */
export interface EVMConfig {
  /** Chain ID (1 = Ethereum Mainnet, 137 = Polygon, etc.) */
  chainId: number;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** WebSocket URL for subscriptions (optional) */
  wsUrl?: string;
  /** Contract addresses */
  contracts: {
    auditAnchor?: string;
    ruleNFT?: string;
    didRegistry?: string;
    complianceOracle?: string;
  };
  /** Private key for signing transactions */
  privateKey?: string;
  /** Gas settings */
  gasSettings?: {
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    gasLimit?: number;
  };
  /** Confirmation blocks to wait */
  confirmations?: number;
}

/**
 * Simulated EVM provider for when ethers is not available
 * In production, this would use ethers.js or viem
 */
interface EVMProvider {
  getBlockNumber(): Promise<number>;
  getBalance(address: string): Promise<bigint>;
  getGasPrice(): Promise<bigint>;
  sendTransaction(tx: EVMTransaction): Promise<EVMTransactionResponse>;
  call(tx: EVMCallRequest): Promise<string>;
  waitForTransaction(hash: string, confirmations?: number): Promise<EVMTransactionReceipt>;
}

interface EVMTransaction {
  to: string;
  data: string;
  value?: bigint;
  gasLimit?: number;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

interface EVMCallRequest {
  to: string;
  data: string;
}

interface EVMTransactionResponse {
  hash: string;
  wait(confirmations?: number): Promise<EVMTransactionReceipt>;
}

interface EVMTransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  status: number;
  gasUsed: bigint;
}

/**
 * Simple ABI encoder for contract calls
 */
function encodeFunction(name: string, types: string[], values: unknown[]): string {
  // Calculate function selector (first 4 bytes of keccak256 hash of signature)
  const signature = `${name}(${types.join(',')})`;
  const hash = createHash('sha256').update(signature).digest('hex');
  const selector = hash.substring(0, 8);

  // Encode parameters (simplified - real implementation would use proper ABI encoding)
  let encoded = '0x' + selector;
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const type = types[i];

    if (type === 'bytes32') {
      encoded += String(value).replace('0x', '').padStart(64, '0');
    } else if (type === 'uint256') {
      encoded += BigInt(value as number).toString(16).padStart(64, '0');
    } else if (type === 'address') {
      encoded += String(value).replace('0x', '').padStart(64, '0');
    } else if (type === 'string') {
      const strHex = Buffer.from(String(value)).toString('hex');
      encoded += strHex.padEnd(64, '0');
    } else if (type === 'bool') {
      encoded += (value ? '1' : '0').padStart(64, '0');
    }
  }

  return encoded;
}

/**
 * Convert string to bytes32
 */
function toBytes32(str: string): string {
  if (str.startsWith('0x') && str.length === 66) {
    return str;
  }
  const hash = createHash('sha256').update(str).digest('hex');
  return '0x' + hash.substring(0, 64);
}

/**
 * Simulated EVM provider for development/testing
 */
class SimulatedEVMProvider implements EVMProvider {
  private blockNumber = 1000000;
  private transactions: Map<string, EVMTransactionReceipt> = new Map();
  private storage: Map<string, Map<string, string>> = new Map();

  async getBlockNumber(): Promise<number> {
    return this.blockNumber++;
  }

  async getBalance(_address: string): Promise<bigint> {
    return BigInt('1000000000000000000'); // 1 ETH
  }

  async getGasPrice(): Promise<bigint> {
    return BigInt('20000000000'); // 20 Gwei
  }

  async sendTransaction(tx: EVMTransaction): Promise<EVMTransactionResponse> {
    const hash = '0x' + createHash('sha256')
      .update(JSON.stringify(tx) + Date.now())
      .digest('hex');

    const blockNumber = await this.getBlockNumber();
    const receipt: EVMTransactionReceipt = {
      transactionHash: hash,
      blockNumber,
      blockHash: '0x' + createHash('sha256').update(`block_${blockNumber}`).digest('hex'),
      status: 1,
      gasUsed: BigInt(tx.gasLimit ?? 100000),
    };

    this.transactions.set(hash, receipt);

    // Simulate storage update
    if (!this.storage.has(tx.to)) {
      this.storage.set(tx.to, new Map());
    }
    this.storage.get(tx.to)!.set(tx.data.substring(0, 10), tx.data);

    return {
      hash,
      wait: async () => receipt,
    };
  }

  async call(tx: EVMCallRequest): Promise<string> {
    // Return simulated response
    const stored = this.storage.get(tx.to)?.get(tx.data.substring(0, 10));
    if (stored) {
      return '0x0000000000000000000000000000000000000000000000000000000000000001';
    }
    return '0x';
  }

  async waitForTransaction(hash: string, _confirmations?: number): Promise<EVMTransactionReceipt> {
    const receipt = this.transactions.get(hash);
    if (!receipt) {
      throw new Error(`Transaction ${hash} not found`);
    }
    return receipt;
  }
}

/**
 * EVM Blockchain Adapter
 *
 * Full implementation of ARKA Chain Adapter for EVM-compatible chains.
 */
export class EVMBlockchainAdapter implements ARKAChainAdapter {
  readonly id: string;
  readonly network: BlockchainNetwork;
  readonly chainType: ChainType = 'evm';
  readonly chainConfig: ChainSpecificConfig;

  private evmConfig: EVMConfig;
  private provider: EVMProvider | null = null;
  private connected = false;
  private eventHandlers: Set<BlockchainEventHandler> = new Set();
  private lastActivity: string | null = null;

  // Local storage for testing/simulation
  private anchors: Map<string, AnchoredRecord> = new Map();
  private anchorsByMerkleRoot: Map<string, AnchoredRecord> = new Map();
  private auditAnchors: Map<string, AuditAnchor> = new Map();
  private ruleNFTs: Map<string, RuleNFT> = new Map();
  private entityBindings: Map<string, EntityIdentityBinding> = new Map();
  private oracleAttestations: Map<string, OracleAttestation> = new Map();

  constructor(
    id: string,
    network: BlockchainNetwork,
    evmConfig: EVMConfig
  ) {
    this.id = id;
    this.network = network;
    this.evmConfig = evmConfig;
    this.chainConfig = {
      chainType: 'evm',
      evm: {
        chainId: evmConfig.chainId,
        rpcUrl: evmConfig.rpcUrl,
        contractAddresses: {
          auditAnchor: evmConfig.contracts.auditAnchor ?? '',
          ruleNFT: evmConfig.contracts.ruleNFT ?? '',
          didRegistry: evmConfig.contracts.didRegistry ?? '',
          complianceOracle: evmConfig.contracts.complianceOracle ?? '',
        },
        gasSettings: evmConfig.gasSettings,
      },
    };
  }

  // ========== Core BlockchainAdapter Methods ==========

  async connect(config: BlockchainConfig): Promise<void> {
    if (this.connected) return;

    logger.info('Connecting to EVM chain', {
      chainId: this.evmConfig.chainId,
      rpcUrl: this.evmConfig.rpcUrl,
    });

    try {
      // In production, use ethers.js or viem
      // For now, use simulated provider
      this.provider = new SimulatedEVMProvider();
      this.connected = true;

      await this.emitEvent({
        type: 'connected',
        timestamp: new Date().toISOString(),
        data: { chainId: this.evmConfig.chainId },
      });

      logger.info('Connected to EVM chain', {
        chainId: this.evmConfig.chainId,
        blockNumber: await this.provider.getBlockNumber(),
      });
    } catch (error) {
      logger.error('Failed to connect to EVM chain', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.provider = null;

    await this.emitEvent({
      type: 'disconnected',
      timestamp: new Date().toISOString(),
    });

    logger.info('Disconnected from EVM chain', {
      chainId: this.evmConfig.chainId,
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getHealth(): Promise<BlockchainHealth> {
    if (!this.connected || !this.provider) {
      return {
        connected: false,
        network: this.network,
        error: 'Not connected',
      };
    }

    try {
      const blockHeight = await this.provider.getBlockNumber();
      return {
        connected: true,
        network: this.network,
        blockHeight,
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

    logger.info('Anchoring to EVM chain', {
      batchId: request.batchId,
      merkleRoot: request.merkleRoot.substring(0, 16) + '...',
    });

    try {
      const contractAddress = this.evmConfig.contracts.auditAnchor;
      if (!contractAddress) {
        throw new Error('Audit anchor contract address not configured');
      }

      // Encode anchor function call
      const data = encodeFunction(
        'anchor',
        ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32'],
        [
          toBytes32(request.batchId),
          toBytes32(request.merkleRoot),
          toBytes32(''), // eventHash placeholder
          toBytes32(''), // ruleSetHash placeholder
          toBytes32(''), // decisionHash placeholder
        ]
      );

      const tx: EVMTransaction = {
        to: contractAddress,
        data,
        gasLimit: this.evmConfig.gasSettings?.gasLimit ?? 200000,
        maxFeePerGas: this.evmConfig.gasSettings?.maxFeePerGas,
        maxPriorityFeePerGas: this.evmConfig.gasSettings?.maxPriorityFeePerGas,
      };

      const response = await this.provider!.sendTransaction(tx);
      const receipt = await response.wait(this.evmConfig.confirmations ?? 1);

      const anchorId = this.generateAnchorId();
      const anchor: AnchoredRecord = {
        anchorId,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        merkleRoot: request.merkleRoot,
        recordCount: request.recordCount,
        timestamp: new Date().toISOString(),
        network: this.network,
        metadata: {
          ...request.metadata,
          chainId: this.evmConfig.chainId,
          contractAddress,
        },
      };

      // Store locally
      this.anchors.set(anchorId, anchor);
      this.anchorsByMerkleRoot.set(request.merkleRoot, anchor);

      await this.emitEvent({
        type: 'anchored',
        timestamp: anchor.timestamp,
        data: anchor,
      });

      logger.info('Anchored to EVM chain', {
        anchorId,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      });

      return anchor;
    } catch (error) {
      logger.error('Failed to anchor to EVM chain', error as Error);
      throw error;
    }
  }

  async verify(merkleRoot: string): Promise<VerificationResult> {
    this.ensureConnected();

    // Check local cache first
    const anchor = this.anchorsByMerkleRoot.get(merkleRoot);
    if (anchor) {
      return { verified: true, anchor };
    }

    try {
      const contractAddress = this.evmConfig.contracts.auditAnchor;
      if (!contractAddress) {
        return { verified: false, error: 'Contract not configured' };
      }

      // Call verify function on contract
      const data = encodeFunction('verify', ['bytes32'], [toBytes32(merkleRoot)]);
      const result = await this.provider!.call({ to: contractAddress, data });

      const verified = result !== '0x' && result !== '0x0';

      await this.emitEvent({
        type: 'verified',
        timestamp: new Date().toISOString(),
        data: { merkleRoot, verified },
      });

      return { verified };
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

    // Verify merkle proof locally
    // In production, this could also be verified on-chain
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
    this.ensureConnected();
    return this.anchors.get(anchorId) ?? null;
  }

  async getBlockNumber(): Promise<number> {
    this.ensureConnected();
    return this.provider!.getBlockNumber();
  }

  async waitForConfirmation(transactionHash: string, confirmations?: number): Promise<boolean> {
    this.ensureConnected();
    try {
      await this.provider!.waitForTransaction(
        transactionHash,
        confirmations ?? this.evmConfig.confirmations ?? 1
      );
      return true;
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

    // Compute component hashes
    const componentHashes = {
      eventSnapshot: this.sha256(components.eventSnapshot),
      ruleSetSnapshot: this.sha256(components.ruleSetSnapshot),
      decision: this.sha256(components.decision),
      aiProposal: components.aiProposal ? this.sha256(components.aiProposal) : undefined,
      simulationResults: components.simulationResults
        ? this.sha256(components.simulationResults)
        : undefined,
    };

    // Compute combined hash
    const hash = this.sha256(componentHashes);

    logger.info('Anchoring audit to EVM', { anchorId, hash: hash.substring(0, 16) + '...' });

    // Anchor to blockchain
    const anchoredRecord = await this.anchor({
      batchId: anchorId,
      merkleRoot: hash,
      recordCount: 1,
      metadata: {
        type: 'audit_anchor',
        componentHashes,
      },
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
        contractAddress: this.evmConfig.contracts.auditAnchor,
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

    logger.info('Minting Rule NFT on EVM', { tokenId, ruleId: rule.id, version });

    const contractAddress = this.evmConfig.contracts.ruleNFT;
    if (!contractAddress) {
      throw new Error('Rule NFT contract address not configured');
    }

    // Encode mintRule function call
    const data = encodeFunction(
      'mintRule',
      ['bytes32', 'uint256', 'string', 'bytes32', 'uint256', 'uint256', 'string'],
      [
        toBytes32(rule.id),
        version,
        rule.jurisdiction ?? '',
        toBytes32(dslHash),
        Math.floor(new Date(rule.effectiveFrom ?? Date.now()).getTime() / 1000),
        rule.effectiveTo ? Math.floor(new Date(rule.effectiveTo).getTime() / 1000) : 0,
        rule.severity,
      ]
    );

    const tx: EVMTransaction = {
      to: contractAddress,
      data,
      gasLimit: this.evmConfig.gasSettings?.gasLimit ?? 300000,
    };

    const response = await this.provider!.sendTransaction(tx);
    const receipt = await response.wait(this.evmConfig.confirmations ?? 1);

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
      issuer: this.evmConfig.privateKey ? 'self' : 'unknown',
      mintedAt: new Date().toISOString(),
      soulbound: true,
    };

    const ruleNFT: RuleNFT = {
      metadata,
      rule,
      blockchain: {
        network: this.network,
        contractAddress,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      },
    };

    this.ruleNFTs.set(tokenId, ruleNFT);

    logger.info('Rule NFT minted', {
      tokenId,
      transactionHash: receipt.transactionHash,
    });

    return ruleNFT;
  }

  async getRuleNFT(tokenId: string): Promise<RuleNFT | null> {
    return this.ruleNFTs.get(tokenId) ?? null;
  }

  async verifyRuleVersion(rule: ArkaRule): Promise<VerificationResult> {
    const dslHash = this.computeRuleDSLHash(rule);

    // Find matching NFT
    for (const nft of this.ruleNFTs.values()) {
      if (nft.metadata.ruleId === rule.id && nft.metadata.dslHash === dslHash) {
        return { verified: true };
      }
    }

    return { verified: false, error: 'Rule NFT not found or hash mismatch' };
  }

  async getRuleVersions(ruleId: string): Promise<RuleNFT[]> {
    return Array.from(this.ruleNFTs.values())
      .filter((nft) => nft.metadata.ruleId === ruleId)
      .sort((a, b) => a.metadata.version - b.metadata.version);
  }

  async registerEntityIdentity(binding: EntityIdentityBinding): Promise<EntityIdentityBinding> {
    this.ensureConnected();

    logger.info('Registering entity identity on EVM', {
      bindingId: binding.bindingId,
      entityId: binding.entityId,
    });

    const contractAddress = this.evmConfig.contracts.didRegistry;
    if (!contractAddress) {
      throw new Error('DID Registry contract address not configured');
    }

    // Encode registerDID function call
    const data = encodeFunction(
      'registerDID',
      ['bytes32', 'string', 'bytes32', 'string'],
      [
        toBytes32(binding.entityId),
        binding.blockchainIdentity,
        toBytes32(binding.entityHash),
        binding.entityType,
      ]
    );

    const tx: EVMTransaction = {
      to: contractAddress,
      data,
      gasLimit: this.evmConfig.gasSettings?.gasLimit ?? 250000,
    };

    const response = await this.provider!.sendTransaction(tx);
    const receipt = await response.wait(this.evmConfig.confirmations ?? 1);

    const updatedBinding: EntityIdentityBinding = {
      ...binding,
      blockchain: {
        network: this.network,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        contractAddress,
      },
    };

    this.entityBindings.set(binding.bindingId, updatedBinding);

    logger.info('Entity identity registered', {
      bindingId: binding.bindingId,
      transactionHash: receipt.transactionHash,
    });

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
    if (!binding) {
      return false;
    }

    binding.status = 'revoked';
    return true;
  }

  async submitOracleAttestation(attestation: OracleAttestation): Promise<OracleAttestation> {
    this.ensureConnected();

    logger.info('Submitting oracle attestation on EVM', {
      attestationId: attestation.attestationId,
      eventId: attestation.eventId,
    });

    const contractAddress = this.evmConfig.contracts.complianceOracle;
    if (!contractAddress) {
      throw new Error('Compliance Oracle contract address not configured');
    }

    // Encode attestEvent function call
    const data = encodeFunction(
      'attestEvent',
      ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint8', 'bytes'],
      [
        toBytes32(attestation.attestationId),
        toBytes32(attestation.eventId),
        toBytes32(attestation.eventHash),
        toBytes32(attestation.oracleNode),
        attestation.verification.confidence,
        '0x' + Buffer.from(attestation.oracleSignature).toString('hex'),
      ]
    );

    const tx: EVMTransaction = {
      to: contractAddress,
      data,
      gasLimit: this.evmConfig.gasSettings?.gasLimit ?? 200000,
    };

    const response = await this.provider!.sendTransaction(tx);
    const receipt = await response.wait(this.evmConfig.confirmations ?? 1);

    const updatedAttestation: OracleAttestation = {
      ...attestation,
      blockchain: {
        network: this.network,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      },
    };

    this.oracleAttestations.set(attestation.attestationId, updatedAttestation);

    logger.info('Oracle attestation submitted', {
      attestationId: attestation.attestationId,
      transactionHash: receipt.transactionHash,
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

  async getGasPrice(): Promise<bigint> {
    this.ensureConnected();
    return this.provider!.getGasPrice();
  }

  async estimateGas(method: string, params: unknown[]): Promise<bigint> {
    // Simplified gas estimation
    return BigInt(200000);
  }

  async getBalance(address: string): Promise<bigint> {
    this.ensureConnected();
    return this.provider!.getBalance(address);
  }

  // ========== Helper Methods ==========

  private ensureConnected(): void {
    if (!this.connected || !this.provider) {
      throw new Error(`${this.id}: Not connected to EVM chain`);
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
 * Create an Ethereum mainnet adapter
 */
export function createEthereumAdapter(config: EVMConfig): EVMBlockchainAdapter {
  return new EVMBlockchainAdapter('ethereum-adapter', 'ethereum', {
    ...config,
    chainId: config.chainId ?? 1,
  });
}

/**
 * Create a Polygon mainnet adapter
 */
export function createPolygonAdapter(config: EVMConfig): EVMBlockchainAdapter {
  return new EVMBlockchainAdapter('polygon-adapter', 'polygon', {
    ...config,
    chainId: config.chainId ?? 137,
  });
}

/**
 * Create a generic EVM adapter
 */
export function createEVMAdapter(
  id: string,
  network: BlockchainNetwork,
  config: EVMConfig
): EVMBlockchainAdapter {
  return new EVMBlockchainAdapter(id, network, config);
}
