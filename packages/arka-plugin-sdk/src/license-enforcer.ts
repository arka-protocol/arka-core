/**
 * License Enforcement Module
 *
 * Provides middleware for enforcing license validation on plugin execution.
 * Supports offline validation with 2-day grace period via JWT-embedded data.
 */

import * as jose from 'jose';

// ============================================================================
// Types
// ============================================================================

export interface LicenseConfig {
  /** License Authority service URL */
  licenseAuthorityUrl: string;
  /** Grace period in days for offline validation */
  gracePeriodDays: number;
  /** Cache TTL in seconds */
  cacheTtlSeconds: number;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Enable offline validation using JWT */
  enableOfflineValidation: boolean;
}

export interface LicenseValidationResult {
  valid: boolean;
  reason?: string;
  keyId?: string;
  tenantId?: string;
  client?: {
    name: string;
    email: string;
    tier: string;
  };
  subscriptions?: {
    plugins: string[];
    jurisdictions: string[];
    features: string[];
  };
  limits?: {
    maxDecisionsPerDay: number;
    maxNodes: number;
    maxApiCallsPerMinute: number;
  };
  expiresIn?: number;
  inGracePeriod?: boolean;
}

export interface PluginExecutionContext {
  pluginId: string;
  jurisdiction?: string;
  feature?: string;
  apiKey: string;
  requestId?: string;
}

export type LicenseEnforcementMode = 'strict' | 'warn' | 'disabled';

// ============================================================================
// Errors
// ============================================================================

export class LicenseValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly pluginId?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'LicenseValidationError';
  }
}

export class PluginNotLicensedError extends LicenseValidationError {
  constructor(pluginId: string, reason?: string) {
    super(
      `Plugin '${pluginId}' is not licensed: ${reason || 'subscription required'}`,
      'PLUGIN_NOT_LICENSED',
      pluginId
    );
  }
}

export class LicenseExpiredError extends LicenseValidationError {
  constructor(message: string = 'License has expired') {
    super(message, 'LICENSE_EXPIRED');
  }
}

export class QuotaExceededError extends LicenseValidationError {
  constructor(quotaType: string, limit: number, current: number) {
    super(
      `Quota exceeded: ${quotaType} (limit: ${limit}, current: ${current})`,
      'QUOTA_EXCEEDED',
      undefined,
      { quotaType, limit, current }
    );
  }
}

// ============================================================================
// License Cache
// ============================================================================

interface CachedValidation {
  result: LicenseValidationResult;
  cachedAt: number;
  expiresAt: number;
}

class LicenseCache {
  private cache = new Map<string, CachedValidation>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private ttlSeconds: number) {
    // Periodically clean up expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get(apiKey: string): LicenseValidationResult | null {
    const cached = this.cache.get(this.hashKey(apiKey));
    if (!cached) return null;

    const now = Date.now();
    if (now > cached.expiresAt) {
      this.cache.delete(this.hashKey(apiKey));
      return null;
    }

    return cached.result;
  }

  set(apiKey: string, result: LicenseValidationResult): void {
    const now = Date.now();
    this.cache.set(this.hashKey(apiKey), {
      result,
      cachedAt: now,
      expiresAt: now + this.ttlSeconds * 1000,
    });
  }

  invalidate(apiKey: string): void {
    this.cache.delete(this.hashKey(apiKey));
  }

  clear(): void {
    this.cache.clear();
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private hashKey(apiKey: string): string {
    // Simple hash for cache key (first 32 chars)
    return apiKey.substring(0, 32);
  }
}

// ============================================================================
// License Enforcer
// ============================================================================

const DEFAULT_CONFIG: LicenseConfig = {
  licenseAuthorityUrl: 'http://localhost:3003',
  gracePeriodDays: 2,
  cacheTtlSeconds: 300,
  timeoutMs: 5000,
  enableOfflineValidation: true,
};

const KEY_PREFIX = 'arka_live_';

export class LicenseEnforcer {
  private config: LicenseConfig;
  private cache: LicenseCache;
  private mode: LicenseEnforcementMode = 'strict';

  constructor(config: Partial<LicenseConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new LicenseCache(this.config.cacheTtlSeconds);
  }

  /**
   * Set enforcement mode
   */
  setMode(mode: LicenseEnforcementMode): void {
    this.mode = mode;
  }

  /**
   * Get current enforcement mode
   */
  getMode(): LicenseEnforcementMode {
    return this.mode;
  }

  /**
   * Validate API key and check plugin access
   */
  async validatePluginAccess(context: PluginExecutionContext): Promise<LicenseValidationResult> {
    // Check if enforcement is disabled
    if (this.mode === 'disabled') {
      return { valid: true, reason: 'Enforcement disabled' };
    }

    const { pluginId, jurisdiction, feature, apiKey } = context;

    // Try cache first
    const cached = this.cache.get(apiKey);
    if (cached && cached.valid) {
      // Verify plugin access from cached data
      if (!this.checkPluginAccess(cached, pluginId, jurisdiction, feature)) {
        const result: LicenseValidationResult = {
          valid: false,
          reason: `Plugin '${pluginId}' not licensed`,
        };
        return this.handleValidationResult(result, pluginId);
      }
      return cached;
    }

    // Try online validation
    try {
      const result = await this.validateOnline(apiKey, pluginId, jurisdiction, feature);
      if (result.valid) {
        this.cache.set(apiKey, result);
      }
      return this.handleValidationResult(result, pluginId);
    } catch (error) {
      // Online validation failed, try offline
      if (this.config.enableOfflineValidation) {
        const offlineResult = this.validateOffline(apiKey, pluginId, jurisdiction, feature);
        return this.handleValidationResult(offlineResult, pluginId);
      }

      return this.handleValidationResult(
        { valid: false, reason: 'License validation failed (offline disabled)' },
        pluginId
      );
    }
  }

  /**
   * Middleware wrapper for plugin execution
   */
  createMiddleware() {
    return async <T>(
      context: PluginExecutionContext,
      execute: () => Promise<T>
    ): Promise<T> => {
      const validation = await this.validatePluginAccess(context);

      if (!validation.valid) {
        throw new PluginNotLicensedError(context.pluginId, validation.reason);
      }

      // Execute the plugin
      return execute();
    };
  }

  /**
   * Decorator for plugin methods
   */
  requireLicense(pluginId: string) {
    const enforcer = this;

    return function <T extends (...args: unknown[]) => Promise<unknown>>(
      target: unknown,
      propertyKey: string,
      descriptor: TypedPropertyDescriptor<T>
    ): TypedPropertyDescriptor<T> {
      const originalMethod = descriptor.value!;

      descriptor.value = async function (this: unknown, ...args: unknown[]) {
        // Extract API key from first argument (assumed to be context)
        const context = args[0] as { apiKey?: string; jurisdiction?: string } | undefined;
        const apiKey = context?.apiKey;

        if (!apiKey) {
          throw new LicenseValidationError(
            'API key required for licensed plugin execution',
            'API_KEY_REQUIRED',
            pluginId
          );
        }

        const validation = await enforcer.validatePluginAccess({
          pluginId,
          jurisdiction: context?.jurisdiction,
          apiKey,
        });

        if (!validation.valid) {
          throw new PluginNotLicensedError(pluginId, validation.reason);
        }

        return originalMethod.apply(this, args);
      } as T;

      return descriptor;
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cache.destroy();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async validateOnline(
    apiKey: string,
    pluginId?: string,
    jurisdiction?: string,
    feature?: string
  ): Promise<LicenseValidationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const payload: Record<string, string> = { apiKey };
      if (pluginId) payload.requestedPlugin = pluginId;
      if (jurisdiction) payload.requestedJurisdiction = jurisdiction;
      if (feature) payload.requestedFeature = feature;

      const response = await fetch(`${this.config.licenseAuthorityUrl}/api-key/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await response.json() as {
        success: boolean;
        data?: LicenseValidationResult;
        error?: { message?: string };
      };

      if (!data.success) {
        return {
          valid: false,
          reason: data.error?.message || 'Validation failed',
        };
      }

      return data.data as LicenseValidationResult;
    } finally {
      clearTimeout(timeout);
    }
  }

  private validateOffline(
    apiKey: string,
    pluginId?: string,
    jurisdiction?: string,
    feature?: string
  ): LicenseValidationResult {
    try {
      // Strip prefix if present
      let token = apiKey;
      if (apiKey.startsWith(KEY_PREFIX)) {
        token = apiKey.substring(KEY_PREFIX.length);
      }

      // Decode JWT without verification (for offline use)
      const payload = jose.decodeJwt(token);

      // Check expiration with grace period
      const exp = payload.exp as number;
      const graceDays = (payload.gracePeriodDays as number) || this.config.gracePeriodDays;
      const graceSeconds = graceDays * 24 * 60 * 60;
      const effectiveExp = exp + graceSeconds;
      const now = Math.floor(Date.now() / 1000);

      if (now > effectiveExp) {
        return {
          valid: false,
          reason: 'API key expired (grace period ended)',
        };
      }

      // Extract subscriptions
      const subscriptions = payload.subscriptions as {
        plugins?: string[];
        jurisdictions?: string[];
        features?: string[];
      };

      // Check plugin access
      if (pluginId && subscriptions.plugins && !subscriptions.plugins.includes(pluginId)) {
        return {
          valid: false,
          reason: `Plugin '${pluginId}' not licensed`,
        };
      }

      // Check jurisdiction access
      if (
        jurisdiction &&
        subscriptions.jurisdictions &&
        !subscriptions.jurisdictions.includes(jurisdiction)
      ) {
        return {
          valid: false,
          reason: `Jurisdiction '${jurisdiction}' not licensed`,
        };
      }

      // Check feature access
      if (feature && subscriptions.features && !subscriptions.features.includes(feature)) {
        return {
          valid: false,
          reason: `Feature '${feature}' not licensed`,
        };
      }

      const client = payload.client as { name: string; email: string; tier: string };
      const limits = payload.limits as {
        maxDecisionsPerDay: number;
        maxNodes: number;
        maxApiCallsPerMinute: number;
      };

      const inGracePeriod = now > exp;

      return {
        valid: true,
        keyId: payload.keyId as string,
        tenantId: payload.tenantId as string,
        client,
        subscriptions: {
          plugins: subscriptions.plugins || [],
          jurisdictions: subscriptions.jurisdictions || [],
          features: subscriptions.features || [],
        },
        limits,
        expiresIn: Math.max(0, exp - now),
        inGracePeriod,
        reason: inGracePeriod ? 'Valid (offline grace period)' : 'Valid (offline)',
      };
    } catch (error) {
      return {
        valid: false,
        reason: 'Invalid API key format',
      };
    }
  }

  private checkPluginAccess(
    validation: LicenseValidationResult,
    pluginId?: string,
    jurisdiction?: string,
    feature?: string
  ): boolean {
    if (!validation.subscriptions) return true;

    if (pluginId && !validation.subscriptions.plugins.includes(pluginId)) {
      return false;
    }

    if (jurisdiction && !validation.subscriptions.jurisdictions.includes(jurisdiction)) {
      return false;
    }

    if (feature && !validation.subscriptions.features.includes(feature)) {
      return false;
    }

    return true;
  }

  private handleValidationResult(
    result: LicenseValidationResult,
    pluginId: string
  ): LicenseValidationResult {
    if (this.mode === 'warn' && !result.valid) {
      console.warn(
        `[ARKA License Warning] Plugin '${pluginId}' license validation failed: ${result.reason}`
      );
      return { ...result, valid: true, reason: `Warning: ${result.reason}` };
    }

    return result;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalEnforcer: LicenseEnforcer | null = null;

export function getLicenseEnforcer(config?: Partial<LicenseConfig>): LicenseEnforcer {
  if (!globalEnforcer) {
    globalEnforcer = new LicenseEnforcer(config);
  }
  return globalEnforcer;
}

export function resetLicenseEnforcer(): void {
  if (globalEnforcer) {
    globalEnforcer.destroy();
    globalEnforcer = null;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract API key from request headers
 */
export function extractApiKey(headers: Record<string, string | undefined>): string | null {
  // Check Authorization header
  const auth = headers.authorization || headers.Authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.substring(7);
  }

  // Check X-API-Key header
  const apiKey = headers['x-api-key'] || headers['X-API-Key'];
  if (apiKey) {
    return apiKey;
  }

  return null;
}

/**
 * Create a licensed plugin wrapper
 */
export function withLicense<T extends object>(
  plugin: T,
  pluginId: string,
  enforcer?: LicenseEnforcer
): T {
  const licenseEnforcer = enforcer || getLicenseEnforcer();
  const middleware = licenseEnforcer.createMiddleware();

  return new Proxy(plugin, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // Only wrap functions
      if (typeof value !== 'function') {
        return value;
      }

      // Return wrapped function
      return async function (this: unknown, ...args: unknown[]) {
        // Extract context from first argument
        const firstArg = args[0] as { apiKey?: string; jurisdiction?: string } | undefined;
        const apiKey = firstArg?.apiKey;

        if (!apiKey) {
          // No API key provided, execute without license check
          // (useful for internal calls)
          return value.apply(this, args);
        }

        return middleware(
          {
            pluginId,
            jurisdiction: firstArg?.jurisdiction,
            apiKey,
          },
          () => value.apply(this, args)
        );
      };
    },
  });
}
