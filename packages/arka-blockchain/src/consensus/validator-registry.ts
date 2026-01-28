/**
 * Validator Registry
 *
 * Manages the set of authorized validators for Proof-of-Authority consensus.
 */

import type {
  ValidatorConfig,
  ValidatorId,
  ValidatorStatus,
} from './types.js';

/**
 * Validator registry interface
 */
export interface ValidatorRegistry {
  /** Register a new validator */
  registerValidator(config: ValidatorConfig): Promise<void>;

  /** Remove a validator */
  removeValidator(address: string): Promise<boolean>;

  /** Get validator by address */
  getValidator(address: string): Promise<ValidatorConfig | null>;

  /** Get all validators */
  getAllValidators(): Promise<ValidatorConfig[]>;

  /** Get active validators */
  getActiveValidators(): Promise<ValidatorConfig[]>;

  /** Update validator status */
  updateStatus(address: string, status: ValidatorStatus): Promise<void>;

  /** Update validator weight */
  updateWeight(address: string, weight: number): Promise<void>;

  /** Update validator trust score */
  updateTrustScore(address: string, trustScore: number): Promise<void>;

  /** Record block proposed */
  recordBlockProposed(address: string, height: number): Promise<void>;

  /** Record block missed */
  recordBlockMissed(address: string, height: number): Promise<void>;

  /** Increment slash count */
  incrementSlashCount(address: string): Promise<void>;

  /** Get validator count */
  getValidatorCount(): Promise<number>;

  /** Get active validator count */
  getActiveValidatorCount(): Promise<number>;

  /** Get total voting weight */
  getTotalWeight(): Promise<number>;

  /** Get active voting weight */
  getActiveWeight(): Promise<number>;

  /** Check if address is a validator */
  isValidator(address: string): Promise<boolean>;

  /** Check if address is an active validator */
  isActiveValidator(address: string): Promise<boolean>;
}

/**
 * In-memory validator registry implementation
 */
export class InMemoryValidatorRegistry implements ValidatorRegistry {
  private validators: Map<string, ValidatorConfig> = new Map();

  async registerValidator(config: ValidatorConfig): Promise<void> {
    if (this.validators.has(config.id.address)) {
      throw new Error(`Validator ${config.id.address} already registered`);
    }
    this.validators.set(config.id.address, { ...config });
  }

  async removeValidator(address: string): Promise<boolean> {
    return this.validators.delete(address);
  }

  async getValidator(address: string): Promise<ValidatorConfig | null> {
    const validator = this.validators.get(address);
    return validator ? { ...validator } : null;
  }

  async getAllValidators(): Promise<ValidatorConfig[]> {
    return Array.from(this.validators.values()).map((v) => ({ ...v }));
  }

  async getActiveValidators(): Promise<ValidatorConfig[]> {
    return Array.from(this.validators.values())
      .filter((v) => v.status === 'active')
      .map((v) => ({ ...v }));
  }

  async updateStatus(address: string, status: ValidatorStatus): Promise<void> {
    const validator = this.validators.get(address);
    if (!validator) {
      throw new Error(`Validator ${address} not found`);
    }
    validator.status = status;
  }

  async updateWeight(address: string, weight: number): Promise<void> {
    const validator = this.validators.get(address);
    if (!validator) {
      throw new Error(`Validator ${address} not found`);
    }
    if (weight < 1 || weight > 100) {
      throw new Error('Weight must be between 1 and 100');
    }
    validator.weight = weight;
  }

  async updateTrustScore(address: string, trustScore: number): Promise<void> {
    const validator = this.validators.get(address);
    if (!validator) {
      throw new Error(`Validator ${address} not found`);
    }
    if (trustScore < 0 || trustScore > 1) {
      throw new Error('Trust score must be between 0 and 1');
    }
    validator.trustScore = trustScore;
  }

  async recordBlockProposed(address: string, height: number): Promise<void> {
    const validator = this.validators.get(address);
    if (!validator) {
      throw new Error(`Validator ${address} not found`);
    }
    validator.blocksProposed++;
    validator.lastActiveHeight = height;
  }

  async recordBlockMissed(address: string, height: number): Promise<void> {
    const validator = this.validators.get(address);
    if (!validator) {
      throw new Error(`Validator ${address} not found`);
    }
    validator.blocksMissed++;
  }

  async incrementSlashCount(address: string): Promise<void> {
    const validator = this.validators.get(address);
    if (!validator) {
      throw new Error(`Validator ${address} not found`);
    }
    validator.slashCount++;
  }

  async getValidatorCount(): Promise<number> {
    return this.validators.size;
  }

  async getActiveValidatorCount(): Promise<number> {
    return Array.from(this.validators.values()).filter(
      (v) => v.status === 'active'
    ).length;
  }

  async getTotalWeight(): Promise<number> {
    return Array.from(this.validators.values()).reduce(
      (sum, v) => sum + v.weight,
      0
    );
  }

  async getActiveWeight(): Promise<number> {
    return Array.from(this.validators.values())
      .filter((v) => v.status === 'active')
      .reduce((sum, v) => sum + v.weight, 0);
  }

  async isValidator(address: string): Promise<boolean> {
    return this.validators.has(address);
  }

  async isActiveValidator(address: string): Promise<boolean> {
    const validator = this.validators.get(address);
    return validator?.status === 'active';
  }
}

/**
 * Create a validator config from basic info
 */
export function createValidatorConfig(
  id: ValidatorId,
  weight: number = 10,
  status: ValidatorStatus = 'pending'
): ValidatorConfig {
  return {
    id,
    status,
    weight,
    registeredAt: new Date().toISOString(),
    lastActiveHeight: 0,
    blocksProposed: 0,
    blocksMissed: 0,
    trustScore: 1.0,
    slashCount: 0,
  };
}

/**
 * Get validator by highest weight (for proposer selection)
 */
export async function getValidatorsByWeight(
  registry: ValidatorRegistry
): Promise<ValidatorConfig[]> {
  const validators = await registry.getActiveValidators();
  return validators.sort((a, b) => b.weight - a.weight);
}

/**
 * Calculate weighted voting power percentage
 */
export function calculateVotingPower(
  validatorWeight: number,
  totalWeight: number
): number {
  if (totalWeight === 0) return 0;
  return validatorWeight / totalWeight;
}
