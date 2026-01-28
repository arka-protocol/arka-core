/**
 * ARKA Plugin SDK
 *
 * SDK for building ARKA Protocol domain plugins.
 *
 * Features:
 * - Plugin interfaces and base classes
 * - Plugin registry with dependency management
 * - Hot loading of plugins
 * - AI Cortex extensibility
 *
 * @packageDocumentation
 */

// Types
export * from './types.js';

// Plugin registry
export {
  PluginRegistry,
  getPluginRegistry,
  resetPluginRegistry,
  type PluginRegistryEvent,
  type PluginRegistryEventHandler,
} from './registry.js';

// Base plugin class
export { BaseArkaPlugin } from './base-plugin.js';

// Hot loader
export {
  PluginHotLoader,
  getHotLoader,
  initializeHotLoader,
  shutdownHotLoader,
  type PluginPackageManifest,
  type LoadedPlugin,
  type HotLoaderConfig,
  type PluginValidationResult,
} from './hot-loader.js';

// AI extensions
export {
  AIExtensionRegistry,
  getAIExtensionRegistry,
  resetAIExtensionRegistry,
  type AIPromptTemplate,
  type RiskModel,
  type SimulationTemplate,
  type LegalMapping,
  type TuningStrategy,
  type PluginAIExtension,
} from './ai-extension.js';

// Testing utilities
export {
  // Mock factories
  createMockEvent,
  createMockEntity,
  createMockDecision,
  // Rule builder
  RuleBuilder,
  rule,
  // Test harness
  PluginTestHarness,
  // Simulation
  generateTestEvents,
  runSimulation,
  // Assertions
  assert,
  // Types
  type TestResult,
  type TestSuiteResult,
  type EventGeneratorConfig,
  type SimulationResult,
} from './testing.js';

// License enforcement
export {
  LicenseEnforcer,
  getLicenseEnforcer,
  resetLicenseEnforcer,
  extractApiKey,
  withLicense,
  LicenseValidationError,
  PluginNotLicensedError,
  LicenseExpiredError,
  QuotaExceededError,
  type LicenseConfig,
  type LicenseValidationResult,
  type PluginExecutionContext,
  type LicenseEnforcementMode,
} from './license-enforcer.js';

// CLI extension support
export * from './cli/index.js';
