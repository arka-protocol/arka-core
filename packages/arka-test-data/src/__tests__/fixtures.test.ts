/**
 * ARKA Test Data Fixtures Tests
 */

import { describe, it, expect } from 'vitest';
import {
  loanEntityType,
  loanEntitySchema,
  shipmentEntityType,
  shipmentEntitySchema,
  sampleLoanEntity,
  sampleHighRiskLoanEntity,
  sampleShipmentEntity,
  allEntityTypes,
  allSampleEntities,
} from '../entities.js';

describe('@arka/test-data', () => {
  describe('Entity Types', () => {
    describe('Loan Entity Type', () => {
      it('should have correct loan entity type definition', () => {
        expect(loanEntityType.name).toBe('Loan');
        expect(loanEntityType.description).toBe('Consumer or business loan');
        expect(loanEntityType.metadata?.category).toBe('financial');
        expect(loanEntityType.metadata?.version).toBe('1.0');
      });

      it('should have valid loan schema', () => {
        expect(loanEntitySchema.type).toBe('object');
        expect(loanEntitySchema.properties).toBeDefined();
        expect(loanEntitySchema.properties?.apr).toBeDefined();
        expect(loanEntitySchema.properties?.amount).toBeDefined();
        expect(loanEntitySchema.required).toContain('apr');
        expect(loanEntitySchema.required).toContain('amount');
      });
    });

    describe('Shipment Entity Type', () => {
      it('should have correct shipment entity type definition', () => {
        expect(shipmentEntityType.name).toBe('Shipment');
        expect(shipmentEntityType.description).toBe('Import/export shipment for customs');
        expect(shipmentEntityType.metadata?.category).toBe('customs');
      });

      it('should have valid shipment schema', () => {
        expect(shipmentEntitySchema.type).toBe('object');
        expect(shipmentEntitySchema.properties?.value).toBeDefined();
        expect(shipmentEntitySchema.properties?.hsCode).toBeDefined();
        expect(shipmentEntitySchema.properties?.origin).toBeDefined();
        expect(shipmentEntitySchema.properties?.destination).toBeDefined();
      });
    });

    describe('Entity Type Collection', () => {
      it('should contain all entity types', () => {
        expect(allEntityTypes).toHaveLength(2);
        expect(allEntityTypes).toContain(loanEntityType);
        expect(allEntityTypes).toContain(shipmentEntityType);
      });
    });
  });

  describe('Sample Entities', () => {
    describe('Sample Loan Entity', () => {
      it('should have valid loan entity structure', () => {
        expect(sampleLoanEntity.id).toBe('ent_loan_001');
        expect(sampleLoanEntity.type).toBe('Loan');
        expect(sampleLoanEntity.jurisdiction).toBe('US-CA');
      });

      it('should have loan data', () => {
        const data = sampleLoanEntity.data as Record<string, unknown>;
        expect(data.apr).toBe(0.25);
        expect(data.amount).toBe(10000);
        expect(data.termMonths).toBe(36);
        expect(data.status).toBe('PENDING');
      });

      it('should have timestamps', () => {
        expect(sampleLoanEntity.createdAt).toBeDefined();
        expect(sampleLoanEntity.updatedAt).toBeDefined();
      });
    });

    describe('Sample High Risk Loan Entity', () => {
      it('should have high risk characteristics', () => {
        const data = sampleHighRiskLoanEntity.data as Record<string, unknown>;
        expect(data.apr).toBe(0.45);
        expect(data.amount).toBe(50000);
        expect(data.termMonths).toBe(72);
      });

      it('should be identified as high risk', () => {
        const data = sampleHighRiskLoanEntity.data as Record<string, unknown>;
        // High APR (45%) is a risk indicator
        expect(data.apr).toBeGreaterThan(0.36);
      });
    });

    describe('Sample Shipment Entity', () => {
      it('should have valid shipment entity structure', () => {
        expect(sampleShipmentEntity.id).toBe('ent_shipment_001');
        expect(sampleShipmentEntity.type).toBe('Shipment');
        expect(sampleShipmentEntity.jurisdiction).toBe('US');
      });

      it('should have shipment data', () => {
        const data = sampleShipmentEntity.data as Record<string, unknown>;
        expect(data.origin).toBe('CN');
        expect(data.destination).toBe('US');
        expect(data.value).toBe(25000);
        expect(data.hsCode).toBe('8471300000');
        expect(data.status).toBe('DECLARED');
      });
    });

    describe('Sample Entity Collection', () => {
      it('should contain all sample entities', () => {
        expect(allSampleEntities).toHaveLength(3);
        expect(allSampleEntities).toContain(sampleLoanEntity);
        expect(allSampleEntities).toContain(sampleHighRiskLoanEntity);
        expect(allSampleEntities).toContain(sampleShipmentEntity);
      });
    });
  });

  describe('Events Module', () => {
    it('should export events', async () => {
      const eventsModule = await import('../events.js');
      expect(eventsModule).toBeDefined();
    });
  });

  describe('Rules Module', () => {
    it('should export rules', async () => {
      const rulesModule = await import('../rules.js');
      expect(rulesModule).toBeDefined();
    });
  });
});
