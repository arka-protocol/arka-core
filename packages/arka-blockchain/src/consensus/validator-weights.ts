/**
 * Validator Weights
 *
 * Manages validator weight calculations including AI-based trust scoring.
 */

import type { ValidatorConfig } from './types.js';
import type { ValidatorRegistry } from './validator-registry.js';

/**
 * Weight calculation factors
 */
export interface WeightFactors {
  /** Base weight factor (0-1) */
  baseWeight: number;
  /** Uptime factor (0-1) */
  uptimeFactor: number;
  /** Performance factor (0-1) */
  performanceFactor: number;
  /** Trust score factor (0-1) */
  trustFactor: number;
  /** Slashing penalty factor (0-1) */
  slashingPenalty: number;
}

/**
 * Weight update event
 */
export interface WeightUpdateEvent {
  /** Validator address */
  validator: string;
  /** Previous weight */
  previousWeight: number;
  /** New weight */
  newWeight: number;
  /** Factors used in calculation */
  factors: WeightFactors;
  /** Timestamp */
  timestamp: string;
}

/**
 * Weight calculator configuration
 */
export interface WeightCalculatorConfig {
  /** Weight for base weight factor */
  baseWeightMultiplier: number;
  /** Weight for uptime factor */
  uptimeMultiplier: number;
  /** Weight for performance factor */
  performanceMultiplier: number;
  /** Weight for trust factor */
  trustMultiplier: number;
  /** Penalty per slash */
  slashPenaltyPerEvent: number;
  /** Minimum weight */
  minWeight: number;
  /** Maximum weight */
  maxWeight: number;
}

/**
 * Default weight calculator configuration
 */
export const DEFAULT_WEIGHT_CONFIG: WeightCalculatorConfig = {
  baseWeightMultiplier: 0.3,
  uptimeMultiplier: 0.25,
  performanceMultiplier: 0.2,
  trustMultiplier: 0.25,
  slashPenaltyPerEvent: 0.1,
  minWeight: 1,
  maxWeight: 100,
};

/**
 * Validator weight calculator
 */
export class ValidatorWeightCalculator {
  private config: WeightCalculatorConfig;
  private weightHistory: Map<string, WeightUpdateEvent[]> = new Map();

  constructor(config: Partial<WeightCalculatorConfig> = {}) {
    this.config = { ...DEFAULT_WEIGHT_CONFIG, ...config };
  }

  /**
   * Calculate weight factors for a validator
   */
  calculateFactors(validator: ValidatorConfig): WeightFactors {
    // Base weight (normalized to 0-1)
    const baseWeight = validator.weight / this.config.maxWeight;

    // Uptime factor based on blocks proposed vs missed
    const totalBlocks = validator.blocksProposed + validator.blocksMissed;
    const uptimeFactor =
      totalBlocks > 0 ? validator.blocksProposed / totalBlocks : 1;

    // Performance factor (could be enhanced with more metrics)
    const performanceFactor = this.calculatePerformanceFactor(validator);

    // Trust factor from AI scoring
    const trustFactor = validator.trustScore;

    // Slashing penalty
    const slashingPenalty = Math.min(
      1,
      validator.slashCount * this.config.slashPenaltyPerEvent
    );

    return {
      baseWeight,
      uptimeFactor,
      performanceFactor,
      trustFactor,
      slashingPenalty,
    };
  }

  /**
   * Calculate performance factor based on validator metrics
   */
  private calculatePerformanceFactor(validator: ValidatorConfig): number {
    // Base performance is 1.0
    let performance = 1.0;

    // Reduce for high miss rate
    const totalBlocks = validator.blocksProposed + validator.blocksMissed;
    if (totalBlocks > 10) {
      const missRate = validator.blocksMissed / totalBlocks;
      performance *= 1 - missRate * 0.5;
    }

    // Reduce for multiple slashes
    if (validator.slashCount > 0) {
      performance *= Math.pow(0.9, validator.slashCount);
    }

    return Math.max(0, Math.min(1, performance));
  }

  /**
   * Calculate effective weight for a validator
   */
  calculateEffectiveWeight(validator: ValidatorConfig): number {
    const factors = this.calculateFactors(validator);

    // Weighted sum of factors
    let effectiveWeight =
      factors.baseWeight * this.config.baseWeightMultiplier +
      factors.uptimeFactor * this.config.uptimeMultiplier +
      factors.performanceFactor * this.config.performanceMultiplier +
      factors.trustFactor * this.config.trustMultiplier;

    // Apply slashing penalty
    effectiveWeight *= 1 - factors.slashingPenalty;

    // Scale to weight range
    effectiveWeight *= this.config.maxWeight;

    // Clamp to valid range
    return Math.max(
      this.config.minWeight,
      Math.min(this.config.maxWeight, Math.round(effectiveWeight))
    );
  }

  /**
   * Update validator weight based on current metrics
   */
  async updateValidatorWeight(
    registry: ValidatorRegistry,
    address: string
  ): Promise<WeightUpdateEvent | null> {
    const validator = await registry.getValidator(address);
    if (!validator) {
      return null;
    }

    const previousWeight = validator.weight;
    const factors = this.calculateFactors(validator);
    const newWeight = this.calculateEffectiveWeight(validator);

    if (newWeight !== previousWeight) {
      await registry.updateWeight(address, newWeight);

      const event: WeightUpdateEvent = {
        validator: address,
        previousWeight,
        newWeight,
        factors,
        timestamp: new Date().toISOString(),
      };

      // Store in history
      const history = this.weightHistory.get(address) || [];
      history.push(event);
      // Keep last 100 events
      if (history.length > 100) {
        history.shift();
      }
      this.weightHistory.set(address, history);

      return event;
    }

    return null;
  }

  /**
   * Update all validator weights
   */
  async updateAllWeights(
    registry: ValidatorRegistry
  ): Promise<WeightUpdateEvent[]> {
    const validators = await registry.getAllValidators();
    const updates: WeightUpdateEvent[] = [];

    for (const validator of validators) {
      const event = await this.updateValidatorWeight(
        registry,
        validator.id.address
      );
      if (event) {
        updates.push(event);
      }
    }

    return updates;
  }

  /**
   * Get weight history for a validator
   */
  getWeightHistory(address: string): WeightUpdateEvent[] {
    return this.weightHistory.get(address) || [];
  }

  /**
   * Apply AI trust score update
   */
  async applyTrustScoreUpdate(
    registry: ValidatorRegistry,
    address: string,
    trustScore: number
  ): Promise<WeightUpdateEvent | null> {
    await registry.updateTrustScore(address, trustScore);
    return this.updateValidatorWeight(registry, address);
  }
}

/**
 * Calculate proposer selection based on weighted round-robin
 */
export function selectProposer(
  validators: ValidatorConfig[],
  height: number
): ValidatorConfig | null {
  if (validators.length === 0) {
    return null;
  }

  // Filter active validators
  const activeValidators = validators.filter((v) => v.status === 'active');
  if (activeValidators.length === 0) {
    return null;
  }

  // Calculate total weight
  const totalWeight = activeValidators.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight === 0) {
    return null;
  }

  // Weighted round-robin selection
  const weightedIndex = height % totalWeight;
  let cumulativeWeight = 0;

  for (const validator of activeValidators) {
    cumulativeWeight += validator.weight;
    if (weightedIndex < cumulativeWeight) {
      return validator;
    }
  }

  // Fallback to first validator
  return activeValidators[0] ?? null;
}

/**
 * Calculate if quorum is reached
 */
export function hasQuorum(
  votingWeight: number,
  totalWeight: number,
  threshold: number
): boolean {
  if (totalWeight === 0) return false;
  return votingWeight / totalWeight >= threshold;
}
