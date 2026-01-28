/**
 * Blockchain Orchestrator
 *
 * Coordinates blockchain anchoring for ARKA Protocol.
 * Manages batching, anchoring, and verification of decision records.
 */

import { createLogger } from '@arka-protocol/utils';
import {
  getMerkleRoot,
  generateMerkleProof,
  getGlobalEventLog,
  type MerkleProof,
} from '@arka-protocol/crypto';
import type {
  BlockchainAdapter,
  BlockchainConfig,
  AnchoredRecord,
  VerificationResult,
  BatchManagerConfig,
} from './types.js';
import { DefaultBatchManager, AutoAnchoringBatchManager } from './batch-manager.js';
import { createAdapter } from './factory.js';

const logger = createLogger({ service: 'blockchain-orchestrator' });

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Blockchain adapter configuration */
  blockchain: BlockchainConfig;
  /** Batch manager configuration */
  batch: BatchManagerConfig;
  /** Auto-anchor interval in ms (0 to disable) */
  autoAnchorInterval?: number;
  /** Callback when batch is anchored */
  onAnchor?: (anchor: AnchoredRecord, batchHashes: string[]) => void | Promise<void>;
  /** Callback on error */
  onError?: (error: Error) => void | Promise<void>;
}

/**
 * Record that was anchored with its proof
 */
export interface AnchoredDecision {
  /** The original decision record */
  record: unknown;
  /** Hash of the record */
  hash: string;
  /** Anchor information */
  anchor: AnchoredRecord;
  /** Merkle proof for this specific record */
  proof: MerkleProof;
}

/**
 * Blockchain Orchestrator
 *
 * Coordinates the following workflow:
 * 1. Receive decision records from ARKA engine
 * 2. Batch records and compute Merkle root
 * 3. Anchor Merkle root to blockchain
 * 4. Store proofs for individual record verification
 */
export class BlockchainOrchestrator {
  private adapter: BlockchainAdapter;
  private batchManager: AutoAnchoringBatchManager;
  private config: OrchestratorConfig;
  private pendingRecords: Map<string, unknown> = new Map();
  private anchoredRecords: Map<string, AnchoredDecision> = new Map();
  private isConnected = false;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.adapter = createAdapter(config.blockchain.network, config.blockchain);
    this.batchManager = new AutoAnchoringBatchManager(config.batch);
  }

  /**
   * Initialize and connect to blockchain
   */
  async connect(): Promise<void> {
    logger.info('Connecting to blockchain', {
      network: this.config.blockchain.network,
    });

    await this.adapter.connect(this.config.blockchain);
    this.isConnected = true;

    // Start auto-anchoring if configured
    if (this.config.autoAnchorInterval && this.config.autoAnchorInterval > 0) {
      this.batchManager.startAutoAnchor(
        async (request) => {
          await this.anchorBatch(request.batchId, request.merkleRoot, request.recordHashes ?? []);
        },
        this.config.autoAnchorInterval
      );
    }

    logger.info('Connected to blockchain', {
      network: this.config.blockchain.network,
    });
  }

  /**
   * Disconnect from blockchain
   */
  async disconnect(): Promise<void> {
    this.batchManager.stopAutoAnchor();
    await this.adapter.disconnect();
    this.isConnected = false;
    logger.info('Disconnected from blockchain');
  }

  /**
   * Add a decision record to be anchored
   */
  addRecord(record: unknown): string {
    if (!this.isConnected) {
      throw new Error('Orchestrator not connected to blockchain');
    }

    const hash = this.batchManager.addRecord(record);
    this.pendingRecords.set(hash, record);

    // Also add to event log for local replay
    const eventLog = getGlobalEventLog();
    eventLog.append('DECISION_MADE', {
      hash,
      record,
    });

    logger.debug('Record added to batch', {
      hash,
      batchSize: this.batchManager.getBatchSize(),
    });

    return hash;
  }

  /**
   * Force anchor current batch immediately
   */
  async anchorNow(): Promise<AnchoredRecord | null> {
    if (!this.isConnected) {
      throw new Error('Orchestrator not connected to blockchain');
    }

    if (this.batchManager.getBatchSize() === 0) {
      return null;
    }

    const request = this.batchManager.finalizeBatch();
    const anchor = await this.anchorBatch(
      request.batchId,
      request.merkleRoot,
      request.recordHashes ?? []
    );
    this.batchManager.clearBatch();

    return anchor;
  }

  /**
   * Verify a record exists on blockchain
   */
  async verifyRecord(hash: string): Promise<VerificationResult> {
    const anchored = this.anchoredRecords.get(hash);

    if (!anchored) {
      return {
        verified: false,
        error: 'Record not found in anchored records',
      };
    }

    // Verify on blockchain
    return this.adapter.verifyItem(anchored.anchor.merkleRoot, anchored.proof);
  }

  /**
   * Get anchored decision by hash
   */
  getAnchoredDecision(hash: string): AnchoredDecision | undefined {
    return this.anchoredRecords.get(hash);
  }

  /**
   * Get proof for a record
   */
  getProof(hash: string): MerkleProof | null {
    const anchored = this.anchoredRecords.get(hash);
    return anchored?.proof ?? null;
  }

  /**
   * Get current batch size
   */
  getBatchSize(): number {
    return this.batchManager.getBatchSize();
  }

  /**
   * Check if ready to anchor
   */
  isReadyToAnchor(): boolean {
    return this.batchManager.isReadyToAnchor();
  }

  /**
   * Get blockchain health
   */
  async getHealth() {
    return this.adapter.getHealth();
  }

  /**
   * Get statistics
   */
  getStats(): {
    pendingRecords: number;
    anchoredRecords: number;
    batchSize: number;
    batchAge: number;
    isConnected: boolean;
  } {
    return {
      pendingRecords: this.pendingRecords.size,
      anchoredRecords: this.anchoredRecords.size,
      batchSize: this.batchManager.getBatchSize(),
      batchAge: this.batchManager.getBatchAge(),
      isConnected: this.isConnected,
    };
  }

  /**
   * Internal: Anchor a batch to blockchain
   */
  private async anchorBatch(
    batchId: string,
    merkleRoot: string,
    recordHashes: string[]
  ): Promise<AnchoredRecord> {
    logger.info('Anchoring batch to blockchain', {
      batchId,
      merkleRoot,
      recordCount: recordHashes.length,
    });

    try {
      // Anchor to blockchain
      const anchor = await this.adapter.anchor({
        batchId,
        merkleRoot,
        recordCount: recordHashes.length,
        recordHashes,
      });

      // Generate proofs and store anchored records
      for (let i = 0; i < recordHashes.length; i++) {
        const hash = recordHashes[i]!;
        const record = this.pendingRecords.get(hash);
        const proof = generateMerkleProof(recordHashes, i);

        if (record) {
          this.anchoredRecords.set(hash, {
            record,
            hash,
            anchor,
            proof,
          });
          this.pendingRecords.delete(hash);
        }
      }

      // Log to event log
      const eventLog = getGlobalEventLog();
      await eventLog.append('BATCH_ANCHORED', {
        batchId,
        merkleRoot,
        transactionHash: anchor.transactionHash,
        blockNumber: anchor.blockNumber,
        recordCount: recordHashes.length,
      });

      // Callback
      if (this.config.onAnchor) {
        await this.config.onAnchor(anchor, recordHashes);
      }

      logger.info('Batch anchored successfully', {
        batchId,
        transactionHash: anchor.transactionHash,
        blockNumber: anchor.blockNumber,
      });

      return anchor;
    } catch (error) {
      logger.error('Failed to anchor batch', error as Error, { batchId });

      if (this.config.onError) {
        await this.config.onError(error as Error);
      }

      throw error;
    }
  }
}

// Global singleton
let orchestratorInstance: BlockchainOrchestrator | null = null;

/**
 * Get the global orchestrator instance
 */
export function getOrchestrator(): BlockchainOrchestrator | null {
  return orchestratorInstance;
}

/**
 * Initialize the global orchestrator
 */
export async function initializeOrchestrator(
  config: OrchestratorConfig
): Promise<BlockchainOrchestrator> {
  if (orchestratorInstance) {
    await orchestratorInstance.disconnect();
  }

  orchestratorInstance = new BlockchainOrchestrator(config);
  await orchestratorInstance.connect();

  return orchestratorInstance;
}

/**
 * Shutdown the global orchestrator
 */
export async function shutdownOrchestrator(): Promise<void> {
  if (orchestratorInstance) {
    await orchestratorInstance.disconnect();
    orchestratorInstance = null;
  }
}
