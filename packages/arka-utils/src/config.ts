/**
 * ARKA Configuration Utilities
 *
 * Helpers for loading and validating configuration from environment variables.
 */

export interface EnvConfig {
  [key: string]: string | undefined;
}

/**
 * Gets an environment variable, throwing if not found and required
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Gets an optional environment variable
 */
export function getEnvOptional(key: string): string | undefined {
  return process.env[key];
}

/**
 * Gets an environment variable as a number
 */
export function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${value}`);
  }
  return parsed;
}

/**
 * Gets an environment variable as a boolean
 */
export function getEnvBoolean(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Gets an environment variable as an array (comma-separated)
 */
export function getEnvArray(key: string, defaultValue?: string[]): string[] {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Base configuration interface
 */
export interface BaseConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Loads base configuration from environment
 */
export function loadBaseConfig(): BaseConfig {
  const nodeEnv = getEnv('NODE_ENV', 'development') as BaseConfig['nodeEnv'];
  return {
    nodeEnv,
    port: getEnvNumber('PORT', 3000),
    logLevel: getEnv('LOG_LEVEL', nodeEnv === 'production' ? 'info' : 'debug') as BaseConfig['logLevel'],
  };
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  url: string;
  maxConnections: number;
}

/**
 * Loads database configuration from environment
 */
export function loadDatabaseConfig(): DatabaseConfig {
  return {
    url: getEnv('DATABASE_URL'),
    maxConnections: getEnvNumber('DATABASE_MAX_CONNECTIONS', 10),
  };
}

/**
 * OpenRouter configuration
 */
export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  maxRetries: number;
  timeoutMs: number;
}

/**
 * Loads OpenRouter configuration from environment
 */
export function loadOpenRouterConfig(): OpenRouterConfig {
  return {
    apiKey: getEnv('OPENROUTER_API_KEY'),
    baseUrl: getEnv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
    defaultModel: getEnv('OPENROUTER_DEFAULT_MODEL', 'anthropic/claude-3-sonnet'),
    maxRetries: getEnvNumber('OPENROUTER_MAX_RETRIES', 3),
    timeoutMs: getEnvNumber('OPENROUTER_TIMEOUT_MS', 30000),
  };
}
