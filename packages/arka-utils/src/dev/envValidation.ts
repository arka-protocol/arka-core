/**
 * Environment Validation
 *
 * Utilities for validating environment configuration at startup.
 */

/**
 * Environment variable definition
 */
export interface EnvVarDefinition {
  name: string;
  required?: boolean;
  default?: string;
  type?: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'json';
  pattern?: RegExp;
  enum?: string[];
  sensitive?: boolean;
  description?: string;
  transform?: (value: string) => unknown;
}

/**
 * Validation result
 */
export interface EnvValidationResult {
  valid: boolean;
  errors: EnvValidationError[];
  warnings: EnvValidationWarning[];
  values: Record<string, unknown>;
}

export interface EnvValidationError {
  variable: string;
  message: string;
  expected?: string;
  received?: string;
}

export interface EnvValidationWarning {
  variable: string;
  message: string;
}

/**
 * Validate environment variables against schema
 */
export function validateEnv(
  definitions: EnvVarDefinition[],
  env: Record<string, string | undefined> = process.env
): EnvValidationResult {
  const errors: EnvValidationError[] = [];
  const warnings: EnvValidationWarning[] = [];
  const values: Record<string, unknown> = {};

  for (const def of definitions) {
    const rawValue = env[def.name];
    const value = rawValue ?? def.default;

    // Check required
    if (def.required !== false && value === undefined) {
      errors.push({
        variable: def.name,
        message: `Required environment variable '${def.name}' is not set`,
      });
      continue;
    }

    // Skip if not set and not required
    if (value === undefined) {
      continue;
    }

    // Type validation
    const typeError = validateType(def, value);
    if (typeError) {
      errors.push(typeError);
      continue;
    }

    // Pattern validation
    if (def.pattern && !def.pattern.test(value)) {
      errors.push({
        variable: def.name,
        message: `Value doesn't match required pattern`,
        expected: def.pattern.toString(),
        received: def.sensitive ? '[REDACTED]' : value,
      });
      continue;
    }

    // Enum validation
    if (def.enum && !def.enum.includes(value)) {
      errors.push({
        variable: def.name,
        message: `Value must be one of: ${def.enum.join(', ')}`,
        received: def.sensitive ? '[REDACTED]' : value,
      });
      continue;
    }

    // Transform and store value
    try {
      values[def.name] = def.transform
        ? def.transform(value)
        : transformValue(value, def.type);
    } catch (e) {
      errors.push({
        variable: def.name,
        message: `Failed to transform value: ${e instanceof Error ? e.message : 'Unknown error'}`,
      });
    }
  }

  // Check for sensitive vars in production without encryption
  const isProduction = env.NODE_ENV === 'production';
  if (isProduction) {
    for (const def of definitions) {
      if (def.sensitive && values[def.name]) {
        const value = String(values[def.name]);
        // Warn if it looks like a plain text secret
        if (!value.startsWith('enc:') && !value.startsWith('arn:')) {
          warnings.push({
            variable: def.name,
            message: `Sensitive variable '${def.name}' appears to be plain text in production`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    values,
  };
}

/**
 * Validate value type
 */
function validateType(def: EnvVarDefinition, value: string): EnvValidationError | null {
  switch (def.type) {
    case 'number': {
      const num = Number(value);
      if (isNaN(num)) {
        return {
          variable: def.name,
          message: 'Expected a number',
          received: def.sensitive ? '[REDACTED]' : value,
        };
      }
      break;
    }

    case 'boolean': {
      const lower = value.toLowerCase();
      if (!['true', 'false', '1', '0', 'yes', 'no'].includes(lower)) {
        return {
          variable: def.name,
          message: 'Expected a boolean (true/false, 1/0, yes/no)',
          received: def.sensitive ? '[REDACTED]' : value,
        };
      }
      break;
    }

    case 'url': {
      try {
        new URL(value);
      } catch {
        return {
          variable: def.name,
          message: 'Expected a valid URL',
          received: def.sensitive ? '[REDACTED]' : value,
        };
      }
      break;
    }

    case 'email': {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        return {
          variable: def.name,
          message: 'Expected a valid email address',
          received: def.sensitive ? '[REDACTED]' : value,
        };
      }
      break;
    }

    case 'json': {
      try {
        JSON.parse(value);
      } catch {
        return {
          variable: def.name,
          message: 'Expected valid JSON',
          received: def.sensitive ? '[REDACTED]' : value.slice(0, 50) + '...',
        };
      }
      break;
    }
  }

  return null;
}

/**
 * Transform string value to appropriate type
 */
function transformValue(value: string, type?: string): unknown {
  switch (type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return ['true', '1', 'yes'].includes(value.toLowerCase());
    case 'json':
      return JSON.parse(value);
    default:
      return value;
  }
}

/**
 * Format validation result for display
 */
export function formatEnvValidationResult(result: EnvValidationResult, colors = true): string {
  const colorize = (str: string, color: string): string => {
    if (!colors) return str;
    const codes: Record<string, string> = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      cyan: '\x1b[36m',
    };
    return `${codes[color] || ''}${str}${codes.reset}`;
  };

  const lines: string[] = [];

  if (result.valid) {
    lines.push(colorize('✓ Environment validation passed', 'green'));
  } else {
    lines.push(colorize('✗ Environment validation failed', 'red'));
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push(colorize('Errors:', 'red'));
    for (const error of result.errors) {
      lines.push(`  • ${error.variable}: ${error.message}`);
      if (error.expected) {
        lines.push(`    Expected: ${error.expected}`);
      }
      if (error.received) {
        lines.push(`    Received: ${error.received}`);
      }
    }
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push(colorize('Warnings:', 'yellow'));
    for (const warning of result.warnings) {
      lines.push(`  • ${warning.variable}: ${warning.message}`);
    }
  }

  return lines.join('\n');
}

/**
 * Create a typed environment configuration
 */
export function createEnvConfig<T extends Record<string, EnvVarDefinition>>(
  schema: T
): EnvConfig<T> {
  const definitions = Object.entries(schema).map(([, def]) => def);
  const result = validateEnv(definitions);

  if (!result.valid) {
    const formatted = formatEnvValidationResult(result);
    console.error(formatted);
    throw new Error('Environment validation failed');
  }

  // Show warnings but continue
  if (result.warnings.length > 0) {
    console.warn(formatEnvValidationResult(result));
  }

  // Create typed config object
  const config = {} as Record<string, unknown>;
  for (const [key, def] of Object.entries(schema)) {
    config[key] = result.values[def.name];
  }

  return config as EnvConfig<T>;
}

// Type helper for createEnvConfig
type EnvConfig<T extends Record<string, EnvVarDefinition>> = {
  [K in keyof T]: T[K]['type'] extends 'number'
    ? number
    : T[K]['type'] extends 'boolean'
      ? boolean
      : T[K]['type'] extends 'json'
        ? unknown
        : string;
};

/**
 * Common environment variable definitions
 */
export const commonEnvVars = {
  nodeEnv: {
    name: 'NODE_ENV',
    default: 'development',
    enum: ['development', 'test', 'staging', 'production'],
    description: 'Application environment',
  } as EnvVarDefinition,

  port: {
    name: 'PORT',
    type: 'number',
    default: '3000',
    description: 'Server port',
  } as EnvVarDefinition,

  logLevel: {
    name: 'LOG_LEVEL',
    default: 'info',
    enum: ['debug', 'info', 'warn', 'error'],
    description: 'Logging level',
  } as EnvVarDefinition,

  databaseUrl: {
    name: 'DATABASE_URL',
    type: 'url',
    required: true,
    sensitive: true,
    description: 'PostgreSQL connection URL',
  } as EnvVarDefinition,

  redisUrl: {
    name: 'REDIS_URL',
    type: 'url',
    sensitive: true,
    description: 'Redis connection URL',
  } as EnvVarDefinition,

  jwtSecret: {
    name: 'JWT_SECRET',
    required: true,
    sensitive: true,
    pattern: /^.{32,}$/,
    description: 'JWT signing secret (min 32 characters)',
  } as EnvVarDefinition,
};

/**
 * Validate and throw on startup
 */
export function requireEnv(
  definitions: EnvVarDefinition[],
  options: { exitOnError?: boolean } = {}
): Record<string, unknown> {
  const result = validateEnv(definitions);

  if (!result.valid) {
    console.error(formatEnvValidationResult(result));

    if (options.exitOnError !== false) {
      process.exit(1);
    }

    throw new Error('Environment validation failed');
  }

  if (result.warnings.length > 0) {
    console.warn(formatEnvValidationResult(result));
  }

  return result.values;
}

/**
 * Generate .env.example from definitions
 */
export function generateEnvExample(definitions: EnvVarDefinition[]): string {
  const lines: string[] = [
    '# Environment Configuration',
    '# Copy this file to .env and fill in the values',
    '',
  ];

  for (const def of definitions) {
    if (def.description) {
      lines.push(`# ${def.description}`);
    }

    let example = '';
    if (def.default) {
      example = def.default;
    } else if (def.enum) {
      example = def.enum[0]!;
    } else if (def.type === 'url') {
      example = 'https://example.com';
    } else if (def.type === 'email') {
      example = 'user@example.com';
    } else if (def.type === 'number') {
      example = '0';
    } else if (def.type === 'boolean') {
      example = 'true';
    } else if (def.sensitive) {
      example = 'your-secret-here';
    } else {
      example = 'value';
    }

    const required = def.required !== false ? '' : ' # optional';
    lines.push(`${def.name}=${example}${required}`);
    lines.push('');
  }

  return lines.join('\n');
}
