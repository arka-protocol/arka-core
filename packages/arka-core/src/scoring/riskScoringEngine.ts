/**
 * Adaptive Compliance Scoring Engine
 *
 * Computes and manages entity risk scores based on compliance history,
 * violations, and contextual factors (Enhancement #13).
 */

import type {
  EntityRiskScore as BaseEntityRiskScore,
  RiskFactor as BaseRiskFactor,
  RiskBand,
} from '@arka-protocol/types';

/**
 * Extended risk band with scoring metadata
 */
export interface RiskBandConfig {
  /** Band name matching RiskBand type */
  name: RiskBand;

  /** Minimum score for this band */
  minScore: number;

  /** Maximum score for this band */
  maxScore: number;

  /** Display color */
  color: string;

  /** Human-readable description */
  description: string;
}

/**
 * Extended risk factor for internal computation
 */
export interface ComputedRiskFactor extends BaseRiskFactor {
  /** Factor identifier */
  id: string;

  /** Factor category */
  category: 'HISTORICAL' | 'BEHAVIORAL' | 'STRUCTURAL' | 'CONTEXTUAL' | 'EXTERNAL';
}

/**
 * Extended entity risk score with additional metadata
 */
export interface EntityRiskScore extends Omit<BaseEntityRiskScore, 'factors' | 'calculatedAt'> {
  /** Computed risk factors with extended info */
  factors: ComputedRiskFactor[];

  /** Confidence level in the score (0-1) */
  confidence?: number;

  /** ISO timestamp of calculation */
  calculatedAt: string;
}

/**
 * Risk factor definition
 */
export interface RiskFactorDefinition {
  /** Factor identifier */
  id: string;

  /** Factor name */
  name: string;

  /** Factor category */
  category: 'HISTORICAL' | 'BEHAVIORAL' | 'STRUCTURAL' | 'CONTEXTUAL' | 'EXTERNAL';

  /** Weight in overall score (0-1) */
  weight: number;

  /** Function to compute factor value */
  compute: (context: RiskComputeContext) => Promise<number>;

  /** Whether this factor is enabled */
  enabled: boolean;
}

/**
 * Context for computing risk factors
 */
export interface RiskComputeContext {
  /** Entity ID */
  entityId: string;

  /** Entity type */
  entityType: string;

  /** Entity data */
  entityData: Record<string, unknown>;

  /** Historical decisions */
  decisions: DecisionHistory[];

  /** Current timestamp */
  timestamp: string;

  /** Jurisdiction */
  jurisdiction?: string;

  /** Additional context */
  additionalContext?: Record<string, unknown>;
}

/**
 * Historical decision for risk calculation
 */
export interface DecisionHistory {
  /** Decision ID */
  id: string;

  /** Rule ID */
  ruleId: string;

  /** Decision type */
  decision: 'ALLOW' | 'DENY' | 'FLAG';

  /** Severity */
  severity: string;

  /** Timestamp */
  timestamp: string;

  /** Whether it was a violation */
  isViolation: boolean;
}

/**
 * Scoring model configuration
 */
export interface ScoringModelConfig {
  /** Model name */
  name: string;

  /** Risk bands */
  bands: RiskBandConfig[];

  /** Decay rate for historical factors (per day) */
  historicalDecayRate: number;

  /** Maximum lookback period in days */
  maxLookbackDays: number;

  /** Minimum decisions required for stable score */
  minDecisionsForStableScore: number;

  /** Default score for new entities */
  defaultScore: number;
}

/**
 * Score change event
 */
export interface ScoreChangeEvent {
  /** Entity ID */
  entityId: string;

  /** Previous score */
  previousScore: number;

  /** New score */
  newScore: number;

  /** Previous band */
  previousBand: string;

  /** New band */
  newBand: string;

  /** Factors that contributed to change */
  contributingFactors: Array<{
    factorId: string;
    contribution: number;
  }>;

  /** Timestamp */
  timestamp: string;
}

/**
 * Score listener
 */
export type ScoreChangeListener = (event: ScoreChangeEvent) => void;

/**
 * Default risk bands
 */
export const DEFAULT_RISK_BANDS: RiskBandConfig[] = [
  { name: 'MINIMAL', minScore: 0, maxScore: 20, color: 'green', description: 'Minimal risk' },
  { name: 'LOW', minScore: 20, maxScore: 40, color: 'lightgreen', description: 'Low risk' },
  { name: 'MEDIUM', minScore: 40, maxScore: 60, color: 'yellow', description: 'Moderate risk' },
  { name: 'HIGH', minScore: 60, maxScore: 80, color: 'orange', description: 'High risk' },
  { name: 'CRITICAL', minScore: 80, maxScore: 100, color: 'red', description: 'Critical risk' },
];

/**
 * Default scoring model
 */
export const DEFAULT_SCORING_MODEL: ScoringModelConfig = {
  name: 'default',
  bands: DEFAULT_RISK_BANDS,
  historicalDecayRate: 0.99, // 1% decay per day
  maxLookbackDays: 365,
  minDecisionsForStableScore: 10,
  defaultScore: 30, // Start at LOW band
};

/**
 * Risk Scoring Engine
 */
export class RiskScoringEngine {
  private factors: Map<string, RiskFactorDefinition> = new Map();
  private scores: Map<string, EntityRiskScore> = new Map();
  private model: ScoringModelConfig;
  private listeners: ScoreChangeListener[] = [];

  constructor(model?: ScoringModelConfig) {
    this.model = model ?? DEFAULT_SCORING_MODEL;
    this.registerDefaultFactors();
  }

  /**
   * Register a risk factor
   */
  registerFactor(factor: RiskFactorDefinition): void {
    this.factors.set(factor.id, factor);
  }

  /**
   * Compute risk score for an entity
   */
  async computeScore(context: RiskComputeContext): Promise<EntityRiskScore> {
    const factorResults: ComputedRiskFactor[] = [];
    let totalWeight = 0;
    let weightedSum = 0;

    // Compute each enabled factor
    for (const factor of this.factors.values()) {
      if (!factor.enabled) continue;

      try {
        const value = await factor.compute(context);
        const clampedValue = Math.max(0, Math.min(100, value));

        factorResults.push({
          id: factor.id,
          name: factor.name,
          value: clampedValue,
          weight: factor.weight,
          description: `Computed value: ${clampedValue.toFixed(2)}`,
          source: 'AI_ANALYSIS',
          category: factor.category,
        });

        weightedSum += clampedValue * factor.weight;
        totalWeight += factor.weight;
      } catch (error) {
        // Factor computation failed - skip but log
        console.error(`Factor ${factor.id} computation failed:`, error);
      }
    }

    // Calculate final score
    const rawScore = totalWeight > 0 ? weightedSum / totalWeight : this.model.defaultScore;
    const finalScore = Math.round(rawScore * 100) / 100;

    // Determine risk band
    const band = this.getBandForScore(finalScore);

    // Determine confidence based on decision history
    const confidence = this.calculateConfidence(context.decisions.length);

    // Get previous score
    const previousScore = this.scores.get(context.entityId);

    // Create new score
    const newScore: EntityRiskScore = {
      id: `risk-${context.entityId}-${Date.now()}`,
      entityId: context.entityId,
      entityType: context.entityType,
      riskScore: finalScore,
      riskBand: band.name,
      factors: factorResults,
      calculatedAt: context.timestamp,
      previousScore: previousScore?.riskScore,
      trend: this.calculateTrend(previousScore?.riskScore, finalScore),
      confidence,
    };

    // Check for band change
    if (previousScore && previousScore.riskBand !== newScore.riskBand) {
      this.emitScoreChange({
        entityId: context.entityId,
        previousScore: previousScore.riskScore,
        newScore: finalScore,
        previousBand: previousScore.riskBand,
        newBand: newScore.riskBand,
        contributingFactors: factorResults.map((f) => ({
          factorId: f.id,
          contribution: (f.value * f.weight) / totalWeight,
        })),
        timestamp: context.timestamp,
      });
    }

    // Store score
    this.scores.set(context.entityId, newScore);

    return newScore;
  }

  /**
   * Get current score for an entity
   */
  getScore(entityId: string): EntityRiskScore | undefined {
    return this.scores.get(entityId);
  }

  /**
   * Get all scores
   */
  getAllScores(): EntityRiskScore[] {
    return Array.from(this.scores.values());
  }

  /**
   * Get scores by band
   */
  getScoresByBand(bandName: string): EntityRiskScore[] {
    return Array.from(this.scores.values()).filter((s) => s.riskBand === bandName);
  }

  /**
   * Get high-risk entities
   */
  getHighRiskEntities(threshold: number = 60): EntityRiskScore[] {
    return Array.from(this.scores.values())
      .filter((s) => s.riskScore >= threshold)
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Add score change listener
   */
  onScoreChange(listener: ScoreChangeListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove score change listener
   */
  offScoreChange(listener: ScoreChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Update scoring model
   */
  updateModel(model: Partial<ScoringModelConfig>): void {
    this.model = { ...this.model, ...model };
  }

  /**
   * Get current model
   */
  getModel(): ScoringModelConfig {
    return { ...this.model };
  }

  /**
   * Get all registered factors
   */
  getFactors(): RiskFactorDefinition[] {
    return Array.from(this.factors.values());
  }

  /**
   * Enable/disable a factor
   */
  setFactorEnabled(factorId: string, enabled: boolean): void {
    const factor = this.factors.get(factorId);
    if (factor) {
      factor.enabled = enabled;
    }
  }

  /**
   * Batch compute scores for multiple entities
   */
  async computeBatchScores(contexts: RiskComputeContext[]): Promise<Map<string, EntityRiskScore>> {
    const results = new Map<string, EntityRiskScore>();

    await Promise.all(
      contexts.map(async (context) => {
        const score = await this.computeScore(context);
        results.set(context.entityId, score);
      })
    );

    return results;
  }

  // Private methods

  private registerDefaultFactors(): void {
    // Historical violation rate
    this.registerFactor({
      id: 'violation_rate',
      name: 'Violation Rate',
      category: 'HISTORICAL',
      weight: 0.3,
      enabled: true,
      compute: async (context) => {
        const { decisions } = context;
        if (decisions.length === 0) return 0;

        const violations = decisions.filter((d) => d.isViolation);
        const recentViolations = this.applyDecay(violations, context.timestamp);

        return (recentViolations / decisions.length) * 100;
      },
    });

    // Severity-weighted violations
    this.registerFactor({
      id: 'severity_weighted',
      name: 'Severity-Weighted Violations',
      category: 'HISTORICAL',
      weight: 0.25,
      enabled: true,
      compute: async (context) => {
        const { decisions } = context;
        const violations = decisions.filter((d) => d.isViolation);
        if (violations.length === 0) return 0;

        const severityWeights: Record<string, number> = {
          CRITICAL: 4,
          HIGH: 3,
          MEDIUM: 2,
          LOW: 1,
        };

        let weightedSum = 0;
        for (const v of violations) {
          const weight = severityWeights[v.severity] ?? 1;
          const age = this.getDaysSince(v.timestamp, context.timestamp);
          const decayedWeight = weight * Math.pow(this.model.historicalDecayRate, age);
          weightedSum += decayedWeight;
        }

        // Normalize to 0-100
        const maxPossible = violations.length * 4;
        return Math.min(100, (weightedSum / maxPossible) * 100);
      },
    });

    // Recent activity
    this.registerFactor({
      id: 'recent_activity',
      name: 'Recent Activity Pattern',
      category: 'BEHAVIORAL',
      weight: 0.15,
      enabled: true,
      compute: async (context) => {
        const { decisions } = context;
        const last30Days = decisions.filter((d) => {
          const age = this.getDaysSince(d.timestamp, context.timestamp);
          return age <= 30;
        });

        if (last30Days.length === 0) return 0;

        const recentViolations = last30Days.filter((d) => d.isViolation);
        // Weight recent violations more heavily
        return (recentViolations.length / last30Days.length) * 120; // Can exceed 100 for recent issues
      },
    });

    // Decision volume
    this.registerFactor({
      id: 'decision_volume',
      name: 'Decision Volume',
      category: 'BEHAVIORAL',
      weight: 0.1,
      enabled: true,
      compute: async (context) => {
        const { decisions } = context;
        // High volume with many violations = higher risk
        const last90Days = decisions.filter((d) => {
          const age = this.getDaysSince(d.timestamp, context.timestamp);
          return age <= 90;
        });

        if (last90Days.length < 10) return 20; // Low volume baseline
        if (last90Days.length > 100) return 40; // High volume slight increase

        return 30;
      },
    });

    // Entity age
    this.registerFactor({
      id: 'entity_age',
      name: 'Entity Age',
      category: 'STRUCTURAL',
      weight: 0.1,
      enabled: true,
      compute: async (context) => {
        const { decisions } = context;
        if (decisions.length === 0) return 50; // New entity - neutral

        const oldest = decisions.reduce((min, d) => {
          return d.timestamp < min.timestamp ? d : min;
        });

        const age = this.getDaysSince(oldest.timestamp, context.timestamp);

        // Newer entities get slightly higher risk
        if (age < 30) return 60;
        if (age < 90) return 45;
        if (age < 365) return 35;
        return 25; // Established entities
      },
    });

    // Deny ratio
    this.registerFactor({
      id: 'deny_ratio',
      name: 'Denial Ratio',
      category: 'HISTORICAL',
      weight: 0.1,
      enabled: true,
      compute: async (context) => {
        const { decisions } = context;
        if (decisions.length === 0) return 0;

        const denials = decisions.filter((d) => d.decision === 'DENY');
        return (denials.length / decisions.length) * 100;
      },
    });
  }

  private getBandForScore(score: number): RiskBandConfig {
    for (const band of this.model.bands) {
      if (score >= band.minScore && score < band.maxScore) {
        return band;
      }
    }
    // Default to highest band
    const lastBand = this.model.bands[this.model.bands.length - 1];
    if (!lastBand) {
      // Fallback if no bands configured
      return { name: 'CRITICAL', minScore: 0, maxScore: 100, color: 'red', description: 'Critical risk' };
    }
    return lastBand;
  }

  private calculateConfidence(decisionCount: number): number {
    const min = this.model.minDecisionsForStableScore;
    if (decisionCount >= min) return 1.0;
    return decisionCount / min;
  }

  private calculateTrend(
    previousScore: number | undefined,
    currentScore: number
  ): 'IMPROVING' | 'STABLE' | 'WORSENING' {
    if (previousScore === undefined) return 'STABLE';

    const diff = currentScore - previousScore;
    if (Math.abs(diff) < 2) return 'STABLE';
    return diff > 0 ? 'WORSENING' : 'IMPROVING';
  }

  private applyDecay(decisions: DecisionHistory[], currentTimestamp: string): number {
    let decayedCount = 0;

    for (const d of decisions) {
      const age = this.getDaysSince(d.timestamp, currentTimestamp);
      if (age <= this.model.maxLookbackDays) {
        decayedCount += Math.pow(this.model.historicalDecayRate, age);
      }
    }

    return decayedCount;
  }

  private getDaysSince(timestamp: string, reference: string): number {
    const date = new Date(timestamp);
    const ref = new Date(reference);
    return Math.floor((ref.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  private emitScoreChange(event: ScoreChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

/**
 * Create a risk scoring engine
 */
export function createRiskScoringEngine(model?: ScoringModelConfig): RiskScoringEngine {
  return new RiskScoringEngine(model);
}
