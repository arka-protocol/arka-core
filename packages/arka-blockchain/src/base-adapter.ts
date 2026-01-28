/**
 * Base Blockchain Adapter
 *
 * Abstract implementation providing common functionality
 * for all blockchain adapters.
 */

import type {
  BlockchainAdapter,
  BlockchainConfig,
  BlockchainHealth,
  BlockchainNetwork,
  BlockchainEvent,
  BlockchainEventHandler,
  AnchorRequest,
  AnchoredRecord,
  AnchorQuery,
  VerificationResult,
} from './types.js';
import type { MerkleProof } from '@arka-protocol/crypto';
import { verifyMerkleProof } from '@arka-protocol/crypto';

/**
 * Abstract base class for blockchain adapters
 */
export abstract class BaseBlockchainAdapter implements BlockchainAdapter {
  abstract readonly id: string;
  abstract readonly network: BlockchainNetwork;

  protected config: BlockchainConfig | null = null;
  protected connected = false;
  protected eventHandlers: Set<BlockchainEventHandler> = new Set();
  protected lastActivity: string | null = null;

  /**
   * Connect to the blockchain network
   */
  abstract connect(config: BlockchainConfig): Promise<void>;

  /**
   * Disconnect from the blockchain network
   */
  abstract disconnect(): Promise<void>;

  /**
   * Anchor a batch to the blockchain
   */
  abstract anchor(request: AnchorRequest): Promise<AnchoredRecord>;

  /**
   * Verify a merkle root exists on chain
   */
  abstract verify(merkleRoot: string): Promise<VerificationResult>;

  /**
   * Query anchored records
   */
  abstract query(query: AnchorQuery): Promise<AnchoredRecord[]>;

  /**
   * Get anchor by ID
   */
  abstract getAnchor(anchorId: string): Promise<AnchoredRecord | null>;

  /**
   * Get current block number
   */
  abstract getBlockNumber(): Promise<number>;

  /**
   * Wait for transaction confirmation
   */
  abstract waitForConfirmation(transactionHash: string, confirmations?: number): Promise<boolean>;

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<BlockchainHealth> {
    if (!this.connected) {
      return {
        connected: false,
        network: this.network,
        error: 'Not connected',
      };
    }

    try {
      const blockHeight = await this.getBlockNumber();
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

  /**
   * Verify a specific item within an anchored batch
   */
  async verifyItem(merkleRoot: string, proof: MerkleProof): Promise<VerificationResult> {
    // First verify the merkle root exists on chain
    const rootVerification = await this.verify(merkleRoot);

    if (!rootVerification.verified) {
      return {
        verified: false,
        error: rootVerification.error ?? 'Merkle root not found on chain',
      };
    }

    // Then verify the proof is valid
    const proofValid = verifyMerkleProof(proof);

    if (!proofValid) {
      return {
        verified: false,
        error: 'Invalid merkle proof',
        anchor: rootVerification.anchor,
      };
    }

    // Check the proof's root matches the anchored root
    if (proof.root !== merkleRoot) {
      return {
        verified: false,
        error: 'Proof root does not match anchored merkle root',
        anchor: rootVerification.anchor,
      };
    }

    return {
      verified: true,
      anchor: rootVerification.anchor,
      proof,
    };
  }

  /**
   * Subscribe to blockchain events
   */
  subscribe(handler: BlockchainEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Emit an event to all subscribers
   */
  protected async emitEvent(event: BlockchainEvent): Promise<void> {
    this.lastActivity = new Date().toISOString();

    for (const handler of this.eventHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Error in blockchain event handler:', error);
      }
    }
  }

  /**
   * Ensure connected before operation
   */
  protected ensureConnected(): void {
    if (!this.connected) {
      throw new Error(`${this.id}: Not connected to blockchain`);
    }
  }

  /**
   * Generate a unique anchor ID
   */
  protected generateAnchorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `anchor_${timestamp}_${random}`;
  }
}
