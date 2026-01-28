/**
 * Consensus Types
 *
 * Type definitions for Proof-of-Authority consensus with AI-assisted finality.
 */

/**
 * Validator status
 */
export type ValidatorStatus = 'active' | 'inactive' | 'jailed' | 'pending';

/**
 * Vote type for consensus
 */
export type VoteType = 'prevote' | 'precommit' | 'finality';

/**
 * Slashing reason
 */
export type SlashingReason =
  | 'equivocation'
  | 'downtime'
  | 'invalid_block'
  | 'malicious_behavior'
  | 'ai_detected_anomaly';

/**
 * Validator identity
 */
export interface ValidatorId {
  /** Unique validator address/ID */
  address: string;
  /** Human-readable name */
  name: string;
  /** Public key for signature verification */
  publicKey: string;
}

/**
 * Validator configuration
 */
export interface ValidatorConfig {
  /** Validator identity */
  id: ValidatorId;
  /** Validator name (convenience accessor) */
  name?: string;
  /** Current status */
  status: ValidatorStatus;
  /** Voting weight (1-100) */
  weight: number;
  /** Uptime ratio (0-1) */
  uptime?: number;
  /** When validator was registered */
  registeredAt: string;
  /** Last active block height */
  lastActiveHeight: number;
  /** Total blocks proposed */
  blocksProposed: number;
  /** Total blocks missed */
  blocksMissed: number;
  /** AI-computed trust score (0-1) */
  trustScore: number;
  /** Slashing history count */
  slashCount: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Block proposal
 */
export interface BlockProposal {
  /** Block height */
  height: number;
  /** Block hash */
  hash: string;
  /** Parent block hash */
  parentHash: string;
  /** Proposer validator address */
  proposer: string;
  /** Proposal timestamp */
  timestamp: string;
  /** Transaction merkle root */
  txRoot: string;
  /** State root */
  stateRoot: string;
  /** Proposal signature */
  signature: string;
  /** Transaction count */
  txCount: number;
}

/**
 * Vote on a block proposal
 */
export interface Vote {
  /** Vote type */
  type: VoteType;
  /** Block height */
  height: number;
  /** Consensus round */
  round: number;
  /** Block hash being voted on */
  blockHash: string;
  /** Voter validator address */
  validator: string;
  /** Vote timestamp */
  timestamp: string;
  /** Vote signature */
  signature: string;
}

/**
 * Consensus round state
 */
export interface ConsensusRound {
  /** Current height */
  height: number;
  /** Current round number */
  round: number;
  /** Current step */
  step: 'propose' | 'prevote' | 'precommit' | 'commit';
  /** Current proposer */
  proposer: string;
  /** Current proposal if any */
  proposal?: BlockProposal;
  /** Prevotes received */
  prevotes: Map<string, Vote>;
  /** Precommits received */
  precommits: Map<string, Vote>;
  /** Round start time */
  startTime: number;
  /** Whether round is locked on a block */
  lockedBlock?: string;
  /** Valid block hash */
  validBlock?: string;
}

/**
 * Finality certificate
 */
export interface FinalityCertificate {
  /** Block height */
  height: number;
  /** Block hash */
  blockHash: string;
  /** Aggregated signatures from validators */
  signatures: Array<{
    validator: string;
    signature: string;
    weight: number;
  }>;
  /** Total weight of signers */
  totalWeight: number;
  /** Finality timestamp */
  createdAt: string;
  /** AI finality score (0-1) */
  aiScore?: number;
}

/**
 * Slashing event
 */
export interface SlashingEvent {
  /** Event ID */
  id: string;
  /** Validator being slashed */
  validator: string;
  /** Reason for slashing */
  reason: SlashingReason;
  /** Evidence hash */
  evidence: string;
  /** Block height when detected */
  height: number;
  /** Slash amount (weight reduction) */
  slashAmount: number;
  /** Jail duration in blocks (0 = permanent) */
  jailDuration: number;
  /** Timestamp */
  timestamp: string;
  /** AI confidence in slashing decision (0-1) */
  aiConfidence?: number;
}

/**
 * Gossip message types
 */
export type GossipMessageType =
  | 'proposal'
  | 'vote'
  | 'finality'
  | 'validator_update'
  | 'slashing';

/**
 * Gossip message
 */
export interface GossipMessage {
  /** Unique message ID */
  id: string;
  /** Message type */
  type: GossipMessageType;
  /** Sender validator */
  sender: string;
  /** Message payload */
  payload: unknown;
  /** Message signature */
  signature?: string;
  /** Timestamp */
  timestamp: string;
}

/**
 * Consensus status
 */
export interface ConsensusStatus {
  /** Current height */
  height: number;
  /** Current round */
  round: number;
  /** Current step */
  step: string;
  /** Active validators count */
  activeValidators?: number;
  /** Total validators count */
  totalValidators?: number;
  /** Validator count (alias) */
  validatorCount?: number;
  /** Last finalized height */
  lastFinalizedHeight?: number;
  /** Current proposer */
  currentProposer?: string;
  /** Consensus health (0-1) */
  health?: number;
  /** AI monitoring enabled */
  aiMonitoringEnabled?: boolean;
}

/**
 * Consensus configuration
 */
export interface ConsensusConfig {
  /** Block time in milliseconds */
  blockTimeMs: number;
  /** Timeout for propose step (ms) */
  proposeTimeoutMs: number;
  /** Timeout for prevote step (ms) */
  prevoteTimeoutMs: number;
  /** Timeout for precommit step (ms) */
  precommitTimeoutMs: number;
  /** Minimum validators for consensus */
  minValidators: number;
  /** Threshold for prevote (percentage) */
  prevoteThreshold: number;
  /** Threshold for precommit (percentage) */
  precommitThreshold: number;
  /** Enable AI-assisted finality */
  aiAssistedFinality: boolean;
  /** AI confidence threshold for finality */
  aiFinalityThreshold: number;
  /** Slashing enabled */
  slashingEnabled: boolean;
  /** Downtime threshold (missed blocks before jailing) */
  downtimeThreshold: number;
  /** Jail duration in blocks */
  jailDuration: number;
}

/**
 * Default consensus configuration
 */
export const DEFAULT_CONSENSUS_CONFIG: ConsensusConfig = {
  blockTimeMs: 5000,
  proposeTimeoutMs: 3000,
  prevoteTimeoutMs: 1000,
  precommitTimeoutMs: 1000,
  minValidators: 3,
  prevoteThreshold: 0.67,
  precommitThreshold: 0.67,
  aiAssistedFinality: true,
  aiFinalityThreshold: 0.8,
  slashingEnabled: true,
  downtimeThreshold: 100,
  jailDuration: 1000,
};

/**
 * Validate validator config
 */
export function validateValidatorConfig(config: ValidatorConfig): boolean {
  return (
    config.id.address.length > 0 &&
    config.id.publicKey.length > 0 &&
    config.weight >= 1 &&
    config.weight <= 100 &&
    config.trustScore >= 0 &&
    config.trustScore <= 1
  );
}

/**
 * Validate consensus config
 */
export function validateConsensusConfig(config: ConsensusConfig): boolean {
  return (
    config.blockTimeMs >= 100 &&
    config.minValidators >= 1 &&
    config.prevoteThreshold >= 0.5 &&
    config.prevoteThreshold <= 1 &&
    config.precommitThreshold >= 0.5 &&
    config.precommitThreshold <= 1
  );
}
