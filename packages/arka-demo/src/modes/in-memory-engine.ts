/**
 * In-Memory Demo Engine
 *
 * Lightweight rule evaluation engine that runs entirely in memory.
 * No external dependencies required - perfect for demos and presentations.
 */

import type {
  ArkaRule,
  ArkaEvent,
  ArkaEntity,
  ArkaDecision,
  ArkaCondition,
  ArkaRuleEvaluation,
  CompareCondition,
} from '@arka/types';
import { demoDataset, datasetStats } from '../seed-data/index.js';

/**
 * In-memory storage for the demo engine
 */
interface DemoStorage {
  rules: Map<string, ArkaRule>;
  events: Map<string, ArkaEvent>;
  entities: Map<string, ArkaEntity>;
  decisions: Map<string, ArkaDecision>;
}

/**
 * Demo engine statistics
 */
export interface EngineStats {
  rulesLoaded: number;
  eventsProcessed: number;
  decisionsGenerated: number;
  allowCount: number;
  flagCount: number;
  denyCount: number;
  avgProcessingTimeMs: number;
}

/**
 * In-Memory ARKA Demo Engine
 */
export class InMemoryDemoEngine {
  private storage: DemoStorage;
  private stats: EngineStats;
  private processingTimes: number[] = [];

  constructor() {
    this.storage = {
      rules: new Map(),
      events: new Map(),
      entities: new Map(),
      decisions: new Map(),
    };
    this.stats = {
      rulesLoaded: 0,
      eventsProcessed: 0,
      decisionsGenerated: 0,
      allowCount: 0,
      flagCount: 0,
      denyCount: 0,
      avgProcessingTimeMs: 0,
    };
  }

  /**
   * Initialize engine with demo data
   */
  initialize(): void {
    // Load rules
    for (const rule of demoDataset.rules) {
      this.storage.rules.set(rule.id, rule);
    }
    this.stats.rulesLoaded = this.storage.rules.size;

    // Load customers/entities
    for (const entity of demoDataset.customers) {
      this.storage.entities.set(entity.id, entity);
    }

    // Pre-populate with sample decision history for demo purposes
    this.seedDemoHistory();
  }

  /**
   * Seed demo history with sample decisions for a better demo experience
   */
  private async seedDemoHistory(): Promise<void> {
    // Run each scenario to populate decision history
    const scenarios = demoDataset.scenarios;
    for (const scenario of Object.values(scenarios)) {
      for (const event of scenario.events) {
        await this.processEvent(event);
      }
    }
    console.log(`[Demo Engine] Pre-populated ${this.stats.decisionsGenerated} decisions from ${Object.keys(scenarios).length} scenarios`);
  }

  /**
   * Get all loaded rules
   */
  getRules(): ArkaRule[] {
    return Array.from(this.storage.rules.values());
  }

  /**
   * Get rules by category
   */
  getRulesByCategory(category: string): ArkaRule[] {
    const cat = demoDataset.ruleCategories[category as keyof typeof demoDataset.ruleCategories];
    return cat?.rules ?? [];
  }

  /**
   * Get all entities
   */
  getEntities(): ArkaEntity[] {
    return Array.from(this.storage.entities.values());
  }

  /**
   * Get all decisions
   */
  getDecisions(): ArkaDecision[] {
    return Array.from(this.storage.decisions.values());
  }

  /**
   * Get engine statistics
   */
  getStats(): EngineStats {
    return { ...this.stats };
  }

  /**
   * Process an event through the rule engine
   */
  async processEvent(event: ArkaEvent): Promise<ArkaDecision> {
    const startTime = performance.now();

    // Store the event
    this.storage.events.set(event.id, event);

    // Get applicable rules
    const rules = this.getApplicableRules(event);

    // Evaluate all rules
    const evaluations: ArkaRuleEvaluation[] = [];
    let hasDeny = false;
    let hasFlag = false;

    for (const rule of rules) {
      const evaluation = this.evaluateRule(rule, event);
      evaluations.push(evaluation);

      if (evaluation.result === 'FAIL') {
        if (rule.consequence.decision === 'DENY') {
          hasDeny = true;
        } else if (rule.consequence.decision === 'FLAG') {
          hasFlag = true;
        }
      }
    }

    // Determine final decision status
    let status: ArkaDecision['status'];
    if (hasDeny) {
      status = 'DENY';
      this.stats.denyCount++;
    } else if (hasFlag) {
      status = 'ALLOW_WITH_FLAGS';
      this.stats.flagCount++;
    } else {
      status = 'ALLOW';
      this.stats.allowCount++;
    }

    // Create decision
    const decision: ArkaDecision = {
      id: `dec_demo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      eventId: event.id,
      status,
      ruleEvaluations: evaluations,
      createdAt: new Date().toISOString(),
      metadata: {
        processingTimeMs: performance.now() - startTime,
        rulesEvaluated: evaluations.length,
        engine: 'in-memory-demo',
      },
    };

    // Store decision
    this.storage.decisions.set(decision.id, decision);

    // Update stats
    this.stats.eventsProcessed++;
    this.stats.decisionsGenerated++;
    const processingTime = performance.now() - startTime;
    this.processingTimes.push(processingTime);
    this.stats.avgProcessingTimeMs =
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;

    return decision;
  }

  /**
   * Process multiple events (batch)
   */
  async processEvents(events: ArkaEvent[]): Promise<ArkaDecision[]> {
    const decisions: ArkaDecision[] = [];
    for (const event of events) {
      const decision = await this.processEvent(event);
      decisions.push(decision);
    }
    return decisions;
  }

  /**
   * Get rules applicable to an event
   */
  private getApplicableRules(event: ArkaEvent): ArkaRule[] {
    const allRules = Array.from(this.storage.rules.values());

    return allRules.filter((rule) => {
      // Check entity type match
      if (rule.appliesToEntityType) {
        if (!event.entityType || event.entityType !== rule.appliesToEntityType) {
          return false;
        }
      }

      // Check event type match
      if (rule.appliesToEventType) {
        if (event.type !== rule.appliesToEventType) {
          return false;
        }
      }

      // Check jurisdiction match
      if (rule.jurisdiction) {
        const eventJurisdiction = event.jurisdiction ?? (event.payload as Record<string, unknown>)?.jurisdiction;
        if (eventJurisdiction && eventJurisdiction !== rule.jurisdiction) {
          return false;
        }
      }

      // Check effective dates
      const now = new Date();
      if (rule.effectiveFrom && new Date(rule.effectiveFrom) > now) {
        return false;
      }
      if (rule.effectiveTo && new Date(rule.effectiveTo) < now) {
        return false;
      }

      return true;
    });
  }

  /**
   * Evaluate a single rule against an event
   */
  private evaluateRule(rule: ArkaRule, event: ArkaEvent): ArkaRuleEvaluation {
    const startTime = performance.now();

    const conditionMet = this.evaluateCondition(rule.condition, event);

    return {
      ruleId: rule.id,
      version: rule.version ?? 1,
      applied: true,
      result: conditionMet ? 'FAIL' : 'PASS', // FAIL means rule triggered (condition met)
      details: conditionMet ? `Rule "${rule.name}" triggered` : null,
      evaluationTimeMs: performance.now() - startTime,
      consequenceSnapshot: conditionMet ? rule.consequence as unknown as Record<string, unknown> : undefined,
    };
  }

  /**
   * Evaluate a condition against event data
   */
  private evaluateCondition(condition: ArkaCondition, event: ArkaEvent): boolean {
    switch (condition.type) {
      case 'compare':
        return this.evaluateComparison(condition as CompareCondition, event);

      case 'and':
        return condition.conditions.every((c: ArkaCondition) => this.evaluateCondition(c, event));

      case 'or':
        return condition.conditions.some((c: ArkaCondition) => this.evaluateCondition(c, event));

      case 'not':
        return !this.evaluateCondition(condition.condition, event);

      default:
        return false;
    }
  }

  /**
   * Evaluate a comparison condition
   */
  private evaluateComparison(condition: CompareCondition, event: ArkaEvent): boolean {
    const fieldValue = this.getFieldValue(condition.field, event);
    const compareValue = condition.value;

    switch (condition.operator) {
      case '==':
        return fieldValue === compareValue;

      case '!=':
        return fieldValue !== compareValue;

      case '>':
        return typeof fieldValue === 'number' && fieldValue > (compareValue as number);

      case '>=':
        return typeof fieldValue === 'number' && fieldValue >= (compareValue as number);

      case '<':
        return typeof fieldValue === 'number' && fieldValue < (compareValue as number);

      case '<=':
        return typeof fieldValue === 'number' && fieldValue <= (compareValue as number);

      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(fieldValue);

      case 'not_in':
        return Array.isArray(compareValue) && !compareValue.includes(fieldValue);

      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(compareValue as string);

      case 'matches':
        return typeof fieldValue === 'string' && new RegExp(compareValue as string).test(fieldValue);

      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;

      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;

      default:
        return false;
    }
  }

  /**
   * Get a field value from event using dot notation
   */
  private getFieldValue(path: string, event: ArkaEvent): unknown {
    const parts = path.split('.');
    let current: unknown = event;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Reset the engine (clear all data except rules)
   */
  reset(): void {
    this.storage.events.clear();
    this.storage.decisions.clear();
    this.processingTimes = [];
    this.stats = {
      rulesLoaded: this.storage.rules.size,
      eventsProcessed: 0,
      decisionsGenerated: 0,
      allowCount: 0,
      flagCount: 0,
      denyCount: 0,
      avgProcessingTimeMs: 0,
    };
  }

  /**
   * Get dataset information
   */
  getDatasetInfo(): typeof datasetStats {
    return datasetStats;
  }
}

/**
 * Create and initialize a demo engine instance
 */
export function createDemoEngine(): InMemoryDemoEngine {
  const engine = new InMemoryDemoEngine();
  engine.initialize();
  return engine;
}
