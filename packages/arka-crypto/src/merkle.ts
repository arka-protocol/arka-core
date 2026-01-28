/**
 * Merkle Tree Implementation
 *
 * Provides cryptographic proof of data integrity for ARKA audit records.
 * Used to anchor decision batches to blockchain.
 */

import { createHash } from 'crypto';
import { canonicalSerialize } from './canonical.js';

/**
 * Hash algorithm to use
 */
export type HashAlgorithm = 'sha256' | 'sha384' | 'sha512';

/**
 * A node in the Merkle tree
 */
export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  data?: unknown;
  index?: number;
}

/**
 * Proof of inclusion in a Merkle tree
 */
export interface MerkleProof {
  /** The leaf being proven */
  leaf: string;
  /** Index of the leaf in the tree */
  leafIndex: number;
  /** Proof path (sibling hashes) */
  proof: Array<{
    hash: string;
    position: 'left' | 'right';
  }>;
  /** Root hash of the tree */
  root: string;
}

/**
 * Hashes data using the specified algorithm
 */
export function hashData(data: unknown, algorithm: HashAlgorithm = 'sha256'): string {
  const bytes = Buffer.isBuffer(data) ? data : canonicalSerialize(data);
  return createHash(algorithm).update(bytes).digest('hex');
}

/**
 * Hashes two child hashes to create parent hash
 */
export function hashPair(left: string, right: string, algorithm: HashAlgorithm = 'sha256'): string {
  // Sort hashes to ensure consistent ordering regardless of position
  const combined = left < right ? left + right : right + left;
  return createHash(algorithm).update(combined, 'hex').digest('hex');
}

/**
 * Builds a Merkle tree from a list of data items
 */
export function buildMerkleTree(
  items: unknown[],
  algorithm: HashAlgorithm = 'sha256'
): MerkleNode {
  if (items.length === 0) {
    return { hash: hashData('', algorithm) };
  }

  // Create leaf nodes
  let nodes: MerkleNode[] = items.map((data, index) => ({
    hash: hashData(data, algorithm),
    data,
    index,
  }));

  // If odd number of nodes, duplicate the last one
  if (nodes.length % 2 === 1 && nodes.length > 1) {
    nodes.push({ ...nodes[nodes.length - 1]! });
  }

  // Build tree bottom-up
  while (nodes.length > 1) {
    const nextLevel: MerkleNode[] = [];

    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i]!;
      const right = nodes[i + 1] ?? left; // Handle odd case

      nextLevel.push({
        hash: hashPair(left.hash, right.hash, algorithm),
        left,
        right: nodes[i + 1] ? right : undefined,
      });
    }

    nodes = nextLevel;
  }

  return nodes[0]!;
}

/**
 * Gets the root hash of a Merkle tree
 */
export function getMerkleRoot(items: unknown[], algorithm: HashAlgorithm = 'sha256'): string {
  return buildMerkleTree(items, algorithm).hash;
}

/**
 * Generates a proof of inclusion for a specific item
 */
export function generateMerkleProof(
  items: unknown[],
  index: number,
  algorithm: HashAlgorithm = 'sha256'
): MerkleProof {
  if (index < 0 || index >= items.length) {
    throw new Error(`Invalid index: ${index}`);
  }

  const leafHash = hashData(items[index], algorithm);
  const proof: MerkleProof['proof'] = [];

  // Create leaf hashes
  let hashes = items.map((item) => hashData(item, algorithm));

  // If odd, duplicate last
  if (hashes.length % 2 === 1 && hashes.length > 1) {
    hashes.push(hashes[hashes.length - 1]!);
  }

  let currentIndex = index;

  // Build proof path
  while (hashes.length > 1) {
    const nextLevel: string[] = [];

    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i]!;
      const right = hashes[i + 1] ?? left;

      nextLevel.push(hashPair(left, right, algorithm));

      // If this pair contains our target, add sibling to proof
      if (i === currentIndex || i + 1 === currentIndex) {
        if (currentIndex % 2 === 0) {
          // We're on the left, add right sibling
          proof.push({
            hash: right,
            position: 'right',
          });
        } else {
          // We're on the right, add left sibling
          proof.push({
            hash: left,
            position: 'left',
          });
        }
      }
    }

    hashes = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    leaf: leafHash,
    leafIndex: index,
    proof,
    root: hashes[0]!,
  };
}

/**
 * Verifies a Merkle proof
 */
export function verifyMerkleProof(
  proof: MerkleProof,
  algorithm: HashAlgorithm = 'sha256'
): boolean {
  let currentHash = proof.leaf;

  for (const step of proof.proof) {
    if (step.position === 'left') {
      currentHash = hashPair(step.hash, currentHash, algorithm);
    } else {
      currentHash = hashPair(currentHash, step.hash, algorithm);
    }
  }

  return currentHash === proof.root;
}

/**
 * Verifies that specific data is in the tree
 */
export function verifyDataInTree(
  data: unknown,
  proof: MerkleProof,
  algorithm: HashAlgorithm = 'sha256'
): boolean {
  const dataHash = hashData(data, algorithm);
  if (dataHash !== proof.leaf) {
    return false;
  }
  return verifyMerkleProof(proof, algorithm);
}

/**
 * Batch of items with their Merkle root
 */
export interface MerkleBatch<T = unknown> {
  /** Unique batch identifier */
  batchId: string;
  /** Items in the batch */
  items: T[];
  /** Merkle root of the batch */
  root: string;
  /** Timestamp when batch was created */
  timestamp: string;
  /** Number of items */
  count: number;
  /** Hash algorithm used */
  algorithm: HashAlgorithm;
}

/**
 * Creates a Merkle batch from items
 */
export function createMerkleBatch<T>(
  batchId: string,
  items: T[],
  algorithm: HashAlgorithm = 'sha256'
): MerkleBatch<T> {
  return {
    batchId,
    items,
    root: getMerkleRoot(items, algorithm),
    timestamp: new Date().toISOString(),
    count: items.length,
    algorithm,
  };
}
