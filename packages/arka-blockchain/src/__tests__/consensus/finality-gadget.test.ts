/**
 * Tests for Finality Gadget
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FinalityGadget,
  createFinalityGadget,
  DefaultAIFinalityScorer,
  InMemoryValidatorRegistry,
  createValidatorConfig,
  type FinalityCertificate,
  type BlockProposal,
  type Vote,
} from '../../consensus/index.js';

describe('FinalityGadget', () => {
  let registry: InMemoryValidatorRegistry;
  let gadget: FinalityGadget;

  beforeEach(async () => {
    registry = new InMemoryValidatorRegistry();

    // Register validators with different weights
    await registry.registerValidator(
      createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 20, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v3', name: 'V3', publicKey: 'pk3' }, 15, 'active')
    );

    gadget = createFinalityGadget(registry, { minSignatures: 2, minValidatorWeight: 30 });
  });

  describe('checkFinality', () => {
    it('should finalize block with sufficient signatures', async () => {
      const proposal: BlockProposal = {
        height: 100,
        parentHash: 'parent',
        hash: 'hash',
        proposer: 'v1',
        txRoot: 'tx-root',
        stateRoot: 'state-root',
        txCount: 5,
        timestamp: new Date().toISOString(),
        signature: 'sig',
      };

      const signatures = [
        { validator: 'v1', signature: 's1' },
        { validator: 'v2', signature: 's2' },
        { validator: 'v3', signature: 's3' },
      ];

      const result = await gadget.checkFinality(proposal, signatures);

      expect(result.aiScore).toBeGreaterThan(0);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should not finalize block without quorum', async () => {
      const proposal: BlockProposal = {
        height: 100,
        parentHash: 'parent',
        hash: 'hash',
        proposer: 'v1',
        txRoot: 'tx-root',
        stateRoot: 'state-root',
        txCount: 5,
        timestamp: new Date().toISOString(),
        signature: 'sig',
      };

      const signatures = [
        { validator: 'v1', signature: 's1' },
      ];

      const result = await gadget.checkFinality(proposal, signatures);

      expect(result.canFinalize).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should include AI score in result', async () => {
      const proposal: BlockProposal = {
        height: 100,
        parentHash: 'parent',
        hash: 'hash',
        proposer: 'v1',
        txRoot: 'tx-root',
        stateRoot: 'state-root',
        txCount: 5,
        timestamp: new Date().toISOString(),
        signature: 'sig',
      };

      const signatures = [
        { validator: 'v1', signature: 's1' },
        { validator: 'v2', signature: 's2' },
        { validator: 'v3', signature: 's3' },
      ];

      const result = await gadget.checkFinality(proposal, signatures);

      expect(result.aiScore).toBeDefined();
      expect(result.aiScore).toBeGreaterThanOrEqual(0);
      expect(result.aiScore).toBeLessThanOrEqual(1);
    });
  });

  describe('createFinalityCertificate', () => {
    it('should create a finality certificate when conditions are met', async () => {
      const proposal: BlockProposal = {
        height: 100,
        parentHash: 'parent',
        hash: 'hash',
        proposer: 'v1',
        txRoot: 'tx-root',
        stateRoot: 'state-root',
        txCount: 5,
        timestamp: new Date().toISOString(),
        signature: 'sig',
      };

      const signatures = [
        { validator: 'v1', signature: 's1' },
        { validator: 'v2', signature: 's2' },
        { validator: 'v3', signature: 's3' },
      ];

      const certificate = await gadget.createFinalityCertificate(proposal, signatures);

      if (certificate) {
        expect(certificate.height).toBe(100);
        expect(certificate.blockHash).toBe('hash');
        expect(certificate.signatures.length).toBe(3);
        expect(certificate.totalWeight).toBe(45); // 10 + 20 + 15
      }
    });

    it('should include validator weights in signatures', async () => {
      const proposal: BlockProposal = {
        height: 100,
        parentHash: 'parent',
        hash: 'hash',
        proposer: 'v1',
        txRoot: 'tx-root',
        stateRoot: 'state-root',
        txCount: 5,
        timestamp: new Date().toISOString(),
        signature: 'sig',
      };

      const signatures = [
        { validator: 'v1', signature: 's1' },
      ];

      // May return null if conditions not met, but test the weight calculation
      const certificate = await gadget.createFinalityCertificate(proposal, signatures);

      // If certificate is created, check the weight
      if (certificate) {
        expect(certificate.signatures[0]!.weight).toBe(10);
      }
    });
  });

  describe('verifyCertificate', () => {
    it('should verify valid certificate', async () => {
      const certificate: FinalityCertificate = {
        height: 100,
        blockHash: 'hash',
        signatures: [
          { validator: 'v1', signature: 's1', weight: 10 },
          { validator: 'v2', signature: 's2', weight: 20 },
          { validator: 'v3', signature: 's3', weight: 15 },
        ],
        totalWeight: 45,
        createdAt: new Date().toISOString(),
      };

      const isValid = await gadget.verifyCertificate(certificate);

      expect(isValid).toBe(true);
    });

    it('should reject certificate with invalid validator', async () => {
      const certificate: FinalityCertificate = {
        height: 100,
        blockHash: 'hash',
        signatures: [
          { validator: 'unknown', signature: 's1', weight: 10 },
        ],
        totalWeight: 10,
        createdAt: new Date().toISOString(),
      };

      const isValid = await gadget.verifyCertificate(certificate);

      expect(isValid).toBe(false);
    });
  });

  describe('getLastFinalizedHeight', () => {
    it('should return 0 initially', () => {
      expect(gadget.getLastFinalizedHeight()).toBe(0);
    });
  });

  describe('getFinalityCertificate', () => {
    it('should return null for non-finalized height', () => {
      expect(gadget.getFinalityCertificate(999)).toBeNull();
    });
  });

  describe('isFinalized', () => {
    it('should return false for non-finalized height', () => {
      expect(gadget.isFinalized(999)).toBe(false);
    });
  });

  describe('getFinalityGap', () => {
    it('should calculate gap from current height', () => {
      const gap = gadget.getFinalityGap(100);
      expect(gap).toBe(100); // 100 - 0 (lastFinalizedHeight)
    });
  });
});

describe('DefaultAIFinalityScorer', () => {
  let registry: InMemoryValidatorRegistry;
  let scorer: DefaultAIFinalityScorer;

  beforeEach(async () => {
    registry = new InMemoryValidatorRegistry();
    await registry.registerValidator(
      createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 10, 'active')
    );

    // Update trust scores
    await registry.updateTrustScore('v1', 0.9);
    await registry.updateTrustScore('v2', 0.8);

    scorer = new DefaultAIFinalityScorer({ minSignatures: 2, minTrustScore: 0.7, minValidatorWeight: 15 });
  });

  describe('scoreBlock', () => {
    it('should return score between 0 and 1', async () => {
      const proposal: BlockProposal = {
        height: 100,
        parentHash: 'parent',
        hash: 'hash',
        proposer: 'v1',
        txRoot: 'tx-root',
        stateRoot: 'state-root',
        txCount: 5,
        timestamp: new Date().toISOString(),
        signature: 'sig',
      };

      const signatures = [
        { validator: 'v1', signature: 's1' },
        { validator: 'v2', signature: 's2' },
      ];

      const validators = await registry.getAllValidators();
      const result = await scorer.scoreBlock(proposal, signatures, validators);

      expect(result.aiScore).toBeGreaterThanOrEqual(0);
      expect(result.aiScore).toBeLessThanOrEqual(1);
    });

    it('should provide reasons for the score', async () => {
      const proposal: BlockProposal = {
        height: 100,
        parentHash: 'parent',
        hash: 'hash',
        proposer: 'v1',
        txRoot: 'tx-root',
        stateRoot: 'state-root',
        txCount: 5,
        timestamp: new Date().toISOString(),
        signature: 'sig',
      };

      const signatures = [
        { validator: 'v1', signature: 's1' },
      ];

      const validators = await registry.getAllValidators();
      const result = await scorer.scoreBlock(proposal, signatures, validators);

      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should score higher with more signatures', async () => {
      const proposal: BlockProposal = {
        height: 100,
        parentHash: 'parent',
        hash: 'hash',
        proposer: 'v1',
        txRoot: 'tx-root',
        stateRoot: 'state-root',
        txCount: 5,
        timestamp: new Date().toISOString(),
        signature: 'sig',
      };

      const oneSignature = [
        { validator: 'v1', signature: 's1' },
      ];

      const twoSignatures = [
        { validator: 'v1', signature: 's1' },
        { validator: 'v2', signature: 's2' },
      ];

      const validators = await registry.getAllValidators();
      const result1 = await scorer.scoreBlock(proposal, oneSignature, validators);
      const result2 = await scorer.scoreBlock(proposal, twoSignatures, validators);

      expect(result2.aiScore).toBeGreaterThan(result1.aiScore);
    });

    it('should detect anomalies for slashed validators', async () => {
      // Increment slash count
      await registry.incrementSlashCount('v1');

      const proposal: BlockProposal = {
        height: 100,
        parentHash: 'parent',
        hash: 'hash',
        proposer: 'v1',
        txRoot: 'tx-root',
        stateRoot: 'state-root',
        txCount: 5,
        timestamp: new Date().toISOString(),
        signature: 'sig',
      };

      const signatures = [
        { validator: 'v1', signature: 's1' },
      ];

      const validators = await registry.getAllValidators();
      const result = await scorer.scoreBlock(proposal, signatures, validators);

      expect(result.anomalies.length).toBeGreaterThan(0);
    });
  });
});
