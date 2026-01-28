/**
 * Slashing Manager
 *
 * Handles validator slashing for misbehavior with AI-assisted detection.
 */

import type {
  SlashingEvent,
  SlashingReason,
  Vote,
  ValidatorConfig,
} from './types.js';
import type { ValidatorRegistry } from './validator-registry.js';
import { hashData } from '@arka-protocol/crypto';

/**
 * Slashing configuration
 */
export interface SlashingConfig {
  /** Slash amount for equivocation (weight reduction %) */
  equivocationSlash: number;
  /** Slash amount for downtime (weight reduction %) */
  downtimeSlash: number;
  /** Slash amount for invalid block (weight reduction %) */
  invalidBlockSlash: number;
  /** Slash amount for AI-detected anomaly (weight reduction %) */
  anomalySlash: number;
  /** Jail duration for equivocation (blocks) */
  equivocationJail: number;
  /** Jail duration for downtime (blocks) */
  downtimeJail: number;
  /** Jail duration for invalid block (blocks) */
  invalidBlockJail: number;
  /** Jail duration for anomaly (blocks) */
  anomalyJail: number;
  /** Enable AI-based anomaly detection */
  aiAnomalyDetection: boolean;
}

/**
 * Default slashing configuration
 */
export const DEFAULT_SLASHING_CONFIG: SlashingConfig = {
  equivocationSlash: 30,
  downtimeSlash: 10,
  invalidBlockSlash: 20,
  anomalySlash: 15,
  equivocationJail: 10000,
  downtimeJail: 1000,
  invalidBlockJail: 5000,
  anomalyJail: 2000,
  aiAnomalyDetection: true,
};

/**
 * Evidence for slashing
 */
export interface SlashingEvidence {
  /** Type of evidence */
  type: SlashingReason;
  /** Height where misbehavior occurred */
  height: number;
  /** Validator address */
  validator: string;
  /** Evidence data */
  data: unknown;
  /** Evidence hash */
  hash: string;
  /** Timestamp */
  timestamp: string;
}

/**
 * AI anomaly detection result
 */
export interface AnomalyDetectionResult {
  /** Whether anomaly was detected */
  anomalyDetected: boolean;
  /** Confidence level (0-1) */
  confidence: number;
  /** Type of anomaly */
  anomalyType?: string;
  /** Description */
  description?: string;
  /** Recommended action */
  recommendedAction?: 'warn' | 'slash' | 'jail';
}

/**
 * AI anomaly detector interface
 */
export interface AIAnomalyDetector {
  /** Analyze validator behavior for anomalies */
  analyzeValidator(
    validator: ValidatorConfig,
    recentActions: unknown[]
  ): Promise<AnomalyDetectionResult>;
}

/**
 * Default rule-based anomaly detector
 */
export class DefaultAnomalyDetector implements AIAnomalyDetector {
  async analyzeValidator(
    validator: ValidatorConfig,
    recentActions: unknown[]
  ): Promise<AnomalyDetectionResult> {
    let anomalyScore = 0;
    const reasons: string[] = [];

    // Check for high miss rate
    const totalBlocks = validator.blocksProposed + validator.blocksMissed;
    if (totalBlocks > 100) {
      const missRate = validator.blocksMissed / totalBlocks;
      if (missRate > 0.3) {
        anomalyScore += 0.3;
        reasons.push(`High miss rate: ${(missRate * 100).toFixed(1)}%`);
      }
    }

    // Check for rapid trust score decline
    if (validator.trustScore < 0.5) {
      anomalyScore += 0.2;
      reasons.push(`Low trust score: ${validator.trustScore.toFixed(2)}`);
    }

    // Check for multiple slashes
    if (validator.slashCount >= 3) {
      anomalyScore += 0.4;
      reasons.push(`Multiple slashes: ${validator.slashCount}`);
    }

    // Determine if anomaly should trigger action
    const anomalyDetected = anomalyScore >= 0.5;
    let recommendedAction: AnomalyDetectionResult['recommendedAction'];

    if (anomalyScore >= 0.8) {
      recommendedAction = 'jail';
    } else if (anomalyScore >= 0.5) {
      recommendedAction = 'slash';
    } else if (anomalyScore >= 0.3) {
      recommendedAction = 'warn';
    }

    return {
      anomalyDetected,
      confidence: Math.min(1, anomalyScore),
      anomalyType: anomalyDetected ? 'behavioral' : undefined,
      description: reasons.join('; '),
      recommendedAction,
    };
  }
}

/**
 * Slashing Manager
 */
export class SlashingManager {
  private config: SlashingConfig;
  private registry: ValidatorRegistry;
  private anomalyDetector: AIAnomalyDetector;
  private slashingHistory: Map<string, SlashingEvent[]> = new Map();
  private evidenceStore: Map<string, SlashingEvidence> = new Map();

  constructor(
    registry: ValidatorRegistry,
    config: Partial<SlashingConfig> = {},
    anomalyDetector?: AIAnomalyDetector
  ) {
    this.registry = registry;
    this.config = { ...DEFAULT_SLASHING_CONFIG, ...config };
    this.anomalyDetector = anomalyDetector ?? new DefaultAnomalyDetector();
  }

  /**
   * Slash for equivocation (double voting)
   */
  async slashForEquivocation(
    validator: string,
    height: number,
    vote1: Vote,
    vote2: Vote
  ): Promise<SlashingEvent> {
    // Create evidence
    const evidence = this.createEvidence('equivocation', height, validator, {
      vote1,
      vote2,
    });

    return this.executeSlash(
      validator,
      'equivocation',
      evidence.hash,
      height,
      this.config.equivocationSlash,
      this.config.equivocationJail
    );
  }

  /**
   * Slash for downtime
   */
  async slashForDowntime(
    validator: string,
    height: number
  ): Promise<SlashingEvent> {
    const validatorConfig = await this.registry.getValidator(validator);
    const evidence = this.createEvidence('downtime', height, validator, {
      missedBlocks: validatorConfig?.blocksMissed ?? 0,
    });

    return this.executeSlash(
      validator,
      'downtime',
      evidence.hash,
      height,
      this.config.downtimeSlash,
      this.config.downtimeJail
    );
  }

  /**
   * Slash for invalid block proposal
   */
  async slashForInvalidBlock(
    validator: string,
    height: number,
    reason: string
  ): Promise<SlashingEvent> {
    const evidence = this.createEvidence('invalid_block', height, validator, {
      reason,
    });

    return this.executeSlash(
      validator,
      'invalid_block',
      evidence.hash,
      height,
      this.config.invalidBlockSlash,
      this.config.invalidBlockJail
    );
  }

  /**
   * Slash for AI-detected anomaly
   */
  async slashForAnomaly(
    validator: string,
    height: number,
    anomalyResult: AnomalyDetectionResult
  ): Promise<SlashingEvent> {
    const evidence = this.createEvidence(
      'ai_detected_anomaly',
      height,
      validator,
      anomalyResult
    );

    return this.executeSlash(
      validator,
      'ai_detected_anomaly',
      evidence.hash,
      height,
      this.config.anomalySlash,
      this.config.anomalyJail,
      anomalyResult.confidence
    );
  }

  /**
   * Execute slashing
   */
  private async executeSlash(
    validator: string,
    reason: SlashingReason,
    evidenceHash: string,
    height: number,
    slashAmount: number,
    jailDuration: number,
    aiConfidence?: number
  ): Promise<SlashingEvent> {
    const event: SlashingEvent = {
      id: `slash_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
      validator,
      reason,
      evidence: evidenceHash,
      height,
      slashAmount,
      jailDuration,
      timestamp: new Date().toISOString(),
      aiConfidence,
    };

    // Update validator status
    await this.registry.updateStatus(validator, 'jailed');
    await this.registry.incrementSlashCount(validator);

    // Reduce weight
    const validatorConfig = await this.registry.getValidator(validator);
    if (validatorConfig) {
      const newWeight = Math.max(
        1,
        Math.round(validatorConfig.weight * (1 - slashAmount / 100))
      );
      await this.registry.updateWeight(validator, newWeight);
    }

    // Store in history
    const history = this.slashingHistory.get(validator) || [];
    history.push(event);
    this.slashingHistory.set(validator, history);

    return event;
  }

  /**
   * Create evidence record
   */
  private createEvidence(
    type: SlashingReason,
    height: number,
    validator: string,
    data: unknown
  ): SlashingEvidence {
    const timestamp = new Date().toISOString();
    const content = JSON.stringify({ type, height, validator, data, timestamp });
    const hash = hashData(content);

    const evidence: SlashingEvidence = {
      type,
      height,
      validator,
      data,
      hash,
      timestamp,
    };

    this.evidenceStore.set(hash, evidence);
    return evidence;
  }

  /**
   * Unjail a validator after jail duration
   */
  async unjail(validator: string, currentHeight: number): Promise<boolean> {
    const history = this.slashingHistory.get(validator);
    if (!history || history.length === 0) {
      return false;
    }

    const lastSlash = history[history.length - 1]!;
    const jailEndHeight = lastSlash.height + lastSlash.jailDuration;

    if (currentHeight < jailEndHeight) {
      return false; // Still in jail
    }

    await this.registry.updateStatus(validator, 'active');
    return true;
  }

  /**
   * Check validator for anomalies
   */
  async checkForAnomalies(
    validator: string,
    height: number
  ): Promise<AnomalyDetectionResult | null> {
    if (!this.config.aiAnomalyDetection) {
      return null;
    }

    const validatorConfig = await this.registry.getValidator(validator);
    if (!validatorConfig) {
      return null;
    }

    const result = await this.anomalyDetector.analyzeValidator(
      validatorConfig,
      [] // Could pass recent actions here
    );

    if (result.anomalyDetected && result.recommendedAction === 'slash') {
      await this.slashForAnomaly(validator, height, result);
    }

    return result;
  }

  /**
   * Get slashing history for a validator
   */
  getSlashingHistory(validator: string): SlashingEvent[] {
    return this.slashingHistory.get(validator) || [];
  }

  /**
   * Get evidence by hash
   */
  getEvidence(hash: string): SlashingEvidence | null {
    return this.evidenceStore.get(hash) ?? null;
  }

  /**
   * Get all slashing events
   */
  getAllSlashingEvents(): SlashingEvent[] {
    const events: SlashingEvent[] = [];
    for (const history of this.slashingHistory.values()) {
      events.push(...history);
    }
    return events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get slashing statistics
   */
  getStats(): {
    totalSlashes: number;
    slashesByReason: Record<SlashingReason, number>;
    validatorsJailed: number;
  } {
    const events = this.getAllSlashingEvents();
    const slashesByReason: Record<SlashingReason, number> = {
      equivocation: 0,
      downtime: 0,
      invalid_block: 0,
      malicious_behavior: 0,
      ai_detected_anomaly: 0,
    };

    for (const event of events) {
      slashesByReason[event.reason]++;
    }

    return {
      totalSlashes: events.length,
      slashesByReason,
      validatorsJailed: this.slashingHistory.size,
    };
  }
}

/**
 * Create slashing manager
 */
export function createSlashingManager(
  registry: ValidatorRegistry,
  config?: Partial<SlashingConfig>,
  anomalyDetector?: AIAnomalyDetector
): SlashingManager {
  return new SlashingManager(registry, config, anomalyDetector);
}
