/**
 * Tests for Plugin Registry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PluginRegistry,
  getPluginRegistry,
  resetPluginRegistry,
  type PluginRegistryEvent,
} from '../registry.js';
import type { ArkaDomainPlugin, PluginManifest, PluginHooks } from '../types.js';
import type { ArkaEntityType, ArkaRule } from '@arka/types';

// Helper to create a mock plugin
function createMockPlugin(manifest: Partial<PluginManifest> = {}): ArkaDomainPlugin {
  const fullManifest: PluginManifest = {
    id: `test-plugin-${Date.now()}`,
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test',
    entityTypes: [],
    eventTypes: [],
    ...manifest,
  };

  return {
    manifest: fullManifest,
    getEntityTypes: () => [],
    getDefaultRules: () => [],
    mapToCanonicalEvent: (event) => ({
      source: fullManifest.id,
      type: event.type,
      entityId: event.entityId,
    }),
  };
}

// Helper to create a mock plugin with hooks
function createMockPluginWithHooks(
  manifest: Partial<PluginManifest> = {},
  hooks: PluginHooks = {}
): ArkaDomainPlugin {
  const plugin = createMockPlugin(manifest);
  return {
    ...plugin,
    hooks,
  };
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('register', () => {
    it('should register a plugin successfully', async () => {
      const plugin = createMockPlugin({ id: 'test-plugin' });

      await registry.register(plugin);

      expect(registry.isRegistered('test-plugin')).toBe(true);
      expect(registry.getPlugin('test-plugin')).toBe(plugin);
    });

    it('should reject duplicate plugin registration', async () => {
      const plugin1 = createMockPlugin({ id: 'test-plugin' });
      const plugin2 = createMockPlugin({ id: 'test-plugin' });

      await registry.register(plugin1);

      await expect(registry.register(plugin2)).rejects.toThrow(
        "Plugin 'test-plugin' is already registered"
      );
    });

    it('should register entity types and event types', async () => {
      const plugin = createMockPlugin({
        id: 'test-plugin',
        entityTypes: ['Customer', 'Transaction'],
        eventTypes: ['KYC_CHECK', 'TRANSACTION_SCREEN'],
      });

      await registry.register(plugin);

      expect(registry.getPluginForEntityType('Customer')).toBe(plugin);
      expect(registry.getPluginForEntityType('Transaction')).toBe(plugin);
      expect(registry.getPluginForEventType('KYC_CHECK')).toBe(plugin);
      expect(registry.getPluginForEventType('TRANSACTION_SCREEN')).toBe(plugin);
    });

    it('should reject conflicting entity types', async () => {
      const plugin1 = createMockPlugin({
        id: 'plugin-1',
        entityTypes: ['Customer'],
      });
      const plugin2 = createMockPlugin({
        id: 'plugin-2',
        entityTypes: ['Customer'], // conflict
      });

      await registry.register(plugin1);

      await expect(registry.register(plugin2)).rejects.toThrow(
        "Entity type 'Customer' is already registered by plugin 'plugin-1'"
      );
    });

    it('should reject conflicting event types', async () => {
      const plugin1 = createMockPlugin({
        id: 'plugin-1',
        eventTypes: ['KYC_CHECK'],
      });
      const plugin2 = createMockPlugin({
        id: 'plugin-2',
        eventTypes: ['KYC_CHECK'], // conflict
      });

      await registry.register(plugin1);

      await expect(registry.register(plugin2)).rejects.toThrow(
        "Event type 'KYC_CHECK' is already registered by plugin 'plugin-1'"
      );
    });

    it('should check dependencies', async () => {
      const plugin = createMockPlugin({
        id: 'dependent-plugin',
        dependencies: ['base-plugin'],
      });

      await expect(registry.register(plugin)).rejects.toThrow(
        "Plugin 'dependent-plugin' requires 'base-plugin' which is not registered"
      );
    });

    it('should allow registration when dependencies are met', async () => {
      const basePlugin = createMockPlugin({ id: 'base-plugin' });
      const dependentPlugin = createMockPlugin({
        id: 'dependent-plugin',
        dependencies: ['base-plugin'],
      });

      await registry.register(basePlugin);
      await registry.register(dependentPlugin);

      expect(registry.isRegistered('dependent-plugin')).toBe(true);
    });

    it('should call onLoad hook during registration', async () => {
      const onLoad = vi.fn();
      const plugin = createMockPluginWithHooks(
        { id: 'test-plugin' },
        { onLoad }
      );

      await registry.register(plugin);

      expect(onLoad).toHaveBeenCalledTimes(1);
    });
  });

  describe('unregister', () => {
    it('should unregister a plugin successfully', async () => {
      const plugin = createMockPlugin({ id: 'test-plugin' });
      await registry.register(plugin);

      await registry.unregister('test-plugin');

      expect(registry.isRegistered('test-plugin')).toBe(false);
      expect(registry.getPlugin('test-plugin')).toBeUndefined();
    });

    it('should reject unregistering non-existent plugin', async () => {
      await expect(registry.unregister('non-existent')).rejects.toThrow(
        "Plugin 'non-existent' is not registered"
      );
    });

    it('should prevent unregistering plugin with dependents', async () => {
      const basePlugin = createMockPlugin({ id: 'base-plugin' });
      const dependentPlugin = createMockPlugin({
        id: 'dependent-plugin',
        dependencies: ['base-plugin'],
      });

      await registry.register(basePlugin);
      await registry.register(dependentPlugin);

      await expect(registry.unregister('base-plugin')).rejects.toThrow(
        "Cannot unregister 'base-plugin': plugin 'dependent-plugin' depends on it"
      );
    });

    it('should remove entity type and event type mappings', async () => {
      const plugin = createMockPlugin({
        id: 'test-plugin',
        entityTypes: ['Customer'],
        eventTypes: ['KYC_CHECK'],
      });

      await registry.register(plugin);
      await registry.unregister('test-plugin');

      expect(registry.getPluginForEntityType('Customer')).toBeUndefined();
      expect(registry.getPluginForEventType('KYC_CHECK')).toBeUndefined();
    });

    it('should call onUnload hook during unregistration', async () => {
      const onUnload = vi.fn();
      const plugin = createMockPluginWithHooks(
        { id: 'test-plugin' },
        { onUnload }
      );

      await registry.register(plugin);
      await registry.unregister('test-plugin');

      expect(onUnload).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPlugin', () => {
    it('should return undefined for non-existent plugin', () => {
      expect(registry.getPlugin('non-existent')).toBeUndefined();
    });
  });

  describe('getAllPlugins', () => {
    it('should return all active plugins', async () => {
      const plugin1 = createMockPlugin({ id: 'plugin-1' });
      const plugin2 = createMockPlugin({ id: 'plugin-2' });

      await registry.register(plugin1);
      await registry.register(plugin2);

      const plugins = registry.getAllPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins).toContain(plugin1);
      expect(plugins).toContain(plugin2);
    });
  });

  describe('getAllEntityTypes', () => {
    it('should return entity types from all plugins', async () => {
      const entityType1: ArkaEntityType = {
        name: 'Customer',
        description: 'Customer entity',
        schema: { type: 'object' },
      };
      const entityType2: ArkaEntityType = {
        name: 'Transaction',
        description: 'Transaction entity',
        schema: { type: 'object' },
      };

      const plugin1 = createMockPlugin({
        id: 'plugin-1',
        entityTypes: ['Customer'],
      });
      (plugin1 as { getEntityTypes: () => ArkaEntityType[] }).getEntityTypes = () => [entityType1];

      const plugin2 = createMockPlugin({
        id: 'plugin-2',
        entityTypes: ['Transaction'],
      });
      (plugin2 as { getEntityTypes: () => ArkaEntityType[] }).getEntityTypes = () => [entityType2];

      await registry.register(plugin1);
      await registry.register(plugin2);

      const entityTypes = registry.getAllEntityTypes();
      expect(entityTypes).toHaveLength(2);
    });
  });

  describe('getAllDefaultRules', () => {
    it('should return default rules from all plugins', async () => {
      const rule1: ArkaRule = {
        id: 'rule-1',
        name: 'Rule 1',
        description: 'Test rule 1',
        status: 'ACTIVE',
        severity: 'MEDIUM',
        tags: [],
        condition: { type: 'ALWAYS_TRUE' },
        action: { type: 'ALLOW' },
      };
      const rule2: ArkaRule = {
        id: 'rule-2',
        name: 'Rule 2',
        description: 'Test rule 2',
        status: 'ACTIVE',
        severity: 'HIGH',
        tags: [],
        condition: { type: 'ALWAYS_TRUE' },
        action: { type: 'FLAG', message: 'Test' },
      };

      const plugin1 = createMockPlugin({ id: 'plugin-1' });
      (plugin1 as { getDefaultRules: () => ArkaRule[] }).getDefaultRules = () => [rule1];

      const plugin2 = createMockPlugin({ id: 'plugin-2' });
      (plugin2 as { getDefaultRules: () => ArkaRule[] }).getDefaultRules = () => [rule2];

      await registry.register(plugin1);
      await registry.register(plugin2);

      const rules = registry.getAllDefaultRules();
      expect(rules).toHaveLength(2);
    });
  });

  describe('events', () => {
    it('should emit plugin:registered event', async () => {
      const handler = vi.fn();
      registry.on(handler);

      const plugin = createMockPlugin({ id: 'test-plugin' });
      await registry.register(plugin);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:registered',
          pluginId: 'test-plugin',
        })
      );
    });

    it('should emit plugin:unregistered event', async () => {
      const plugin = createMockPlugin({ id: 'test-plugin' });
      await registry.register(plugin);

      const handler = vi.fn();
      registry.on(handler);

      await registry.unregister('test-plugin');

      expect(handler).toHaveBeenCalledWith({
        type: 'plugin:unregistered',
        pluginId: 'test-plugin',
      });
    });

    it('should emit entityType:registered events', async () => {
      const handler = vi.fn();
      registry.on(handler);

      const plugin = createMockPlugin({
        id: 'test-plugin',
        entityTypes: ['Customer', 'Transaction'],
      });
      await registry.register(plugin);

      const entityTypeEvents = handler.mock.calls
        .map(call => call[0] as PluginRegistryEvent)
        .filter(e => e.type === 'entityType:registered');

      expect(entityTypeEvents).toHaveLength(2);
    });

    it('should allow unsubscribing from events', async () => {
      const handler = vi.fn();
      const unsubscribe = registry.on(handler);

      unsubscribe();

      const plugin = createMockPlugin({ id: 'test-plugin' });
      await registry.register(plugin);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return active status for registered plugin', async () => {
      const plugin = createMockPlugin({ id: 'test-plugin' });
      await registry.register(plugin);

      expect(registry.getStatus('test-plugin')).toBe('active');
    });

    it('should return undefined for non-existent plugin', () => {
      expect(registry.getStatus('non-existent')).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const plugin1 = createMockPlugin({
        id: 'plugin-1',
        entityTypes: ['Customer'],
        eventTypes: ['KYC_CHECK'],
      });
      const plugin2 = createMockPlugin({
        id: 'plugin-2',
        entityTypes: ['Transaction'],
        eventTypes: ['TRANSACTION_SCREEN', 'TRANSACTION_COMPLETE'],
      });

      await registry.register(plugin1);
      await registry.register(plugin2);

      const stats = registry.getStats();

      expect(stats.pluginCount).toBe(2);
      expect(stats.entityTypeCount).toBe(2);
      expect(stats.eventTypeCount).toBe(3);
      expect(stats.activePlugins).toContain('plugin-1');
      expect(stats.activePlugins).toContain('plugin-2');
    });
  });

  describe('clear', () => {
    it('should remove all plugins', async () => {
      await registry.register(createMockPlugin({ id: 'plugin-1' }));
      await registry.register(createMockPlugin({ id: 'plugin-2' }));

      registry.clear();

      expect(registry.getAllPlugins()).toHaveLength(0);
      expect(registry.getStats().pluginCount).toBe(0);
    });
  });
});

describe('Global Plugin Registry', () => {
  beforeEach(() => {
    resetPluginRegistry();
  });

  it('should return singleton instance', () => {
    const registry1 = getPluginRegistry();
    const registry2 = getPluginRegistry();

    expect(registry1).toBe(registry2);
  });

  it('should reset global registry', async () => {
    const registry = getPluginRegistry();
    await registry.register(createMockPlugin({ id: 'test' }));

    resetPluginRegistry();

    const newRegistry = getPluginRegistry();
    expect(newRegistry.getAllPlugins()).toHaveLength(0);
  });
});
