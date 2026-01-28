/**
 * ARKA ID Generation Utilities
 *
 * Utilities for generating unique identifiers.
 */

import { randomUUID } from 'crypto';

/**
 * Generates a unique identifier using UUID v4
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Generates a prefixed identifier
 * @param prefix - The prefix to use (e.g., "evt", "dec", "rul")
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

/**
 * Predefined ID generators for common entity types
 */
export const ids = {
  event: () => generatePrefixedId('evt'),
  decision: () => generatePrefixedId('dec'),
  rule: () => generatePrefixedId('rul'),
  entity: () => generatePrefixedId('ent'),
  audit: () => generatePrefixedId('aud'),
  proposal: () => generatePrefixedId('prp'),
  simulation: () => generatePrefixedId('sim'),
  request: () => generatePrefixedId('req'),
};

/**
 * Validates that a string looks like a valid ARKA ID
 */
export function isValidId(id: string): boolean {
  // Accept both plain UUIDs and prefixed IDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const prefixedRegex = /^[a-z]{3}_[0-9a-f]{32}$/i;
  return uuidRegex.test(id) || prefixedRegex.test(id);
}

/**
 * Extracts the prefix from a prefixed ID
 */
export function getIdPrefix(id: string): string | null {
  const match = id.match(/^([a-z]{3})_/i);
  return match?.[1] ?? null;
}
