/**
 * ARKA Entity Validator
 *
 * Validates entities against their type schemas using JSON Schema.
 */

import Ajv, { type ErrorObject } from 'ajv';
import type { ArkaEntity, ArkaEntityType, JSONSchema } from '@arka/types';
import { SchemaValidationError } from '@arka/utils';

// Create a single Ajv instance for reuse
const ajv = new Ajv({
  allErrors: true,
  strict: false,
  validateFormats: false,
});

/**
 * Schema validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
}

/**
 * Converts Ajv errors to a simpler format
 */
function formatErrors(errors: ErrorObject[] | null | undefined): Array<{ path: string; message: string }> {
  if (!errors) return [];
  return errors.map((err) => ({
    path: err.instancePath || '/',
    message: err.message || 'Unknown validation error',
  }));
}

/**
 * Validates data against a JSON Schema
 */
export function validateAgainstSchema(
  data: Record<string, unknown>,
  schema: JSONSchema
): ValidationResult {
  const validate = ajv.compile(schema);
  const valid = validate(data);

  return {
    valid: !!valid,
    errors: formatErrors(validate.errors),
  };
}

/**
 * Validates an entity against its type schema
 */
export function validateEntity(
  entity: ArkaEntity,
  entityType: ArkaEntityType
): ValidationResult {
  return validateAgainstSchema(entity.data, entityType.schema);
}

/**
 * Validates an entity and throws if invalid
 */
export function validateEntityOrThrow(
  entity: ArkaEntity,
  entityType: ArkaEntityType
): void {
  const result = validateEntity(entity, entityType);
  if (!result.valid) {
    throw new SchemaValidationError(
      `Entity validation failed for type '${entityType.name}'`,
      result.errors
    );
  }
}

/**
 * Validates entity data against a type schema (for creation)
 */
export function validateEntityData(
  data: Record<string, unknown>,
  entityType: ArkaEntityType
): ValidationResult {
  return validateAgainstSchema(data, entityType.schema);
}

/**
 * Validates entity data and throws if invalid
 */
export function validateEntityDataOrThrow(
  data: Record<string, unknown>,
  entityType: ArkaEntityType
): void {
  const result = validateEntityData(data, entityType);
  if (!result.valid) {
    throw new SchemaValidationError(
      `Entity data validation failed for type '${entityType.name}'`,
      result.errors
    );
  }
}

/**
 * Validates a JSON Schema definition itself
 */
export function validateSchema(schema: JSONSchema): ValidationResult {
  try {
    ajv.compile(schema);
    return { valid: true, errors: [] };
  } catch (error) {
    return {
      valid: false,
      errors: [{ path: '/', message: error instanceof Error ? error.message : 'Invalid schema' }],
    };
  }
}

/**
 * Creates a validator function for a specific schema
 */
export function createValidator(schema: JSONSchema): (data: unknown) => ValidationResult {
  const validate = ajv.compile(schema);
  return (data: unknown) => {
    const valid = validate(data);
    return {
      valid: !!valid,
      errors: formatErrors(validate.errors),
    };
  };
}
