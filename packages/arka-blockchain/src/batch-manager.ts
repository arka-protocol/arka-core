/**
 * Batch Manager
 *
 * Efficiently batches records for anchoring to blockchain.
 * Uses Merkle trees to create compact proofs.
 */

import {
  hashData,
  getMerkleRoot,
  generateMerkleProof,
  type MerkleProof,
} from '@arka/crypto';
import type { AnchorRequest, BatchManager, BatchManagerConfig } from './types.js';

/**
 * Default batch manager implementation
 */
export class DefaultBatchManager implements BatchManager {
  private records: Map<string, { data: unknown; index: number }> = new Map();
  private recordOrder: string[] = [];
  private config: Required<BatchManagerConfig>;
  private batchStartTime: number | null = null;

  constructor(config: BatchManagerConfig) {
    this.config = {
      maxBatchSize: config.maxBatchSize,
      maxBatchAge: config.maxBatchAge ?? 60000, // 1 minute default
      minBatchSize: config.minBatchSize ?? 1,
    };
  }

  /**
   * Add a record to the current batch
   */
  addRecord(record: unknown): string {
    if (this.records.size >= this.config.maxBatchSize) {
      throw new Error('Batch is full. Finalize current batch before adding more records.');
    }

    if (this.batchStartTime === null) {
      this.batchStartTime = Date.now();
    }

    const recordHash = hashData(record);
    const index = this.recordOrder.length;

    this.records.set(recordHash, { data: record, index });
    this.recordOrder.push(recordHash);

    return recordHash;
  }

  /**
   * Get current batch size
   */
  getBatchSize(): number {
    return this.records.size;
  }

  /**
   * Check if batch is ready to anchor
   */
  isReadyToAnchor(): boolean {
    if (this.records.size < this.config.minBatchSize) {
      return false;
    }

    // Check size threshold
    if (this.records.size >= this.config.maxBatchSize) {
      return true;
    }

    // Check age threshold
    if (this.batchStartTime !== null) {
      const age = Date.now() - this.batchStartTime;
      if (age >= this.config.maxBatchAge) {
        return true;
      }
    }

    return false;
  }

  /**
   * Finalize and get the batch for anchoring
   */
  finalizeBatch(): AnchorRequest {
    if (this.records.size === 0) {
      throw new Error('Cannot finalize empty batch');
    }

    const recordHashes = this.recordOrder;
    const merkleRoot = getMerkleRoot(recordHashes);

    const batchId = this.generateBatchId();

    return {
      batchId,
      merkleRoot,
      recordCount: this.records.size,
      recordHashes,
      metadata: {
        batchStartTime: this.batchStartTime,
        batchEndTime: Date.now(),
      },
    };
  }

  /**
   * Clear the current batch
   */
  clearBatch(): void {
    this.records.clear();
    this.recordOrder = [];
    this.batchStartTime = null;
  }

  /**
   * Get proof for a specific record in batch
   */
  getProof(recordHash: string): MerkleProof | null {
    const record = this.records.get(recordHash);
    if (!record) {
      return null;
    }

    return generateMerkleProof(this.recordOrder, record.index);
  }

  /**
   * Get all record hashes in order
   */
  getRecordHashes(): string[] {
    return [...this.recordOrder];
  }

  /**
   * Check if a record exists in the batch
   */
  hasRecord(recordHash: string): boolean {
    return this.records.has(recordHash);
  }

  /**
   * Get batch age in milliseconds
   */
  getBatchAge(): number {
    if (this.batchStartTime === null) {
      return 0;
    }
    return Date.now() - this.batchStartTime;
  }

  /**
   * Generate a unique batch ID
   */
  private generateBatchId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `batch_${timestamp}_${random}`;
  }
}

/**
 * Auto-anchoring batch manager that triggers anchoring automatically
 */
export class AutoAnchoringBatchManager extends DefaultBatchManager {
  private anchorCallback: ((request: AnchorRequest) => Promise<void>) | null = null;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    config: BatchManagerConfig,
    anchorCallback?: (request: AnchorRequest) => Promise<void>
  ) {
    super(config);
    this.anchorCallback = anchorCallback ?? null;
  }

  /**
   * Start auto-anchoring checks
   */
  startAutoAnchor(
    callback: (request: AnchorRequest) => Promise<void>,
    checkIntervalMs: number = 5000
  ): void {
    this.anchorCallback = callback;
    this.stopAutoAnchor();

    this.checkInterval = setInterval(async () => {
      if (this.isReadyToAnchor() && this.anchorCallback) {
        try {
          const request = this.finalizeBatch();
          await this.anchorCallback(request);
          this.clearBatch();
        } catch (error) {
          console.error('Auto-anchor failed:', error);
        }
      }
    }, checkIntervalMs);
  }

  /**
   * Stop auto-anchoring
   */
  stopAutoAnchor(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Force anchor current batch immediately
   */
  async forceAnchor(): Promise<AnchorRequest | null> {
    if (this.getBatchSize() === 0) {
      return null;
    }

    const request = this.finalizeBatch();

    if (this.anchorCallback) {
      await this.anchorCallback(request);
    }

    this.clearBatch();
    return request;
  }
}
