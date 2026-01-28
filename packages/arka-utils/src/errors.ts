/**
 * ARKA Error Types
 *
 * Custom error classes for the ARKA system.
 */

/**
 * Base error class for all ARKA errors
 */
export class PactError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PactError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends PactError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Error for resource not found
 */
export class NotFoundError extends PactError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

/**
 * Error for duplicate resources
 */
export class ConflictError extends PactError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

/**
 * Error for rule evaluation failures
 */
export class RuleEvaluationError extends PactError {
  constructor(message: string, ruleId?: string, details?: Record<string, unknown>) {
    super(message, 'RULE_EVALUATION_ERROR', 500, { ruleId, ...details });
    this.name = 'RuleEvaluationError';
  }
}

/**
 * Error for schema validation failures
 */
export class SchemaValidationError extends PactError {
  public readonly errors: Array<{ path: string; message: string }>;

  constructor(message: string, errors: Array<{ path: string; message: string }>) {
    super(message, 'SCHEMA_VALIDATION_ERROR', 400, { errors });
    this.name = 'SchemaValidationError';
    this.errors = errors;
  }
}

/**
 * Error for AI gateway failures
 */
export class AIGatewayError extends PactError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AI_GATEWAY_ERROR', 502, details);
    this.name = 'AIGatewayError';
  }
}

/**
 * Error for external service failures
 */
export class ExternalServiceError extends PactError {
  constructor(service: string, message: string, details?: Record<string, unknown>) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, { service, ...details });
    this.name = 'ExternalServiceError';
  }
}

/**
 * Error for rate limiting
 */
export class RateLimitError extends PactError {
  public readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { retryAfterMs });
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Type guard to check if an error is a PactError
 */
export function isPactError(error: unknown): error is PactError {
  return error instanceof PactError;
}

/**
 * Wraps an unknown error in a PactError
 */
export function wrapError(error: unknown): PactError {
  if (isPactError(error)) {
    return error;
  }
  if (error instanceof Error) {
    return new PactError(error.message, 'INTERNAL_ERROR', 500, {
      originalError: error.name,
    });
  }
  return new PactError(String(error), 'INTERNAL_ERROR', 500);
}
