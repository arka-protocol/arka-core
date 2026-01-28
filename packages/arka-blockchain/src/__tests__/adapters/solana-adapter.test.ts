/**
 * Solana Blockchain Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SolanaBlockchainAdapter,
  createSolanaAdapter,
  createSolanaDevnetAdapter,
  type SolanaConfig,
} from '../../adapters/solana.js';
import type { BlockchainConfig } from '../../types.js';

describe('SolanaBlockchainAdapter', () => {
  let adapter: SolanaBlockchainAdapter;
  const defaultConfig: SolanaConfig = {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    programIds: {
      auditAnchor: 'AuditAnchorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
      ruleNFT: 'RuleNFTrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
      didRegistry: 'DIDRegistryrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
      complianceOracle: 'OracleAttestrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
    },
    commitment: 'confirmed',
  };

  beforeEach(() => {
    adapter = new SolanaBlockchainAdapter(defaultConfig);
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
  });

  describe('Connection', () => {
    it('should connect to Solana', async () => {
      await adapter.connect({} as BlockchainConfig);
      expect(adapter.isConnected()).toBe(true);
    });

    it('should disconnect from Solana', async () => {
      await adapter.connect({} as BlockchainConfig);
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });

    it('should get health status when connected', async () => {
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

    it('should anchor a batch to Solana', async () => {
      const result = await adapter.anchor({
        batchId: 'solana-batch-001',
        merkleRoot: 'merkle_root_hash_value_here',
        recordCount: 5,
        metadata: { source: 'test' },
      });

      expect(result.anchorId).toBeDefined();
      expect(result.transactionHash).toBeDefined();
      expect(result.blockNumber).toBeGreaterThan(0);
      expect(result.merkleRoot).toBe('merkle_root_hash_value_here');
      expect(result.network).toBe('solana');
    });

    it('should verify anchored merkle root', async () => {
      const merkleRoot = 'unique_merkle_root_123';
      await adapter.anchor({
        batchId: 'solana-batch-002',
        merkleRoot,
        recordCount: 3,
      });

      const verification = await adapter.verify(merkleRoot);
      expect(verification.verified).toBe(true);
      expect(verification.anchor).toBeDefined();
    });

    it('should return false for non-existent merkle root', async () => {
      const verification = await adapter.verify('non_existent_root');
      expect(verification.verified).toBe(false);
    });
  });

  describe('Audit Anchoring', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should anchor audit components', async () => {
      const anchor = await adapter.anchorAudit({
        eventSnapshot: { type: 'sol_transfer', lamports: 1000000 },
        ruleSetSnapshot: { rules: ['sol_rule_1'] },
        decision: { action: 'approve', program: 'test' },
      });

      expect(anchor.anchorId).toBeDefined();
      expect(anchor.hash).toBeDefined();
      expect(anchor.componentHashes).toBeDefined();
      expect(anchor.blockchain?.network).toBe('solana');
    });

    it('should get audit anchor by ID', async () => {
      const anchor = await adapter.anchorAudit({
        eventSnapshot: { data: 'solana_test' },
        ruleSetSnapshot: { rules: [] },
        decision: { action: 'log' },
      });

      const retrieved = await adapter.getAuditAnchor(anchor.anchorId);
      expect(retrieved?.anchorId).toBe(anchor.anchorId);
    });
  });

  describe('Rule NFTs', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should mint a rule NFT on Solana', async () => {
      const rule = {
        id: 'sol-rule-001',
        name: 'Solana AML Rule',
        description: 'AML compliance for Solana',
        severity: 'high' as const,
        condition: { type: 'amount_threshold', lamports: 1000000000 },
        consequence: { action: 'flag' },
      };

      const nft = await adapter.mintRuleNFT(rule, 1);

      expect(nft.metadata.tokenId).toBeDefined();
      expect(nft.metadata.ruleId).toBe('sol-rule-001');
      expect(nft.metadata.soulbound).toBe(true);
      expect(nft.blockchain?.network).toBe('solana');
    });

    it('should get rule versions', async () => {
      const rule = {
        id: 'sol-rule-002',
        name: 'Solana Version Test',
        severity: 'medium' as const,
        condition: { type: 'test' },
        consequence: { action: 'log' },
      };

      await adapter.mintRuleNFT(rule, 1);
      await adapter.mintRuleNFT({ ...rule, name: 'Updated' }, 2);

      const versions = await adapter.getRuleVersions('sol-rule-002');
      expect(versions.length).toBe(2);
    });

    it('should verify rule version', async () => {
      const rule = {
        id: 'sol-rule-003',
        name: 'Verify Test',
        severity: 'low' as const,
        condition: { type: 'verify' },
        consequence: { action: 'approve' },
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
        bindingId: 'sol-binding-001',
        entityId: 'sol-entity-001',
        entityType: 'Program',
        identityType: 'did' as const,
        blockchainIdentity: 'did:sol:program:sol-entity-001',
        entityHash: 'abc123hash',
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      const result = await adapter.registerEntityIdentity(binding);
      expect(result.blockchain).toBeDefined();
      expect(result.blockchain?.network).toBe('solana');
    });

    it('should get entity binding', async () => {
      const binding = {
        bindingId: 'sol-binding-002',
        entityId: 'sol-entity-002',
        entityType: 'Account',
        identityType: 'did' as const,
        blockchainIdentity: 'did:sol:account:sol-entity-002',
        entityHash: 'def456hash',
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      await adapter.registerEntityIdentity(binding);
      const retrieved = await adapter.getEntityBinding('sol-entity-002');
      expect(retrieved?.entityType).toBe('Account');
    });

    it('should resolve DID', async () => {
      const did = 'did:sol:program:sol-entity-003';
      const binding = {
        bindingId: 'sol-binding-003',
        entityId: 'sol-entity-003',
        entityType: 'Program',
        identityType: 'did' as const,
        blockchainIdentity: did,
        entityHash: 'ghi789hash',
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      await adapter.registerEntityIdentity(binding);
      const resolved = await adapter.resolveDID(did);
      expect(resolved?.entityId).toBe('sol-entity-003');
    });
  });

  describe('Oracle Attestations', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should submit oracle attestation', async () => {
      const attestation = {
        attestationId: 'sol-attest-001',
        eventId: 'sol-event-001',
        eventHash: 'event_hash_123',
        oracleNode: 'solana-oracle-1',
        verification: {
          verified: true,
          details: {},
          confidence: 92,
          errors: [],
          warnings: [],
        },
        verifiedAt: new Date().toISOString(),
        oracleSignature: 'sol_sig_123',
      };

      const result = await adapter.submitOracleAttestation(attestation);
      expect(result.blockchain).toBeDefined();
      expect(result.blockchain?.network).toBe('solana');
    });

    it('should verify oracle attestation', async () => {
      const attestation = {
        attestationId: 'sol-attest-002',
        eventId: 'sol-event-002',
        eventHash: 'event_hash_456',
        oracleNode: 'solana-oracle-2',
        verification: {
          verified: true,
          details: {},
          confidence: 88,
          errors: [],
          warnings: [],
        },
        verifiedAt: new Date().toISOString(),
        oracleSignature: 'sol_sig_456',
      };

      await adapter.submitOracleAttestation(attestation);
      const verification = await adapter.verifyOracleAttestation('sol-attest-002');
      expect(verification.verified).toBe(true);
    });
  });

  describe('Chain Utilities', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should get balance (lamports)', async () => {
      const balance = await adapter.getBalance('SomePublicKeyHere');
      expect(balance).toBeGreaterThan(0n);
    });

    it('should get slot (block number)', async () => {
      const slot = await adapter.getBlockNumber();
      expect(slot).toBeGreaterThan(0);
    });

    it('should wait for confirmation', async () => {
      const anchor = await adapter.anchor({
        batchId: 'confirm-test',
        merkleRoot: 'confirm_root',
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
        merkleRoot: 'event_root',
        recordCount: 1,
      });

      expect(events.length).toBeGreaterThan(0);
      unsubscribe();
    });
  });
});

describe('Solana Factory Functions', () => {
  it('should create Solana mainnet adapter', () => {
    const adapter = createSolanaAdapter({
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      programIds: {},
    });

    expect(adapter.id).toBe('solana-adapter');
    expect(adapter.network).toBe('solana');
    expect(adapter.chainType).toBe('solana');
  });

  it('should create Solana devnet adapter', () => {
    const adapter = createSolanaDevnetAdapter();

    expect(adapter.id).toBe('solana-adapter');
    expect(adapter.chainType).toBe('solana');
  });

  it('should create devnet adapter with custom config', () => {
    const adapter = createSolanaDevnetAdapter({
      programIds: {
        auditAnchor: 'CustomProgram111111111111111111111111111111',
      },
    });

    expect(adapter.chainType).toBe('solana');
  });
});
