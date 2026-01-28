/**
 * Hash Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { sha256, generateIntegrityHash, verifyIntegrityHash } from './hash.js';

describe('Hash Utilities', () => {
  describe('sha256', () => {
    it('should generate consistent hashes for strings', () => {
      const hash1 = sha256('hello world');
      const hash2 = sha256('hello world');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different strings', () => {
      const hash1 = sha256('hello world');
      const hash2 = sha256('hello world!');
      expect(hash1).not.toBe(hash2);
    });

    it('should generate 64 character hex string', () => {
      const hash = sha256('test');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should hash objects consistently', () => {
      const obj = { name: 'test', value: 123 };
      const hash1 = sha256(obj);
      const hash2 = sha256({ name: 'test', value: 123 });
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different objects', () => {
      const hash1 = sha256({ a: 1 });
      const hash2 = sha256({ a: 2 });
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = sha256('');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle empty object', () => {
      const hash = sha256({});
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: 'deep value',
          },
        },
      };
      const hash = sha256(obj);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('generateIntegrityHash', () => {
    const entitySnapshot = { id: 'ent_001', name: 'Test Entity' };
    const eventSnapshot = { id: 'evt_001', type: 'TEST' };
    const rulesetSnapshot = [{ id: 'rul_001', name: 'Test Rule' }];
    const context = { userId: 'user_001', timestamp: '2024-01-01T00:00:00.000Z' };

    it('should generate consistent hashes', () => {
      const hash1 = generateIntegrityHash(
        entitySnapshot,
        eventSnapshot,
        rulesetSnapshot,
        context
      );
      const hash2 = generateIntegrityHash(
        entitySnapshot,
        eventSnapshot,
        rulesetSnapshot,
        context
      );
      expect(hash1).toBe(hash2);
    });

    it('should generate 64 character hex string', () => {
      const hash = generateIntegrityHash(
        entitySnapshot,
        eventSnapshot,
        rulesetSnapshot,
        context
      );
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = generateIntegrityHash(
        entitySnapshot,
        eventSnapshot,
        rulesetSnapshot,
        context
      );
      const hash2 = generateIntegrityHash(
        { ...entitySnapshot, id: 'ent_002' },
        eventSnapshot,
        rulesetSnapshot,
        context
      );
      expect(hash1).not.toBe(hash2);
    });

    it('should handle null values', () => {
      const hash = generateIntegrityHash(null, null, null, null);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('verifyIntegrityHash', () => {
    const entitySnapshot = { id: 'ent_001', name: 'Test Entity' };
    const eventSnapshot = { id: 'evt_001', type: 'TEST' };
    const rulesetSnapshot = [{ id: 'rul_001', name: 'Test Rule' }];
    const context = { userId: 'user_001', timestamp: '2024-01-01T00:00:00.000Z' };

    it('should verify correct hash', () => {
      const hash = generateIntegrityHash(
        entitySnapshot,
        eventSnapshot,
        rulesetSnapshot,
        context
      );
      const isValid = verifyIntegrityHash(
        hash,
        entitySnapshot,
        eventSnapshot,
        rulesetSnapshot,
        context
      );
      expect(isValid).toBe(true);
    });

    it('should reject incorrect hash', () => {
      const isValid = verifyIntegrityHash(
        'invalid_hash',
        entitySnapshot,
        eventSnapshot,
        rulesetSnapshot,
        context
      );
      expect(isValid).toBe(false);
    });

    it('should reject tampered entity', () => {
      const hash = generateIntegrityHash(
        entitySnapshot,
        eventSnapshot,
        rulesetSnapshot,
        context
      );
      const isValid = verifyIntegrityHash(
        hash,
        { ...entitySnapshot, name: 'Tampered Entity' },
        eventSnapshot,
        rulesetSnapshot,
        context
      );
      expect(isValid).toBe(false);
    });

    it('should reject tampered event', () => {
      const hash = generateIntegrityHash(
        entitySnapshot,
        eventSnapshot,
        rulesetSnapshot,
        context
      );
      const isValid = verifyIntegrityHash(
        hash,
        entitySnapshot,
        { ...eventSnapshot, type: 'TAMPERED' },
        rulesetSnapshot,
        context
      );
      expect(isValid).toBe(false);
    });

    it('should reject tampered context', () => {
      const hash = generateIntegrityHash(
        entitySnapshot,
        eventSnapshot,
        rulesetSnapshot,
        context
      );
      const isValid = verifyIntegrityHash(
        hash,
        entitySnapshot,
        eventSnapshot,
        rulesetSnapshot,
        { ...context, userId: 'different_user' }
      );
      expect(isValid).toBe(false);
    });
  });
});
