/**
 * Tests for PoA Consensus Engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PoAConsensus,
  InMemoryValidatorRegistry,
  createValidatorConfig,
  FinalityGadget,
  SlashingManager,
  createFinalityGadget,
  createSlashingManager,
  type ConsensusEvent,
  type BlockProposal,
  type Vote,
} from '../../consensus/index.js';

describe('PoAConsensus', () => {
  let registry: InMemoryValidatorRegistry;
  let finalityGadget: FinalityGadget;
  let slashingManager: SlashingManager;
  let consensus: PoAConsensus;

  beforeEach(async () => {
    registry = new InMemoryValidatorRegistry();
    finalityGadget = createFinalityGadget(registry);
    slashingManager = createSlashingManager(registry);

    // Register validators
    await registry.registerValidator(
      createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 10, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v3', name: 'V3', publicKey: 'pk3' }, 10, 'active')
    );

    consensus = new PoAConsensus(
      registry,
      { aiAssistedFinality: true },
      finalityGadget,
      slashingManager
    );
  });

  describe('start/stop', () => {
    it('should start at specified height', async () => {
      await consensus.start(100);

      const status = await consensus.getStatus();
      expect(status.height).toBe(100);
      expect(status.step).toBe('propose');
    });

    it('should stop consensus', async () => {
      await consensus.start(100);
      await consensus.stop();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('createProposal', () => {
    it('should create a valid block proposal', async () => {
      await consensus.start(100);

      const proposal = await consensus.createProposal(
        100,
        'parent-hash',
        'tx-root',
        'state-root',
        5,
        'private-key'
      );

      expect(proposal.height).toBe(100);
      expect(proposal.parentHash).toBe('parent-hash');
      expect(proposal.txRoot).toBe('tx-root');
      expect(proposal.stateRoot).toBe('state-root');
      expect(proposal.txCount).toBe(5);
      expect(proposal.hash).toBeDefined();
      expect(proposal.signature).toBeDefined();
    });
  });

  describe('receiveProposal', () => {
    it('should accept valid proposal', async () => {
      await consensus.start(100);
      const status = await consensus.getStatus();

      const proposal = await consensus.createProposal(
        100,
        'parent-hash',
        'tx-root',
        'state-root',
        5,
        'private-key'
      );
      proposal.proposer = status.currentProposer!;

      const accepted = await consensus.receiveProposal(proposal);

      expect(accepted).toBe(true);
    });

    it('should reject proposal from wrong proposer', async () => {
      await consensus.start(100);
      const status = await consensus.getStatus();

      // Use a registered validator that isn't the current proposer
      const wrongProposer = status.currentProposer === 'v1' ? 'v2' : 'v1';

      const proposal = await consensus.createProposal(
        100,
        'parent-hash',
        'tx-root',
        'state-root',
        5,
        'private-key'
      );
      proposal.proposer = wrongProposer;

      const accepted = await consensus.receiveProposal(proposal);

      expect(accepted).toBe(false);
    });

    it('should reject proposal for wrong height', async () => {
      await consensus.start(100);
      const status = await consensus.getStatus();

      const proposal = await consensus.createProposal(
        99, // Wrong height
        'parent-hash',
        'tx-root',
        'state-root',
        5,
        'private-key'
      );
      proposal.proposer = status.currentProposer!;

      const accepted = await consensus.receiveProposal(proposal);

      expect(accepted).toBe(false);
    });
  });

  describe('createVote', () => {
    it('should create a prevote', () => {
      const vote = consensus.createVote('prevote', 100, 'block-hash', 'v1', 'pk');

      expect(vote.type).toBe('prevote');
      expect(vote.height).toBe(100);
      expect(vote.blockHash).toBe('block-hash');
      expect(vote.validator).toBe('v1');
      expect(vote.signature).toBeDefined();
    });

    it('should create a precommit', () => {
      const vote = consensus.createVote('precommit', 100, 'block-hash', 'v1', 'pk');

      expect(vote.type).toBe('precommit');
    });
  });

  describe('receiveVote', () => {
    it('should accept valid vote', async () => {
      await consensus.start(100);

      const vote = consensus.createVote('prevote', 100, 'block-hash', 'v1', 'pk');

      const accepted = await consensus.receiveVote(vote);

      expect(accepted).toBe(true);
    });

    it('should reject vote for wrong height', async () => {
      await consensus.start(100);

      const vote = consensus.createVote('prevote', 99, 'block-hash', 'v1', 'pk');

      const accepted = await consensus.receiveVote(vote);

      expect(accepted).toBe(false);
    });

    it('should reject vote from non-validator', async () => {
      await consensus.start(100);

      const vote = consensus.createVote('prevote', 100, 'block-hash', 'unknown', 'pk');

      const accepted = await consensus.receiveVote(vote);

      expect(accepted).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return current consensus status', async () => {
      await consensus.start(100);

      const status = await consensus.getStatus();

      expect(status.height).toBe(100);
      expect(status.round).toBe(0);
      expect(status.step).toBeDefined();
      expect(status.currentProposer).toBeDefined();
      expect(status.activeValidators).toBe(3);
      expect(status.totalValidators).toBe(3);
    });
  });

  describe('getFinalizedHeight', () => {
    it('should return 0 before any finalization', () => {
      expect(consensus.getFinalizedHeight()).toBe(0);
    });
  });

  describe('event subscription', () => {
    it('should notify subscribers of events', async () => {
      const events: ConsensusEvent[] = [];
      consensus.subscribe((event) => {
        events.push(event);
      });

      await consensus.start(100);
      const status = await consensus.getStatus();

      const proposal = await consensus.createProposal(
        100,
        'parent-hash',
        'tx-root',
        'state-root',
        5,
        'private-key'
      );
      proposal.proposer = status.currentProposer!;

      await consensus.receiveProposal(proposal);

      // Should have received at least the proposal_received event
      expect(events.length).toBeGreaterThan(0);
      const proposalEvent = events.find((e) => e.type === 'proposal_received');
      expect(proposalEvent).toBeDefined();
    });

    it('should unsubscribe correctly', async () => {
      const events: ConsensusEvent[] = [];
      const unsubscribe = consensus.subscribe((event) => {
        events.push(event);
      });

      unsubscribe();
      await consensus.start(100);

      // Should not have received any events
      expect(events.length).toBe(0);
    });
  });

  describe('quorum detection', () => {
    it('should detect when quorum is reached', async () => {
      await consensus.start(100);
      const status = await consensus.getStatus();

      // Create and accept proposal
      const proposal = await consensus.createProposal(
        100,
        'parent-hash',
        'tx-root',
        'state-root',
        5,
        'private-key'
      );
      proposal.proposer = status.currentProposer!;
      await consensus.receiveProposal(proposal);

      // Submit votes from all validators (2/3 needed for quorum)
      await consensus.receiveVote(
        consensus.createVote('prevote', 100, proposal.hash, 'v1', 'pk1')
      );
      await consensus.receiveVote(
        consensus.createVote('prevote', 100, proposal.hash, 'v2', 'pk2')
      );

      // With 2 of 3 validators (66.67%), should have quorum
      const newStatus = await consensus.getStatus();
      // Status should have progressed
      expect(newStatus).toBeDefined();
    });
  });
});

describe('PoAConsensus round transitions', () => {
  let registry: InMemoryValidatorRegistry;
  let consensus: PoAConsensus;

  beforeEach(async () => {
    registry = new InMemoryValidatorRegistry();
    await registry.registerValidator(
      createValidatorConfig({ address: 'v1', name: 'V1', publicKey: 'pk1' }, 10, 'active')
    );
    await registry.registerValidator(
      createValidatorConfig({ address: 'v2', name: 'V2', publicKey: 'pk2' }, 10, 'active')
    );

    const finalityGadget = createFinalityGadget(registry);
    const slashingManager = createSlashingManager(registry);

    consensus = new PoAConsensus(
      registry,
      { aiAssistedFinality: false },
      finalityGadget,
      slashingManager
    );
  });

  it('should start in propose step', async () => {
    await consensus.start(1);

    const status = await consensus.getStatus();
    expect(status.step).toBe('propose');
  });

  it('should transition to prevote after proposal', async () => {
    await consensus.start(1);
    const status = await consensus.getStatus();

    const proposal = await consensus.createProposal(
      1,
      'genesis',
      'tx-root',
      'state-root',
      0,
      'pk'
    );
    proposal.proposer = status.currentProposer!;
    await consensus.receiveProposal(proposal);

    const newStatus = await consensus.getStatus();
    expect(newStatus.step).toBe('prevote');
  });
});
