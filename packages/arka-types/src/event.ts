/**
 * Canonical ARKA Event Format
 *
 * Events are the primary input to the ARKA system. They represent
 * domain-specific occurrences that need to be evaluated against rules.
 */

/**
 * Represents a canonical event in the ARKA system.
 * All domain-specific events must be converted to this format.
 */
export interface ArkaEvent {
  /** Unique identifier for the event */
  id: string;

  /** Source system that generated the event (e.g., "arka-loans", "arka-tariff") */
  source: string;

  /** Type of the event (e.g., "LOAN_CREATED", "SHIPMENT_DECLARED") */
  type: string;

  /** ID of the related entity, if applicable */
  entityId?: string | null;

  /** Type of the related entity (e.g., "Loan", "Shipment") */
  entityType?: string | null;

  /** Jurisdiction code (e.g., "US-CA", "EU", "IN") */
  jurisdiction?: string | null;

  /** Domain-specific payload data */
  payload: Record<string, unknown>;

  /** ISO timestamp when the event occurred */
  occurredAt: string;

  /** ISO timestamp when the event was received by ARKA */
  receivedAt: string;
}

/**
 * Input DTO for creating a new event
 */
export interface CreateEventInput {
  source: string;
  type: string;
  entityId?: string | null;
  entityType?: string | null;
  jurisdiction?: string | null;
  payload: Record<string, unknown>;
  occurredAt?: string;
}
