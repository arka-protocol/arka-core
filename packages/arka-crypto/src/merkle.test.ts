/**
 * Merkle Tree Tests
 */

import { describe, it, expect } from 'vitest';
import {
  hashData,
  hashPair,
  buildMerkleTree,
  getMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  verifyDataInTree,
  createMerkleBatch,
} from './merkle.js';

describe('Merkle Tree', () => {
  describe('hashData', () => {
    it('should hash strings consistently', () => {
      const hash1 = hashData('test data');
      const hash2 = hashData('test data');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', () => {
      const hash1 = hashData('data 1');
      const hash2 = hashData('data 2');
      expect(hash1).not.toBe(hash2);
    });

    it('should hash objects using canonical serialization', () => {
      const hash1 = hashData({ z: 1, a: 2 });
      const hash2 = hashData({ a: 2, z: 1 });
      expect(hash1).toBe(hash2);
    });

    it('should produce 64-char hex for sha256', () => {
      const hash = hashData('test', 'sha256');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce 96-char hex for sha384', () => {
      const hash = hashData('test', 'sha384');
      expect(hash).toMatch(/^[0-9a-f]{96}$/);
    });

    it('should produce 128-char hex for sha512', () => {
      const hash = hashData('test', 'sha512');
      expect(hash).toMatch(/^[0-9a-f]{128}$/);
    });

    it('should hash Buffer directly', () => {
      const buffer = Buffer.from('test');
      const hash = hashData(buffer);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('hashPair', () => {
    it('should produce consistent hash regardless of order', () => {
      const hash1 = hashPair('aaa', 'bbb');
      const hash2 = hashPair('bbb', 'aaa');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different pairs', () => {
      const hash1 = hashPair('aaa', 'bbb');
      const hash2 = hashPair('aaa', 'ccc');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('buildMerkleTree', () => {
    it('should build tree for single item', () => {
      const items = [{ id: 1 }];
      const tree = buildMerkleTree(items);
      expect(tree.hash).toBe(hashData(items[0]));
      expect(tree.data).toEqual(items[0]);
    });

    it('should build tree for two items', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const tree = buildMerkleTree(items);

      const leftHash = hashData(items[0]);
      const rightHash = hashData(items[1]);
      const expectedRoot = hashPair(leftHash, rightHash);

      expect(tree.hash).toBe(expectedRoot);
      expect(tree.left?.hash).toBe(leftHash);
      expect(tree.right?.hash).toBe(rightHash);
    });

    it('should handle odd number of items', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const tree = buildMerkleTree(items);
      expect(tree.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle empty array', () => {
      const tree = buildMerkleTree([]);
      expect(tree.hash).toBe(hashData(''));
    });

    it('should handle large number of items', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const tree = buildMerkleTree(items);
      expect(tree.hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('getMerkleRoot', () => {
    it('should return root hash for items', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const root = getMerkleRoot(items);
      expect(root).toBe(buildMerkleTree(items).hash);
    });

    it('should be deterministic', () => {
      const items = [{ a: 1 }, { b: 2 }, { c: 3 }];
      const roots = Array.from({ length: 10 }, () => getMerkleRoot(items));
      const unique = new Set(roots);
      expect(unique.size).toBe(1);
    });
  });

  describe('generateMerkleProof', () => {
    it('should generate valid proof for first item', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const proof = generateMerkleProof(items, 0);

      expect(proof.leaf).toBe(hashData(items[0]));
      expect(proof.leafIndex).toBe(0);
      expect(proof.root).toBe(getMerkleRoot(items));
      expect(proof.proof.length).toBeGreaterThan(0);
    });

    it('should generate valid proof for last item', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const proof = generateMerkleProof(items, 3);

      expect(proof.leaf).toBe(hashData(items[3]));
      expect(proof.leafIndex).toBe(3);
      expect(proof.root).toBe(getMerkleRoot(items));
    });

    it('should generate valid proof for middle item', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const proof = generateMerkleProof(items, 2);

      expect(proof.leaf).toBe(hashData(items[2]));
      expect(proof.leafIndex).toBe(2);
    });

    it('should throw for invalid index', () => {
      const items = [{ id: 1 }, { id: 2 }];
      expect(() => generateMerkleProof(items, -1)).toThrow('Invalid index');
      expect(() => generateMerkleProof(items, 2)).toThrow('Invalid index');
    });

    it('should handle single item', () => {
      const items = [{ id: 1 }];
      const proof = generateMerkleProof(items, 0);

      expect(proof.leaf).toBe(hashData(items[0]));
      expect(proof.proof.length).toBe(0);
    });

    it('should handle odd number of items', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const proof = generateMerkleProof(items, 2);

      expect(proof.root).toBe(getMerkleRoot(items));
    });
  });

  describe('verifyMerkleProof', () => {
    it('should verify valid proof', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

      for (let i = 0; i < items.length; i++) {
        const proof = generateMerkleProof(items, i);
        expect(verifyMerkleProof(proof)).toBe(true);
      }
    });

    it('should reject proof with wrong leaf', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const proof = generateMerkleProof(items, 0);

      // Tamper with leaf
      proof.leaf = hashData({ id: 999 });

      expect(verifyMerkleProof(proof)).toBe(false);
    });

    it('should reject proof with wrong root', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const proof = generateMerkleProof(items, 0);

      // Tamper with root
      proof.root = hashData({ fake: true });

      expect(verifyMerkleProof(proof)).toBe(false);
    });

    it('should reject proof with tampered sibling', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const proof = generateMerkleProof(items, 0);

      // Tamper with proof path
      if (proof.proof.length > 0) {
        proof.proof[0].hash = 'tampered';
      }

      expect(verifyMerkleProof(proof)).toBe(false);
    });
  });

  describe('verifyDataInTree', () => {
    it('should verify data is in tree', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const proof = generateMerkleProof(items, 1);

      expect(verifyDataInTree(items[1], proof)).toBe(true);
    });

    it('should reject different data', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const proof = generateMerkleProof(items, 0);

      expect(verifyDataInTree({ id: 999 }, proof)).toBe(false);
    });

    it('should reject valid data with wrong proof', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const proof = generateMerkleProof(items, 0);

      // Verify with different item (item at index 1 with proof for index 0)
      expect(verifyDataInTree(items[1], proof)).toBe(false);
    });
  });

  describe('createMerkleBatch', () => {
    it('should create batch with correct properties', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const batch = createMerkleBatch('batch_001', items);

      expect(batch.batchId).toBe('batch_001');
      expect(batch.items).toEqual(items);
      expect(batch.root).toBe(getMerkleRoot(items));
      expect(batch.count).toBe(3);
      expect(batch.algorithm).toBe('sha256');
      expect(batch.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should use custom algorithm', () => {
      const items = [{ id: 1 }];
      const batch = createMerkleBatch('batch_001', items, 'sha512');

      expect(batch.algorithm).toBe('sha512');
      expect(batch.root).toBe(getMerkleRoot(items, 'sha512'));
    });

    it('should handle empty items', () => {
      const batch = createMerkleBatch('batch_empty', []);

      expect(batch.count).toBe(0);
      expect(batch.items).toEqual([]);
      expect(batch.root).toBe(getMerkleRoot([]));
    });
  });
});
