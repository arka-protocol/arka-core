/**
 * Multi-Jurisdiction Harmonization Engine
 *
 * Manages overlapping jurisdictions and creates unified rule interpretations
 * based on geographic, entity type, and regulatory hierarchy (Enhancement #6).
 */

import type { ArkaRule, RuleSeverity } from '@arka-protocol/types';

/**
 * Jurisdiction definition
 */
export interface Jurisdiction {
  /** Unique identifier (e.g., "US", "US-CA", "EU", "EU-DE") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Parent jurisdiction (e.g., "US-CA" parent is "US") */
  parentId?: string;

  /** Jurisdiction type */
  type: 'FEDERAL' | 'STATE' | 'REGIONAL' | 'LOCAL' | 'INTERNATIONAL' | 'SUPRANATIONAL';

  /** ISO country code if applicable */
  countryCode?: string;

  /** Regulatory bodies in this jurisdiction */
  regulatoryBodies: string[];

  /** Priority when multiple jurisdictions conflict (higher = takes precedence) */
  priority: number;

  /** Whether this jurisdiction is active */
  active: boolean;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Jurisdiction hierarchy node
 */
interface JurisdictionNode {
  jurisdiction: Jurisdiction;
  children: JurisdictionNode[];
  parent?: JurisdictionNode;
  depth: number;
}

/**
 * Rule resolution result when jurisdictions overlap
 */
export interface JurisdictionResolution {
  /** Applicable jurisdictions (in priority order) */
  applicableJurisdictions: Jurisdiction[];

  /** Resolved rules after harmonization */
  resolvedRules: ArkaRule[];

  /** Conflicts detected */
  conflicts: JurisdictionConflict[];

  /** Resolution strategy used */
  strategy: ResolutionStrategy;

  /** Audit trail */
  auditTrail: ResolutionAuditEntry[];
}

/**
 * Conflict between jurisdiction rules
 */
export interface JurisdictionConflict {
  /** Jurisdictions in conflict */
  jurisdictions: string[];

  /** Rules in conflict */
  ruleIds: string[];

  /** Type of conflict */
  conflictType: 'CONTRADICTING' | 'OVERLAPPING' | 'AMBIGUOUS';

  /** Description */
  description: string;

  /** How it was resolved */
  resolution: string;

  /** Severity of the conflict */
  severity: RuleSeverity;
}

/**
 * Audit entry for resolution decisions
 */
export interface ResolutionAuditEntry {
  /** Timestamp */
  timestamp: string;

  /** Action taken */
  action: string;

  /** Reason for the action */
  reason: string;

  /** Rules affected */
  affectedRules: string[];

  /** Jurisdictions involved */
  jurisdictions: string[];
}

/**
 * Resolution strategy options
 */
export type ResolutionStrategy =
  | 'MOST_RESTRICTIVE' // Apply the most restrictive rule from all jurisdictions
  | 'LEAST_RESTRICTIVE' // Apply the least restrictive rule
  | 'HIERARCHY' // Follow jurisdiction hierarchy (child overrides parent)
  | 'PRIORITY' // Use jurisdiction priority scores
  | 'INTERSECTION' // Apply rules that all jurisdictions agree on
  | 'UNION'; // Apply all rules from all jurisdictions

/**
 * Harmonization Engine options
 */
export interface HarmonizationOptions {
  /** Default resolution strategy */
  defaultStrategy: ResolutionStrategy;

  /** Whether to include rules from parent jurisdictions */
  includeParentRules: boolean;

  /** Whether to automatically resolve conflicts */
  autoResolveConflicts: boolean;

  /** Minimum severity for conflict detection */
  conflictThreshold: RuleSeverity;
}

const DEFAULT_OPTIONS: HarmonizationOptions = {
  defaultStrategy: 'HIERARCHY',
  includeParentRules: true,
  autoResolveConflicts: true,
  conflictThreshold: 'MEDIUM',
};

/**
 * Multi-Jurisdiction Harmonization Engine
 */
export class JurisdictionHarmonizationEngine {
  private jurisdictions: Map<string, Jurisdiction> = new Map();
  private tree: Map<string, JurisdictionNode> = new Map();
  private rules: Map<string, ArkaRule[]> = new Map(); // jurisdiction -> rules
  private options: HarmonizationOptions;

  constructor(options: Partial<HarmonizationOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Register a jurisdiction
   */
  registerJurisdiction(jurisdiction: Jurisdiction): void {
    this.jurisdictions.set(jurisdiction.id, jurisdiction);
    this.rebuildTree();
  }

  /**
   * Register multiple jurisdictions
   */
  registerJurisdictions(jurisdictions: Jurisdiction[]): void {
    for (const j of jurisdictions) {
      this.jurisdictions.set(j.id, j);
    }
    this.rebuildTree();
  }

  /**
   * Register rules for a jurisdiction
   */
  registerRules(jurisdictionId: string, rules: ArkaRule[]): void {
    if (!this.jurisdictions.has(jurisdictionId)) {
      throw new Error(`Unknown jurisdiction: ${jurisdictionId}`);
    }

    const existing = this.rules.get(jurisdictionId) ?? [];
    this.rules.set(jurisdictionId, [...existing, ...rules]);
  }

  /**
   * Get all rules for a jurisdiction (including parents if configured)
   */
  getRulesForJurisdiction(jurisdictionId: string): ArkaRule[] {
    const result: ArkaRule[] = [];
    const seen = new Set<string>();

    const collect = (jId: string) => {
      const rules = this.rules.get(jId) ?? [];
      for (const rule of rules) {
        if (!seen.has(rule.id)) {
          seen.add(rule.id);
          result.push(rule);
        }
      }

      if (this.options.includeParentRules) {
        const j = this.jurisdictions.get(jId);
        if (j?.parentId) {
          collect(j.parentId);
        }
      }
    };

    collect(jurisdictionId);
    return result;
  }

  /**
   * Resolve rules for multiple overlapping jurisdictions
   */
  resolveRules(
    jurisdictionIds: string[],
    strategy?: ResolutionStrategy
  ): JurisdictionResolution {
    const effectiveStrategy = strategy ?? this.options.defaultStrategy;
    const auditTrail: ResolutionAuditEntry[] = [];
    const conflicts: JurisdictionConflict[] = [];

    // Get applicable jurisdictions in priority order
    const applicable = this.getApplicableJurisdictions(jurisdictionIds);

    auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'IDENTIFY_JURISDICTIONS',
      reason: `Found ${applicable.length} applicable jurisdictions`,
      affectedRules: [],
      jurisdictions: applicable.map((j) => j.id),
    });

    // Collect all rules from applicable jurisdictions
    const allRules: Map<string, { rule: ArkaRule; jurisdiction: Jurisdiction }[]> = new Map();

    for (const jurisdiction of applicable) {
      const rules = this.getRulesForJurisdiction(jurisdiction.id);
      for (const rule of rules) {
        const existing = allRules.get(rule.id) ?? [];
        existing.push({ rule, jurisdiction });
        allRules.set(rule.id, existing);
      }
    }

    // Detect and resolve conflicts
    const resolvedRules: ArkaRule[] = [];

    for (const [ruleId, ruleVersions] of allRules) {
      if (ruleVersions.length === 1) {
        const firstVersion = ruleVersions[0];
        if (firstVersion) {
          resolvedRules.push(firstVersion.rule);
        }
        continue;
      }

      // Multiple versions - detect conflicts
      const conflict = this.detectConflict(ruleVersions);
      if (conflict) {
        conflicts.push(conflict);

        auditTrail.push({
          timestamp: new Date().toISOString(),
          action: 'CONFLICT_DETECTED',
          reason: conflict.description,
          affectedRules: conflict.ruleIds,
          jurisdictions: conflict.jurisdictions,
        });
      }

      // Resolve based on strategy
      const resolved = this.resolveConflict(ruleVersions, effectiveStrategy);
      resolvedRules.push(resolved.rule);

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'CONFLICT_RESOLVED',
        reason: `Applied ${effectiveStrategy} strategy, selected ${resolved.jurisdiction.id}`,
        affectedRules: [ruleId],
        jurisdictions: ruleVersions.map((rv) => rv.jurisdiction.id),
      });
    }

    return {
      applicableJurisdictions: applicable,
      resolvedRules,
      conflicts,
      strategy: effectiveStrategy,
      auditTrail,
    };
  }

  /**
   * Get applicable jurisdictions in priority order
   */
  private getApplicableJurisdictions(jurisdictionIds: string[]): Jurisdiction[] {
    const result: Jurisdiction[] = [];
    const seen = new Set<string>();

    const collect = (jId: string) => {
      if (seen.has(jId)) return;
      seen.add(jId);

      const j = this.jurisdictions.get(jId);
      if (!j || !j.active) return;

      result.push(j);

      // Include parent jurisdictions
      if (this.options.includeParentRules && j.parentId) {
        collect(j.parentId);
      }
    };

    for (const jId of jurisdictionIds) {
      collect(jId);
    }

    // Sort by priority (highest first), then by depth (deeper first)
    return result.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      const depthA = this.getDepth(a.id);
      const depthB = this.getDepth(b.id);
      return depthB - depthA;
    });
  }

  /**
   * Detect conflict between rule versions
   */
  private detectConflict(
    ruleVersions: Array<{ rule: ArkaRule; jurisdiction: Jurisdiction }>
  ): JurisdictionConflict | null {
    const decisions = new Set(ruleVersions.map((rv) => rv.rule.consequence.decision));
    const severities = new Set(ruleVersions.map((rv) => rv.rule.severity));

    // Check for contradicting decisions
    if (decisions.has('ALLOW') && (decisions.has('DENY') || decisions.has('FLAG'))) {
      return {
        jurisdictions: ruleVersions.map((rv) => rv.jurisdiction.id),
        ruleIds: ruleVersions.map((rv) => rv.rule.id),
        conflictType: 'CONTRADICTING',
        description: `Rule has contradicting decisions across jurisdictions: ${Array.from(decisions).join(', ')}`,
        resolution: 'pending',
        severity: this.getHighestSeverity(ruleVersions.map((rv) => rv.rule.severity)),
      };
    }

    // Check for different severities
    if (severities.size > 1) {
      return {
        jurisdictions: ruleVersions.map((rv) => rv.jurisdiction.id),
        ruleIds: ruleVersions.map((rv) => rv.rule.id),
        conflictType: 'AMBIGUOUS',
        description: `Rule has different severity levels across jurisdictions: ${Array.from(severities).join(', ')}`,
        resolution: 'pending',
        severity: this.getHighestSeverity(ruleVersions.map((rv) => rv.rule.severity)),
      };
    }

    return null;
  }

  /**
   * Resolve conflict using the specified strategy
   */
  private resolveConflict(
    ruleVersions: Array<{ rule: ArkaRule; jurisdiction: Jurisdiction }>,
    strategy: ResolutionStrategy
  ): { rule: ArkaRule; jurisdiction: Jurisdiction } {
    switch (strategy) {
      case 'MOST_RESTRICTIVE':
        return this.selectMostRestrictive(ruleVersions);

      case 'LEAST_RESTRICTIVE':
        return this.selectLeastRestrictive(ruleVersions);

      case 'HIERARCHY':
        return this.selectByHierarchy(ruleVersions);

      case 'PRIORITY':
        return this.selectByPriority(ruleVersions);

      case 'INTERSECTION':
      case 'UNION':
        // For intersection/union, we'd need to merge conditions
        // For now, fall back to hierarchy
        return this.selectByHierarchy(ruleVersions);

      default: {
        const firstVersion = ruleVersions[0];
        if (!firstVersion) {
          throw new Error('No rule versions available for conflict resolution');
        }
        return firstVersion;
      }
    }
  }

  /**
   * Select most restrictive rule (DENY > FLAG > ALLOW)
   */
  private selectMostRestrictive(
    ruleVersions: Array<{ rule: ArkaRule; jurisdiction: Jurisdiction }>
  ): { rule: ArkaRule; jurisdiction: Jurisdiction } {
    const severityOrder: Record<string, number> = {
      DENY: 3,
      FLAG: 2,
      ALLOW: 1,
    };

    return ruleVersions.reduce((mostRestrictive, current) => {
      const currentScore = severityOrder[current.rule.consequence.decision] ?? 0;
      const bestScore = severityOrder[mostRestrictive.rule.consequence.decision] ?? 0;
      return currentScore > bestScore ? current : mostRestrictive;
    });
  }

  /**
   * Select least restrictive rule
   */
  private selectLeastRestrictive(
    ruleVersions: Array<{ rule: ArkaRule; jurisdiction: Jurisdiction }>
  ): { rule: ArkaRule; jurisdiction: Jurisdiction } {
    const severityOrder: Record<string, number> = {
      ALLOW: 3,
      FLAG: 2,
      DENY: 1,
    };

    return ruleVersions.reduce((leastRestrictive, current) => {
      const currentScore = severityOrder[current.rule.consequence.decision] ?? 0;
      const bestScore = severityOrder[leastRestrictive.rule.consequence.decision] ?? 0;
      return currentScore > bestScore ? current : leastRestrictive;
    });
  }

  /**
   * Select by jurisdiction hierarchy (child overrides parent)
   */
  private selectByHierarchy(
    ruleVersions: Array<{ rule: ArkaRule; jurisdiction: Jurisdiction }>
  ): { rule: ArkaRule; jurisdiction: Jurisdiction } {
    return ruleVersions.reduce((deepest, current) => {
      const currentDepth = this.getDepth(current.jurisdiction.id);
      const bestDepth = this.getDepth(deepest.jurisdiction.id);
      return currentDepth > bestDepth ? current : deepest;
    });
  }

  /**
   * Select by jurisdiction priority
   */
  private selectByPriority(
    ruleVersions: Array<{ rule: ArkaRule; jurisdiction: Jurisdiction }>
  ): { rule: ArkaRule; jurisdiction: Jurisdiction } {
    return ruleVersions.reduce((highest, current) => {
      return current.jurisdiction.priority > highest.jurisdiction.priority ? current : highest;
    });
  }

  /**
   * Get depth of a jurisdiction in the hierarchy
   */
  private getDepth(jurisdictionId: string): number {
    const node = this.tree.get(jurisdictionId);
    return node?.depth ?? 0;
  }

  /**
   * Get highest severity from a list
   */
  private getHighestSeverity(severities: RuleSeverity[]): RuleSeverity {
    const order: Record<RuleSeverity, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    return severities.reduce((highest, current) => {
      return order[current] > order[highest] ? current : highest;
    });
  }

  /**
   * Rebuild jurisdiction hierarchy tree
   */
  private rebuildTree(): void {
    this.tree.clear();

    // Create nodes
    for (const [id, jurisdiction] of this.jurisdictions) {
      this.tree.set(id, {
        jurisdiction,
        children: [],
        depth: 0,
      });
    }

    // Build relationships
    for (const [id, node] of this.tree) {
      if (node.jurisdiction.parentId) {
        const parent = this.tree.get(node.jurisdiction.parentId);
        if (parent) {
          node.parent = parent;
          parent.children.push(node);
        }
      }
    }

    // Calculate depths
    const calculateDepth = (node: JurisdictionNode, depth: number): void => {
      node.depth = depth;
      for (const child of node.children) {
        calculateDepth(child, depth + 1);
      }
    };

    for (const node of this.tree.values()) {
      if (!node.parent) {
        calculateDepth(node, 0);
      }
    }
  }

  /**
   * Get jurisdiction hierarchy as tree structure
   */
  getHierarchy(): JurisdictionNode[] {
    return Array.from(this.tree.values()).filter((n) => !n.parent);
  }

  /**
   * Get all registered jurisdictions
   */
  getAllJurisdictions(): Jurisdiction[] {
    return Array.from(this.jurisdictions.values());
  }

  /**
   * Get a specific jurisdiction
   */
  getJurisdiction(id: string): Jurisdiction | undefined {
    return this.jurisdictions.get(id);
  }

  /**
   * Check if a jurisdiction is a descendant of another
   */
  isDescendantOf(childId: string, ancestorId: string): boolean {
    let current = this.tree.get(childId);
    while (current?.parent) {
      if (current.parent.jurisdiction.id === ancestorId) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Get common ancestors of multiple jurisdictions
   */
  getCommonAncestors(jurisdictionIds: string[]): Jurisdiction[] {
    if (jurisdictionIds.length === 0) return [];

    const firstId = jurisdictionIds[0];
    if (!firstId) return [];

    if (jurisdictionIds.length === 1) {
      const j = this.jurisdictions.get(firstId);
      return j ? [j] : [];
    }

    // Get ancestors for first jurisdiction
    const getAncestors = (jId: string): string[] => {
      const ancestors: string[] = [];
      let current = this.tree.get(jId);
      while (current?.parent) {
        ancestors.push(current.parent.jurisdiction.id);
        current = current.parent;
      }
      return ancestors;
    };

    let common = new Set(getAncestors(firstId));

    for (let i = 1; i < jurisdictionIds.length; i++) {
      const jId = jurisdictionIds[i];
      if (!jId) continue;
      const ancestors = new Set(getAncestors(jId));
      common = new Set([...common].filter((x) => ancestors.has(x)));
    }

    return Array.from(common)
      .map((id) => this.jurisdictions.get(id)!)
      .filter(Boolean);
  }

  /**
   * Export configuration
   */
  exportConfig(): {
    jurisdictions: Jurisdiction[];
    rules: Array<{ jurisdictionId: string; rules: ArkaRule[] }>;
    options: HarmonizationOptions;
  } {
    return {
      jurisdictions: this.getAllJurisdictions(),
      rules: Array.from(this.rules.entries()).map(([jId, rules]) => ({
        jurisdictionId: jId,
        rules,
      })),
      options: this.options,
    };
  }

  /**
   * Import configuration
   */
  importConfig(config: {
    jurisdictions: Jurisdiction[];
    rules: Array<{ jurisdictionId: string; rules: ArkaRule[] }>;
    options?: Partial<HarmonizationOptions>;
  }): void {
    this.jurisdictions.clear();
    this.rules.clear();

    if (config.options) {
      this.options = { ...DEFAULT_OPTIONS, ...config.options };
    }

    this.registerJurisdictions(config.jurisdictions);

    for (const { jurisdictionId, rules } of config.rules) {
      this.registerRules(jurisdictionId, rules);
    }
  }
}

/**
 * Create a new harmonization engine
 */
export function createHarmonizationEngine(
  options?: Partial<HarmonizationOptions>
): JurisdictionHarmonizationEngine {
  return new JurisdictionHarmonizationEngine(options);
}

/**
 * Pre-built jurisdiction definitions for common regions
 */
export const COMMON_JURISDICTIONS: Jurisdiction[] = [
  // International
  {
    id: 'INTL',
    name: 'International',
    type: 'INTERNATIONAL',
    regulatoryBodies: ['BIS', 'FSB'],
    priority: 1,
    active: true,
  },

  // United States
  {
    id: 'US',
    name: 'United States',
    parentId: 'INTL',
    type: 'FEDERAL',
    countryCode: 'US',
    regulatoryBodies: ['SEC', 'CFTC', 'OCC', 'FDIC', 'Fed'],
    priority: 10,
    active: true,
  },
  {
    id: 'US-CA',
    name: 'California',
    parentId: 'US',
    type: 'STATE',
    countryCode: 'US',
    regulatoryBodies: ['DFPI'],
    priority: 20,
    active: true,
  },
  {
    id: 'US-NY',
    name: 'New York',
    parentId: 'US',
    type: 'STATE',
    countryCode: 'US',
    regulatoryBodies: ['NYDFS'],
    priority: 20,
    active: true,
  },

  // European Union
  {
    id: 'EU',
    name: 'European Union',
    parentId: 'INTL',
    type: 'SUPRANATIONAL',
    regulatoryBodies: ['EBA', 'ESMA', 'ECB'],
    priority: 10,
    active: true,
  },
  {
    id: 'EU-DE',
    name: 'Germany',
    parentId: 'EU',
    type: 'FEDERAL',
    countryCode: 'DE',
    regulatoryBodies: ['BaFin'],
    priority: 15,
    active: true,
  },
  {
    id: 'EU-FR',
    name: 'France',
    parentId: 'EU',
    type: 'FEDERAL',
    countryCode: 'FR',
    regulatoryBodies: ['AMF', 'ACPR'],
    priority: 15,
    active: true,
  },

  // United Kingdom
  {
    id: 'UK',
    name: 'United Kingdom',
    parentId: 'INTL',
    type: 'FEDERAL',
    countryCode: 'GB',
    regulatoryBodies: ['FCA', 'PRA'],
    priority: 10,
    active: true,
  },

  // Asia Pacific
  {
    id: 'APAC',
    name: 'Asia Pacific',
    parentId: 'INTL',
    type: 'REGIONAL',
    regulatoryBodies: [],
    priority: 5,
    active: true,
  },
  {
    id: 'APAC-SG',
    name: 'Singapore',
    parentId: 'APAC',
    type: 'FEDERAL',
    countryCode: 'SG',
    regulatoryBodies: ['MAS'],
    priority: 15,
    active: true,
  },
  {
    id: 'APAC-HK',
    name: 'Hong Kong',
    parentId: 'APAC',
    type: 'REGIONAL',
    countryCode: 'HK',
    regulatoryBodies: ['HKMA', 'SFC'],
    priority: 15,
    active: true,
  },
];
