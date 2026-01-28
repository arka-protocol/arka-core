/**
 * Gossip Service
 *
 * P2P message propagation for consensus messages.
 */

import type {
  GossipMessage,
  GossipMessageType,
  BlockProposal,
  Vote,
  SlashingEvent,
  ValidatorConfig,
} from './types.js';
import { hashData } from '@arka/crypto';

/**
 * Gossip peer information
 */
export interface GossipPeer {
  /** Peer ID */
  id: string;
  /** Peer address */
  address: string;
  /** Validator address if peer is a validator */
  validatorAddress?: string;
  /** Last seen timestamp */
  lastSeen: number;
  /** Connection status */
  status: 'connected' | 'disconnected' | 'connecting';
  /** Message latency (ms) */
  latency?: number;
}

/**
 * Gossip message handler
 */
export type GossipMessageHandler = (
  message: GossipMessage,
  peer: GossipPeer
) => void | Promise<void>;

/**
 * Gossip service configuration
 */
export interface GossipConfig {
  /** Maximum peers to connect */
  maxPeers: number;
  /** Message TTL (hops) */
  messageTtl: number;
  /** Heartbeat interval (ms) */
  heartbeatIntervalMs: number;
  /** Peer timeout (ms) */
  peerTimeoutMs: number;
  /** Deduplication cache size */
  deduplicationCacheSize: number;
}

/**
 * Default gossip configuration
 */
export const DEFAULT_GOSSIP_CONFIG: GossipConfig = {
  maxPeers: 50,
  messageTtl: 5,
  heartbeatIntervalMs: 5000,
  peerTimeoutMs: 30000,
  deduplicationCacheSize: 10000,
};

/**
 * Gossip service for P2P message propagation
 */
export class GossipService {
  private config: GossipConfig;
  private peers: Map<string, GossipPeer> = new Map();
  private messageCache: Set<string> = new Set();
  private handlers: Map<GossipMessageType, Set<GossipMessageHandler>> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private running: boolean = false;

  constructor(config: Partial<GossipConfig> = {}) {
    this.config = { ...DEFAULT_GOSSIP_CONFIG, ...config };
  }

  /**
   * Start gossip service
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    this.heartbeatTimer = setInterval(() => {
      this.heartbeat();
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Stop gossip service
   */
  stop(): void {
    this.running = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Heartbeat to check peer health
   */
  private heartbeat(): void {
    const now = Date.now();
    const timeout = this.config.peerTimeoutMs;

    for (const [id, peer] of this.peers) {
      if (now - peer.lastSeen > timeout) {
        peer.status = 'disconnected';
      }
    }

    // Prune message cache
    if (this.messageCache.size > this.config.deduplicationCacheSize) {
      const toRemove = this.messageCache.size - this.config.deduplicationCacheSize;
      const iterator = this.messageCache.values();
      for (let i = 0; i < toRemove; i++) {
        const value = iterator.next().value;
        if (value) {
          this.messageCache.delete(value);
        }
      }
    }
  }

  /**
   * Add a peer
   */
  addPeer(peer: GossipPeer): void {
    if (this.peers.size >= this.config.maxPeers) {
      // Remove oldest disconnected peer
      let oldestDisconnected: [string, GossipPeer] | null = null;
      for (const entry of this.peers) {
        if (entry[1].status === 'disconnected') {
          if (!oldestDisconnected || entry[1].lastSeen < oldestDisconnected[1].lastSeen) {
            oldestDisconnected = entry;
          }
        }
      }
      if (oldestDisconnected) {
        this.peers.delete(oldestDisconnected[0]);
      } else {
        return; // Can't add more peers
      }
    }

    this.peers.set(peer.id, peer);
  }

  /**
   * Remove a peer
   */
  removePeer(peerId: string): boolean {
    return this.peers.delete(peerId);
  }

  /**
   * Get all peers
   */
  getPeers(): GossipPeer[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get connected peers
   */
  getConnectedPeers(): GossipPeer[] {
    return Array.from(this.peers.values()).filter(
      (p) => p.status === 'connected'
    );
  }

  /**
   * Update peer last seen
   */
  updatePeerLastSeen(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.lastSeen = Date.now();
      peer.status = 'connected';
    }
  }

  /**
   * Register message handler
   */
  on(type: GossipMessageType, handler: GossipMessageHandler): () => void {
    let handlers = this.handlers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(type, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers?.delete(handler);
    };
  }

  /**
   * Broadcast a message to all peers
   */
  broadcast(message: GossipMessage): void {
    const messageId = this.getMessageId(message);

    // Check deduplication
    if (this.messageCache.has(messageId)) {
      return;
    }
    this.messageCache.add(messageId);

    // Send to all connected peers
    for (const peer of this.getConnectedPeers()) {
      this.sendToPeer(peer, message);
    }
  }

  /**
   * Send message to specific peer
   */
  private sendToPeer(peer: GossipPeer, message: GossipMessage): void {
    // In a real implementation, this would send over network
    // For now, this is a placeholder
    console.log(`[Gossip] Sending ${message.type} to ${peer.id}`);
  }

  /**
   * Receive a message from a peer
   */
  async receiveMessage(message: GossipMessage, peer: GossipPeer): Promise<void> {
    // Update peer last seen
    this.updatePeerLastSeen(peer.id);

    // Check deduplication
    const messageId = this.getMessageId(message);
    if (this.messageCache.has(messageId)) {
      return;
    }
    this.messageCache.add(messageId);

    // Call handlers
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(message, peer);
        } catch (error) {
          console.error(`[Gossip] Handler error for ${message.type}:`, error);
        }
      }
    }

    // Relay to other peers (gossip propagation)
    for (const otherPeer of this.getConnectedPeers()) {
      if (otherPeer.id !== peer.id) {
        this.sendToPeer(otherPeer, message);
      }
    }
  }

  /**
   * Get unique message ID for deduplication
   */
  private getMessageId(message: GossipMessage): string {
    const content = JSON.stringify({
      type: message.type,
      sender: message.sender,
      payload: message.payload,
      timestamp: message.timestamp,
    });
    return hashData(content);
  }

  /**
   * Create a gossip message for a proposal
   */
  createProposalMessage(
    proposal: BlockProposal,
    senderAddress: string,
    privateKey: string
  ): GossipMessage {
    const timestamp = new Date().toISOString();
    const content = JSON.stringify({ proposal, timestamp });
    const signature = hashData(`${privateKey}:${content}`);

    return {
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
      type: 'proposal',
      sender: senderAddress,
      payload: proposal,
      signature,
      timestamp,
    };
  }

  /**
   * Create a gossip message for a vote
   */
  createVoteMessage(
    vote: Vote,
    senderAddress: string,
    privateKey: string
  ): GossipMessage {
    const timestamp = new Date().toISOString();
    const content = JSON.stringify({ vote, timestamp });
    const signature = hashData(`${privateKey}:${content}`);

    return {
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
      type: 'vote',
      sender: senderAddress,
      payload: vote,
      signature,
      timestamp,
    };
  }

  /**
   * Create a gossip message for slashing event
   */
  createSlashingMessage(
    event: SlashingEvent,
    senderAddress: string,
    privateKey: string
  ): GossipMessage {
    const timestamp = new Date().toISOString();
    const content = JSON.stringify({ event, timestamp });
    const signature = hashData(`${privateKey}:${content}`);

    return {
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
      type: 'slashing',
      sender: senderAddress,
      payload: event,
      signature,
      timestamp,
    };
  }

  /**
   * Create a gossip message for validator update
   */
  createValidatorUpdateMessage(
    validator: ValidatorConfig,
    senderAddress: string,
    privateKey: string
  ): GossipMessage {
    const timestamp = new Date().toISOString();
    const content = JSON.stringify({ validator, timestamp });
    const signature = hashData(`${privateKey}:${content}`);

    return {
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
      type: 'validator_update',
      sender: senderAddress,
      payload: validator,
      signature,
      timestamp,
    };
  }

  /**
   * Get gossip statistics
   */
  getStats(): {
    totalPeers: number;
    connectedPeers: number;
    messageCacheSize: number;
  } {
    return {
      totalPeers: this.peers.size,
      connectedPeers: this.getConnectedPeers().length,
      messageCacheSize: this.messageCache.size,
    };
  }
}

/**
 * Create gossip service instance
 */
export function createGossipService(
  config?: Partial<GossipConfig>
): GossipService {
  return new GossipService(config);
}
