/**
 * Base Plugin Implementation
 *
 * Abstract base class that plugins can extend for common functionality.
 */

import type {
  ArkaEvent,
  ArkaEntity,
  ArkaEntityType,
  ArkaRule,
  CreateEventInput,
} from '@arka-protocol/types';
import { ids, now } from '@arka-protocol/utils';
import type {
  ArkaDomainPlugin,
  PluginManifest,
  PluginHooks,
  DomainEvent,
  ValidationResult,
} from './types.js';

/**
 * Abstract base class for ARKA domain plugins
 */
export abstract class BaseArkaPlugin implements ArkaDomainPlugin {
  abstract readonly manifest: PluginManifest;

  /**
   * Optional hooks - override in subclass
   */
  readonly hooks?: PluginHooks;

  /**
   * Entity types defined by this plugin
   */
  protected abstract entityTypes: ArkaEntityType[];

  /**
   * Default rules for this domain
   */
  protected abstract defaultRules: ArkaRule[];

  /**
   * Returns entity types defined by this plugin
   */
  getEntityTypes(): ArkaEntityType[] {
    return this.entityTypes;
  }

  /**
   * Returns default rules for this domain
   */
  getDefaultRules(): ArkaRule[] {
    return this.defaultRules;
  }

  /**
   * Converts a domain-specific event to canonical ARKA format.
   * Override in subclass for custom mapping.
   */
  mapToCanonicalEvent(domainEvent: DomainEvent): CreateEventInput {
    return {
      source: this.manifest.id,
      type: domainEvent.type,
      entityId: domainEvent.entityId,
      entityType: this.inferEntityType(domainEvent),
      jurisdiction: domainEvent.jurisdiction,
      payload: domainEvent.payload,
      occurredAt: domainEvent.occurredAt ?? now(),
    };
  }

  /**
   * Infers entity type from domain event.
   * Override in subclass for custom logic.
   */
  protected inferEntityType(domainEvent: DomainEvent): string | undefined {
    // Default: try to infer from event type
    // e.g., "LOAN_CREATED" -> "Loan"
    const parts = domainEvent.type.split('_');
    if (parts.length >= 2) {
      const entityName = parts[0]!;
      // Capitalize first letter
      return entityName.charAt(0).toUpperCase() + entityName.slice(1).toLowerCase();
    }
    return undefined;
  }

  /**
   * Validates domain-specific data against entity type schema.
   * Override in subclass for custom validation.
   */
  validateDomainData(
    entityType: string,
    data: Record<string, unknown>
  ): ValidationResult {
    const type = this.entityTypes.find((t) => t.name === entityType);
    if (!type) {
      return {
        valid: false,
        errors: [
          {
            field: 'entityType',
            message: `Unknown entity type: ${entityType}`,
            code: 'UNKNOWN_ENTITY_TYPE',
          },
        ],
      };
    }

    // Basic schema validation (can be extended with full JSON Schema validation)
    const errors: ValidationResult['errors'] = [];
    const schema = type.schema;

    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (data[field] === undefined || data[field] === null) {
          errors.push({
            field,
            message: `Required field '${field}' is missing`,
            code: 'REQUIRED_FIELD_MISSING',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Returns domain-specific context for rule evaluation.
   * Override in subclass to provide context.
   */
  getEvaluationContext(
    _event: ArkaEvent,
    _entity?: ArkaEntity | null
  ): Record<string, unknown> {
    return {};
  }

  /**
   * Serializes data deterministically for blockchain.
   * Uses canonical JSON serialization by default.
   */
  serializeForChain(data: unknown): Buffer {
    const canonical = this.canonicalStringify(data);
    return Buffer.from(canonical, 'utf8');
  }

  /**
   * Deserializes data from blockchain format.
   */
  deserializeFromChain(data: Buffer): unknown {
    return JSON.parse(data.toString('utf8'));
  }

  /**
   * Produces canonical JSON string with sorted keys
   */
  protected canonicalStringify(obj: unknown): string {
    return JSON.stringify(obj, (_, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce((sorted: Record<string, unknown>, key) => {
            sorted[key] = (value as Record<string, unknown>)[key];
            return sorted;
          }, {});
      }
      return value;
    });
  }

  /**
   * Helper to create a rule ID
   */
  protected createRuleId(): string {
    return ids.rule();
  }

  /**
   * Helper to create a rule with plugin defaults
   */
  protected createRule(
    rule: Omit<ArkaRule, 'id' | 'tags' | 'metadata'> & {
      tags?: string[];
      metadata?: Record<string, unknown>;
    }
  ): ArkaRule {
    return {
      ...rule,
      id: this.createRuleId(),
      tags: [...(rule.tags ?? []), this.manifest.id],
      metadata: {
        ...rule.metadata,
        pluginId: this.manifest.id,
        pluginVersion: this.manifest.version,
      },
    };
  }
}
