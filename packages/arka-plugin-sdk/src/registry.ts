/**
 * ARKA Plugin Registry
 *
 * Central registry for managing domain plugins.
 */

import type { ArkaEntityType, ArkaRule } from '@arka-protocol/types';
import { createLogger, ValidationError } from '@arka-protocol/utils';
import type {
  ArkaDomainPlugin,
  PluginRegistration,
  PluginConfig,
  PluginManifest,
} from './types.js';

const logger = createLogger({ service: 'plugin-registry' });

/**
 * Events emitted by the plugin registry
 */
export type PluginRegistryEvent =
  | { type: 'plugin:registered'; pluginId: string; manifest: PluginManifest }
  | { type: 'plugin:unregistered'; pluginId: string }
  | { type: 'plugin:error'; pluginId: string; error: Error }
  | { type: 'entityType:registered'; pluginId: string; entityType: string }
  | { type: 'rule:registered'; pluginId: string; ruleId: string };

export type PluginRegistryEventHandler = (event: PluginRegistryEvent) => void;

/**
 * Central registry for ARKA domain plugins
 */
export class PluginRegistry {
  private plugins: Map<string, PluginRegistration> = new Map();
  private entityTypeToPlugin: Map<string, string> = new Map();
  private eventTypeToPlugin: Map<string, string> = new Map();
  private eventHandlers: Set<PluginRegistryEventHandler> = new Set();

  /**
   * Registers a domain plugin
   */
  async register(
    plugin: ArkaDomainPlugin,
    config: PluginConfig = {}
  ): Promise<void> {
    const { manifest } = plugin;

    // Check for duplicate registration
    if (this.plugins.has(manifest.id)) {
      throw new ValidationError(`Plugin '${manifest.id}' is already registered`);
    }

    // Check dependencies
    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new ValidationError(
            `Plugin '${manifest.id}' requires '${dep}' which is not registered`
          );
        }
      }
    }

    // Check for entity type conflicts
    for (const entityType of manifest.entityTypes) {
      const existingPlugin = this.entityTypeToPlugin.get(entityType);
      if (existingPlugin) {
        throw new ValidationError(
          `Entity type '${entityType}' is already registered by plugin '${existingPlugin}'`
        );
      }
    }

    // Check for event type conflicts
    for (const eventType of manifest.eventTypes) {
      const existingPlugin = this.eventTypeToPlugin.get(eventType);
      if (existingPlugin) {
        throw new ValidationError(
          `Event type '${eventType}' is already registered by plugin '${existingPlugin}'`
        );
      }
    }

    logger.info('Registering plugin', {
      pluginId: manifest.id,
      version: manifest.version,
      entityTypes: manifest.entityTypes,
      eventTypes: manifest.eventTypes,
    });

    try {
      // Call onLoad hook
      if (plugin.hooks?.onLoad) {
        await plugin.hooks.onLoad();
      }

      // Register plugin
      const registration: PluginRegistration = {
        plugin,
        registeredAt: new Date().toISOString(),
        status: 'active',
      };
      this.plugins.set(manifest.id, registration);

      // Map entity types to plugin
      for (const entityType of manifest.entityTypes) {
        this.entityTypeToPlugin.set(entityType, manifest.id);
        this.emit({
          type: 'entityType:registered',
          pluginId: manifest.id,
          entityType,
        });
      }

      // Map event types to plugin
      for (const eventType of manifest.eventTypes) {
        this.eventTypeToPlugin.set(eventType, manifest.id);
      }

      this.emit({
        type: 'plugin:registered',
        pluginId: manifest.id,
        manifest,
      });

      logger.info('Plugin registered successfully', { pluginId: manifest.id });
    } catch (error) {
      logger.error('Failed to register plugin', error as Error, {
        pluginId: manifest.id,
      });
      throw error;
    }
  }

  /**
   * Unregisters a plugin
   */
  async unregister(pluginId: string): Promise<void> {
    const registration = this.plugins.get(pluginId);
    if (!registration) {
      throw new ValidationError(`Plugin '${pluginId}' is not registered`);
    }

    // Check if other plugins depend on this one
    for (const [otherId, otherReg] of this.plugins) {
      if (otherId !== pluginId) {
        const deps = otherReg.plugin.manifest.dependencies ?? [];
        if (deps.includes(pluginId)) {
          throw new ValidationError(
            `Cannot unregister '${pluginId}': plugin '${otherId}' depends on it`
          );
        }
      }
    }

    logger.info('Unregistering plugin', { pluginId });

    try {
      // Call onUnload hook
      if (registration.plugin.hooks?.onUnload) {
        await registration.plugin.hooks.onUnload();
      }

      // Remove entity type mappings
      for (const entityType of registration.plugin.manifest.entityTypes) {
        this.entityTypeToPlugin.delete(entityType);
      }

      // Remove event type mappings
      for (const eventType of registration.plugin.manifest.eventTypes) {
        this.eventTypeToPlugin.delete(eventType);
      }

      // Remove plugin
      this.plugins.delete(pluginId);

      this.emit({ type: 'plugin:unregistered', pluginId });

      logger.info('Plugin unregistered successfully', { pluginId });
    } catch (error) {
      logger.error('Failed to unregister plugin', error as Error, { pluginId });
      throw error;
    }
  }

  /**
   * Gets a plugin by ID
   */
  getPlugin(pluginId: string): ArkaDomainPlugin | undefined {
    return this.plugins.get(pluginId)?.plugin;
  }

  /**
   * Gets the plugin responsible for an entity type
   */
  getPluginForEntityType(entityType: string): ArkaDomainPlugin | undefined {
    const pluginId = this.entityTypeToPlugin.get(entityType);
    return pluginId ? this.plugins.get(pluginId)?.plugin : undefined;
  }

  /**
   * Gets the plugin responsible for an event type
   */
  getPluginForEventType(eventType: string): ArkaDomainPlugin | undefined {
    const pluginId = this.eventTypeToPlugin.get(eventType);
    return pluginId ? this.plugins.get(pluginId)?.plugin : undefined;
  }

  /**
   * Gets all registered plugins
   */
  getAllPlugins(): ArkaDomainPlugin[] {
    return Array.from(this.plugins.values())
      .filter((r) => r.status === 'active')
      .map((r) => r.plugin);
  }

  /**
   * Gets all entity types from all plugins
   */
  getAllEntityTypes(): ArkaEntityType[] {
    const types: ArkaEntityType[] = [];
    for (const registration of this.plugins.values()) {
      if (registration.status === 'active') {
        types.push(...registration.plugin.getEntityTypes());
      }
    }
    return types;
  }

  /**
   * Gets all default rules from all plugins
   */
  getAllDefaultRules(): ArkaRule[] {
    const rules: ArkaRule[] = [];
    for (const registration of this.plugins.values()) {
      if (registration.status === 'active') {
        rules.push(...registration.plugin.getDefaultRules());
      }
    }
    return rules;
  }

  /**
   * Checks if a plugin is registered
   */
  isRegistered(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Gets plugin status
   */
  getStatus(pluginId: string): PluginRegistration['status'] | undefined {
    return this.plugins.get(pluginId)?.status;
  }

  /**
   * Subscribe to registry events
   */
  on(handler: PluginRegistryEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Emits an event to all handlers
   */
  private emit(event: PluginRegistryEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error('Error in plugin event handler', error as Error);
      }
    }
  }

  /**
   * Gets registry statistics
   */
  getStats(): {
    pluginCount: number;
    entityTypeCount: number;
    eventTypeCount: number;
    activePlugins: string[];
  } {
    return {
      pluginCount: this.plugins.size,
      entityTypeCount: this.entityTypeToPlugin.size,
      eventTypeCount: this.eventTypeToPlugin.size,
      activePlugins: Array.from(this.plugins.entries())
        .filter(([, r]) => r.status === 'active')
        .map(([id]) => id),
    };
  }

  /**
   * Clears all plugins (for testing)
   */
  clear(): void {
    this.plugins.clear();
    this.entityTypeToPlugin.clear();
    this.eventTypeToPlugin.clear();
  }
}

// Global singleton
let globalRegistry: PluginRegistry | null = null;

export function getPluginRegistry(): PluginRegistry {
  if (!globalRegistry) {
    globalRegistry = new PluginRegistry();
  }
  return globalRegistry;
}

export function resetPluginRegistry(): void {
  globalRegistry?.clear();
  globalRegistry = null;
}
