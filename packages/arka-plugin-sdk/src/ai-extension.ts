/**
 * AI Cortex Plugin Extension
 *
 * Allows domain plugins to register:
 * - Domain-specific AI prompts
 * - Risk models
 * - Tuning strategies
 * - Simulation templates
 * - Legal ingestion mappings
 *
 * Enables Cortex to interpret domain laws, propose rules, and analyze risk.
 */

import { createLogger } from '@arka/utils';
import type { ArkaRule } from '@arka/types';

const logger = createLogger({ service: 'ai-extension' });

/**
 * AI prompt template
 */
export interface AIPromptTemplate {
  /** Unique prompt ID */
  id: string;
  /** Prompt name */
  name: string;
  /** Domain this prompt is for */
  domain: string;
  /** Type of prompt */
  type: 'rule_generation' | 'risk_analysis' | 'legal_interpretation' | 'explanation' | 'custom';
  /** System prompt */
  systemPrompt: string;
  /** User prompt template (with {{placeholders}}) */
  userPromptTemplate: string;
  /** Output schema (JSON Schema) */
  outputSchema?: Record<string, unknown>;
  /** Model preferences */
  modelPreferences?: {
    preferredModel?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * Risk model definition
 */
export interface RiskModel {
  /** Model ID */
  id: string;
  /** Model name */
  name: string;
  /** Domain this model is for */
  domain: string;
  /** Risk factors to evaluate */
  factors: Array<{
    name: string;
    field: string;
    weight: number;
    thresholds: Array<{
      value: number;
      risk: 'low' | 'medium' | 'high' | 'critical';
    }>;
  }>;
  /** Combined risk calculation method */
  aggregation: 'max' | 'sum' | 'weighted_average';
  /** Description */
  description: string;
}

/**
 * Simulation template
 */
export interface SimulationTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Domain */
  domain: string;
  /** Description */
  description: string;
  /** Default parameters */
  defaultParams: Record<string, unknown>;
  /** Event generators */
  eventGenerators: Array<{
    type: string;
    count: number;
    distribution: 'uniform' | 'normal' | 'poisson';
    params: Record<string, unknown>;
  }>;
  /** Expected outcomes */
  expectedOutcomes?: {
    allowRate?: { min: number; max: number };
    denyRate?: { min: number; max: number };
    flagRate?: { min: number; max: number };
  };
}

/**
 * Legal mapping for document ingestion
 */
export interface LegalMapping {
  /** Mapping ID */
  id: string;
  /** Domain */
  domain: string;
  /** Document type */
  documentType: 'regulation' | 'statute' | 'contract' | 'policy' | 'guidance';
  /** Jurisdiction pattern (regex) */
  jurisdictionPattern: string;
  /** Extraction patterns */
  extractionPatterns: Array<{
    name: string;
    pattern: string;
    ruleType: string;
  }>;
  /** Post-processing rules */
  postProcessing?: {
    normalizeAmounts?: boolean;
    extractDates?: boolean;
    inferSeverity?: boolean;
  };
}

/**
 * Tuning strategy for model fine-tuning
 */
export interface TuningStrategy {
  /** Strategy ID */
  id: string;
  /** Domain */
  domain: string;
  /** Training data configuration */
  trainingData: {
    /** Field to use as input */
    inputField: string;
    /** Field to use as output */
    outputField: string;
    /** Filters */
    filters?: Record<string, unknown>;
  };
  /** Model configuration */
  modelConfig: {
    baseModel: string;
    epochs?: number;
    learningRate?: number;
  };
  /** Evaluation metrics */
  metrics: string[];
}

/**
 * Complete AI extension configuration for a plugin
 */
export interface PluginAIExtension {
  /** Plugin ID */
  pluginId: string;
  /** AI prompts */
  prompts: AIPromptTemplate[];
  /** Risk models */
  riskModels: RiskModel[];
  /** Simulation templates */
  simulationTemplates: SimulationTemplate[];
  /** Legal mappings */
  legalMappings: LegalMapping[];
  /** Tuning strategies */
  tuningStrategies: TuningStrategy[];
}

/**
 * AI Extension Registry
 *
 * Central registry for all AI extensions from plugins.
 */
export class AIExtensionRegistry {
  private extensions: Map<string, PluginAIExtension> = new Map();
  private promptsById: Map<string, AIPromptTemplate> = new Map();
  private riskModelsById: Map<string, RiskModel> = new Map();
  private simulationsById: Map<string, SimulationTemplate> = new Map();
  private legalMappingsById: Map<string, LegalMapping> = new Map();

  /**
   * Registers AI extensions for a plugin
   */
  register(extension: PluginAIExtension): void {
    logger.info('Registering AI extension', {
      pluginId: extension.pluginId,
      prompts: extension.prompts.length,
      riskModels: extension.riskModels.length,
      simulations: extension.simulationTemplates.length,
    });

    this.extensions.set(extension.pluginId, extension);

    // Index prompts
    for (const prompt of extension.prompts) {
      this.promptsById.set(prompt.id, prompt);
    }

    // Index risk models
    for (const model of extension.riskModels) {
      this.riskModelsById.set(model.id, model);
    }

    // Index simulations
    for (const sim of extension.simulationTemplates) {
      this.simulationsById.set(sim.id, sim);
    }

    // Index legal mappings
    for (const mapping of extension.legalMappings) {
      this.legalMappingsById.set(mapping.id, mapping);
    }
  }

  /**
   * Unregisters AI extensions for a plugin
   */
  unregister(pluginId: string): void {
    const extension = this.extensions.get(pluginId);
    if (!extension) return;

    // Remove indexed items
    for (const prompt of extension.prompts) {
      this.promptsById.delete(prompt.id);
    }
    for (const model of extension.riskModels) {
      this.riskModelsById.delete(model.id);
    }
    for (const sim of extension.simulationTemplates) {
      this.simulationsById.delete(sim.id);
    }
    for (const mapping of extension.legalMappings) {
      this.legalMappingsById.delete(mapping.id);
    }

    this.extensions.delete(pluginId);

    logger.info('Unregistered AI extension', { pluginId });
  }

  /**
   * Gets a prompt by ID
   */
  getPrompt(promptId: string): AIPromptTemplate | undefined {
    return this.promptsById.get(promptId);
  }

  /**
   * Gets prompts by domain
   */
  getPromptsByDomain(domain: string): AIPromptTemplate[] {
    return Array.from(this.promptsById.values()).filter(
      (p) => p.domain === domain
    );
  }

  /**
   * Gets prompts by type
   */
  getPromptsByType(type: AIPromptTemplate['type']): AIPromptTemplate[] {
    return Array.from(this.promptsById.values()).filter((p) => p.type === type);
  }

  /**
   * Gets a risk model by ID
   */
  getRiskModel(modelId: string): RiskModel | undefined {
    return this.riskModelsById.get(modelId);
  }

  /**
   * Gets risk models by domain
   */
  getRiskModelsByDomain(domain: string): RiskModel[] {
    return Array.from(this.riskModelsById.values()).filter(
      (m) => m.domain === domain
    );
  }

  /**
   * Gets a simulation template by ID
   */
  getSimulationTemplate(templateId: string): SimulationTemplate | undefined {
    return this.simulationsById.get(templateId);
  }

  /**
   * Gets simulation templates by domain
   */
  getSimulationsByDomain(domain: string): SimulationTemplate[] {
    return Array.from(this.simulationsById.values()).filter(
      (s) => s.domain === domain
    );
  }

  /**
   * Gets legal mapping by ID
   */
  getLegalMapping(mappingId: string): LegalMapping | undefined {
    return this.legalMappingsById.get(mappingId);
  }

  /**
   * Gets legal mappings by jurisdiction
   */
  getLegalMappingsByJurisdiction(jurisdiction: string): LegalMapping[] {
    return Array.from(this.legalMappingsById.values()).filter((m) => {
      const regex = new RegExp(m.jurisdictionPattern);
      return regex.test(jurisdiction);
    });
  }

  /**
   * Evaluates risk using a model
   */
  evaluateRisk(
    modelId: string,
    data: Record<string, unknown>
  ): {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    factors: Array<{
      name: string;
      value: unknown;
      risk: string;
      contribution: number;
    }>;
  } {
    const model = this.riskModelsById.get(modelId);
    if (!model) {
      throw new Error(`Risk model ${modelId} not found`);
    }

    const factorResults: Array<{
      name: string;
      value: unknown;
      risk: string;
      contribution: number;
    }> = [];

    let totalScore = 0;
    let totalWeight = 0;
    let maxRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';

    const riskValues = { low: 1, medium: 2, high: 3, critical: 4 };

    for (const factor of model.factors) {
      const value = this.getNestedValue(data, factor.field);
      let factorRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';

      if (typeof value === 'number') {
        for (const threshold of factor.thresholds) {
          if (value >= threshold.value) {
            factorRisk = threshold.risk;
          }
        }
      }

      const contribution = factor.weight * riskValues[factorRisk];
      totalScore += contribution;
      totalWeight += factor.weight;

      if (riskValues[factorRisk] > riskValues[maxRisk]) {
        maxRisk = factorRisk;
      }

      factorResults.push({
        name: factor.name,
        value,
        risk: factorRisk,
        contribution,
      });
    }

    // Calculate overall risk
    let overallRisk: 'low' | 'medium' | 'high' | 'critical';
    if (model.aggregation === 'max') {
      overallRisk = maxRisk;
    } else {
      const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
      if (avgScore >= 3.5) overallRisk = 'critical';
      else if (avgScore >= 2.5) overallRisk = 'high';
      else if (avgScore >= 1.5) overallRisk = 'medium';
      else overallRisk = 'low';
    }

    return {
      overallRisk,
      score: totalWeight > 0 ? totalScore / totalWeight : 0,
      factors: factorResults,
    };
  }

  /**
   * Renders a prompt template
   */
  renderPrompt(
    promptId: string,
    variables: Record<string, unknown>
  ): { system: string; user: string } {
    const prompt = this.promptsById.get(promptId);
    if (!prompt) {
      throw new Error(`Prompt ${promptId} not found`);
    }

    let userPrompt = prompt.userPromptTemplate;
    for (const [key, value] of Object.entries(variables)) {
      userPrompt = userPrompt.replace(
        new RegExp(`{{${key}}}`, 'g'),
        String(value)
      );
    }

    return {
      system: prompt.systemPrompt,
      user: userPrompt,
    };
  }

  /**
   * Gets all extensions
   */
  getAllExtensions(): PluginAIExtension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Gets extension for a plugin
   */
  getExtension(pluginId: string): PluginAIExtension | undefined {
    return this.extensions.get(pluginId);
  }

  /**
   * Gets statistics
   */
  getStats(): {
    totalPlugins: number;
    totalPrompts: number;
    totalRiskModels: number;
    totalSimulations: number;
    totalLegalMappings: number;
  } {
    return {
      totalPlugins: this.extensions.size,
      totalPrompts: this.promptsById.size,
      totalRiskModels: this.riskModelsById.size,
      totalSimulations: this.simulationsById.size,
      totalLegalMappings: this.legalMappingsById.size,
    };
  }

  /**
   * Helper to get nested value
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Clears all extensions
   */
  clear(): void {
    this.extensions.clear();
    this.promptsById.clear();
    this.riskModelsById.clear();
    this.simulationsById.clear();
    this.legalMappingsById.clear();
  }
}

// Global singleton
let globalAIExtensionRegistry: AIExtensionRegistry | null = null;

/**
 * Gets the global AI extension registry
 */
export function getAIExtensionRegistry(): AIExtensionRegistry {
  if (!globalAIExtensionRegistry) {
    globalAIExtensionRegistry = new AIExtensionRegistry();
  }
  return globalAIExtensionRegistry;
}

/**
 * Resets the global AI extension registry
 */
export function resetAIExtensionRegistry(): void {
  globalAIExtensionRegistry?.clear();
  globalAIExtensionRegistry = null;
}
