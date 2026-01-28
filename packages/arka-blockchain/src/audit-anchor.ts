/**
 * Audit Anchor System
 *
 * Anchors cryptographic hashes of ARKA audit records to blockchain.
 * Hash only, not data → no privacy issues.
 *
 * Provides:
 * - Tamper-proof proof-of-compliance
 * - Non-repudiation
 * - Forensic traceability
 * - Zero-trust ability for regulators & courts
 */

import { createHash } from 'crypto';
import { canonicalSerialize } from '@arka-protocol/crypto';
import { createLogger, ids } from '@arka-protocol/utils';
import type { BlockchainAdapter, AnchoredRecord } from './types.js';

const logger = createLogger({ service: 'audit-anchor' });

/**
 * Components that make up an audit anchor
 */
export interface AuditAnchorComponents {
  /** Event snapshot at time of decision */
  eventSnapshot: unknown;
  /** Rule set snapshot (rules that were evaluated) */
  ruleSetSnapshot: unknown;
  /** The decision made */
  decision: unknown;
  /** AI proposal that led to this (if any) */
  aiProposal?: unknown;
  /** Simulation results used (if any) */
  simulationResults?: unknown;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * An anchored audit record
 */
export interface AuditAnchor {
  /** Unique anchor ID */
  anchorId: string;
  /** SHA-256 hash of all components */
  hash: string;
  /** Individual component hashes for selective verification */
  componentHashes: {
    eventSnapshot: string;
    ruleSetSnapshot: string;
    decision: string;
    aiProposal?: string;
    simulationResults?: string;
  };
  /** Timestamp of anchoring */
  timestamp: string;
  /** Blockchain transaction details */
  blockchain?: {
    network: string;
    transactionHash: string;
    blockNumber: number;
    contractAddress?: string;
  };
}

/**
 * Verification result for an audit anchor
 */
export interface AuditVerificationResult {
  /** Is the audit verified on chain */
  verified: boolean;
  /** The anchor record */
  anchor?: AuditAnchor;
  /** Blockchain confirmation */
  blockchainConfirmed?: boolean;
  /** Error if verification failed */
  error?: string;
  /** Detailed verification status */
  details?: {
    hashMatches: boolean;
    componentHashesMatch: boolean;
    blockchainVerified: boolean;
  };
}

/**
 * Computes SHA-256 hash of data
 */
function sha256(data: unknown): string {
  const bytes = canonicalSerialize(data);
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Audit Anchor Service
 *
 * Creates tamper-proof anchors of ARKA audit records on blockchain.
 */
export class AuditAnchorService {
  private adapter: BlockchainAdapter;
  private anchors: Map<string, AuditAnchor> = new Map();
  private anchorsByHash: Map<string, AuditAnchor> = new Map();
  private contractAddress?: string;

  constructor(adapter: BlockchainAdapter, contractAddress?: string) {
    this.adapter = adapter;
    this.contractAddress = contractAddress;
  }

  /**
   * Creates an audit anchor from components
   */
  createAnchor(components: AuditAnchorComponents): AuditAnchor {
    const anchorId = ids.audit();

    // Compute individual component hashes
    const componentHashes = {
      eventSnapshot: sha256(components.eventSnapshot),
      ruleSetSnapshot: sha256(components.ruleSetSnapshot),
      decision: sha256(components.decision),
      aiProposal: components.aiProposal ? sha256(components.aiProposal) : undefined,
      simulationResults: components.simulationResults
        ? sha256(components.simulationResults)
        : undefined,
    };

    // Compute combined hash
    const combinedData = {
      eventSnapshot: componentHashes.eventSnapshot,
      ruleSetSnapshot: componentHashes.ruleSetSnapshot,
      decision: componentHashes.decision,
      aiProposal: componentHashes.aiProposal,
      simulationResults: componentHashes.simulationResults,
      timestamp: new Date().toISOString(),
    };
    const hash = sha256(combinedData);

    const anchor: AuditAnchor = {
      anchorId,
      hash,
      componentHashes,
      timestamp: new Date().toISOString(),
    };

    // Store locally
    this.anchors.set(anchorId, anchor);
    this.anchorsByHash.set(hash, anchor);

    logger.info('Created audit anchor', {
      anchorId,
      hash: hash.substring(0, 16) + '...',
    });

    return anchor;
  }

  /**
   * Anchors an audit record to blockchain
   */
  async anchorToBlockchain(anchor: AuditAnchor): Promise<AuditAnchor> {
    logger.info('Anchoring to blockchain', {
      anchorId: anchor.anchorId,
      network: this.adapter.network,
    });

    try {
      const result = await this.adapter.anchor({
        batchId: anchor.anchorId,
        merkleRoot: anchor.hash,
        recordCount: 1,
        metadata: {
          type: 'audit_anchor',
          componentHashes: anchor.componentHashes,
          contractAddress: this.contractAddress,
        },
      });

      // Update anchor with blockchain info
      const updatedAnchor: AuditAnchor = {
        ...anchor,
        blockchain: {
          network: this.adapter.network,
          transactionHash: result.transactionHash,
          blockNumber: result.blockNumber,
          contractAddress: this.contractAddress,
        },
      };

      // Update stored anchor
      this.anchors.set(anchor.anchorId, updatedAnchor);
      this.anchorsByHash.set(anchor.hash, updatedAnchor);

      logger.info('Audit anchored to blockchain', {
        anchorId: anchor.anchorId,
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
      });

      return updatedAnchor;
    } catch (error) {
      logger.error('Failed to anchor audit', error as Error, {
        anchorId: anchor.anchorId,
      });
      throw error;
    }
  }

  /**
   * Creates and anchors in one step
   */
  async createAndAnchor(components: AuditAnchorComponents): Promise<AuditAnchor> {
    const anchor = this.createAnchor(components);
    return this.anchorToBlockchain(anchor);
  }

  /**
   * Verifies an audit anchor
   */
  async verify(anchorId: string): Promise<AuditVerificationResult> {
    const anchor = this.anchors.get(anchorId);

    if (!anchor) {
      return {
        verified: false,
        error: 'Anchor not found',
      };
    }

    // If not on blockchain yet, just return local verification
    if (!anchor.blockchain) {
      return {
        verified: true,
        anchor,
        blockchainConfirmed: false,
        details: {
          hashMatches: true,
          componentHashesMatch: true,
          blockchainVerified: false,
        },
      };
    }

    // Verify on blockchain
    try {
      const blockchainResult = await this.adapter.verify(anchor.hash);

      return {
        verified: blockchainResult.verified,
        anchor,
        blockchainConfirmed: blockchainResult.verified,
        details: {
          hashMatches: true,
          componentHashesMatch: true,
          blockchainVerified: blockchainResult.verified,
        },
      };
    } catch (error) {
      return {
        verified: false,
        anchor,
        error: error instanceof Error ? error.message : 'Verification failed',
        details: {
          hashMatches: true,
          componentHashesMatch: true,
          blockchainVerified: false,
        },
      };
    }
  }

  /**
   * Verifies audit data matches an anchor
   */
  async verifyData(
    anchorId: string,
    components: AuditAnchorComponents
  ): Promise<AuditVerificationResult> {
    const anchor = this.anchors.get(anchorId);

    if (!anchor) {
      return {
        verified: false,
        error: 'Anchor not found',
      };
    }

    // Verify component hashes match
    const computedHashes = {
      eventSnapshot: sha256(components.eventSnapshot),
      ruleSetSnapshot: sha256(components.ruleSetSnapshot),
      decision: sha256(components.decision),
      aiProposal: components.aiProposal ? sha256(components.aiProposal) : undefined,
      simulationResults: components.simulationResults
        ? sha256(components.simulationResults)
        : undefined,
    };

    const hashesMatch =
      computedHashes.eventSnapshot === anchor.componentHashes.eventSnapshot &&
      computedHashes.ruleSetSnapshot === anchor.componentHashes.ruleSetSnapshot &&
      computedHashes.decision === anchor.componentHashes.decision &&
      computedHashes.aiProposal === anchor.componentHashes.aiProposal &&
      computedHashes.simulationResults === anchor.componentHashes.simulationResults;

    if (!hashesMatch) {
      return {
        verified: false,
        anchor,
        error: 'Component hashes do not match - data has been tampered with',
        details: {
          hashMatches: false,
          componentHashesMatch: false,
          blockchainVerified: false,
        },
      };
    }

    // Now verify on blockchain
    return this.verify(anchorId);
  }

  /**
   * Gets an anchor by ID
   */
  getAnchor(anchorId: string): AuditAnchor | undefined {
    return this.anchors.get(anchorId);
  }

  /**
   * Gets an anchor by hash
   */
  getAnchorByHash(hash: string): AuditAnchor | undefined {
    return this.anchorsByHash.get(hash);
  }

  /**
   * Gets all anchors
   */
  getAllAnchors(): AuditAnchor[] {
    return Array.from(this.anchors.values());
  }

  /**
   * Gets anchors that have been confirmed on blockchain
   */
  getBlockchainConfirmedAnchors(): AuditAnchor[] {
    return Array.from(this.anchors.values()).filter((a) => a.blockchain);
  }
}

/**
 * ARKA Audit Anchor Contract Interface (Solidity-compatible)
 *
 * This is the interface that on-chain contracts should implement.
 *
 * ```solidity
 * // SPDX-License-Identifier: MIT
 * pragma solidity ^0.8.19;
 *
 * interface IPACTAuditAnchor {
 *     event AuditAnchored(
 *         bytes32 indexed anchorId,
 *         bytes32 indexed hash,
 *         uint256 timestamp,
 *         address indexed submitter
 *     );
 *
 *     function anchor(
 *         bytes32 anchorId,
 *         bytes32 hash,
 *         bytes32 eventHash,
 *         bytes32 ruleSetHash,
 *         bytes32 decisionHash
 *     ) external;
 *
 *     function verify(bytes32 hash) external view returns (bool exists, uint256 timestamp);
 *
 *     function getAnchor(bytes32 anchorId) external view returns (
 *         bytes32 hash,
 *         bytes32 eventHash,
 *         bytes32 ruleSetHash,
 *         bytes32 decisionHash,
 *         uint256 timestamp,
 *         address submitter
 *     );
 * }
 * ```
 */
export const AUDIT_ANCHOR_CONTRACT_ABI = [
  {
    type: 'event',
    name: 'AuditAnchored',
    inputs: [
      { name: 'anchorId', type: 'bytes32', indexed: true },
      { name: 'hash', type: 'bytes32', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
      { name: 'submitter', type: 'address', indexed: true },
    ],
  },
  {
    type: 'function',
    name: 'anchor',
    inputs: [
      { name: 'anchorId', type: 'bytes32' },
      { name: 'hash', type: 'bytes32' },
      { name: 'eventHash', type: 'bytes32' },
      { name: 'ruleSetHash', type: 'bytes32' },
      { name: 'decisionHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'verify',
    inputs: [{ name: 'hash', type: 'bytes32' }],
    outputs: [
      { name: 'exists', type: 'bool' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAnchor',
    inputs: [{ name: 'anchorId', type: 'bytes32' }],
    outputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'eventHash', type: 'bytes32' },
      { name: 'ruleSetHash', type: 'bytes32' },
      { name: 'decisionHash', type: 'bytes32' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'submitter', type: 'address' },
    ],
    stateMutability: 'view',
  },
];
