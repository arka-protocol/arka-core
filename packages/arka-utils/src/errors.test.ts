/**
 * Errors Tests
 */

import { describe, it, expect } from 'vitest';
import {
  PactError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RuleEvaluationError,
  SchemaValidationError,
  AIGatewayError,
  ExternalServiceError,
  RateLimitError,
  isPactError,
  wrapError,
} from './errors.js';

describe('PactError', () => {
  it('should create error with message and code', () => {
    const error = new PactError('Something went wrong', 'GENERIC_ERROR');

    expect(error.message).toBe('Something went wrong');
    expect(error.code).toBe('GENERIC_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('PactError');
  });

  it('should create error with custom status code', () => {
    const error = new PactError('Bad request', 'BAD_REQUEST', 400);

    expect(error.statusCode).toBe(400);
  });

  it('should include additional details', () => {
    const error = new PactError('Error with details', 'DETAILED', 500, {
      field: 'email',
      reason: 'invalid format',
    });

    expect(error.details).toEqual({ field: 'email', reason: 'invalid format' });
  });

  it('should serialize to JSON', () => {
    const error = new PactError('Test error', 'TEST', 400, { extra: 'data' });
    const json = error.toJSON();

    expect(json.name).toBe('PactError');
    expect(json.code).toBe('TEST');
    expect(json.message).toBe('Test error');
    expect(json.statusCode).toBe(400);
    expect(json.details).toEqual({ extra: 'data' });
  });

  it('should have stack trace', () => {
    const error = new PactError('Test', 'TEST');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('PactError');
  });
});

describe('ValidationError', () => {
  it('should have 400 status code', () => {
    const error = new ValidationError('Invalid input');

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.name).toBe('ValidationError');
  });

  it('should accept details', () => {
    const error = new ValidationError('Validation failed', {
      errors: [
        { field: 'email', message: 'Invalid email format' },
        { field: 'age', message: 'Must be a positive number' },
      ],
    });

    expect(error.details?.errors).toHaveLength(2);
  });
});

describe('NotFoundError', () => {
  it('should have 404 status code', () => {
    const error = new NotFoundError('Resource');

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.name).toBe('NotFoundError');
  });

  it('should include resource name in message', () => {
    const error = new NotFoundError('User');
    expect(error.message).toBe('User not found');
  });

  it('should include resource ID in message when provided', () => {
    const error = new NotFoundError('User', '123');
    expect(error.message).toBe("User with ID '123' not found");
    expect(error.details).toEqual({ resource: 'User', id: '123' });
  });
});

describe('ConflictError', () => {
  it('should have 409 status code', () => {
    const error = new ConflictError('Resource already exists');

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.name).toBe('ConflictError');
  });

  it('should include details', () => {
    const error = new ConflictError('Duplicate key', { key: 'email' });
    expect(error.details).toEqual({ key: 'email' });
  });
});

describe('RuleEvaluationError', () => {
  it('should have 500 status code', () => {
    const error = new RuleEvaluationError('Rule failed to execute');

    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('RULE_EVALUATION_ERROR');
    expect(error.name).toBe('RuleEvaluationError');
  });

  it('should include rule ID', () => {
    const error = new RuleEvaluationError('Rule failed', 'rule-123');
    expect(error.details?.ruleId).toBe('rule-123');
  });

  it('should include additional details', () => {
    const error = new RuleEvaluationError('Rule failed', 'rule-123', {
      step: 'condition_evaluation',
    });
    expect(error.details).toEqual({
      ruleId: 'rule-123',
      step: 'condition_evaluation',
    });
  });
});

describe('SchemaValidationError', () => {
  it('should have 400 status code', () => {
    const error = new SchemaValidationError('Schema validation failed', []);

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('SCHEMA_VALIDATION_ERROR');
    expect(error.name).toBe('SchemaValidationError');
  });

  it('should include validation errors', () => {
    const errors = [
      { path: '/email', message: 'Invalid email format' },
      { path: '/age', message: 'Must be a number' },
    ];
    const error = new SchemaValidationError('Invalid schema', errors);

    expect(error.errors).toEqual(errors);
    expect(error.details?.errors).toEqual(errors);
  });
});

describe('AIGatewayError', () => {
  it('should have 502 status code', () => {
    const error = new AIGatewayError('AI service unavailable');

    expect(error.statusCode).toBe(502);
    expect(error.code).toBe('AI_GATEWAY_ERROR');
    expect(error.name).toBe('AIGatewayError');
  });

  it('should include details', () => {
    const error = new AIGatewayError('Model timeout', { model: 'gpt-4' });
    expect(error.details).toEqual({ model: 'gpt-4' });
  });
});

describe('ExternalServiceError', () => {
  it('should have 502 status code', () => {
    const error = new ExternalServiceError('PaymentGateway', 'Connection failed');

    expect(error.statusCode).toBe(502);
    expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
    expect(error.name).toBe('ExternalServiceError');
    expect(error.details?.service).toBe('PaymentGateway');
  });

  it('should include additional details', () => {
    const error = new ExternalServiceError('API', 'Timeout', {
      timeout: 30000,
      endpoint: '/v1/users',
    });
    expect(error.details).toEqual({
      service: 'API',
      timeout: 30000,
      endpoint: '/v1/users',
    });
  });
});

describe('RateLimitError', () => {
  it('should have 429 status code', () => {
    const error = new RateLimitError('Too many requests', 60000);

    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.name).toBe('RateLimitError');
  });

  it('should include retry after in milliseconds', () => {
    const error = new RateLimitError('Rate limit exceeded', 30000);

    expect(error.retryAfterMs).toBe(30000);
    expect(error.details?.retryAfterMs).toBe(30000);
  });
});

describe('isPactError', () => {
  it('should return true for PactError', () => {
    const error = new PactError('Test', 'TEST');
    expect(isPactError(error)).toBe(true);
  });

  it('should return true for ValidationError', () => {
    const error = new ValidationError('Test');
    expect(isPactError(error)).toBe(true);
  });

  it('should return true for all PactError subclasses', () => {
    expect(isPactError(new NotFoundError('Resource'))).toBe(true);
    expect(isPactError(new ConflictError('Conflict'))).toBe(true);
    expect(isPactError(new RateLimitError('Limit', 1000))).toBe(true);
    expect(isPactError(new AIGatewayError('AI Error'))).toBe(true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('Regular error');
    expect(isPactError(error)).toBe(false);
  });

  it('should return false for non-Error objects', () => {
    expect(isPactError('string')).toBe(false);
    expect(isPactError(null)).toBe(false);
    expect(isPactError(undefined)).toBe(false);
    expect(isPactError(123)).toBe(false);
    expect(isPactError({})).toBe(false);
  });
});

describe('wrapError', () => {
  it('should return PactError as-is', () => {
    const original = new ValidationError('Already a PactError');
    const wrapped = wrapError(original);

    expect(wrapped).toBe(original);
  });

  it('should wrap regular Error', () => {
    const original = new Error('Regular error');
    const wrapped = wrapError(original);

    expect(wrapped).toBeInstanceOf(PactError);
    expect(wrapped.message).toBe('Regular error');
    expect(wrapped.code).toBe('INTERNAL_ERROR');
    expect(wrapped.statusCode).toBe(500);
    expect(wrapped.details?.originalError).toBe('Error');
  });

  it('should wrap TypeError', () => {
    const original = new TypeError('Type mismatch');
    const wrapped = wrapError(original);

    expect(wrapped.message).toBe('Type mismatch');
    expect(wrapped.details?.originalError).toBe('TypeError');
  });

  it('should wrap string', () => {
    const wrapped = wrapError('String error');

    expect(wrapped.message).toBe('String error');
    expect(wrapped.code).toBe('INTERNAL_ERROR');
  });

  it('should wrap number', () => {
    const wrapped = wrapError(404);

    expect(wrapped.message).toBe('404');
  });

  it('should wrap null', () => {
    const wrapped = wrapError(null);

    expect(wrapped.message).toBe('null');
  });

  it('should wrap undefined', () => {
    const wrapped = wrapError(undefined);

    expect(wrapped.message).toBe('undefined');
  });

  it('should wrap object', () => {
    const wrapped = wrapError({ error: 'Something' });

    expect(wrapped.message).toBe('[object Object]');
  });
});
