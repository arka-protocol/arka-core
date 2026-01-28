/**
 * Polkadot/Substrate Blockchain Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PolkadotBlockchainAdapter,
  createPolkadotAdapter,
  createKusamaAdapter,
  createWestendAdapter,
  createSubstrateAdapter,
  type PolkadotConfig,
} from '../../adapters/polkadot.js';
import type { BlockchainConfig } from '../../types.js';

describe('PolkadotBlockchainAdapter', () => {
  let adapter: PolkadotBlockchainAdapter;
  const defaultConfig: PolkadotConfig = {
    wsUrl: 'wss://rpc.polkadot.io',
    network: 'polkadot',
    ss58Format: 0,
    palletName: 'arkaCompliance',
    contracts: {
      auditAnchor: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      ruleNFT: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      didRegistry: '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y',
      complianceOracle: '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy',
    },
    useContracts: false,
  };

  beforeEach(() => {
    adapter = new PolkadotBlockchainAdapter(defaultConfig);
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
  });

  describe('Connection', () => {
    it('should connect to Polkadot', async () => {
      await adapter.connect({} as BlockchainConfig);
      expect(adapter.isConnected()).toBe(true);
    });

    it('should disconnect from Polkadot', async () => {
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
    });

    it('should have correct adapter ID', () => {
      expect(adapter.id).toBe('polkadot-polkadot');
    });

    it('should have polkadot chain type', () => {
      expect(adapter.chainType).toBe('polkadot');
    });
  });

  describe('Anchoring via Pallet', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should anchor a batch via pallet extrinsic', async () => {
      const result = await adapter.anchor({
        batchId: 'dot-batch-001',
        merkleRoot: 'polkadot_merkle_root_hash',
        recordCount: 8,
        metadata: { parachain: 'relay' },
      });

      expect(result.anchorId).toBeDefined();
      expect(result.transactionHash).toMatch(/^0x/);
      expect(result.blockNumber).toBeGreaterThan(0);
      expect(result.merkleRoot).toBe('polkadot_merkle_root_hash');
    });

    it('should verify anchored merkle root', async () => {
      const merkleRoot = 'dot_verify_root';
      await adapter.anchor({
        batchId: 'dot-batch-002',
        merkleRoot,
        recordCount: 4,
      });

      const verification = await adapter.verify(merkleRoot);
      expect(verification.verified).toBe(true);
    });

    it('should return false for non-existent merkle root', async () => {
      const verification = await adapter.verify('non_existent_dot_root');
      expect(verification.verified).toBe(false);
    });

    it('should query anchors with pagination', async () => {
      await adapter.anchor({
        batchId: 'dot-batch-003',
        merkleRoot: 'query_dot_1',
        recordCount: 2,
      });
      await adapter.anchor({
        batchId: 'dot-batch-004',
        merkleRoot: 'query_dot_2',
        recordCount: 3,
      });

      const results = await adapter.query({ limit: 10 });
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Anchoring via ink! Contracts', () => {
    let contractAdapter: PolkadotBlockchainAdapter;

    beforeEach(async () => {
      contractAdapter = new PolkadotBlockchainAdapter({
        ...defaultConfig,
        useContracts: true,
      });
      await contractAdapter.connect({} as BlockchainConfig);
    });

    afterEach(async () => {
      if (contractAdapter.isConnected()) {
        await contractAdapter.disconnect();
      }
    });

    it('should anchor via ink! contract', async () => {
      const result = await contractAdapter.anchor({
        batchId: 'ink-batch-001',
        merkleRoot: 'ink_merkle_root',
        recordCount: 5,
      });

      expect(result.anchorId).toBeDefined();
      expect(result.transactionHash).toBeDefined();
    });
  });

  describe('Audit Anchoring', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should anchor audit components', async () => {
      const anchor = await adapter.anchorAudit({
        eventSnapshot: { type: 'xcm_transfer', paraId: 2000 },
        ruleSetSnapshot: { rules: ['dot_rule_1'] },
        decision: { action: 'approve', era: 1234 },
      });

      expect(anchor.anchorId).toBeDefined();
      expect(anchor.hash).toBeDefined();
      expect(anchor.blockchain?.network).toContain('polkadot');
    });

    it('should get audit anchor by ID', async () => {
      const anchor = await adapter.anchorAudit({
        eventSnapshot: { data: 'dot_test' },
        ruleSetSnapshot: { rules: [] },
        decision: { action: 'log' },
      });

      const retrieved = await adapter.getAuditAnchor(anchor.anchorId);
      expect(retrieved?.anchorId).toBe(anchor.anchorId);
    });

    it('should verify audit anchor', async () => {
      const anchor = await adapter.anchorAudit({
        eventSnapshot: { data: 'verify_test' },
        ruleSetSnapshot: { rules: ['r1'] },
        decision: { action: 'verify' },
      });

      const verification = await adapter.verifyAuditAnchor(anchor.hash);
      expect(verification.verified).toBe(true);
    });
  });

  describe('Rule NFTs', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should mint a rule NFT', async () => {
      const rule = {
        id: 'dot-rule-001',
        name: 'Polkadot XCM Rule',
        description: 'XCM transfer compliance',
        severity: 'high' as const,
        condition: { type: 'xcm_message' },
        consequence: { action: 'verify_origin' },
        jurisdiction: 'DOT',
      };

      const nft = await adapter.mintRuleNFT(rule, 1);

      expect(nft.metadata.tokenId).toBeDefined();
      expect(nft.metadata.ruleId).toBe('dot-rule-001');
      expect(nft.metadata.soulbound).toBe(true);
      expect(nft.blockchain?.network).toContain('polkadot');
    });

    it('should get rule NFT', async () => {
      const rule = {
        id: 'dot-rule-002',
        name: 'Get Test',
        severity: 'medium' as const,
        condition: { type: 'test' },
        consequence: { action: 'log' },
      };

      const nft = await adapter.mintRuleNFT(rule, 1);
      const retrieved = await adapter.getRuleNFT(nft.metadata.tokenId);

      expect(retrieved?.metadata.ruleId).toBe('dot-rule-002');
    });

    it('should get rule versions', async () => {
      const ruleBase = {
        id: 'dot-rule-003',
        name: 'Version Test',
        severity: 'low' as const,
        condition: { type: 'version' },
        consequence: { action: 'none' },
      };

      await adapter.mintRuleNFT(ruleBase, 1);
      await adapter.mintRuleNFT({ ...ruleBase, name: 'v2' }, 2);

      const versions = await adapter.getRuleVersions('dot-rule-003');
      expect(versions.length).toBe(2);
    });

    it('should verify rule version', async () => {
      const rule = {
        id: 'dot-rule-004',
        name: 'Verify Test',
        severity: 'high' as const,
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
        bindingId: 'dot-binding-001',
        entityId: 'dot-entity-001',
        entityType: 'Parachain',
        identityType: 'did' as const,
        blockchainIdentity: 'did:dot:parachain:dot-entity-001',
        entityHash: 'dot_hash_abc',
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      const result = await adapter.registerEntityIdentity(binding);
      expect(result.blockchain).toBeDefined();
      expect(result.blockchain?.network).toContain('polkadot');
    });

    it('should get entity binding', async () => {
      const binding = {
        bindingId: 'dot-binding-002',
        entityId: 'dot-entity-002',
        entityType: 'Account',
        identityType: 'did' as const,
        blockchainIdentity: 'did:dot:account:dot-entity-002',
        entityHash: 'dot_hash_def',
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      await adapter.registerEntityIdentity(binding);
      const retrieved = await adapter.getEntityBinding('dot-entity-002');
      expect(retrieved?.entityType).toBe('Account');
    });

    it('should resolve DID', async () => {
      const did = 'did:dot:validator:dot-entity-003';
      const binding = {
        bindingId: 'dot-binding-003',
        entityId: 'dot-entity-003',
        entityType: 'Validator',
        identityType: 'did' as const,
        blockchainIdentity: did,
        entityHash: 'dot_hash_ghi',
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      await adapter.registerEntityIdentity(binding);
      const resolved = await adapter.resolveDID(did);
      expect(resolved?.entityId).toBe('dot-entity-003');
    });

    it('should revoke identity', async () => {
      const binding = {
        bindingId: 'dot-binding-004',
        entityId: 'dot-entity-004',
        entityType: 'Collator',
        identityType: 'did' as const,
        blockchainIdentity: 'did:dot:collator:dot-entity-004',
        entityHash: 'dot_hash_jkl',
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      await adapter.registerEntityIdentity(binding);
      const revoked = await adapter.revokeEntityIdentity('dot-binding-004');
      expect(revoked).toBe(true);
    });
  });

  describe('Oracle Attestations', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should submit oracle attestation', async () => {
      const attestation = {
        attestationId: 'dot-attest-001',
        eventId: 'dot-event-001',
        eventHash: 'dot_event_hash',
        oracleNode: 'dot-oracle-1',
        verification: {
          verified: true,
          details: { xcmVerified: true },
          confidence: 96,
          errors: [],
          warnings: [],
        },
        verifiedAt: new Date().toISOString(),
        oracleSignature: 'dot_oracle_sig',
      };

      const result = await adapter.submitOracleAttestation(attestation);
      expect(result.blockchain).toBeDefined();
    });

    it('should verify oracle attestation', async () => {
      const attestation = {
        attestationId: 'dot-attest-002',
        eventId: 'dot-event-002',
        eventHash: 'dot_event_hash_2',
        oracleNode: 'dot-oracle-2',
        verification: {
          verified: true,
          details: {},
          confidence: 93,
          errors: [],
          warnings: [],
        },
        verifiedAt: new Date().toISOString(),
        oracleSignature: 'dot_sig_2',
      };

      await adapter.submitOracleAttestation(attestation);
      const verification = await adapter.verifyOracleAttestation('dot-attest-002');
      expect(verification.verified).toBe(true);
    });
  });

  describe('Chain Utilities', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should get balance (planck)', async () => {
      const balance = await adapter.getBalance('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
      expect(balance).toBeGreaterThan(0n);
    });

    it('should get block number', async () => {
      const blockNumber = await adapter.getBlockNumber();
      expect(blockNumber).toBeGreaterThan(0);
    });

    it('should wait for finality', async () => {
      const anchor = await adapter.anchor({
        batchId: 'finality-test',
        merkleRoot: 'finality_root',
        recordCount: 1,
      });

      const confirmed = await adapter.waitForConfirmation(anchor.transactionHash, 2);
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
        merkleRoot: 'event_dot_root',
        recordCount: 1,
      });

      expect(events.length).toBeGreaterThan(0);
      unsubscribe();
    });
  });
});

describe('Polkadot Factory Functions', () => {
  it('should create Polkadot mainnet adapter', () => {
    const adapter = createPolkadotAdapter();

    expect(adapter.id).toBe('polkadot-polkadot');
    expect(adapter.chainType).toBe('polkadot');
  });

  it('should create Kusama adapter', () => {
    const adapter = createKusamaAdapter();

    expect(adapter.id).toBe('polkadot-kusama');
    expect(adapter.chainType).toBe('polkadot');
  });

  it('should create Westend testnet adapter', () => {
    const adapter = createWestendAdapter();

    expect(adapter.id).toBe('polkadot-westend');
    expect(adapter.chainType).toBe('polkadot');
  });

  it('should create custom Substrate adapter', () => {
    const adapter = createSubstrateAdapter({
      wsUrl: 'wss://custom-chain.io',
      network: 'custom',
      ss58Format: 42,
      palletName: 'customPact',
    });

    expect(adapter.id).toBe('polkadot-custom');
    expect(adapter.chainType).toBe('polkadot');
  });

  it('should create adapter with ink! contracts enabled', () => {
    const adapter = createPolkadotAdapter({
      useContracts: true,
      contracts: {
        auditAnchor: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      },
    });

    expect(adapter.chainType).toBe('polkadot');
  });
});
