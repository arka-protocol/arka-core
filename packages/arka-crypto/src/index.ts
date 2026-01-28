/**
 * ARKA Crypto
 *
 * Cryptographic utilities for blockchain integration and data integrity.
 *
 * @packageDocumentation
 */

// Canonical serialization for consensus
export {
  canonicalStringify,
  canonicalSerialize,
  canonicalParse,
  canonicalEquals,
  toSignableBytes,
  type CanonicalOptions,
} from './canonical.js';

// Merkle tree for cryptographic proofs
export {
  hashData,
  hashPair,
  buildMerkleTree,
  getMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  verifyDataInTree,
  createMerkleBatch,
  type HashAlgorithm,
  type MerkleNode,
  type MerkleProof,
  type MerkleBatch,
} from './merkle.js';

// Append-only event log
export {
  AppendOnlyEventLog,
  getGlobalEventLog,
  resetGlobalEventLog,
  type PactLogEventType,
  type LogEntry,
  type StateCheckpoint,
  type EventLogOptions,
} from './event-log.js';

// Zero-Knowledge Proofs
export * from './zk/index.js';
