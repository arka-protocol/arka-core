/**
 * Plugin Hot Loader
 *
 * Enables dynamic loading of ARKA domain plugins without service restart.
 *
 * Features:
 * - Load plugins from directory
 * - Watch for changes
 * - Validate plugins
 * - Register/unregister automatically
 */

import { createLogger, ValidationError } from '@arka-protocol/utils';
import type {
  ArkaDomainPlugin,
  PluginManifest,
  PluginConfig,
} from './types.js';
import { PluginRegistry, getPluginRegistry } from './registry.js';

const logger = createLogger({ service: 'plugin-hot-loader' });

/**
 * Plugin manifest file structure (arka-plugin.json)
 */
export interface PluginPackageManifest {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description: string;
  /** Main entry point */
  main: string;
  /** ARKA plugin specification */
  pact: {
    /** ARKA Core version required */
    coreVersion: string;
    /** Entity types defined */
    entityTypes: string[];
    /** Event types handled */
    eventTypes: string[];
    /** Dependencies on other plugins */
    dependencies?: string[];
    /** Optional: AI configuration */
    ai?: {
      prompts?: string;
      riskModels?: string;
    };
    /** Optional: Blockchain configuration */
    blockchain?: {
      ruleRegistryContract?: string;
      auditContract?: string;
    };
  };
  /** Author/organization */
  author: string;
  /** License */
  license?: string;
}

/**
 * Loaded plugin info
 */
export interface LoadedPlugin {
  /** Plugin instance */
  plugin: ArkaDomainPlugin;
  /** Package manifest */
  packageManifest: PluginPackageManifest;
  /** Load timestamp */
  loadedAt: string;
  /** Plugin path */
  path: string;
  /** Is currently active */
  active: boolean;
}

/**
 * Hot loader configuration
 */
export interface HotLoaderConfig {
  /** Directory to watch for plugins */
  pluginsDir: string;
  /** Whether to watch for changes */
  watch?: boolean;
  /** Polling interval in ms (if watch is true) */
  watchInterval?: number;
  /** Auto-register new plugins */
  autoRegister?: boolean;
  /** Plugin config to apply */
  defaultPluginConfig?: PluginConfig;
}

/**
 * Plugin validation result
 */
export interface PluginValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Plugin Hot Loader
 *
 * Dynamically loads and manages ARKA domain plugins.
 */
export class PluginHotLoader {
  private config: Required<HotLoaderConfig>;
  private registry: PluginRegistry;
  private loadedPlugins: Map<string, LoadedPlugin> = new Map();
  private watchInterval: ReturnType<typeof setInterval> | null = null;
  private lastScan: Map<string, number> = new Map(); // path -> mtime

  constructor(config: HotLoaderConfig) {
    this.config = {
      pluginsDir: config.pluginsDir,
      watch: config.watch ?? false,
      watchInterval: config.watchInterval ?? 5000,
      autoRegister: config.autoRegister ?? true,
      defaultPluginConfig: config.defaultPluginConfig ?? {},
    };
    this.registry = getPluginRegistry();
  }

  /**
   * Starts the hot loader
   */
  async start(): Promise<void> {
    logger.info('Starting plugin hot loader', {
      pluginsDir: this.config.pluginsDir,
      watch: this.config.watch,
    });

    // Initial scan
    await this.scanPlugins();

    // Start watching if enabled
    if (this.config.watch) {
      this.startWatching();
    }
  }

  /**
   * Stops the hot loader
   */
  async stop(): Promise<void> {
    logger.info('Stopping plugin hot loader');

    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }

    // Unregister all plugins
    for (const [pluginId] of this.loadedPlugins) {
      try {
        await this.unloadPlugin(pluginId);
      } catch (error) {
        logger.error('Error unloading plugin', error as Error, { pluginId });
      }
    }
  }

  /**
   * Scans plugin directory and loads/updates plugins
   */
  async scanPlugins(): Promise<void> {
    logger.debug('Scanning plugins directory', { dir: this.config.pluginsDir });

    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const entries = await fs.readdir(this.config.pluginsDir, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(this.config.pluginsDir, entry.name);
          const manifestPath = path.join(pluginPath, 'arka-plugin.json');

          try {
            // Check if manifest exists
            const stat = await fs.stat(manifestPath);
            const mtime = stat.mtimeMs;

            // Check if plugin needs loading/reloading
            const lastMtime = this.lastScan.get(pluginPath);
            if (!lastMtime || mtime > lastMtime) {
              await this.loadPluginFromPath(pluginPath);
              this.lastScan.set(pluginPath, mtime);
            }
          } catch {
            // No manifest file, skip
          }
        }
      }
    } catch (error) {
      logger.error('Error scanning plugins directory', error as Error);
    }
  }

  /**
   * Loads a plugin from a directory path
   */
  async loadPluginFromPath(pluginPath: string): Promise<LoadedPlugin> {
    const fs = await import('fs/promises');
    const path = await import('path');

    logger.info('Loading plugin from path', { pluginPath });

    // Read and parse manifest
    const manifestPath = path.join(pluginPath, 'arka-plugin.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const packageManifest: PluginPackageManifest = JSON.parse(manifestContent);

    // Validate manifest
    const validation = this.validateManifest(packageManifest);
    if (!validation.valid) {
      throw new ValidationError(
        `Invalid plugin manifest: ${validation.errors.join(', ')}`
      );
    }

    // Check if already loaded
    const existingPlugin = this.loadedPlugins.get(packageManifest.name);
    if (existingPlugin) {
      // Unload existing version
      await this.unloadPlugin(packageManifest.name);
    }

    // Import the plugin module
    const mainPath = path.join(pluginPath, packageManifest.main);
    const pluginModule = await import(mainPath);

    // Get plugin instance (support various export patterns)
    let plugin: ArkaDomainPlugin;
    if (typeof pluginModule.default === 'function') {
      plugin = new pluginModule.default();
    } else if (typeof pluginModule.default === 'object') {
      plugin = pluginModule.default;
    } else if (typeof pluginModule.getPlugin === 'function') {
      plugin = pluginModule.getPlugin();
    } else if (typeof pluginModule.plugin === 'object') {
      plugin = pluginModule.plugin;
    } else {
      throw new ValidationError(
        'Plugin module must export a default class, object, or getPlugin function'
      );
    }

    const loadedPlugin: LoadedPlugin = {
      plugin,
      packageManifest,
      loadedAt: new Date().toISOString(),
      path: pluginPath,
      active: false,
    };

    // Register if auto-register is enabled
    if (this.config.autoRegister) {
      await this.registry.register(plugin, this.config.defaultPluginConfig);
      loadedPlugin.active = true;
    }

    this.loadedPlugins.set(packageManifest.name, loadedPlugin);

    logger.info('Plugin loaded successfully', {
      name: packageManifest.name,
      version: packageManifest.version,
      active: loadedPlugin.active,
    });

    return loadedPlugin;
  }

  /**
   * Unloads a plugin
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const loaded = this.loadedPlugins.get(pluginId);
    if (!loaded) {
      throw new ValidationError(`Plugin ${pluginId} is not loaded`);
    }

    logger.info('Unloading plugin', { pluginId });

    if (loaded.active) {
      await this.registry.unregister(pluginId);
    }

    this.loadedPlugins.delete(pluginId);

    logger.info('Plugin unloaded', { pluginId });
  }

  /**
   * Reloads a specific plugin
   */
  async reloadPlugin(pluginId: string): Promise<LoadedPlugin> {
    const loaded = this.loadedPlugins.get(pluginId);
    if (!loaded) {
      throw new ValidationError(`Plugin ${pluginId} is not loaded`);
    }

    logger.info('Reloading plugin', { pluginId });

    return this.loadPluginFromPath(loaded.path);
  }

  /**
   * Gets a loaded plugin
   */
  getLoadedPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  /**
   * Gets all loaded plugins
   */
  getAllLoadedPlugins(): LoadedPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Validates a plugin manifest
   */
  validateManifest(manifest: PluginPackageManifest): PluginValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest.name) {
      errors.push('Missing required field: name');
    }

    if (!manifest.version) {
      errors.push('Missing required field: version');
    }

    if (!manifest.main) {
      errors.push('Missing required field: main');
    }

    if (!manifest.pact) {
      errors.push('Missing required field: pact');
    } else {
      if (!manifest.pact.coreVersion) {
        errors.push('Missing required field: pact.coreVersion');
      }

      if (!manifest.pact.entityTypes || manifest.pact.entityTypes.length === 0) {
        warnings.push('No entity types defined');
      }

      if (!manifest.pact.eventTypes || manifest.pact.eventTypes.length === 0) {
        warnings.push('No event types defined');
      }
    }

    if (!manifest.author) {
      warnings.push('Missing author field');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Starts watching for plugin changes
   */
  private startWatching(): void {
    logger.info('Starting plugin watch', {
      interval: this.config.watchInterval,
    });

    this.watchInterval = setInterval(async () => {
      await this.scanPlugins();
    }, this.config.watchInterval);
  }

  /**
   * Installs a plugin from a package (simulates pactctl plugin install)
   */
  async installPlugin(
    packageSource: string,
    _options?: { version?: string }
  ): Promise<LoadedPlugin> {
    logger.info('Installing plugin', { source: packageSource });

    // In production, this would:
    // 1. Download package from npm/registry
    // 2. Extract to plugins directory
    // 3. Load the plugin

    // For now, assume packageSource is a local path
    return this.loadPluginFromPath(packageSource);
  }

  /**
   * Gets loader statistics
   */
  getStats(): {
    totalPlugins: number;
    activePlugins: number;
    watchingEnabled: boolean;
    pluginsDir: string;
  } {
    const plugins = Array.from(this.loadedPlugins.values());
    return {
      totalPlugins: plugins.length,
      activePlugins: plugins.filter((p) => p.active).length,
      watchingEnabled: this.config.watch,
      pluginsDir: this.config.pluginsDir,
    };
  }
}

// Global hot loader instance
let globalHotLoader: PluginHotLoader | null = null;

/**
 * Gets the global hot loader
 */
export function getHotLoader(): PluginHotLoader | null {
  return globalHotLoader;
}

/**
 * Initializes the global hot loader
 */
export async function initializeHotLoader(
  config: HotLoaderConfig
): Promise<PluginHotLoader> {
  if (globalHotLoader) {
    await globalHotLoader.stop();
  }

  globalHotLoader = new PluginHotLoader(config);
  await globalHotLoader.start();

  return globalHotLoader;
}

/**
 * Shuts down the global hot loader
 */
export async function shutdownHotLoader(): Promise<void> {
  if (globalHotLoader) {
    await globalHotLoader.stop();
    globalHotLoader = null;
  }
}
