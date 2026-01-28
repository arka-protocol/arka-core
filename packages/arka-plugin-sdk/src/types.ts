/**
 * ARKA Plugin SDK Types
 *
 * Core interfaces that all ARKA domain plugins must implement.
 */

import type {
  ArkaEvent,
  ArkaEntity,
  ArkaEntityType,
  ArkaRule,
  CreateEventInput,
} from '@arka-protocol/types';

/**
 * Unique identifier for a plugin
 */
export interface PluginIdentifier {
  /** Unique plugin ID (e.g., "arka-loans", "arka-tariff") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Plugin author/organization */
  author: string;
}

/**
 * Plugin manifest describing capabilities
 */
export interface PluginManifest extends PluginIdentifier {
  /** Description of the plugin */
  description: string;

  /** Entity types this plugin defines */
  entityTypes: string[];

  /** Event types this plugin emits */
  eventTypes: string[];

  /** Dependencies on other plugins */
  dependencies?: string[];

  /** Minimum ARKA Core version required */
  arkaCoreVersion: string;

  /** Plugin-specific configuration schema */
  configSchema?: Record<string, unknown>;
}

/**
 * Domain-specific event before conversion to canonical format
 */
export interface DomainEvent<T = Record<string, unknown>> {
  /** Domain-specific event type */
  type: string;
  /** Domain-specific payload */
  payload: T;
  /** Optional entity reference */
  entityId?: string;
  /** Jurisdiction if applicable */
  jurisdiction?: string;
  /** When the event occurred */
  occurredAt?: string;
  /** Domain-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of domain data validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  warnings?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Hook points for plugin lifecycle
 */
export interface PluginHooks {
  /** Called when plugin is loaded */
  onLoad?: () => Promise<void>;

  /** Called when plugin is unloaded */
  onUnload?: () => Promise<void>;

  /** Called before an event is processed */
  beforeEventProcess?: (event: ArkaEvent) => Promise<ArkaEvent>;

  /** Called after a decision is made */
  afterDecision?: (event: ArkaEvent, decision: unknown) => Promise<void>;

  /** Called when rules are updated */
  onRulesUpdated?: (rules: ArkaRule[]) => Promise<void>;
}

/**
 * Core interface that all ARKA domain plugins must implement
 */
export interface ArkaDomainPlugin {
  /** Plugin identification and manifest */
  readonly manifest: PluginManifest;

  /** Plugin lifecycle hooks */
  readonly hooks?: PluginHooks;

  /**
   * Returns entity types defined by this plugin
   */
  getEntityTypes(): ArkaEntityType[];

  /**
   * Returns default rules for this domain
   */
  getDefaultRules(): ArkaRule[];

  /**
   * Converts a domain-specific event to canonical ARKA format
   */
  mapToCanonicalEvent(domainEvent: DomainEvent): CreateEventInput;

  /**
   * Validates domain-specific data
   */
  validateDomainData(
    entityType: string,
    data: Record<string, unknown>
  ): ValidationResult;

  /**
   * Returns domain-specific context for rule evaluation
   * (e.g., jurisdiction-specific thresholds, lookup tables)
   */
  getEvaluationContext?(
    event: ArkaEvent,
    entity?: ArkaEntity | null
  ): Record<string, unknown>;

  /**
   * Serializes domain data deterministically for blockchain
   */
  serializeForChain?(data: unknown): Buffer;

  /**
   * Deserializes data from blockchain format
   */
  deserializeFromChain?(data: Buffer): unknown;
}

/**
 * Plugin registration entry
 */
export interface PluginRegistration {
  plugin: ArkaDomainPlugin;
  registeredAt: string;
  status: 'active' | 'inactive' | 'error';
  error?: string;
}

/**
 * Plugin configuration options
 */
export interface PluginConfig {
  /** Plugin-specific settings */
  settings?: Record<string, unknown>;
  /** Whether to auto-register default rules */
  autoRegisterRules?: boolean;
  /** Whether to auto-register entity types */
  autoRegisterEntityTypes?: boolean;
  /** Override for default jurisdiction */
  defaultJurisdiction?: string;
}
