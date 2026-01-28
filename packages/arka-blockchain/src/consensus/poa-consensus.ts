/**
 * Proof-of-Authority Consensus
 *
 * Implements PoA consensus with voting rounds similar to Tendermint/PBFT.
 */

import type {
  BlockProposal,
  Vote,
  ConsensusRound,
  ConsensusConfig,
  ConsensusStatus,
  ValidatorConfig,
  FinalityCertificate,
} from './types.js';
import { DEFAULT_CONSENSUS_CONFIG } from './types.js';
import type { ValidatorRegistry } from './validator-registry.js';
import { selectProposer, hasQuorum } from './validator-weights.js';
import type { FinalityGadget } from './finality-gadget.js';
import type { SlashingManager } from './slashing.js';
import { hashData } from '@arka/crypto';

/**
 * Consensus event types
 */
export type ConsensusEventType =
  | 'proposal_received'
  | 'prevote_received'
  | 'precommit_received'
  | 'block_committed'
  | 'block_finalized'
  | 'round_timeout'
  | 'validator_slashed';

/**
 * Consensus event
 */
export interface ConsensusEvent {
  type: ConsensusEventType;
  height: number;
  round: number;
  data: unknown;
  timestamp: string;
}

/**
 * Consensus event handler
 */
export type ConsensusEventHandler = (event: ConsensusEvent) => void | Promise<void>;

/**
 * PoA Consensus Engine
 */
export class PoAConsensus {
  private config: ConsensusConfig;
  private registry: ValidatorRegistry;
  private finalityGadget?: FinalityGadget;
  private slashingManager?: SlashingManager;

  private currentRound: ConsensusRound | null = null;
  private committedBlocks: Map<number, BlockProposal> = new Map();
  private finalizedHeight: number = 0;
  private eventHandlers: Set<ConsensusEventHandler> = new Set();

  private roundTimer: NodeJS.Timeout | null = null;
  private running: boolean = false;

  constructor(
    registry: ValidatorRegistry,
    config: Partial<ConsensusConfig> = {},
    finalityGadget?: FinalityGadget,
    slashingManager?: SlashingManager
  ) {
    this.registry = registry;
    this.config = { ...DEFAULT_CONSENSUS_CONFIG, ...config };
    this.finalityGadget = finalityGadget;
    this.slashingManager = slashingManager;
  }

  /**
   * Start consensus engine
   */
  async start(startHeight: number = 1): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    await this.startNewRound(startHeight, 0);
  }

  /**
   * Stop consensus engine
   */
  async stop(): Promise<void> {
    this.running = false;
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
  }

  /**
   * Start a new consensus round
   */
  private async startNewRound(height: number, round: number): Promise<void> {
    if (!this.running) return;

    const validators = await this.registry.getActiveValidators();
    const proposer = selectProposer(validators, height + round);

    if (!proposer) {
      // No active validators, retry after timeout
      this.scheduleRoundTimeout(height, round);
      return;
    }

    this.currentRound = {
      height,
      round,
      step: 'propose',
      proposer: proposer.id.address,
      prevotes: new Map(),
      precommits: new Map(),
      startTime: Date.now(),
    };

    this.scheduleRoundTimeout(height, round);

    await this.emitEvent({
      type: 'proposal_received',
      height,
      round,
      data: { proposer: proposer.id.address, step: 'waiting' },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Schedule round timeout
   */
  private scheduleRoundTimeout(height: number, round: number): void {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
    }

    const timeout = this.calculateRoundTimeout();
    this.roundTimer = setTimeout(async () => {
      await this.handleRoundTimeout(height, round);
    }, timeout);
  }

  /**
   * Calculate total round timeout
   */
  private calculateRoundTimeout(): number {
    return (
      this.config.proposeTimeoutMs +
      this.config.prevoteTimeoutMs +
      this.config.precommitTimeoutMs
    );
  }

  /**
   * Handle round timeout
   */
  private async handleRoundTimeout(height: number, round: number): Promise<void> {
    if (!this.running) return;
    if (!this.currentRound || this.currentRound.height !== height) return;

    await this.emitEvent({
      type: 'round_timeout',
      height,
      round,
      data: { step: this.currentRound.step },
      timestamp: new Date().toISOString(),
    });

    // Check if proposer missed the block
    const proposer = this.currentRound.proposer;
    if (!this.currentRound.proposal) {
      await this.registry.recordBlockMissed(proposer, height);

      // Check for slashing due to downtime
      if (this.slashingManager) {
        const validator = await this.registry.getValidator(proposer);
        if (validator && validator.blocksMissed >= this.config.downtimeThreshold) {
          await this.slashingManager.slashForDowntime(proposer, height);
        }
      }
    }

    // Start next round
    await this.startNewRound(height, round + 1);
  }

  /**
   * Receive a block proposal
   */
  async receiveProposal(proposal: BlockProposal): Promise<boolean> {
    if (!this.running || !this.currentRound) {
      return false;
    }

    // Validate proposal
    if (proposal.height !== this.currentRound.height) {
      return false;
    }

    if (proposal.proposer !== this.currentRound.proposer) {
      // Invalid proposer - potential equivocation
      if (this.slashingManager) {
        await this.slashingManager.slashForInvalidBlock(
          proposal.proposer,
          proposal.height,
          'wrong_proposer'
        );
      }
      return false;
    }

    // Verify signature
    if (!this.verifyProposalSignature(proposal)) {
      return false;
    }

    // Accept proposal
    this.currentRound.proposal = proposal;
    this.currentRound.step = 'prevote';

    await this.emitEvent({
      type: 'proposal_received',
      height: proposal.height,
      round: this.currentRound.round,
      data: { proposal },
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Receive a vote
   */
  async receiveVote(vote: Vote): Promise<boolean> {
    if (!this.running || !this.currentRound) {
      return false;
    }

    if (vote.height !== this.currentRound.height) {
      return false;
    }

    // Verify voter is active validator
    if (!(await this.registry.isActiveValidator(vote.validator))) {
      return false;
    }

    // Verify signature
    if (!this.verifyVoteSignature(vote)) {
      return false;
    }

    // Check for equivocation
    const existingVote = vote.type === 'prevote'
      ? this.currentRound.prevotes.get(vote.validator)
      : this.currentRound.precommits.get(vote.validator);

    if (existingVote && existingVote.blockHash !== vote.blockHash) {
      // Equivocation detected!
      if (this.slashingManager) {
        await this.slashingManager.slashForEquivocation(
          vote.validator,
          vote.height,
          existingVote,
          vote
        );
      }
      return false;
    }

    // Add vote
    if (vote.type === 'prevote') {
      this.currentRound.prevotes.set(vote.validator, vote);
      await this.emitEvent({
        type: 'prevote_received',
        height: vote.height,
        round: this.currentRound.round,
        data: { vote },
        timestamp: new Date().toISOString(),
      });

      // Check for prevote quorum
      await this.checkPrevoteQuorum();
    } else if (vote.type === 'precommit') {
      this.currentRound.precommits.set(vote.validator, vote);
      await this.emitEvent({
        type: 'precommit_received',
        height: vote.height,
        round: this.currentRound.round,
        data: { vote },
        timestamp: new Date().toISOString(),
      });

      // Check for precommit quorum
      await this.checkPrecommitQuorum();
    }

    return true;
  }

  /**
   * Check if prevote quorum is reached
   */
  private async checkPrevoteQuorum(): Promise<void> {
    if (!this.currentRound || !this.currentRound.proposal) {
      return;
    }

    const { votingWeight, totalWeight } = await this.calculateVoteWeight(
      this.currentRound.prevotes,
      this.currentRound.proposal.hash
    );

    if (hasQuorum(votingWeight, totalWeight, this.config.prevoteThreshold)) {
      this.currentRound.step = 'precommit';
      this.currentRound.lockedBlock = this.currentRound.proposal.hash;
    }
  }

  /**
   * Check if precommit quorum is reached
   */
  private async checkPrecommitQuorum(): Promise<void> {
    if (!this.currentRound || !this.currentRound.proposal) {
      return;
    }

    const { votingWeight, totalWeight } = await this.calculateVoteWeight(
      this.currentRound.precommits,
      this.currentRound.proposal.hash
    );

    if (hasQuorum(votingWeight, totalWeight, this.config.precommitThreshold)) {
      await this.commitBlock(this.currentRound.proposal);
    }
  }

  /**
   * Calculate vote weight for a block hash
   */
  private async calculateVoteWeight(
    votes: Map<string, Vote>,
    blockHash: string
  ): Promise<{ votingWeight: number; totalWeight: number }> {
    const totalWeight = await this.registry.getActiveWeight();
    let votingWeight = 0;

    for (const [voter, vote] of votes) {
      if (vote.blockHash === blockHash) {
        const validator = await this.registry.getValidator(voter);
        if (validator && validator.status === 'active') {
          votingWeight += validator.weight;
        }
      }
    }

    return { votingWeight, totalWeight };
  }

  /**
   * Commit a block
   */
  private async commitBlock(proposal: BlockProposal): Promise<void> {
    if (!this.currentRound) return;

    // Record block proposed
    await this.registry.recordBlockProposed(proposal.proposer, proposal.height);

    // Store committed block
    this.committedBlocks.set(proposal.height, proposal);

    // Clear old blocks (keep last 1000)
    if (this.committedBlocks.size > 1000) {
      const minHeight = proposal.height - 1000;
      for (const [height] of this.committedBlocks) {
        if (height < minHeight) {
          this.committedBlocks.delete(height);
        }
      }
    }

    await this.emitEvent({
      type: 'block_committed',
      height: proposal.height,
      round: this.currentRound.round,
      data: { proposal },
      timestamp: new Date().toISOString(),
    });

    // Try to finalize
    if (this.finalityGadget && this.config.aiAssistedFinality) {
      await this.tryFinalize(proposal);
    }

    // Start next height
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
    }
    await this.startNewRound(proposal.height + 1, 0);
  }

  /**
   * Try to finalize a block with AI assistance
   */
  private async tryFinalize(proposal: BlockProposal): Promise<void> {
    if (!this.finalityGadget || !this.currentRound) {
      return;
    }

    const signatures = Array.from(this.currentRound.precommits.entries())
      .filter(([, vote]) => vote.blockHash === proposal.hash)
      .map(([validator, vote]) => ({
        validator,
        signature: vote.signature,
      }));

    const certificate = await this.finalityGadget.createFinalityCertificate(
      proposal,
      signatures
    );

    if (certificate && certificate.aiScore !== undefined) {
      if (certificate.aiScore >= this.config.aiFinalityThreshold) {
        this.finalizedHeight = proposal.height;

        await this.emitEvent({
          type: 'block_finalized',
          height: proposal.height,
          round: this.currentRound.round,
          data: { certificate },
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Verify proposal signature (placeholder - implement with actual crypto)
   */
  private verifyProposalSignature(proposal: BlockProposal): boolean {
    // TODO: Implement actual signature verification
    return proposal.signature.length > 0;
  }

  /**
   * Verify vote signature (placeholder - implement with actual crypto)
   */
  private verifyVoteSignature(vote: Vote): boolean {
    // TODO: Implement actual signature verification
    return vote.signature.length > 0;
  }

  /**
   * Create a block proposal
   */
  async createProposal(
    height: number,
    parentHash: string,
    txRoot: string,
    stateRoot: string,
    txCount: number,
    privateKey: string
  ): Promise<BlockProposal> {
    const timestamp = new Date().toISOString();

    // Create hash of proposal content
    const content = `${height}:${parentHash}:${txRoot}:${stateRoot}:${timestamp}`;
    const hash = hashData(content);

    // TODO: Implement actual signing
    const signature = hashData(`${privateKey}:${hash}`);

    const validators = await this.registry.getActiveValidators();
    const proposer = selectProposer(validators, height);

    if (!proposer) {
      throw new Error('No active proposer available');
    }

    return {
      height,
      hash,
      parentHash,
      proposer: proposer.id.address,
      timestamp,
      txRoot,
      stateRoot,
      signature,
      txCount,
    };
  }

  /**
   * Create a vote
   */
  createVote(
    type: 'prevote' | 'precommit',
    height: number,
    blockHash: string,
    voterAddress: string,
    privateKey: string
  ): Vote {
    const timestamp = new Date().toISOString();

    // TODO: Implement actual signing
    const content = `${type}:${height}:${blockHash}:${voterAddress}:${timestamp}`;
    const signature = hashData(`${privateKey}:${content}`);

    return {
      type,
      height,
      round: this.currentRound?.round ?? 0,
      blockHash,
      validator: voterAddress,
      timestamp,
      signature,
    };
  }

  /**
   * Get current consensus status
   */
  async getStatus(): Promise<ConsensusStatus> {
    const activeValidators = await this.registry.getActiveValidatorCount();
    const totalValidators = await this.registry.getValidatorCount();

    return {
      height: this.currentRound?.height ?? 0,
      round: this.currentRound?.round ?? 0,
      step: this.currentRound?.step ?? 'propose',
      activeValidators,
      totalValidators,
      lastFinalizedHeight: this.finalizedHeight,
      currentProposer: this.currentRound?.proposer ?? '',
      health: activeValidators >= this.config.minValidators ? 1 : 0,
      aiMonitoringEnabled: this.config.aiAssistedFinality,
    };
  }

  /**
   * Get committed block
   */
  getCommittedBlock(height: number): BlockProposal | null {
    return this.committedBlocks.get(height) ?? null;
  }

  /**
   * Get finalized height
   */
  getFinalizedHeight(): number {
    return this.finalizedHeight;
  }

  /**
   * Subscribe to consensus events
   */
  subscribe(handler: ConsensusEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Emit consensus event
   */
  private async emitEvent(event: ConsensusEvent): Promise<void> {
    for (const handler of this.eventHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Consensus event handler error:', error);
      }
    }
  }
}
