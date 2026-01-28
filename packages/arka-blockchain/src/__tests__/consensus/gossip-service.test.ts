/**
 * Tests for Gossip Service
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GossipService,
  createGossipService,
  DEFAULT_GOSSIP_CONFIG,
  type GossipMessage,
  type GossipPeer,
} from '../../consensus/index.js';

describe('GossipService', () => {
  let service: GossipService;

  beforeEach(() => {
    service = createGossipService({ heartbeatIntervalMs: 10000 });
  });

  afterEach(() => {
    service.stop();
  });

  describe('start/stop', () => {
    it('should start and stop without errors', () => {
      service.start();
      // Service should be running (no public isRunning method, but no error)
      service.stop();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle multiple starts gracefully', () => {
      service.start();
      service.start(); // Second start should not throw
      expect(true).toBe(true);
    });

    it('should handle stop when not running', () => {
      service.stop(); // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('addPeer', () => {
    it('should add a peer', () => {
      service.start();

      const peer: GossipPeer = {
        id: 'peer-1',
        address: '127.0.0.1:8000',
        status: 'connected',
        lastSeen: Date.now(),
      };

      service.addPeer(peer);

      const peers = service.getPeers();
      expect(peers.length).toBe(1);
      expect(peers[0]!.id).toBe('peer-1');
    });

    it('should update existing peer', () => {
      service.start();

      service.addPeer({
        id: 'peer-1',
        address: '127.0.0.1:8000',
        status: 'connected',
        lastSeen: Date.now(),
      });

      // Adding peer with same id updates it
      service.addPeer({
        id: 'peer-1',
        address: '127.0.0.1:9000',
        status: 'connected',
        lastSeen: Date.now(),
      });

      const peers = service.getPeers();
      expect(peers.length).toBe(1);
      expect(peers[0]!.address).toBe('127.0.0.1:9000');
    });
  });

  describe('removePeer', () => {
    it('should remove a peer', () => {
      service.start();

      service.addPeer({
        id: 'peer-1',
        address: '127.0.0.1:8000',
        status: 'connected',
        lastSeen: Date.now(),
      });

      const removed = service.removePeer('peer-1');

      expect(removed).toBe(true);
      expect(service.getPeers().length).toBe(0);
    });

    it('should handle removing non-existent peer', () => {
      service.start();

      const removed = service.removePeer('non-existent');

      expect(removed).toBe(false);
      expect(service.getPeers().length).toBe(0);
    });
  });

  describe('broadcast', () => {
    it('should broadcast message to all peers', () => {
      service.start();

      service.addPeer({
        id: 'peer-1',
        address: '127.0.0.1:8000',
        status: 'connected',
        lastSeen: Date.now(),
      });

      service.addPeer({
        id: 'peer-2',
        address: '127.0.0.1:8001',
        status: 'connected',
        lastSeen: Date.now(),
      });

      const message: GossipMessage = {
        id: 'msg-1',
        type: 'proposal',
        sender: 'node-1',
        payload: { data: 'test' },
        signature: 'sig',
        timestamp: new Date().toISOString(),
      };

      // Should not throw
      service.broadcast(message);
      expect(true).toBe(true);
    });

    it('should deduplicate messages', async () => {
      service.start();
      const received: GossipMessage[] = [];

      const peer: GossipPeer = {
        id: 'peer-1',
        address: '127.0.0.1:8000',
        status: 'connected',
        lastSeen: Date.now(),
      };

      service.on('proposal', (msg) => {
        received.push(msg);
      });

      const message: GossipMessage = {
        id: 'msg-1',
        type: 'proposal',
        sender: 'peer-1',
        payload: { data: 'test' },
        signature: 'sig',
        timestamp: new Date().toISOString(),
      };

      // Receive same message twice
      await service.receiveMessage(message, peer);
      await service.receiveMessage(message, peer);

      // Should only be processed once due to deduplication
      expect(received.length).toBe(1);
    });
  });

  describe('on (subscribe)', () => {
    it('should notify subscribers of received messages', async () => {
      service.start();
      const received: GossipMessage[] = [];

      const peer: GossipPeer = {
        id: 'peer-1',
        address: '127.0.0.1:8000',
        status: 'connected',
        lastSeen: Date.now(),
      };

      service.on('proposal', (msg) => {
        received.push(msg);
      });

      const message: GossipMessage = {
        id: 'msg-1',
        type: 'proposal',
        sender: 'peer-1',
        payload: { data: 'test' },
        signature: 'sig',
        timestamp: new Date().toISOString(),
      };

      await service.receiveMessage(message, peer);

      expect(received.length).toBe(1);
      expect(received[0]!.id).toBe('msg-1');
    });

    it('should return unsubscribe function', async () => {
      service.start();
      const received: GossipMessage[] = [];

      const peer: GossipPeer = {
        id: 'peer-1',
        address: '127.0.0.1:8000',
        status: 'connected',
        lastSeen: Date.now(),
      };

      const unsubscribe = service.on('proposal', (msg) => {
        received.push(msg);
      });

      const message1: GossipMessage = {
        id: 'msg-1',
        type: 'proposal',
        sender: 'peer-1',
        payload: {},
        signature: 'sig',
        timestamp: new Date().toISOString(),
      };

      await service.receiveMessage(message1, peer);
      expect(received.length).toBe(1);

      unsubscribe();

      const message2: GossipMessage = {
        id: 'msg-2',
        type: 'proposal',
        sender: 'peer-1',
        payload: {},
        signature: 'sig',
        timestamp: new Date().toISOString(),
      };

      await service.receiveMessage(message2, peer);
      expect(received.length).toBe(1); // Still 1 after unsubscribe
    });
  });

  describe('getPeers', () => {
    it('should return all peers', () => {
      service.start();

      service.addPeer({
        id: 'peer-1',
        address: '127.0.0.1:8000',
        status: 'connected',
        lastSeen: Date.now(),
      });

      service.addPeer({
        id: 'peer-2',
        address: '127.0.0.1:8001',
        status: 'connected',
        lastSeen: Date.now(),
      });

      const peers = service.getPeers();

      expect(peers.length).toBe(2);
    });

    it('should return empty array when no peers', () => {
      const peers = service.getPeers();

      expect(peers).toEqual([]);
    });
  });

  describe('getConnectedPeers', () => {
    it('should return only connected peers', () => {
      service.start();

      service.addPeer({
        id: 'peer-1',
        address: '127.0.0.1:8000',
        status: 'connected',
        lastSeen: Date.now(),
      });

      service.addPeer({
        id: 'peer-2',
        address: '127.0.0.1:8001',
        status: 'disconnected',
        lastSeen: Date.now(),
      });

      const connectedPeers = service.getConnectedPeers();

      expect(connectedPeers.length).toBe(1);
      expect(connectedPeers[0]!.id).toBe('peer-1');
    });
  });

  describe('getStats', () => {
    it('should return gossip statistics', async () => {
      service.start();

      service.addPeer({
        id: 'peer-1',
        address: '127.0.0.1:8000',
        status: 'connected',
        lastSeen: Date.now(),
      });

      const peer: GossipPeer = {
        id: 'peer-1',
        address: '127.0.0.1:8000',
        status: 'connected',
        lastSeen: Date.now(),
      };

      const message: GossipMessage = {
        id: 'msg-1',
        type: 'proposal',
        sender: 'peer-1',
        payload: {},
        signature: 'sig',
        timestamp: new Date().toISOString(),
      };

      await service.receiveMessage(message, peer);

      const stats = service.getStats();

      expect(stats.totalPeers).toBe(1);
      expect(stats.connectedPeers).toBe(1);
      expect(stats.messageCacheSize).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('DEFAULT_GOSSIP_CONFIG', () => {
  it('should have reasonable defaults', () => {
    expect(DEFAULT_GOSSIP_CONFIG.maxPeers).toBeGreaterThan(0);
    expect(DEFAULT_GOSSIP_CONFIG.heartbeatIntervalMs).toBeGreaterThan(0);
    expect(DEFAULT_GOSSIP_CONFIG.peerTimeoutMs).toBeGreaterThan(0);
    expect(DEFAULT_GOSSIP_CONFIG.deduplicationCacheSize).toBeGreaterThan(0);
    expect(DEFAULT_GOSSIP_CONFIG.messageTtl).toBeGreaterThan(0);
  });
});

describe('GossipMessage types', () => {
  let service: GossipService;

  beforeEach(() => {
    service = createGossipService();
    service.start();
  });

  afterEach(() => {
    service.stop();
  });

  it('should handle proposal messages', async () => {
    const received: GossipMessage[] = [];
    const peer: GossipPeer = {
      id: 'peer-1',
      address: '127.0.0.1:8000',
      status: 'connected',
      lastSeen: Date.now(),
    };

    service.on('proposal', (msg) => received.push(msg));

    await service.receiveMessage({
      id: 'msg-1',
      type: 'proposal',
      sender: 'peer-1',
      payload: { blockHash: 'hash', height: 100 },
      signature: 'sig',
      timestamp: new Date().toISOString(),
    }, peer);

    expect(received[0]!.type).toBe('proposal');
  });

  it('should handle vote messages', async () => {
    const received: GossipMessage[] = [];
    const peer: GossipPeer = {
      id: 'peer-1',
      address: '127.0.0.1:8000',
      status: 'connected',
      lastSeen: Date.now(),
    };

    service.on('vote', (msg) => received.push(msg));

    await service.receiveMessage({
      id: 'msg-1',
      type: 'vote',
      sender: 'peer-1',
      payload: { voteType: 'prevote', blockHash: 'hash' },
      signature: 'sig',
      timestamp: new Date().toISOString(),
    }, peer);

    expect(received[0]!.type).toBe('vote');
  });

  it('should handle slashing messages', async () => {
    const received: GossipMessage[] = [];
    const peer: GossipPeer = {
      id: 'peer-1',
      address: '127.0.0.1:8000',
      status: 'connected',
      lastSeen: Date.now(),
    };

    service.on('slashing', (msg) => received.push(msg));

    await service.receiveMessage({
      id: 'msg-1',
      type: 'slashing',
      sender: 'peer-1',
      payload: { validator: 'v1', reason: 'equivocation' },
      signature: 'sig',
      timestamp: new Date().toISOString(),
    }, peer);

    expect(received[0]!.type).toBe('slashing');
  });

  it('should handle validator_update messages', async () => {
    const received: GossipMessage[] = [];
    const peer: GossipPeer = {
      id: 'peer-1',
      address: '127.0.0.1:8000',
      status: 'connected',
      lastSeen: Date.now(),
    };

    service.on('validator_update', (msg) => received.push(msg));

    await service.receiveMessage({
      id: 'msg-1',
      type: 'validator_update',
      sender: 'peer-1',
      payload: { validator: 'v1', status: 'active' },
      signature: 'sig',
      timestamp: new Date().toISOString(),
    }, peer);

    expect(received[0]!.type).toBe('validator_update');
  });
});
