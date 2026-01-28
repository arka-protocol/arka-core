/**
 * Time-Travel Simulator
 *
 * Simulates rule evaluation at arbitrary historical or future timestamps,
 * comparing current vs proposed rules (Enhancement #5).
 */

import type {
  ArkaRule,
  ArkaEvent,
  ArkaEntity,
  ArkaDecision,
  TimeTravelSimulationRequest,
  TimeTravelSimulationResult,
} from '@arka-protocol/types';

/**
 * Snapshot of rules and entities at a point in time
 */
export interface TimeSnapshot {
  /** Timestamp of the snapshot */
  timestamp: string;

  /** Rules active at this time */
  rules: ArkaRule[];

  /** Entity state at this time */
  entities: Map<string, ArkaEntity>;

  /** Events that occurred before this time */
  events: ArkaEvent[];
}

/**
 * Result of evaluating an event at a specific time
 */
export interface TimePointEvaluation {
  /** Timestamp evaluated */
  timestamp: string;

  /** Decisions made */
  decisions: ArkaDecision[];

  /** Rules that were applicable */
  applicableRules: string[];

  /** Rules that matched */
  matchedRules: string[];
}

/**
 * Comparison between two time points or rule sets
 */
export interface SimulationComparison {
  /** Events with different outcomes */
  divergentEvents: Array<{
    eventId: string;
    baselineDecision: ArkaDecision;
    simulatedDecision: ArkaDecision;
    difference: string;
  }>;

  /** Rules that produced different results */
  divergentRules: Array<{
    ruleId: string;
    ruleName: string;
    baselineMatches: number;
    simulatedMatches: number;
    changePercent: number;
  }>;

  /** Summary statistics */
  summary: {
    totalEvents: number;
    divergentCount: number;
    divergenceRate: number;
    riskImpact: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
}

/**
 * Extended simulation request with additional properties for the simulator
 */
export interface ExtendedSimulationRequest extends TimeTravelSimulationRequest {
  /** Optional proposed rule set to compare against */
  proposedRules?: ArkaRule[];

  /** Optional specific event IDs to simulate */
  eventIds?: string[];
}

/**
 * Time-Travel Simulator options
 */
export interface SimulatorOptions {
  /** Function to get rules effective at a timestamp */
  getRulesAtTime: (timestamp: string) => Promise<ArkaRule[]>;

  /** Function to get entity state at a timestamp */
  getEntityAtTime: (entityId: string, timestamp: string) => Promise<ArkaEntity | null>;

  /** Function to get events in a time range */
  getEventsInRange: (start: string, end: string) => Promise<ArkaEvent[]>;

  /** Function to evaluate a rule against an event */
  evaluateRule: (
    rule: ArkaRule,
    event: ArkaEvent,
    entity: ArkaEntity | null
  ) => Promise<ArkaDecision | null>;
}

/**
 * Time-Travel Simulator class
 */
export class TimeTravelSimulator {
  private options: SimulatorOptions;

  constructor(options: SimulatorOptions) {
    this.options = options;
  }

  /**
   * Run a time-travel simulation
   */
  async simulate(request: ExtendedSimulationRequest): Promise<TimeTravelSimulationResult> {
    const startTime = Date.now();

    // Get baseline evaluation (current rules)
    const baselineRules = await this.options.getRulesAtTime(new Date().toISOString());

    // Get proposed rules (if provided) or rules at proposed time
    const proposedRules = request.proposedRules ?? (await this.options.getRulesAtTime(request.asOfDate));

    // Get events to simulate
    const events = request.eventIds
      ? await this.getEventsByIds(request.eventIds)
      : await this.options.getEventsInRange(
          request.eventTimeRange.start,
          request.eventTimeRange.end
        );

    // Limit events if maxEvents is specified
    const limitedEvents = request.maxEvents ? events.slice(0, request.maxEvents) : events;

    // Evaluate each event with both rule sets
    const evaluations: Array<{
      event: ArkaEvent;
      baseline: TimePointEvaluation;
      simulated: TimePointEvaluation;
    }> = [];

    for (const event of limitedEvents) {
      const entity = event.entityId
        ? await this.options.getEntityAtTime(event.entityId, request.asOfDate)
        : null;

      const baseline = await this.evaluateAtTime(
        event,
        entity,
        baselineRules,
        request.asOfDate
      );

      const simulated = await this.evaluateAtTime(
        event,
        entity,
        proposedRules,
        request.asOfDate
      );

      evaluations.push({ event, baseline, simulated });
    }

    // Compare results
    const comparison = this.compareEvaluations(evaluations);

    // Build result according to TimeTravelSimulationResult interface
    const result: TimeTravelSimulationResult = {
      id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parameters: request,
      eventsReplayed: limitedEvents.length,
      historicalRuleCount: proposedRules.length,
      currentRuleCount: baselineRules.length,
      comparison: {
        unchanged: limitedEvents.length - comparison.divergentEvents.length,
        allowToDeny: 0, // These would need more specific counting logic
        denyToAllow: 0,
        otherChanges: comparison.divergentEvents.length,
      },
      decisionDiffs: request.includeDecisionDiffs
        ? comparison.divergentEvents.map((d) => ({
            eventId: d.eventId,
            historicalDecision: d.simulatedDecision.status,
            currentDecision: d.baselineDecision.status,
            changedRules: [d.baselineDecision.id, d.simulatedDecision.id],
          }))
        : undefined,
      createdAt: new Date().toISOString(),
    };

    return result;
  }

  /**
   * Compare rule sets without events (dry run)
   */
  async compareRuleSets(
    baselineRules: ArkaRule[],
    proposedRules: ArkaRule[]
  ): Promise<{
    added: ArkaRule[];
    removed: ArkaRule[];
    modified: Array<{ baseline: ArkaRule; proposed: ArkaRule; changes: string[] }>;
    unchanged: ArkaRule[];
  }> {
    const baselineMap = new Map(baselineRules.map((r) => [r.id, r]));
    const proposedMap = new Map(proposedRules.map((r) => [r.id, r]));

    const added: ArkaRule[] = [];
    const removed: ArkaRule[] = [];
    const modified: Array<{ baseline: ArkaRule; proposed: ArkaRule; changes: string[] }> = [];
    const unchanged: ArkaRule[] = [];

    // Check proposed rules
    for (const [id, proposed] of proposedMap) {
      const baseline = baselineMap.get(id);
      if (!baseline) {
        added.push(proposed);
      } else {
        const changes = this.detectRuleChanges(baseline, proposed);
        if (changes.length > 0) {
          modified.push({ baseline, proposed, changes });
        } else {
          unchanged.push(proposed);
        }
      }
    }

    // Check for removed rules
    for (const [id, baseline] of baselineMap) {
      if (!proposedMap.has(id)) {
        removed.push(baseline);
      }
    }

    return { added, removed, modified, unchanged };
  }

  /**
   * Replay historical events with new rules
   */
  async replayHistory(
    startTime: string,
    endTime: string,
    newRules: ArkaRule[]
  ): Promise<{
    originalDecisions: Map<string, ArkaDecision[]>;
    replayedDecisions: Map<string, ArkaDecision[]>;
    changes: Array<{
      eventId: string;
      original: ArkaDecision;
      replayed: ArkaDecision;
      wouldChange: boolean;
    }>;
  }> {
    const events = await this.options.getEventsInRange(startTime, endTime);
    const originalRules = await this.options.getRulesAtTime(startTime);

    const originalDecisions = new Map<string, ArkaDecision[]>();
    const replayedDecisions = new Map<string, ArkaDecision[]>();
    const changes: Array<{
      eventId: string;
      original: ArkaDecision;
      replayed: ArkaDecision;
      wouldChange: boolean;
    }> = [];

    for (const event of events) {
      const entity = event.entityId
        ? await this.options.getEntityAtTime(event.entityId, event.occurredAt)
        : null;

      // Evaluate with original rules
      const originalEval = await this.evaluateAtTime(event, entity, originalRules, event.occurredAt);
      originalDecisions.set(event.id, originalEval.decisions);

      // Evaluate with new rules
      const replayedEval = await this.evaluateAtTime(event, entity, newRules, event.occurredAt);
      replayedDecisions.set(event.id, replayedEval.decisions);

      // Compare decisions
      for (const origDecision of originalEval.decisions) {
        const replayedDecision = replayedEval.decisions.find(
          (d) => d.eventId === origDecision.eventId
        );

        if (replayedDecision) {
          const wouldChange = origDecision.status !== replayedDecision.status;
          changes.push({
            eventId: event.id,
            original: origDecision,
            replayed: replayedDecision,
            wouldChange,
          });
        }
      }
    }

    return { originalDecisions, replayedDecisions, changes };
  }

  /**
   * Forecast impact of rule changes
   */
  async forecastImpact(
    proposedRules: ArkaRule[],
    sampleSize: number = 1000
  ): Promise<{
    estimatedImpact: {
      allowToFlag: number;
      allowToDeny: number;
      flagToAllow: number;
      flagToDeny: number;
      denyToAllow: number;
      denyToFlag: number;
    };
    confidenceLevel: number;
    riskAssessment: string;
  }> {
    // Get recent events for sampling
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

    const events = await this.options.getEventsInRange(
      startTime.toISOString(),
      endTime.toISOString()
    );

    // Sample events
    const sampledEvents = this.sampleEvents(events, sampleSize);

    const currentRules = await this.options.getRulesAtTime(endTime.toISOString());

    const impact = {
      allowToFlag: 0,
      allowToDeny: 0,
      flagToAllow: 0,
      flagToDeny: 0,
      denyToAllow: 0,
      denyToFlag: 0,
    };

    for (const event of sampledEvents) {
      const entity = event.entityId
        ? await this.options.getEntityAtTime(event.entityId, event.occurredAt)
        : null;

      const currentEval = await this.evaluateAtTime(
        event,
        entity,
        currentRules,
        event.occurredAt
      );
      const proposedEval = await this.evaluateAtTime(
        event,
        entity,
        proposedRules,
        event.occurredAt
      );

      // Get aggregate decision
      const currentDecision = this.aggregateDecisions(currentEval.decisions);
      const proposedDecision = this.aggregateDecisions(proposedEval.decisions);

      // Track changes
      if (currentDecision !== proposedDecision) {
        const key = `${currentDecision.toLowerCase()}To${this.capitalize(proposedDecision)}` as keyof typeof impact;
        if (key in impact) {
          impact[key]++;
        }
      }
    }

    // Calculate confidence based on sample size
    const confidenceLevel = Math.min(0.95, sampledEvents.length / 1000);

    // Assess risk
    const totalChanges = Object.values(impact).reduce((a, b) => a + b, 0);
    const changeRate = totalChanges / sampledEvents.length;
    const denyChanges = impact.allowToDeny + impact.flagToDeny;

    let riskAssessment: string;
    if (denyChanges > sampledEvents.length * 0.1) {
      riskAssessment = 'HIGH RISK: Significant increase in denials expected';
    } else if (changeRate > 0.2) {
      riskAssessment = 'MEDIUM RISK: Substantial decision changes expected';
    } else if (changeRate > 0.05) {
      riskAssessment = 'LOW RISK: Minor decision changes expected';
    } else {
      riskAssessment = 'MINIMAL RISK: Very few decision changes expected';
    }

    return {
      estimatedImpact: impact,
      confidenceLevel,
      riskAssessment,
    };
  }

  /**
   * Evaluate event at a specific time point
   */
  private async evaluateAtTime(
    event: ArkaEvent,
    entity: ArkaEntity | null,
    rules: ArkaRule[],
    timestamp: string
  ): Promise<TimePointEvaluation> {
    const decisions: ArkaDecision[] = [];
    const applicableRules: string[] = [];
    const matchedRules: string[] = [];

    // Filter rules effective at timestamp
    const effectiveRules = rules.filter((rule) => this.isRuleEffective(rule, timestamp));

    for (const rule of effectiveRules) {
      // Check if rule applies to this event type
      if (rule.appliesToEventType && rule.appliesToEventType !== event.type) {
        continue;
      }

      // Check if rule applies to this entity type
      if (entity && rule.appliesToEntityType && rule.appliesToEntityType !== entity.type) {
        continue;
      }

      applicableRules.push(rule.id);

      const decision = await this.options.evaluateRule(rule, event, entity);
      if (decision) {
        decisions.push(decision);
        // A rule is considered matched if it has evaluations with FAIL result
        const hasFailedEvaluation = decision.ruleEvaluations.some(
          (evaluation) => evaluation.result === 'FAIL'
        );
        if (hasFailedEvaluation) {
          matchedRules.push(rule.id);
        }
      }
    }

    return {
      timestamp,
      decisions,
      applicableRules,
      matchedRules,
    };
  }

  /**
   * Check if a rule is effective at a given timestamp
   */
  private isRuleEffective(rule: ArkaRule, timestamp: string): boolean {
    const time = new Date(timestamp).getTime();

    if (rule.effectiveFrom) {
      const from = new Date(rule.effectiveFrom).getTime();
      if (time < from) return false;
    }

    if (rule.effectiveTo) {
      const to = new Date(rule.effectiveTo).getTime();
      if (time > to) return false;
    }

    return rule.status === 'ACTIVE';
  }

  /**
   * Compare evaluations and find divergences
   */
  private compareEvaluations(
    evaluations: Array<{
      event: ArkaEvent;
      baseline: TimePointEvaluation;
      simulated: TimePointEvaluation;
    }>
  ): SimulationComparison {
    const divergentEvents: SimulationComparison['divergentEvents'] = [];
    const ruleStats = new Map<
      string,
      { name: string; baselineMatches: number; simulatedMatches: number }
    >();

    for (const { event, baseline, simulated } of evaluations) {
      // Track rule matches
      for (const ruleId of baseline.matchedRules) {
        if (!ruleStats.has(ruleId)) {
          ruleStats.set(ruleId, { name: ruleId, baselineMatches: 0, simulatedMatches: 0 });
        }
        ruleStats.get(ruleId)!.baselineMatches++;
      }

      for (const ruleId of simulated.matchedRules) {
        if (!ruleStats.has(ruleId)) {
          ruleStats.set(ruleId, { name: ruleId, baselineMatches: 0, simulatedMatches: 0 });
        }
        ruleStats.get(ruleId)!.simulatedMatches++;
      }

      // Check for decision differences
      const baselineAggregate = this.aggregateDecisions(baseline.decisions);
      const simulatedAggregate = this.aggregateDecisions(simulated.decisions);

      if (baselineAggregate !== simulatedAggregate) {
        const baselineDecision = baseline.decisions[0] ?? this.createDefaultDecision(event);
        const simulatedDecision = simulated.decisions[0] ?? this.createDefaultDecision(event);

        divergentEvents.push({
          eventId: event.id,
          baselineDecision,
          simulatedDecision,
          difference: `${baselineAggregate} -> ${simulatedAggregate}`,
        });
      }
    }

    // Build divergent rules list
    const divergentRules: SimulationComparison['divergentRules'] = [];
    for (const [ruleId, stats] of ruleStats) {
      const total = stats.baselineMatches + stats.simulatedMatches;
      if (total > 0 && stats.baselineMatches !== stats.simulatedMatches) {
        const changePercent =
          ((stats.simulatedMatches - stats.baselineMatches) / Math.max(1, stats.baselineMatches)) *
          100;
        divergentRules.push({
          ruleId,
          ruleName: stats.name,
          baselineMatches: stats.baselineMatches,
          simulatedMatches: stats.simulatedMatches,
          changePercent,
        });
      }
    }

    // Calculate summary
    const divergenceRate =
      evaluations.length > 0 ? divergentEvents.length / evaluations.length : 0;

    let riskImpact: SimulationComparison['summary']['riskImpact'] = 'NONE';
    if (divergenceRate > 0.2) {
      riskImpact = 'CRITICAL';
    } else if (divergenceRate > 0.1) {
      riskImpact = 'HIGH';
    } else if (divergenceRate > 0.05) {
      riskImpact = 'MEDIUM';
    } else if (divergenceRate > 0) {
      riskImpact = 'LOW';
    }

    return {
      divergentEvents,
      divergentRules,
      summary: {
        totalEvents: evaluations.length,
        divergentCount: divergentEvents.length,
        divergenceRate,
        riskImpact,
      },
    };
  }

  /**
   * Aggregate multiple decisions into a single decision type
   */
  private aggregateDecisions(decisions: ArkaDecision[]): string {
    if (decisions.length === 0) return 'ALLOW';

    // DENY takes precedence over ALLOW_WITH_FLAGS, which takes precedence over ALLOW
    if (decisions.some((d) => d.status === 'DENY')) return 'DENY';
    if (decisions.some((d) => d.status === 'ALLOW_WITH_FLAGS')) return 'FLAG';
    return 'ALLOW';
  }

  /**
   * Create a default decision record
   */
  private createDefaultDecision(event: ArkaEvent): ArkaDecision {
    return {
      id: `default_${event.id}`,
      eventId: event.id,
      entityId: event.entityId ?? null,
      status: 'ALLOW',
      ruleEvaluations: [],
      totalEvaluationTimeMs: 0,
      createdAt: new Date().toISOString(),
      metadata: {
        message: 'No rules matched',
        code: 'DEFAULT',
      },
    };
  }

  /**
   * Detect changes between two rule versions
   */
  private detectRuleChanges(baseline: ArkaRule, proposed: ArkaRule): string[] {
    const changes: string[] = [];

    if (baseline.name !== proposed.name) {
      changes.push(`name: "${baseline.name}" -> "${proposed.name}"`);
    }

    if (baseline.severity !== proposed.severity) {
      changes.push(`severity: ${baseline.severity} -> ${proposed.severity}`);
    }

    if (baseline.consequence.decision !== proposed.consequence.decision) {
      changes.push(
        `decision: ${baseline.consequence.decision} -> ${proposed.consequence.decision}`
      );
    }

    if (JSON.stringify(baseline.condition) !== JSON.stringify(proposed.condition)) {
      changes.push('condition: modified');
    }

    if (baseline.effectiveFrom !== proposed.effectiveFrom) {
      changes.push(`effectiveFrom: ${baseline.effectiveFrom} -> ${proposed.effectiveFrom}`);
    }

    if (baseline.effectiveTo !== proposed.effectiveTo) {
      changes.push(`effectiveTo: ${baseline.effectiveTo} -> ${proposed.effectiveTo}`);
    }

    return changes;
  }

  /**
   * Sample events for forecasting
   */
  private sampleEvents(events: ArkaEvent[], sampleSize: number): ArkaEvent[] {
    if (events.length <= sampleSize) {
      return events;
    }

    // Reservoir sampling
    const sample = events.slice(0, sampleSize);
    for (let i = sampleSize; i < events.length; i++) {
      const j = Math.floor(Math.random() * (i + 1));
      const event = events[i];
      if (j < sampleSize && event) {
        sample[j] = event;
      }
    }

    return sample;
  }

  /**
   * Get events by IDs
   */
  private async getEventsByIds(eventIds: string[]): Promise<ArkaEvent[]> {
    // This would typically fetch from database
    // For now, get all events in a wide range and filter
    const start = new Date(0).toISOString();
    const end = new Date().toISOString();
    const allEvents = await this.options.getEventsInRange(start, end);
    return allEvents.filter((e) => eventIds.includes(e.id));
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}

/**
 * Create a time-travel simulator
 */
export function createTimeTravelSimulator(options: SimulatorOptions): TimeTravelSimulator {
  return new TimeTravelSimulator(options);
}
