/**
 * ARKA Hash Utilities
 *
 * Utilities for generating hashes for integrity verification.
 */

import { createHash } from 'crypto';

/**
 * Generates a SHA-256 hash of the given data
 */
export function sha256(data: string | object): string {
  const input = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Generates an integrity hash for an audit record
 */
export function generateIntegrityHash(
  entitySnapshot: unknown,
  eventSnapshot: unknown,
  rulesetSnapshot: unknown,
  context: unknown
): string {
  const payload = {
    entitySnapshot,
    eventSnapshot,
    rulesetSnapshot,
    context,
  };
  return sha256(JSON.stringify(payload));
}

/**
 * Verifies an integrity hash
 */
export function verifyIntegrityHash(
  expectedHash: string,
  entitySnapshot: unknown,
  eventSnapshot: unknown,
  rulesetSnapshot: unknown,
  context: unknown
): boolean {
  const actualHash = generateIntegrityHash(
    entitySnapshot,
    eventSnapshot,
    rulesetSnapshot,
    context
  );
  return actualHash === expectedHash;
}
