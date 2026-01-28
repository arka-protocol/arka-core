/**
 * ARKA Consensus Module
 *
 * Proof-of-Authority consensus with AI-assisted finality.
 *
 * Features:
 * - Validator registry and weight management
 * - PoA consensus with voting rounds
 * - AI-assisted block finality
 * - Gossip-based message propagation
 * - Slashing for validator misbehavior
 *
 * @packageDocumentation
 */

// Types
export type {
  ValidatorStatus,
  VoteType,
  SlashingReason,
  ValidatorId,
  ValidatorConfig,
  BlockProposal,
  Vote,
  ConsensusRound,
  FinalityCertificate,
  SlashingEvent,
  GossipMessageType,
  GossipMessage,
  ConsensusStatus,
  ConsensusConfig,
} from './types.js';

export {
  DEFAULT_CONSENSUS_CONFIG,
  validateValidatorConfig,
  validateConsensusConfig,
} from './types.js';

// Validator Registry
export type { ValidatorRegistry } from './validator-registry.js';
export {
  InMemoryValidatorRegistry,
  createValidatorConfig,
  getValidatorsByWeight,
  calculateVotingPower,
} from './validator-registry.js';

// Validator Weights
export type {
  WeightFactors,
  WeightUpdateEvent,
  WeightCalculatorConfig,
} from './validator-weights.js';
export {
  DEFAULT_WEIGHT_CONFIG,
  ValidatorWeightCalculator,
  selectProposer,
  hasQuorum,
} from './validator-weights.js';

// PoA Consensus
export type {
  ConsensusEventType,
  ConsensusEvent,
  ConsensusEventHandler,
} from './poa-consensus.js';
export { PoAConsensus } from './poa-consensus.js';

// Finality Gadget
export type {
  FinalityCheckResult,
  AIFinalityScorer,
} from './finality-gadget.js';
export {
  DefaultAIFinalityScorer,
  FinalityGadget,
  createFinalityGadget,
} from './finality-gadget.js';

// Gossip Service
export type {
  GossipPeer,
  GossipMessageHandler,
  GossipConfig,
} from './gossip-service.js';
export {
  DEFAULT_GOSSIP_CONFIG,
  GossipService,
  createGossipService,
} from './gossip-service.js';

// Slashing
export type {
  SlashingConfig,
  SlashingEvidence,
  AnomalyDetectionResult,
  AIAnomalyDetector,
} from './slashing.js';
export {
  DEFAULT_SLASHING_CONFIG,
  DefaultAnomalyDetector,
  SlashingManager,
  createSlashingManager,
} from './slashing.js';

// AI Validator Scoring
export type {
  ValidatorAnomalySignal,
  AIValidatorScore,
  ValidatorBehaviorAnalysis,
  ValidatorRemediationAction,
  AIValidatorScorerConfig,
  ValidatorEvent,
  RiskEngine,
  AnomalyDetector,
  RemediationEngine,
} from './ai-validator-scoring.js';
export {
  DEFAULT_AI_SCORER_CONFIG,
  AIValidatorScorer,
  createAIValidatorScorer,
  createFullAIValidatorScorer,
} from './ai-validator-scoring.js';
