/**
 * Finality Gadget
 *
 * AI-assisted block finality with risk scoring and anomaly detection.
 */

import type {
  BlockProposal,
  FinalityCertificate,
  ValidatorConfig,
} from './types.js';
import type { ValidatorRegistry } from './validator-registry.js';

/**
 * Finality check result
 */
export interface FinalityCheckResult {
  /** Whether block can be finalized */
  canFinalize: boolean;
  /** AI confidence score (0-1) */
  aiScore: number;
  /** Reasons for decision */
  reasons: string[];
  /** Any detected anomalies */
  anomalies: string[];
  /** Risk factors */
  riskFactors: Array<{
    factor: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

/**
 * AI finality scorer interface
 */
export interface AIFinalityScorer {
  /** Score a block for finality */
  scoreBlock(
    proposal: BlockProposal,
    signatures: Array<{ validator: string; signature: string }>,
    validatorConfigs: ValidatorConfig[]
  ): Promise<FinalityCheckResult>;
}

/**
 * Default AI finality scorer (rule-based)
 */
export class DefaultAIFinalityScorer implements AIFinalityScorer {
  private readonly minSignatures: number;
  private readonly minTrustScore: number;
  private readonly minValidatorWeight: number;

  constructor(options: {
    minSignatures?: number;
    minTrustScore?: number;
    minValidatorWeight?: number;
  } = {}) {
    this.minSignatures = options.minSignatures ?? 3;
    this.minTrustScore = options.minTrustScore ?? 0.7;
    this.minValidatorWeight = options.minValidatorWeight ?? 50;
  }

  async scoreBlock(
    proposal: BlockProposal,
    signatures: Array<{ validator: string; signature: string }>,
    validatorConfigs: ValidatorConfig[]
  ): Promise<FinalityCheckResult> {
    const reasons: string[] = [];
    const anomalies: string[] = [];
    const riskFactors: FinalityCheckResult['riskFactors'] = [];

    let score = 1.0;

    // Check signature count
    if (signatures.length < this.minSignatures) {
      score *= 0.5;
      reasons.push(`Insufficient signatures: ${signatures.length}/${this.minSignatures}`);
      riskFactors.push({
        factor: 'low_signature_count',
        severity: 'high',
        description: `Only ${signatures.length} signatures received`,
      });
    } else {
      reasons.push(`Signature count: ${signatures.length} (sufficient)`);
    }

    // Check validator trust scores
    const signerConfigs = validatorConfigs.filter((v) =>
      signatures.some((s) => s.validator === v.id.address)
    );

    const avgTrustScore =
      signerConfigs.length > 0
        ? signerConfigs.reduce((sum, v) => sum + v.trustScore, 0) / signerConfigs.length
        : 0;

    if (avgTrustScore < this.minTrustScore) {
      score *= 0.7;
      reasons.push(`Low average trust score: ${avgTrustScore.toFixed(2)}`);
      riskFactors.push({
        factor: 'low_trust_score',
        severity: 'medium',
        description: `Average signer trust score is ${avgTrustScore.toFixed(2)}`,
      });
    } else {
      reasons.push(`Average trust score: ${avgTrustScore.toFixed(2)} (good)`);
    }

    // Check validator weights
    const totalWeight = signerConfigs.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight < this.minValidatorWeight) {
      score *= 0.6;
      reasons.push(`Low total weight: ${totalWeight}/${this.minValidatorWeight}`);
      riskFactors.push({
        factor: 'low_voting_power',
        severity: 'high',
        description: `Total signer weight is only ${totalWeight}`,
      });
    } else {
      reasons.push(`Total voting weight: ${totalWeight} (sufficient)`);
    }

    // Check for slashed validators
    const slashedSigners = signerConfigs.filter((v) => v.slashCount > 0);
    if (slashedSigners.length > 0) {
      score *= 0.9;
      anomalies.push(`${slashedSigners.length} signer(s) have slashing history`);
      riskFactors.push({
        factor: 'slashed_signers',
        severity: 'low',
        description: `Signers with slashing history: ${slashedSigners.map((v) => v.id.address).join(', ')}`,
      });
    }

    // Check for jailed validators attempting to sign
    const jailedSigners = validatorConfigs.filter(
      (v) =>
        v.status === 'jailed' &&
        signatures.some((s) => s.validator === v.id.address)
    );
    if (jailedSigners.length > 0) {
      score *= 0.5;
      anomalies.push(`${jailedSigners.length} jailed validator(s) attempted to sign`);
      riskFactors.push({
        factor: 'jailed_signers',
        severity: 'high',
        description: `Jailed validators signed: ${jailedSigners.map((v) => v.id.address).join(', ')}`,
      });
    }

    // Check block timing
    const blockTime = new Date(proposal.timestamp).getTime();
    const now = Date.now();
    const timeDiff = Math.abs(now - blockTime);

    if (timeDiff > 60000) {
      // More than 1 minute old
      score *= 0.8;
      anomalies.push(`Block timestamp is ${Math.round(timeDiff / 1000)}s from now`);
      riskFactors.push({
        factor: 'stale_block',
        severity: 'medium',
        description: `Block is ${Math.round(timeDiff / 1000)} seconds old`,
      });
    }

    // Normalize score
    score = Math.max(0, Math.min(1, score));

    return {
      canFinalize: score >= 0.8 && anomalies.length === 0,
      aiScore: score,
      reasons,
      anomalies,
      riskFactors,
    };
  }
}

/**
 * Finality Gadget
 *
 * Manages block finality with AI assistance.
 */
export class FinalityGadget {
  private registry: ValidatorRegistry;
  private scorer: AIFinalityScorer;
  private finalizedBlocks: Map<number, FinalityCertificate> = new Map();
  private lastFinalizedHeight: number = 0;

  constructor(registry: ValidatorRegistry, scorer?: AIFinalityScorer) {
    this.registry = registry;
    this.scorer = scorer ?? new DefaultAIFinalityScorer();
  }

  /**
   * Check if a block can be finalized
   */
  async checkFinality(
    proposal: BlockProposal,
    signatures: Array<{ validator: string; signature: string }>
  ): Promise<FinalityCheckResult> {
    const validatorConfigs = await this.registry.getAllValidators();
    return this.scorer.scoreBlock(proposal, signatures, validatorConfigs);
  }

  /**
   * Create finality certificate if block can be finalized
   */
  async createFinalityCertificate(
    proposal: BlockProposal,
    signatures: Array<{ validator: string; signature: string }>
  ): Promise<FinalityCertificate | null> {
    const result = await this.checkFinality(proposal, signatures);

    if (!result.canFinalize) {
      return null;
    }

    // Calculate total weight
    const validators = await this.registry.getAllValidators();
    const signerConfigs = validators.filter((v) =>
      signatures.some((s) => s.validator === v.id.address)
    );
    const totalWeight = signerConfigs.reduce((sum, v) => sum + v.weight, 0);

    // Build signatures with weights
    const signaturesWithWeight = signatures.map((s) => {
      const validatorConfig = signerConfigs.find((v) => v.id.address === s.validator);
      return {
        validator: s.validator,
        signature: s.signature,
        weight: validatorConfig?.weight ?? 0,
      };
    });

    const certificate: FinalityCertificate = {
      height: proposal.height,
      blockHash: proposal.hash,
      signatures: signaturesWithWeight,
      totalWeight,
      createdAt: new Date().toISOString(),
      aiScore: result.aiScore,
    };

    // Store finalized block
    this.finalizedBlocks.set(proposal.height, certificate);
    this.lastFinalizedHeight = Math.max(this.lastFinalizedHeight, proposal.height);

    // Prune old certificates (keep last 1000)
    if (this.finalizedBlocks.size > 1000) {
      const minHeight = proposal.height - 1000;
      for (const [height] of this.finalizedBlocks) {
        if (height < minHeight) {
          this.finalizedBlocks.delete(height);
        }
      }
    }

    return certificate;
  }

  /**
   * Get finality certificate for a height
   */
  getFinalityCertificate(height: number): FinalityCertificate | null {
    return this.finalizedBlocks.get(height) ?? null;
  }

  /**
   * Check if a height is finalized
   */
  isFinalized(height: number): boolean {
    return this.finalizedBlocks.has(height);
  }

  /**
   * Get last finalized height
   */
  getLastFinalizedHeight(): number {
    return this.lastFinalizedHeight;
  }

  /**
   * Get finality gap (committed but not finalized)
   */
  getFinalityGap(currentHeight: number): number {
    return currentHeight - this.lastFinalizedHeight;
  }

  /**
   * Verify a finality certificate
   */
  async verifyCertificate(certificate: FinalityCertificate): Promise<boolean> {
    // Verify all signers are/were valid validators
    const validators = await this.registry.getAllValidators();
    const validAddresses = new Set(validators.map((v) => v.id.address));

    for (const sig of certificate.signatures) {
      if (!validAddresses.has(sig.validator)) {
        return false;
      }
    }

    // Verify total weight calculation
    const signerConfigs = validators.filter((v) =>
      certificate.signatures.some((s) => s.validator === v.id.address)
    );
    const expectedWeight = signerConfigs.reduce((sum, v) => sum + v.weight, 0);

    if (expectedWeight !== certificate.totalWeight) {
      return false;
    }

    // TODO: Verify actual signatures cryptographically

    return true;
  }
}

/**
 * Create finality gadget with default scorer
 */
export function createFinalityGadget(
  registry: ValidatorRegistry,
  options?: {
    minSignatures?: number;
    minTrustScore?: number;
    minValidatorWeight?: number;
  }
): FinalityGadget {
  const scorer = new DefaultAIFinalityScorer(options);
  return new FinalityGadget(registry, scorer);
}
