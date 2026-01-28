/**
 * ARKA Entity Types
 *
 * Entities are the subjects of rule evaluations (e.g., Loans, Shipments, Vehicles).
 * Entity types define the schema and structure for validation.
 */

import type { JSONSchema } from './schema.js';

/**
 * Defines a type of entity in the ARKA system.
 * Entity types include a JSON schema for validation.
 */
export interface ArkaEntityType {
  /** Unique name for the entity type (e.g., "Loan", "Shipment", "Vehicle") */
  name: string;

  /** Human-readable description */
  description?: string;

  /** JSON Schema for validating entities of this type */
  schema: JSONSchema;

  /** Additional metadata */
  metadata: Record<string, unknown>;

  /** ISO timestamp when the entity type was created */
  createdAt?: string;

  /** ISO timestamp when the entity type was last updated */
  updatedAt?: string;
}

/**
 * Represents a specific entity instance in the ARKA system.
 */
export interface ArkaEntity {
  /** Unique identifier for the entity */
  id: string;

  /** References ArkaEntityType.name */
  type: string;

  /** Jurisdiction code (e.g., "US-CA", "EU", "IN") */
  jurisdiction?: string | null;

  /** Entity data that conforms to the entity type schema */
  data: Record<string, unknown>;

  /** ISO timestamp when the entity was created */
  createdAt: string;

  /** ISO timestamp when the entity was last updated */
  updatedAt: string;
}

/**
 * Input DTO for creating or updating an entity
 */
export interface CreateEntityInput {
  type: string;
  jurisdiction?: string | null;
  data: Record<string, unknown>;
}

/**
 * Input DTO for updating an existing entity
 */
export interface UpdateEntityInput {
  jurisdiction?: string | null;
  data?: Record<string, unknown>;
}
