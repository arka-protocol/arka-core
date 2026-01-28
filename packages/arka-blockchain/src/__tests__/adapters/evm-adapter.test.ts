/**
 * EVM Blockchain Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EVMBlockchainAdapter,
  createEthereumAdapter,
  createPolygonAdapter,
  createEVMAdapter,
  type EVMConfig,
} from '../../adapters/evm.js';
import type { BlockchainConfig } from '../../types.js';

describe('EVMBlockchainAdapter', () => {
  let adapter: EVMBlockchainAdapter;
  const defaultConfig: EVMConfig = {
    chainId: 1,
    rpcUrl: 'https://eth-mainnet.example.com',
    contracts: {
      auditAnchor: '0x1234567890123456789012345678901234567890',
      ruleNFT: '0x2345678901234567890123456789012345678901',
      didRegistry: '0x3456789012345678901234567890123456789012',
      complianceOracle: '0x4567890123456789012345678901234567890123',
    },
  };

  beforeEach(() => {
    adapter = new EVMBlockchainAdapter('test-evm', 'ethereum', defaultConfig);
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
  });

  describe('Connection', () => {
    it('should connect to EVM chain', async () => {
      await adapter.connect({} as BlockchainConfig);
      expect(adapter.isConnected()).toBe(true);
    });

    it('should disconnect from EVM chain', async () => {
      await adapter.connect({} as BlockchainConfig);
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });

    it('should get health status', async () => {
      await adapter.connect({} as BlockchainConfig);
      const health = await adapter.getHealth();
      expect(health.connected).toBe(true);
      expect(health.blockHeight).toBeGreaterThan(0);
    });

    it('should return error health when disconnected', async () => {
      const health = await adapter.getHealth();
      expect(health.connected).toBe(false);
      expect(health.error).toBeDefined();
    });
  });

  describe('Anchoring', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should anchor a batch', async () => {
      const result = await adapter.anchor({
        batchId: 'batch-001',
        merkleRoot: '0x' + '1'.repeat(64),
        recordCount: 10,
        metadata: { test: true },
      });

      expect(result.anchorId).toBeDefined();
      expect(result.transactionHash).toMatch(/^0x/);
      expect(result.blockNumber).toBeGreaterThan(0);
      expect(result.merkleRoot).toBe('0x' + '1'.repeat(64));
      expect(result.recordCount).toBe(10);
    });

    it('should verify anchored merkle root', async () => {
      const merkleRoot = '0x' + '2'.repeat(64);
      await adapter.anchor({
        batchId: 'batch-002',
        merkleRoot,
        recordCount: 5,
      });

      const verification = await adapter.verify(merkleRoot);
      expect(verification.verified).toBe(true);
      expect(verification.anchor).toBeDefined();
    });

    it('should return false for non-existent merkle root', async () => {
      const verification = await adapter.verify('0x' + 'f'.repeat(64));
      expect(verification.verified).toBe(false);
    });
  });

  describe('Audit Anchoring', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should anchor audit components', async () => {
      const anchor = await adapter.anchorAudit({
        eventSnapshot: { type: 'payment', amount: 1000 },
        ruleSetSnapshot: { rules: ['rule1', 'rule2'] },
        decision: { action: 'approve', confidence: 0.95 },
        aiProposal: { recommendation: 'approve' },
      });

      expect(anchor.anchorId).toBeDefined();
      expect(anchor.hash).toBeDefined();
      expect(anchor.componentHashes.eventSnapshot).toBeDefined();
      expect(anchor.componentHashes.ruleSetSnapshot).toBeDefined();
      expect(anchor.componentHashes.decision).toBeDefined();
      expect(anchor.componentHashes.aiProposal).toBeDefined();
      expect(anchor.blockchain).toBeDefined();
    });

    it('should verify audit anchor', async () => {
      const anchor = await adapter.anchorAudit({
        eventSnapshot: { type: 'transfer' },
        ruleSetSnapshot: { rules: [] },
        decision: { action: 'deny' },
      });

      const verification = await adapter.verifyAuditAnchor(anchor.hash);
      expect(verification.verified).toBe(true);
    });

    it('should get audit anchor by ID', async () => {
      const anchor = await adapter.anchorAudit({
        eventSnapshot: { data: 'test' },
        ruleSetSnapshot: { rules: ['r1'] },
        decision: { action: 'approve' },
      });

      const retrieved = await adapter.getAuditAnchor(anchor.anchorId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.anchorId).toBe(anchor.anchorId);
    });
  });

  describe('Rule NFTs', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should mint a rule NFT', async () => {
      const rule = {
        id: 'rule-001',
        name: 'AML Threshold Rule',
        description: 'Flags transactions over $10,000',
        severity: 'high' as const,
        condition: { type: 'threshold', value: 10000 },
        consequence: { action: 'flag' },
        jurisdiction: 'US',
        effectiveFrom: new Date().toISOString(),
      };

      const nft = await adapter.mintRuleNFT(rule, 1);

      expect(nft.metadata.tokenId).toBeDefined();
      expect(nft.metadata.ruleId).toBe('rule-001');
      expect(nft.metadata.version).toBe(1);
      expect(nft.metadata.dslHash).toBeDefined();
      expect(nft.metadata.soulbound).toBe(true);
      expect(nft.blockchain).toBeDefined();
    });

    it('should get rule NFT by token ID', async () => {
      const rule = {
        id: 'rule-002',
        name: 'KYC Rule',
        severity: 'medium' as const,
        condition: { type: 'kyc_required' },
        consequence: { action: 'require_kyc' },
      };

      const nft = await adapter.mintRuleNFT(rule, 1);
      const retrieved = await adapter.getRuleNFT(nft.metadata.tokenId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.metadata.ruleId).toBe('rule-002');
    });

    it('should get all versions of a rule', async () => {
      const ruleBase = {
        id: 'rule-003',
        name: 'Version Test Rule',
        severity: 'low' as const,
        condition: { type: 'test' },
        consequence: { action: 'log' },
      };

      await adapter.mintRuleNFT(ruleBase, 1);
      await adapter.mintRuleNFT({ ...ruleBase, name: 'Version Test Rule v2' }, 2);

      const versions = await adapter.getRuleVersions('rule-003');
      expect(versions.length).toBe(2);
      expect(versions[0].metadata.version).toBe(1);
      expect(versions[1].metadata.version).toBe(2);
    });

    it('should verify rule version', async () => {
      const rule = {
        id: 'rule-004',
        name: 'Verify Test',
        severity: 'high' as const,
        condition: { type: 'verify' },
        consequence: { action: 'verify' },
      };

      await adapter.mintRuleNFT(rule, 1);
      const verification = await adapter.verifyRuleVersion(rule);
      expect(verification.verified).toBe(true);
    });
  });

  describe('Entity Identity', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should register entity identity', async () => {
      const binding = {
        bindingId: 'binding-001',
        entityId: 'entity-001',
        entityType: 'Organization',
        identityType: 'did' as const,
        blockchainIdentity: 'did:arka:entity:organization:entity-001',
        entityHash: '0x' + 'a'.repeat(64),
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      const result = await adapter.registerEntityIdentity(binding);
      expect(result.blockchain).toBeDefined();
      expect(result.blockchain?.transactionHash).toMatch(/^0x/);
    });

    it('should get entity binding', async () => {
      const binding = {
        bindingId: 'binding-002',
        entityId: 'entity-002',
        entityType: 'Person',
        identityType: 'did' as const,
        blockchainIdentity: 'did:arka:entity:person:entity-002',
        entityHash: '0x' + 'b'.repeat(64),
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      await adapter.registerEntityIdentity(binding);
      const retrieved = await adapter.getEntityBinding('entity-002');
      expect(retrieved).toBeDefined();
      expect(retrieved?.entityType).toBe('Person');
    });

    it('should resolve DID', async () => {
      const did = 'did:arka:entity:organization:entity-003';
      const binding = {
        bindingId: 'binding-003',
        entityId: 'entity-003',
        entityType: 'Organization',
        identityType: 'did' as const,
        blockchainIdentity: did,
        entityHash: '0x' + 'c'.repeat(64),
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      await adapter.registerEntityIdentity(binding);
      const resolved = await adapter.resolveDID(did);
      expect(resolved).toBeDefined();
      expect(resolved?.entityId).toBe('entity-003');
    });

    it('should revoke entity identity', async () => {
      const binding = {
        bindingId: 'binding-004',
        entityId: 'entity-004',
        entityType: 'Person',
        identityType: 'did' as const,
        blockchainIdentity: 'did:arka:entity:person:entity-004',
        entityHash: '0x' + 'd'.repeat(64),
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      await adapter.registerEntityIdentity(binding);
      const revoked = await adapter.revokeEntityIdentity('binding-004');
      expect(revoked).toBe(true);
    });
  });

  describe('Oracle Attestations', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should submit oracle attestation', async () => {
      const attestation = {
        attestationId: 'attest-001',
        eventId: 'event-001',
        eventHash: '0x' + 'e'.repeat(64),
        oracleNode: 'oracle-node-1',
        verification: {
          verified: true,
          details: { signatureValid: true },
          confidence: 95,
          errors: [],
          warnings: [],
        },
        verifiedAt: new Date().toISOString(),
        oracleSignature: 'sig123',
      };

      const result = await adapter.submitOracleAttestation(attestation);
      expect(result.blockchain).toBeDefined();
      expect(result.blockchain?.transactionHash).toMatch(/^0x/);
    });

    it('should verify oracle attestation', async () => {
      const attestation = {
        attestationId: 'attest-002',
        eventId: 'event-002',
        eventHash: '0x' + 'f'.repeat(64),
        oracleNode: 'oracle-node-2',
        verification: {
          verified: true,
          details: {},
          confidence: 90,
          errors: [],
          warnings: [],
        },
        verifiedAt: new Date().toISOString(),
        oracleSignature: 'sig456',
      };

      await adapter.submitOracleAttestation(attestation);
      const verification = await adapter.verifyOracleAttestation('attest-002');
      expect(verification.verified).toBe(true);
    });
  });

  describe('Chain Utilities', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should get gas price', async () => {
      const gasPrice = await adapter.getGasPrice();
      expect(gasPrice).toBeGreaterThan(0n);
    });

    it('should get balance', async () => {
      const balance = await adapter.getBalance('0x' + '1'.repeat(40));
      expect(balance).toBeGreaterThan(0n);
    });

    it('should get block number', async () => {
      const blockNumber = await adapter.getBlockNumber();
      expect(blockNumber).toBeGreaterThan(0);
    });

    it('should wait for confirmation', async () => {
      const anchor = await adapter.anchor({
        batchId: 'confirm-test',
        merkleRoot: '0x' + 'a'.repeat(64),
        recordCount: 1,
      });

      const confirmed = await adapter.waitForConfirmation(anchor.transactionHash);
      expect(confirmed).toBe(true);
    });
  });

  describe('Event Subscription', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should subscribe to events', async () => {
      const events: any[] = [];
      const unsubscribe = adapter.subscribe((event) => {
        events.push(event);
      });

      await adapter.anchor({
        batchId: 'event-test',
        merkleRoot: '0x' + 'b'.repeat(64),
        recordCount: 1,
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'anchored')).toBe(true);

      unsubscribe();
    });
  });
});

describe('Factory Functions', () => {
  it('should create Ethereum adapter', () => {
    const adapter = createEthereumAdapter({
      chainId: 1,
      rpcUrl: 'https://eth.example.com',
      contracts: {},
    });

    expect(adapter.id).toBe('ethereum-adapter');
    expect(adapter.network).toBe('ethereum');
    expect(adapter.chainType).toBe('evm');
  });

  it('should create Polygon adapter', () => {
    const adapter = createPolygonAdapter({
      chainId: 137,
      rpcUrl: 'https://polygon.example.com',
      contracts: {},
    });

    expect(adapter.id).toBe('polygon-adapter');
    expect(adapter.network).toBe('polygon');
    expect(adapter.chainType).toBe('evm');
  });

  it('should create custom EVM adapter', () => {
    const adapter = createEVMAdapter('custom-chain', 'custom', {
      chainId: 12345,
      rpcUrl: 'https://custom.example.com',
      contracts: {},
    });

    expect(adapter.id).toBe('custom-chain');
    expect(adapter.network).toBe('custom');
    expect(adapter.chainType).toBe('evm');
  });
});
