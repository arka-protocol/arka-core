/**
 * ID Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { generateId, generatePrefixedId, ids, isValidId, getIdPrefix } from './id.js';

describe('ID Utilities', () => {
  describe('generateId', () => {
    it('should generate a valid UUID v4', () => {
      const id = generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('generatePrefixedId', () => {
    it('should generate an ID with the specified prefix', () => {
      const id = generatePrefixedId('evt');
      expect(id).toMatch(/^evt_[0-9a-f]{32}$/i);
    });

    it('should work with different prefixes', () => {
      expect(generatePrefixedId('dec')).toMatch(/^dec_/);
      expect(generatePrefixedId('rul')).toMatch(/^rul_/);
      expect(generatePrefixedId('ent')).toMatch(/^ent_/);
    });
  });

  describe('ids helpers', () => {
    it('should generate event IDs with correct prefix', () => {
      const id = ids.event();
      expect(id).toMatch(/^evt_[0-9a-f]{32}$/i);
    });

    it('should generate decision IDs with correct prefix', () => {
      const id = ids.decision();
      expect(id).toMatch(/^dec_[0-9a-f]{32}$/i);
    });

    it('should generate rule IDs with correct prefix', () => {
      const id = ids.rule();
      expect(id).toMatch(/^rul_[0-9a-f]{32}$/i);
    });

    it('should generate entity IDs with correct prefix', () => {
      const id = ids.entity();
      expect(id).toMatch(/^ent_[0-9a-f]{32}$/i);
    });

    it('should generate audit IDs with correct prefix', () => {
      const id = ids.audit();
      expect(id).toMatch(/^aud_[0-9a-f]{32}$/i);
    });

    it('should generate proposal IDs with correct prefix', () => {
      const id = ids.proposal();
      expect(id).toMatch(/^prp_[0-9a-f]{32}$/i);
    });

    it('should generate simulation IDs with correct prefix', () => {
      const id = ids.simulation();
      expect(id).toMatch(/^sim_[0-9a-f]{32}$/i);
    });

    it('should generate request IDs with correct prefix', () => {
      const id = ids.request();
      expect(id).toMatch(/^req_[0-9a-f]{32}$/i);
    });
  });

  describe('isValidId', () => {
    it('should validate standard UUIDs', () => {
      expect(isValidId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidId('6ba7b810-9dad-41d4-80b4-00c04fd430c8')).toBe(true);
    });

    it('should validate prefixed IDs', () => {
      expect(isValidId('evt_550e8400e29b41d4a716446655440000')).toBe(true);
      expect(isValidId('dec_6ba7b8109dad41d480b400c04fd430c8')).toBe(true);
    });

    it('should reject invalid IDs', () => {
      expect(isValidId('invalid')).toBe(false);
      expect(isValidId('12345')).toBe(false);
      expect(isValidId('evt-invalid')).toBe(false);
      expect(isValidId('')).toBe(false);
    });

    it('should validate generated IDs', () => {
      expect(isValidId(generateId())).toBe(true);
      expect(isValidId(ids.event())).toBe(true);
      expect(isValidId(ids.decision())).toBe(true);
    });
  });

  describe('getIdPrefix', () => {
    it('should extract prefix from prefixed IDs', () => {
      expect(getIdPrefix('evt_550e8400e29b41d4a716446655440000')).toBe('evt');
      expect(getIdPrefix('dec_6ba7b8109dad41d480b400c04fd430c8')).toBe('dec');
      expect(getIdPrefix('rul_123456789012345678901234567890ab')).toBe('rul');
    });

    it('should return null for non-prefixed IDs', () => {
      expect(getIdPrefix('550e8400-e29b-41d4-a716-446655440000')).toBe(null);
      expect(getIdPrefix('invalid')).toBe(null);
      expect(getIdPrefix('')).toBe(null);
    });
  });
});
