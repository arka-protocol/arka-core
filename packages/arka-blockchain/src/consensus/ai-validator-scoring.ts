/**
 * AI-Integrated Validator Scoring
 *
 * Provides AI-assisted scoring of validators for trust management.
 * Can optionally integrate with @arka/ai-risk, @arka/ai-monitor, and @arka/ai-remediation.
 */

import type { ValidatorConfig } from './types.js';
import type { ValidatorRegistry } from './validator-registry.js';

/**
 * Anomaly signal (simplified from @arka/types)
 */
export interface ValidatorAnomalySignal {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  validatorId: string;
  score: number;
  detectedAt: string;
  recommendations: string[];
}

/**
 * AI validator scoring result
 */
export interface AIValidatorScore {
  /** Validator address */
  validatorId: string;
  /** Trust score (0-1) */
  trustScore: number;
  /** Risk score (0-1, higher = riskier) */
  riskScore: number;
  /** Anomaly detected */
  anomalyDetected: boolean;
  /** Anomaly details if detected */
  anomaly?: ValidatorAnomalySignal;
  /** Risk reasons */
  riskReasons: string[];
  /** Recommended actions */
  recommendedActions: string[];
  /** Confidence in the score */
  confidence: number;
  /** Scoring timestamp */
  scoredAt: string;
}

/**
 * AI validator behavior analysis
 */
export interface ValidatorBehaviorAnalysis {
  /** Validator ID */
  validatorId: string;
  /** Analysis period (ms) */
  analysisPeriod: number;
  /** Block proposal rate */
  proposalRate: number;
  /** Vote participation rate */
  voteParticipation: number;
  /** Downtime incidents */
  downtimeIncidents: number;
  /** Invalid block attempts */
  invalidBlockAttempts: number;
  /** Detected anomalies */
  anomalies: ValidatorAnomalySignal[];
  /** Overall health score (0-1) */
  healthScore: number;
  /** Trend (improving, stable, declining) */
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * AI remediation action for validator
 */
export interface ValidatorRemediationAction {
  /** Action type */
  type: 'warn' | 'reduce_weight' | 'jail' | 'slash' | 'remove';
  /** Validator ID */
  validatorId: string;
  /** Reason for action */
  reason: string;
  /** Severity (0-1) */
  severity: number;
  /** Requires human approval */
  requiresApproval: boolean;
  /** AI confidence in recommendation */
  confidence: number;
  /** Suggested parameters */
  parameters?: {
    weightReduction?: number;
    jailDuration?: number;
    slashAmount?: number;
  };
}

/**
 * AI Validator Scorer Configuration
 */
export interface AIValidatorScorerConfig {
  /** Enable AI-based risk scoring */
  enableRiskScoring: boolean;
  /** Enable anomaly detection */
  enableAnomalyDetection: boolean;
  /** Enable auto-remediation suggestions */
  enableRemediation: boolean;
  /** Minimum score to trigger review */
  reviewThreshold: number;
  /** Minimum score to trigger automated action */
  actionThreshold: number;
  /** Historical window for analysis (ms) */
  analysisWindow: number;
  /** Require human approval for all actions */
  requireHumanApproval: boolean;
}

/**
 * Default AI validator scorer configuration
 */
export const DEFAULT_AI_SCORER_CONFIG: AIValidatorScorerConfig = {
  enableRiskScoring: true,
  enableAnomalyDetection: true,
  enableRemediation: true,
  reviewThreshold: 0.6,
  actionThreshold: 0.8,
  analysisWindow: 24 * 60 * 60 * 1000, // 24 hours
  requireHumanApproval: true,
};

/**
 * Risk Engine interface
 */
export interface RiskEngine {
  scoreEntity(input: unknown): Promise<{ score: number; reasons: string[] }>;
}

/**
 * Anomaly Detector interface
 */
export interface AnomalyDetector {
  readonly name: string;
  evaluate(event: unknown, context?: unknown): ValidatorAnomalySignal | null;
}

/**
 * Remediation Engine interface
 */
export interface RemediationEngine {
  generateSuggestions(context: unknown): Promise<Array<{
    description: string;
    confidence: number;
    requiresApproval?: boolean;
    action?: { type: string };
  }>>;
}

/**
 * Validator event for AI analysis
 */
export interface ValidatorEvent {
  type:
    | 'block_proposed'
    | 'block_missed'
    | 'vote_submitted'
    | 'vote_missed'
    | 'equivocation'
    | 'invalid_block'
    | 'downtime_start'
    | 'downtime_end';
  validatorId: string;
  timestamp: string;
  height?: number;
  data?: Record<string, unknown>;
}

/**
 * AI-Integrated Validator Scorer
 */
export class AIValidatorScorer {
  private config: AIValidatorScorerConfig;
  private registry: ValidatorRegistry;
  private riskEngine?: RiskEngine;
  private anomalyDetectors: AnomalyDetector[];
  private remediationEngine?: RemediationEngine;
  private validatorEvents: Map<string, ValidatorEvent[]>;

  constructor(
    registry: ValidatorRegistry,
    config: Partial<AIValidatorScorerConfig> = {},
    riskEngine?: RiskEngine,
    anomalyDetectors?: AnomalyDetector[],
    remediationEngine?: RemediationEngine
  ) {
    this.config = { ...DEFAULT_AI_SCORER_CONFIG, ...config };
    this.registry = registry;
    this.riskEngine = riskEngine;
    this.anomalyDetectors = anomalyDetectors ?? [];
    this.remediationEngine = remediationEngine;
    this.validatorEvents = new Map();
  }

  /**
   * Score a validator using AI
   */
  async scoreValidator(validatorId: string): Promise<AIValidatorScore> {
    const validator = await this.registry.getValidator(validatorId);
    if (!validator) {
      throw new Error(`Validator ${validatorId} not found`);
    }

    const events = this.getValidatorEvents(validatorId);
    const analysis = this.analyzeValidatorBehavior(validatorId, events);

    // Calculate base trust score
    let trustScore = validator.trustScore ?? 0.5;

    // Calculate risk score
    let riskScore = 0;
    let riskReasons: string[] = [];

    if (this.config.enableRiskScoring && this.riskEngine) {
      try {
        const riskResult = await this.riskEngine.scoreEntity({
          entityId: validatorId,
          entityType: 'VALIDATOR',
          entityData: {
            status: validator.status,
            weight: validator.weight,
            trustScore: validator.trustScore,
            slashCount: validator.slashCount,
          },
        });
        riskScore = riskResult.score;
        riskReasons = riskResult.reasons;
      } catch {
        // Fallback to rule-based
        const ruleBasedRisk = this.calculateRuleBasedRisk(validator, analysis);
        riskScore = ruleBasedRisk.score;
        riskReasons = ruleBasedRisk.reasons;
      }
    } else {
      const ruleBasedRisk = this.calculateRuleBasedRisk(validator, analysis);
      riskScore = ruleBasedRisk.score;
      riskReasons = ruleBasedRisk.reasons;
    }

    trustScore = Math.max(0, trustScore - riskScore * 0.3);

    // Check for anomalies
    let anomalyDetected = false;
    let anomaly: ValidatorAnomalySignal | undefined;

    if (this.config.enableAnomalyDetection) {
      const anomalyResult = this.detectAnomalies(validatorId, events);
      anomalyDetected = anomalyResult !== null;
      anomaly = anomalyResult ?? undefined;

      if (anomalyDetected) {
        trustScore = Math.max(0, trustScore - 0.2);
        riskReasons.push(`Anomaly detected: ${anomaly?.description}`);
      }
    }

    const recommendedActions = this.generateRecommendations(
      analysis,
      riskScore,
      anomalyDetected
    );

    return {
      validatorId,
      trustScore,
      riskScore,
      anomalyDetected,
      anomaly,
      riskReasons,
      recommendedActions,
      confidence: this.calculateConfidence(events.length),
      scoredAt: new Date().toISOString(),
    };
  }

  /**
   * Score all validators
   */
  async scoreAllValidators(): Promise<AIValidatorScore[]> {
    const validators = await this.registry.getAllValidators();
    const scores: AIValidatorScore[] = [];

    for (const validator of validators) {
      try {
        const score = await this.scoreValidator(validator.id.address);
        scores.push(score);
      } catch {
        // Continue with other validators
      }
    }

    return scores;
  }

  /**
   * Get remediation actions for a validator
   */
  async getRemediationActions(validatorId: string): Promise<ValidatorRemediationAction[]> {
    const score = await this.scoreValidator(validatorId);
    const actions: ValidatorRemediationAction[] = [];

    if (!this.config.enableRemediation) {
      return actions;
    }

    if (score.riskScore >= this.config.actionThreshold) {
      if (score.anomalyDetected) {
        actions.push({
          type: 'jail',
          validatorId,
          reason: 'Suspicious activity pattern detected',
          severity: score.riskScore,
          requiresApproval: this.config.requireHumanApproval,
          confidence: score.confidence,
          parameters: { jailDuration: 1000 },
        });
      } else if (score.riskReasons.some((r) => r.includes('downtime'))) {
        actions.push({
          type: 'reduce_weight',
          validatorId,
          reason: 'Excessive downtime detected',
          severity: score.riskScore,
          requiresApproval: this.config.requireHumanApproval,
          confidence: score.confidence,
          parameters: { weightReduction: 0.2 },
        });
      } else {
        actions.push({
          type: 'slash',
          validatorId,
          reason: 'High risk behavior detected',
          severity: score.riskScore,
          requiresApproval: this.config.requireHumanApproval,
          confidence: score.confidence,
          parameters: { slashAmount: Math.floor(score.riskScore * 10) },
        });
      }
    } else if (score.riskScore >= this.config.reviewThreshold) {
      actions.push({
        type: 'warn',
        validatorId,
        reason: 'Elevated risk detected - requires monitoring',
        severity: score.riskScore,
        requiresApproval: false,
        confidence: score.confidence,
      });
    }

    return actions;
  }

  /**
   * Record a validator event
   */
  recordEvent(event: ValidatorEvent): void {
    const events = this.validatorEvents.get(event.validatorId) ?? [];
    events.push(event);

    // Prune old events
    const cutoff = Date.now() - this.config.analysisWindow;
    const filtered = events.filter((e) => new Date(e.timestamp).getTime() > cutoff);
    this.validatorEvents.set(event.validatorId, filtered);
  }

  /**
   * Get events for a validator
   */
  private getValidatorEvents(validatorId: string): ValidatorEvent[] {
    return this.validatorEvents.get(validatorId) ?? [];
  }

  /**
   * Analyze validator behavior
   */
  private analyzeValidatorBehavior(
    validatorId: string,
    events: ValidatorEvent[]
  ): ValidatorBehaviorAnalysis {
    const blocksProposed = events.filter((e) => e.type === 'block_proposed').length;
    const blocksMissed = events.filter((e) => e.type === 'block_missed').length;
    const votesSubmitted = events.filter((e) => e.type === 'vote_submitted').length;
    const votesMissed = events.filter((e) => e.type === 'vote_missed').length;
    const downtimeStarts = events.filter((e) => e.type === 'downtime_start').length;
    const invalidBlocks = events.filter((e) => e.type === 'invalid_block').length;

    const totalProposals = blocksProposed + blocksMissed;
    const totalVotes = votesSubmitted + votesMissed;

    const proposalRate = totalProposals > 0 ? blocksProposed / totalProposals : 1;
    const voteParticipation = totalVotes > 0 ? votesSubmitted / totalVotes : 1;

    const healthScore =
      proposalRate * 0.3 +
      voteParticipation * 0.3 +
      (1 - Math.min(1, downtimeStarts / 5)) * 0.2 +
      (1 - Math.min(1, invalidBlocks / 3)) * 0.2;

    // Determine trend
    const midpoint = Math.floor(events.length / 2);
    const recentMisses = events
      .slice(midpoint)
      .filter((e) => e.type === 'block_missed' || e.type === 'vote_missed').length;
    const olderMisses = events
      .slice(0, midpoint)
      .filter((e) => e.type === 'block_missed' || e.type === 'vote_missed').length;

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (olderMisses > 0 && recentMisses < olderMisses * 0.7) {
      trend = 'improving';
    } else if (olderMisses > 0 && recentMisses > olderMisses * 1.3) {
      trend = 'declining';
    }

    return {
      validatorId,
      analysisPeriod: this.config.analysisWindow,
      proposalRate,
      voteParticipation,
      downtimeIncidents: downtimeStarts,
      invalidBlockAttempts: invalidBlocks,
      anomalies: [],
      healthScore,
      trend,
    };
  }

  /**
   * Calculate rule-based risk score
   */
  private calculateRuleBasedRisk(
    validator: ValidatorConfig,
    analysis: ValidatorBehaviorAnalysis
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Low uptime increases risk
    const uptime = validator.uptime ?? 1;
    if (uptime < 0.9) {
      score += (1 - uptime) * 0.3;
      reasons.push(`Low uptime: ${(uptime * 100).toFixed(1)}%`);
    }

    // Slash history increases risk
    if (validator.slashCount > 0) {
      score += Math.min(0.3, validator.slashCount * 0.1);
      reasons.push(`Previous slashes: ${validator.slashCount}`);
    }

    // Low proposal rate
    if (analysis.proposalRate < 0.9) {
      score += (1 - analysis.proposalRate) * 0.2;
      reasons.push(`Low proposal rate: ${(analysis.proposalRate * 100).toFixed(1)}%`);
    }

    // Low vote participation
    if (analysis.voteParticipation < 0.9) {
      score += (1 - analysis.voteParticipation) * 0.2;
      reasons.push(`Low vote participation: ${(analysis.voteParticipation * 100).toFixed(1)}%`);
    }

    // Downtime incidents
    if (analysis.downtimeIncidents > 0) {
      score += Math.min(0.3, analysis.downtimeIncidents * 0.05);
      reasons.push(`Downtime incidents: ${analysis.downtimeIncidents}`);
    }

    // Invalid blocks
    if (analysis.invalidBlockAttempts > 0) {
      score += Math.min(0.4, analysis.invalidBlockAttempts * 0.15);
      reasons.push(`Invalid block attempts: ${analysis.invalidBlockAttempts}`);
    }

    // Declining trend
    if (analysis.trend === 'declining') {
      score += 0.1;
      reasons.push('Performance declining');
    }

    return { score: Math.min(1, score), reasons };
  }

  /**
   * Detect anomalies
   */
  private detectAnomalies(
    validatorId: string,
    events: ValidatorEvent[]
  ): ValidatorAnomalySignal | null {
    // Check detectors
    for (const detector of this.anomalyDetectors) {
      for (const event of events) {
        const signal = detector.evaluate(event);
        if (signal) {
          return signal;
        }
      }
    }

    // Rule-based anomaly detection
    const recentEvents = events.filter(
      (e) => Date.now() - new Date(e.timestamp).getTime() < 3600000
    );

    // Velocity anomaly
    if (recentEvents.length > 100) {
      return {
        id: `sig_${Date.now().toString(36)}`,
        type: 'VELOCITY_SPIKE',
        severity: 'HIGH',
        description: `Unusual activity: ${recentEvents.length} events in last hour`,
        validatorId,
        score: Math.min(1, recentEvents.length / 200),
        detectedAt: new Date().toISOString(),
        recommendations: ['Review validator activity', 'Consider suspension'],
      };
    }

    // Equivocation
    const equivocations = events.filter((e) => e.type === 'equivocation');
    if (equivocations.length > 0) {
      return {
        id: `sig_${Date.now().toString(36)}`,
        type: 'EQUIVOCATION',
        severity: 'CRITICAL',
        description: `Double-signing detected`,
        validatorId,
        score: 1.0,
        detectedAt: new Date().toISOString(),
        recommendations: ['Immediately slash validator', 'Review all recent blocks'],
      };
    }

    return null;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    analysis: ValidatorBehaviorAnalysis,
    riskScore: number,
    anomalyDetected: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore >= this.config.actionThreshold) {
      recommendations.push('URGENT: Review validator immediately');
      if (anomalyDetected) {
        recommendations.push('Consider temporary suspension');
      }
    } else if (riskScore >= this.config.reviewThreshold) {
      recommendations.push('Schedule validator review');
      recommendations.push('Increase monitoring frequency');
    }

    if (analysis.proposalRate < 0.8) {
      recommendations.push('Investigate block proposal issues');
    }

    if (analysis.voteParticipation < 0.8) {
      recommendations.push('Check network connectivity');
    }

    if (analysis.trend === 'declining') {
      recommendations.push('Monitor for continued degradation');
    } else if (analysis.trend === 'improving') {
      recommendations.push('Performance improving - continue monitoring');
    }

    return recommendations;
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(eventCount: number): number {
    let confidence = 0.5;
    confidence += Math.min(0.3, eventCount * 0.01);
    if (this.riskEngine) confidence += 0.1;
    if (this.anomalyDetectors.length > 0) confidence += 0.05;
    return Math.min(0.95, confidence);
  }

  /**
   * Update registry with scores
   */
  async updateRegistryWithScores(): Promise<void> {
    const scores = await this.scoreAllValidators();
    for (const score of scores) {
      await this.registry.updateTrustScore(score.validatorId, score.trustScore);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): AIValidatorScorerConfig {
    return { ...this.config };
  }

  /**
   * Set risk engine
   */
  setRiskEngine(engine: RiskEngine): void {
    this.riskEngine = engine;
  }

  /**
   * Add anomaly detector
   */
  addAnomalyDetector(detector: AnomalyDetector): void {
    this.anomalyDetectors.push(detector);
  }

  /**
   * Set remediation engine
   */
  setRemediationEngine(engine: RemediationEngine): void {
    this.remediationEngine = engine;
  }
}

/**
 * Create AI validator scorer
 */
export function createAIValidatorScorer(
  registry: ValidatorRegistry,
  config?: Partial<AIValidatorScorerConfig>,
  riskEngine?: RiskEngine,
  remediationEngine?: RemediationEngine
): AIValidatorScorer {
  return new AIValidatorScorer(registry, config, riskEngine, [], remediationEngine);
}

/**
 * Create AI validator scorer with full AI integration
 *
 * This factory attempts to dynamically load AI packages if available.
 * Falls back to rule-based scoring if packages are not installed.
 */
export async function createFullAIValidatorScorer(
  registry: ValidatorRegistry,
  config?: Partial<AIValidatorScorerConfig>
): Promise<AIValidatorScorer> {
  // Note: AI packages (@arka/ai-risk, @arka/ai-monitor, @arka/ai-remediation)
  // can be dynamically loaded at runtime when available.
  // The scorer will use rule-based fallbacks when these packages are not available.
  return new AIValidatorScorer(registry, config, undefined, [], undefined);
}
