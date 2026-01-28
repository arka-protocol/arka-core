/**
 * Memory Blockchain Adapter
 *
 * In-memory implementation for testing and development.
 * Simulates blockchain behavior without actual network.
 */

import { BaseBlockchainAdapter } from '../base-adapter.js';
import type {
  BlockchainConfig,
  AnchorRequest,
  AnchoredRecord,
  AnchorQuery,
  VerificationResult,
} from '../types.js';

interface Block {
  number: number;
  hash: string;
  timestamp: string;
  transactions: string[];
}

/**
 * In-memory blockchain adapter for testing
 */
export class MemoryBlockchainAdapter extends BaseBlockchainAdapter {
  readonly id = 'memory-adapter';
  readonly network = 'memory' as const;

  private anchors: Map<string, AnchoredRecord> = new Map();
  private anchorsByMerkleRoot: Map<string, AnchoredRecord> = new Map();
  private anchorsByTxHash: Map<string, AnchoredRecord> = new Map();
  private blocks: Block[] = [];
  private currentBlockNumber = 0;

  /**
   * Connect (no-op for memory adapter)
   */
  async connect(config: BlockchainConfig): Promise<void> {
    this.config = config;
    this.connected = true;

    // Create genesis block
    this.blocks.push({
      number: 0,
      hash: '0'.repeat(64),
      timestamp: new Date().toISOString(),
      transactions: [],
    });

    await this.emitEvent({
      type: 'connected',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Disconnect (clears state)
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    await this.emitEvent({
      type: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Anchor a batch to the "blockchain"
   */
  async anchor(request: AnchorRequest): Promise<AnchoredRecord> {
    this.ensureConnected();

    // Create new block
    const blockNumber = ++this.currentBlockNumber;
    const transactionHash = this.generateTransactionHash();
    const blockHash = this.generateBlockHash(blockNumber);

    const block: Block = {
      number: blockNumber,
      hash: blockHash,
      timestamp: new Date().toISOString(),
      transactions: [transactionHash],
    };
    this.blocks.push(block);

    const anchorId = this.generateAnchorId();
    const anchor: AnchoredRecord = {
      anchorId,
      transactionHash,
      blockNumber,
      blockHash,
      merkleRoot: request.merkleRoot,
      recordCount: request.recordCount,
      timestamp: new Date().toISOString(),
      network: this.network,
      metadata: request.metadata,
    };

    // Store anchor with multiple indexes
    this.anchors.set(anchorId, anchor);
    this.anchorsByMerkleRoot.set(request.merkleRoot, anchor);
    this.anchorsByTxHash.set(transactionHash, anchor);

    await this.emitEvent({
      type: 'anchored',
      timestamp: anchor.timestamp,
      data: anchor,
    });

    return anchor;
  }

  /**
   * Verify a merkle root exists
   */
  async verify(merkleRoot: string): Promise<VerificationResult> {
    this.ensureConnected();

    const anchor = this.anchorsByMerkleRoot.get(merkleRoot);

    if (!anchor) {
      return {
        verified: false,
        error: 'Merkle root not found on chain',
      };
    }

    await this.emitEvent({
      type: 'verified',
      timestamp: new Date().toISOString(),
      data: { merkleRoot, verified: true },
    });

    return {
      verified: true,
      anchor,
    };
  }

  /**
   * Query anchored records
   */
  async query(query: AnchorQuery): Promise<AnchoredRecord[]> {
    this.ensureConnected();

    let results = Array.from(this.anchors.values());

    // Apply filters
    if (query.anchorId) {
      results = results.filter((a) => a.anchorId === query.anchorId);
    }

    if (query.transactionHash) {
      results = results.filter((a) => a.transactionHash === query.transactionHash);
    }

    if (query.merkleRoot) {
      results = results.filter((a) => a.merkleRoot === query.merkleRoot);
    }

    if (query.fromTimestamp) {
      results = results.filter((a) => a.timestamp >= query.fromTimestamp!);
    }

    if (query.toTimestamp) {
      results = results.filter((a) => a.timestamp <= query.toTimestamp!);
    }

    if (query.fromBlock !== undefined) {
      results = results.filter((a) => a.blockNumber >= query.fromBlock!);
    }

    if (query.toBlock !== undefined) {
      results = results.filter((a) => a.blockNumber <= query.toBlock!);
    }

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Get anchor by ID
   */
  async getAnchor(anchorId: string): Promise<AnchoredRecord | null> {
    this.ensureConnected();
    return this.anchors.get(anchorId) ?? null;
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    this.ensureConnected();
    return this.currentBlockNumber;
  }

  /**
   * Wait for confirmation (immediate in memory adapter)
   */
  async waitForConfirmation(_transactionHash: string, _confirmations?: number): Promise<boolean> {
    this.ensureConnected();
    // In memory, transactions are immediately confirmed
    return true;
  }

  /**
   * Get all anchors (for testing)
   */
  getAllAnchors(): AnchoredRecord[] {
    return Array.from(this.anchors.values());
  }

  /**
   * Get all blocks (for testing)
   */
  getAllBlocks(): Block[] {
    return [...this.blocks];
  }

  /**
   * Reset state (for testing)
   */
  reset(): void {
    this.anchors.clear();
    this.anchorsByMerkleRoot.clear();
    this.anchorsByTxHash.clear();
    this.blocks = [];
    this.currentBlockNumber = 0;

    // Re-create genesis block
    this.blocks.push({
      number: 0,
      hash: '0'.repeat(64),
      timestamp: new Date().toISOString(),
      transactions: [],
    });
  }

  private generateTransactionHash(): string {
    return (
      '0x' +
      Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    );
  }

  private generateBlockHash(blockNumber: number): string {
    const data = `block_${blockNumber}_${Date.now()}`;
    // Simple hash simulation
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}
