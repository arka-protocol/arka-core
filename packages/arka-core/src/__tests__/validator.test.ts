/**
 * Tests for Entity Validator
 */

import { describe, it, expect } from 'vitest';
import {
  validateAgainstSchema,
  validateEntity,
  validateEntityOrThrow,
  validateEntityData,
  validateEntityDataOrThrow,
  validateSchema,
  createValidator,
} from '../validator.js';
import type { ArkaEntity, ArkaEntityType, JSONSchema } from '@arka/types';

// Test schemas
const customerSchema: JSONSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
    age: { type: 'number', minimum: 0, maximum: 150 },
    tier: { type: 'string', enum: ['bronze', 'silver', 'gold'] },
    isActive: { type: 'boolean' },
    metadata: {
      type: 'object',
      properties: {
        source: { type: 'string' },
        createdAt: { type: 'string' },
      },
    },
  },
  required: ['name', 'email'],
  additionalProperties: false,
};

const customerEntityType: ArkaEntityType = {
  name: 'Customer',
  description: 'A customer entity',
  schema: customerSchema,
  metadata: {},
};

describe('validateAgainstSchema', () => {
  it('should validate valid data against schema', () => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
    };

    const result = validateAgainstSchema(data, customerSchema);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject data missing required fields', () => {
    const data = {
      name: 'John Doe',
      // missing email
    };

    const result = validateAgainstSchema(data, customerSchema);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.message.includes('email') || e.path.includes('email'))).toBe(true);
  });

  it('should reject data with wrong types', () => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 'thirty', // should be number
    };

    const result = validateAgainstSchema(data, customerSchema);

    expect(result.valid).toBe(false);
  });

  it('should reject data with invalid enum values', () => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      tier: 'platinum', // not in enum
    };

    const result = validateAgainstSchema(data, customerSchema);

    expect(result.valid).toBe(false);
  });

  it('should validate nested objects', () => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      metadata: {
        source: 'web',
        createdAt: '2024-01-01',
      },
    };

    const result = validateAgainstSchema(data, customerSchema);

    expect(result.valid).toBe(true);
  });

  it('should reject out of range numbers', () => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      age: -5, // minimum is 0
    };

    const result = validateAgainstSchema(data, customerSchema);

    expect(result.valid).toBe(false);
  });
});

describe('validateEntity', () => {
  it('should validate a valid entity', () => {
    const entity: ArkaEntity = {
      id: 'customer-1',
      type: 'Customer',
      data: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = validateEntity(entity, customerEntityType);

    expect(result.valid).toBe(true);
  });

  it('should reject an invalid entity', () => {
    const entity: ArkaEntity = {
      id: 'customer-1',
      type: 'Customer',
      data: {
        name: '', // minLength is 1
        email: 'john@example.com',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = validateEntity(entity, customerEntityType);

    expect(result.valid).toBe(false);
  });
});

describe('validateEntityOrThrow', () => {
  it('should not throw for valid entity', () => {
    const entity: ArkaEntity = {
      id: 'customer-1',
      type: 'Customer',
      data: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(() => validateEntityOrThrow(entity, customerEntityType)).not.toThrow();
  });

  it('should throw for invalid entity', () => {
    const entity: ArkaEntity = {
      id: 'customer-1',
      type: 'Customer',
      data: {
        // missing required fields
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(() => validateEntityOrThrow(entity, customerEntityType)).toThrow();
  });

  it('should throw SchemaValidationError with details', () => {
    const entity: ArkaEntity = {
      id: 'customer-1',
      type: 'Customer',
      data: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      validateEntityOrThrow(entity, customerEntityType);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Customer');
    }
  });
});

describe('validateEntityData', () => {
  it('should validate raw data against entity type schema', () => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
    };

    const result = validateEntityData(data, customerEntityType);

    expect(result.valid).toBe(true);
  });

  it('should reject invalid data', () => {
    const data = {
      name: 123, // should be string
      email: 'john@example.com',
    };

    const result = validateEntityData(data as unknown as Record<string, unknown>, customerEntityType);

    expect(result.valid).toBe(false);
  });
});

describe('validateEntityDataOrThrow', () => {
  it('should not throw for valid data', () => {
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
    };

    expect(() => validateEntityDataOrThrow(data, customerEntityType)).not.toThrow();
  });

  it('should throw for invalid data', () => {
    const data = {};

    expect(() => validateEntityDataOrThrow(data, customerEntityType)).toThrow();
  });
});

describe('validateSchema', () => {
  it('should validate a valid JSON Schema', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    };

    const result = validateSchema(schema);

    expect(result.valid).toBe(true);
  });

  it('should reject an invalid JSON Schema', () => {
    const schema = {
      type: 'invalid-type', // not a valid JSON Schema type
    } as unknown as JSONSchema;

    const result = validateSchema(schema);

    expect(result.valid).toBe(false);
  });
});

describe('createValidator', () => {
  it('should create a reusable validator function', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        amount: { type: 'number', minimum: 0 },
        currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'] },
      },
      required: ['amount', 'currency'],
    };

    const validate = createValidator(schema);

    // Valid data
    expect(validate({ amount: 100, currency: 'USD' }).valid).toBe(true);
    expect(validate({ amount: 0, currency: 'EUR' }).valid).toBe(true);

    // Invalid data
    expect(validate({ amount: -1, currency: 'USD' }).valid).toBe(false);
    expect(validate({ amount: 100, currency: 'YEN' }).valid).toBe(false);
    expect(validate({ amount: 100 }).valid).toBe(false);
  });

  it('should return errors for invalid data', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    };

    const validate = createValidator(schema);
    const result = validate({});

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('Edge cases', () => {
  it('should handle empty objects', () => {
    const schema: JSONSchema = {
      type: 'object',
    };

    const result = validateAgainstSchema({}, schema);
    expect(result.valid).toBe(true);
  });

  it('should handle arrays', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
        },
      },
      required: ['items'],
    };

    expect(validateAgainstSchema({ items: ['a', 'b'] }, schema).valid).toBe(true);
    expect(validateAgainstSchema({ items: [] }, schema).valid).toBe(false);
    expect(validateAgainstSchema({ items: [1, 2] }, schema).valid).toBe(false);
  });

  it('should handle null values', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        value: { type: ['string', 'null'] },
      },
    };

    expect(validateAgainstSchema({ value: 'test' }, schema).valid).toBe(true);
    expect(validateAgainstSchema({ value: null }, schema).valid).toBe(true);
  });

  it('should handle deeply nested objects', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        level1: {
          type: 'object',
          properties: {
            level2: {
              type: 'object',
              properties: {
                level3: {
                  type: 'object',
                  properties: {
                    value: { type: 'string' },
                  },
                  required: ['value'],
                },
              },
            },
          },
        },
      },
    };

    const validData = {
      level1: {
        level2: {
          level3: {
            value: 'deep',
          },
        },
      },
    };

    const invalidData = {
      level1: {
        level2: {
          level3: {
            value: 123, // should be string
          },
        },
      },
    };

    expect(validateAgainstSchema(validData, schema).valid).toBe(true);
    expect(validateAgainstSchema(invalidData, schema).valid).toBe(false);
  });
});
