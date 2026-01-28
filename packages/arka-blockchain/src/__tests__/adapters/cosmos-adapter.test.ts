/**
 * Cosmos SDK Blockchain Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CosmosBlockchainAdapter,
  createCosmosHubAdapter,
  createOsmosisAdapter,
  createCosmosAdapter,
  type CosmosConfig,
} from '../../adapters/cosmos.js';
import type { BlockchainConfig } from '../../types.js';

describe('CosmosBlockchainAdapter', () => {
  let adapter: CosmosBlockchainAdapter;
  const defaultConfig: CosmosConfig = {
    rpcUrl: 'https://rpc.cosmos.network',
    chainId: 'cosmoshub-4',
    prefix: 'cosmos',
    gasPrice: '0.025uatom',
    contracts: {
      auditAnchor: 'cosmos1auditcontractaddress',
      ruleNFT: 'cosmos1rulenftcontractaddress',
      didRegistry: 'cosmos1didregistryaddress',
      complianceOracle: 'cosmos1oracleaddress',
    },
  };

  beforeEach(() => {
    adapter = new CosmosBlockchainAdapter(defaultConfig);
  });

  afterEach(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
  });

  describe('Connection', () => {
    it('should connect to Cosmos chain', async () => {
      await adapter.connect({} as BlockchainConfig);
      expect(adapter.isConnected()).toBe(true);
    });

    it('should disconnect from Cosmos chain', async () => {
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
      expect(adapter.id).toBe('cosmos-cosmoshub-4');
    });
  });

  describe('Anchoring', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should anchor a batch to Cosmos', async () => {
      const result = await adapter.anchor({
        batchId: 'cosmos-batch-001',
        merkleRoot: 'cosmos_merkle_root_hash',
        recordCount: 7,
        metadata: { chain: 'cosmoshub' },
      });

      expect(result.anchorId).toBeDefined();
      expect(result.transactionHash).toBeDefined();
      expect(result.blockNumber).toBeGreaterThan(0);
      expect(result.merkleRoot).toBe('cosmos_merkle_root_hash');
    });

    it('should verify anchored merkle root', async () => {
      const merkleRoot = 'cosmos_verify_root';
      await adapter.anchor({
        batchId: 'cosmos-batch-002',
        merkleRoot,
        recordCount: 3,
      });

      const verification = await adapter.verify(merkleRoot);
      expect(verification.verified).toBe(true);
    });

    it('should query anchors', async () => {
      await adapter.anchor({
        batchId: 'cosmos-batch-003',
        merkleRoot: 'query_root_1',
        recordCount: 2,
      });
      await adapter.anchor({
        batchId: 'cosmos-batch-004',
        merkleRoot: 'query_root_2',
        recordCount: 4,
      });

      const results = await adapter.query({ limit: 10 });
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Audit Anchoring', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should anchor audit components', async () => {
      const anchor = await adapter.anchorAudit({
        eventSnapshot: { type: 'ibc_transfer', denom: 'uatom' },
        ruleSetSnapshot: { rules: ['cosmos_rule_1'] },
        decision: { action: 'approve', validator: 'cosmosvaloper1...' },
      });

      expect(anchor.anchorId).toBeDefined();
      expect(anchor.hash).toBeDefined();
      expect(anchor.blockchain?.network).toContain('cosmos');
    });

    it('should verify audit anchor', async () => {
      const anchor = await adapter.anchorAudit({
        eventSnapshot: { data: 'test' },
        ruleSetSnapshot: { rules: [] },
        decision: { action: 'log' },
      });

      const verification = await adapter.verifyAuditAnchor(anchor.hash);
      expect(verification.verified).toBe(true);
    });
  });

  describe('Rule NFTs (CW721)', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should mint a rule NFT', async () => {
      const rule = {
        id: 'cosmos-rule-001',
        name: 'Cosmos IBC Rule',
        description: 'IBC transfer compliance',
        severity: 'high' as const,
        condition: { type: 'ibc_transfer' },
        consequence: { action: 'verify_source' },
        jurisdiction: 'COSMOS',
      };

      const nft = await adapter.mintRuleNFT(rule, 1);

      expect(nft.metadata.tokenId).toBeDefined();
      expect(nft.metadata.ruleId).toBe('cosmos-rule-001');
      expect(nft.metadata.soulbound).toBe(true);
      expect(nft.blockchain?.network).toContain('cosmos');
    });

    it('should get rule NFT', async () => {
      const rule = {
        id: 'cosmos-rule-002',
        name: 'Get Test Rule',
        severity: 'medium' as const,
        condition: { type: 'test' },
        consequence: { action: 'log' },
      };

      const nft = await adapter.mintRuleNFT(rule, 1);
      const retrieved = await adapter.getRuleNFT(nft.metadata.tokenId);

      expect(retrieved?.metadata.ruleId).toBe('cosmos-rule-002');
    });

    it('should get rule versions', async () => {
      const ruleBase = {
        id: 'cosmos-rule-003',
        name: 'Version Test',
        severity: 'low' as const,
        condition: { type: 'version' },
        consequence: { action: 'none' },
      };

      await adapter.mintRuleNFT(ruleBase, 1);
      await adapter.mintRuleNFT({ ...ruleBase, name: 'Version Test v2' }, 2);
      await adapter.mintRuleNFT({ ...ruleBase, name: 'Version Test v3' }, 3);

      const versions = await adapter.getRuleVersions('cosmos-rule-003');
      expect(versions.length).toBe(3);
      expect(versions[0].metadata.version).toBe(1);
      expect(versions[2].metadata.version).toBe(3);
    });
  });

  describe('Entity Identity', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should register entity identity', async () => {
      const binding = {
        bindingId: 'cosmos-binding-001',
        entityId: 'cosmos-entity-001',
        entityType: 'Validator',
        identityType: 'did' as const,
        blockchainIdentity: 'did:cosmos:validator:cosmos-entity-001',
        entityHash: 'cosmos_hash_abc',
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      const result = await adapter.registerEntityIdentity(binding);
      expect(result.blockchain).toBeDefined();
      expect(result.blockchain?.network).toContain('cosmos');
    });

    it('should get entity binding', async () => {
      const binding = {
        bindingId: 'cosmos-binding-002',
        entityId: 'cosmos-entity-002',
        entityType: 'Account',
        identityType: 'did' as const,
        blockchainIdentity: 'did:cosmos:account:cosmos-entity-002',
        entityHash: 'cosmos_hash_def',
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      await adapter.registerEntityIdentity(binding);
      const retrieved = await adapter.getEntityBinding('cosmos-entity-002');
      expect(retrieved?.entityType).toBe('Account');
    });

    it('should resolve DID', async () => {
      const did = 'did:cosmos:validator:cosmos-entity-003';
      const binding = {
        bindingId: 'cosmos-binding-003',
        entityId: 'cosmos-entity-003',
        entityType: 'Validator',
        identityType: 'did' as const,
        blockchainIdentity: did,
        entityHash: 'cosmos_hash_ghi',
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      await adapter.registerEntityIdentity(binding);
      const resolved = await adapter.resolveDID(did);
      expect(resolved?.entityId).toBe('cosmos-entity-003');
    });

    it('should revoke identity', async () => {
      const binding = {
        bindingId: 'cosmos-binding-004',
        entityId: 'cosmos-entity-004',
        entityType: 'Account',
        identityType: 'did' as const,
        blockchainIdentity: 'did:cosmos:account:cosmos-entity-004',
        entityHash: 'cosmos_hash_jkl',
        boundAt: new Date().toISOString(),
        status: 'active' as const,
      };

      await adapter.registerEntityIdentity(binding);
      const revoked = await adapter.revokeEntityIdentity('cosmos-binding-004');
      expect(revoked).toBe(true);
    });
  });

  describe('Oracle Attestations', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should submit oracle attestation', async () => {
      const attestation = {
        attestationId: 'cosmos-attest-001',
        eventId: 'cosmos-event-001',
        eventHash: 'cosmos_event_hash',
        oracleNode: 'cosmos-oracle-1',
        verification: {
          verified: true,
          details: { ibcVerified: true },
          confidence: 94,
          errors: [],
          warnings: [],
        },
        verifiedAt: new Date().toISOString(),
        oracleSignature: 'cosmos_oracle_sig',
      };

      const result = await adapter.submitOracleAttestation(attestation);
      expect(result.blockchain).toBeDefined();
    });

    it('should verify oracle attestation', async () => {
      const attestation = {
        attestationId: 'cosmos-attest-002',
        eventId: 'cosmos-event-002',
        eventHash: 'cosmos_event_hash_2',
        oracleNode: 'cosmos-oracle-2',
        verification: {
          verified: true,
          details: {},
          confidence: 91,
          errors: [],
          warnings: [],
        },
        verifiedAt: new Date().toISOString(),
        oracleSignature: 'cosmos_sig_2',
      };

      await adapter.submitOracleAttestation(attestation);
      const verification = await adapter.verifyOracleAttestation('cosmos-attest-002');
      expect(verification.verified).toBe(true);
    });
  });

  describe('Chain Utilities', () => {
    beforeEach(async () => {
      await adapter.connect({} as BlockchainConfig);
    });

    it('should get balance', async () => {
      const balance = await adapter.getBalance('cosmos1testaddress');
      expect(balance).toBeGreaterThan(0n);
    });

    it('should get block height', async () => {
      const height = await adapter.getBlockNumber();
      expect(height).toBeGreaterThan(0);
    });

    it('should confirm immediately (Tendermint finality)', async () => {
      const anchor = await adapter.anchor({
        batchId: 'confirm-test',
        merkleRoot: 'confirm_cosmos_root',
        recordCount: 1,
      });

      const confirmed = await adapter.waitForConfirmation(anchor.transactionHash);
      expect(confirmed).toBe(true);
    });
  });
});

describe('Cosmos Factory Functions', () => {
  it('should create Cosmos Hub adapter', () => {
    const adapter = createCosmosHubAdapter();

    expect(adapter.id).toBe('cosmos-cosmoshub-4');
    expect(adapter.chainType).toBe('cosmos');
  });

  it('should create Cosmos Hub adapter with custom config', () => {
    const adapter = createCosmosHubAdapter({
      contracts: {
        auditAnchor: 'cosmos1custom',
      },
    });

    expect(adapter.chainType).toBe('cosmos');
  });

  it('should create Osmosis adapter', () => {
    const adapter = createOsmosisAdapter();

    expect(adapter.id).toBe('cosmos-osmosis-1');
    expect(adapter.chainType).toBe('cosmos');
  });

  it('should create custom Cosmos adapter', () => {
    const adapter = createCosmosAdapter({
      rpcUrl: 'https://rpc.juno.network',
      chainId: 'juno-1',
      prefix: 'juno',
      contracts: {},
    });

    expect(adapter.id).toBe('cosmos-juno-1');
    expect(adapter.chainType).toBe('cosmos');
  });
});
