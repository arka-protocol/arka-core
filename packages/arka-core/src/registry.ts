/**
 * ARKA Rule and Entity Registry
 *
 * In-memory registry for rules and entity types.
 * This is used by the pure core library; persistent storage is handled by services.
 */

import type {
  ArkaRule,
  ArkaEntityType,
  ArkaEvent,
  ArkaEntity,
  RuleFilterParams,
} from '@arka-protocol/types';
import { isEffective } from '@arka-protocol/utils';

/**
 * In-memory rule registry
 */
export class RuleRegistry {
  private rules: Map<string, ArkaRule> = new Map();
  private ruleVersions: Map<string, Map<number, ArkaRule>> = new Map();

  /**
   * Registers a rule with the specified version
   */
  registerRule(rule: ArkaRule, version: number = 1): void {
    const versionedRule = { ...rule, version };
    this.rules.set(rule.id, versionedRule);

    // Store version history
    if (!this.ruleVersions.has(rule.id)) {
      this.ruleVersions.set(rule.id, new Map());
    }
    this.ruleVersions.get(rule.id)!.set(version, versionedRule);
  }

  /**
   * Gets a rule by ID (latest version)
   */
  getRule(id: string): ArkaRule | undefined {
    return this.rules.get(id);
  }

  /**
   * Gets a specific version of a rule
   */
  getRuleVersion(id: string, version: number): ArkaRule | undefined {
    return this.ruleVersions.get(id)?.get(version);
  }

  /**
   * Gets all versions of a rule
   */
  getRuleVersions(id: string): ArkaRule[] {
    const versions = this.ruleVersions.get(id);
    if (!versions) return [];
    return Array.from(versions.values()).sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
  }

  /**
   * Removes a rule from the registry
   */
  unregisterRule(id: string): boolean {
    this.ruleVersions.delete(id);
    return this.rules.delete(id);
  }

  /**
   * Gets all registered rules
   */
  getAllRules(): ArkaRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Gets rules filtered by various criteria
   */
  getRules(filter?: RuleFilterParams): ArkaRule[] {
    let rules = this.getAllRules();

    if (!filter) return rules;

    if (filter.entityType) {
      rules = rules.filter(
        (r) => !r.appliesToEntityType || r.appliesToEntityType === filter.entityType
      );
    }

    if (filter.eventType) {
      rules = rules.filter(
        (r) => !r.appliesToEventType || r.appliesToEventType === filter.eventType
      );
    }

    if (filter.jurisdiction) {
      rules = rules.filter(
        (r) => !r.jurisdiction || r.jurisdiction === filter.jurisdiction
      );
    }

    if (filter.status) {
      rules = rules.filter((r) => r.status === filter.status);
    }

    if (filter.severity) {
      rules = rules.filter((r) => r.severity === filter.severity);
    }

    if (filter.tags && filter.tags.length > 0) {
      rules = rules.filter((r) =>
        filter.tags!.some((tag) => r.tags.includes(tag))
      );
    }

    if (filter.effectiveAt) {
      rules = rules.filter((r) =>
        isEffective(r.effectiveFrom, r.effectiveTo, filter.effectiveAt)
      );
    }

    return rules;
  }

  /**
   * Gets active rules for a specific event and optional entity
   */
  getActiveRulesFor(event: ArkaEvent, entity?: ArkaEntity | null): ArkaRule[] {
    return this.getRules({
      eventType: event.type,
      entityType: entity?.type,
      jurisdiction: entity?.jurisdiction || event.jurisdiction || undefined,
      status: 'ACTIVE',
      effectiveAt: new Date().toISOString(),
    });
  }

  /**
   * Clears all rules from the registry
   */
  clear(): void {
    this.rules.clear();
    this.ruleVersions.clear();
  }

  /**
   * Returns the count of registered rules
   */
  get size(): number {
    return this.rules.size;
  }
}

/**
 * In-memory entity type registry
 */
export class EntityTypeRegistry {
  private entityTypes: Map<string, ArkaEntityType> = new Map();

  /**
   * Registers an entity type
   */
  registerEntityType(type: ArkaEntityType): void {
    this.entityTypes.set(type.name, type);
  }

  /**
   * Gets an entity type by name
   */
  getEntityType(name: string): ArkaEntityType | undefined {
    return this.entityTypes.get(name);
  }

  /**
   * Removes an entity type from the registry
   */
  unregisterEntityType(name: string): boolean {
    return this.entityTypes.delete(name);
  }

  /**
   * Gets all registered entity types
   */
  getAllEntityTypes(): ArkaEntityType[] {
    return Array.from(this.entityTypes.values());
  }

  /**
   * Checks if an entity type exists
   */
  hasEntityType(name: string): boolean {
    return this.entityTypes.has(name);
  }

  /**
   * Clears all entity types from the registry
   */
  clear(): void {
    this.entityTypes.clear();
  }

  /**
   * Returns the count of registered entity types
   */
  get size(): number {
    return this.entityTypes.size;
  }
}

// Singleton instances for convenience
let defaultRuleRegistry: RuleRegistry | null = null;
let defaultEntityTypeRegistry: EntityTypeRegistry | null = null;

export function getDefaultRuleRegistry(): RuleRegistry {
  if (!defaultRuleRegistry) {
    defaultRuleRegistry = new RuleRegistry();
  }
  return defaultRuleRegistry;
}

export function getDefaultEntityTypeRegistry(): EntityTypeRegistry {
  if (!defaultEntityTypeRegistry) {
    defaultEntityTypeRegistry = new EntityTypeRegistry();
  }
  return defaultEntityTypeRegistry;
}

export function resetDefaultRegistries(): void {
  defaultRuleRegistry?.clear();
  defaultEntityTypeRegistry?.clear();
}
