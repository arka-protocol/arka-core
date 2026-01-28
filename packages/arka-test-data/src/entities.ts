/**
 * Test Entity Types and Fixtures
 */

import type { ArkaEntityType, ArkaEntity, JSONSchema } from '@arka/types';

// ============ Loan Entity Type ============

export const loanEntitySchema: JSONSchema = {
  type: 'object',
  properties: {
    apr: { type: 'number', minimum: 0, maximum: 1 },
    amount: { type: 'number', minimum: 0 },
    termMonths: { type: 'integer', minimum: 1 },
    status: { type: 'string', enum: ['PENDING', 'APPROVED', 'FUNDED', 'CLOSED', 'DEFAULTED'] },
    purpose: { type: 'string' },
    collateral: { type: 'boolean' },
    borrowerId: { type: 'string' },
  },
  required: ['apr', 'amount', 'termMonths', 'status'],
};

export const loanEntityType: ArkaEntityType = {
  name: 'Loan',
  description: 'Consumer or business loan',
  schema: loanEntitySchema,
  metadata: {
    category: 'financial',
    version: '1.0',
  },
};

// ============ Shipment Entity Type ============

export const shipmentEntitySchema: JSONSchema = {
  type: 'object',
  properties: {
    value: { type: 'number', minimum: 0 },
    weight: { type: 'number', minimum: 0 },
    origin: { type: 'string' },
    destination: { type: 'string' },
    hsCode: { type: 'string', pattern: '^[0-9]{4,10}$' },
    status: { type: 'string', enum: ['DECLARED', 'INSPECTING', 'CLEARED', 'HELD', 'RELEASED'] },
    declarant: { type: 'string' },
    carrier: { type: 'string' },
  },
  required: ['value', 'origin', 'destination', 'hsCode', 'status'],
};

export const shipmentEntityType: ArkaEntityType = {
  name: 'Shipment',
  description: 'Import/export shipment for customs',
  schema: shipmentEntitySchema,
  metadata: {
    category: 'customs',
    version: '1.0',
  },
};

// ============ Sample Entities ============

export const sampleLoanEntity: ArkaEntity = {
  id: 'ent_loan_001',
  type: 'Loan',
  jurisdiction: 'US-CA',
  data: {
    apr: 0.25,
    amount: 10000,
    termMonths: 36,
    status: 'PENDING',
    purpose: 'Debt consolidation',
    collateral: false,
    borrowerId: 'borrower_001',
  },
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
};

export const sampleHighRiskLoanEntity: ArkaEntity = {
  id: 'ent_loan_002',
  type: 'Loan',
  jurisdiction: 'US-CA',
  data: {
    apr: 0.45,
    amount: 50000,
    termMonths: 72,
    status: 'PENDING',
    purpose: 'Business expansion',
    collateral: false,
    borrowerId: 'borrower_002',
  },
  createdAt: '2024-01-16T10:00:00Z',
  updatedAt: '2024-01-16T10:00:00Z',
};

export const sampleShipmentEntity: ArkaEntity = {
  id: 'ent_shipment_001',
  type: 'Shipment',
  jurisdiction: 'US',
  data: {
    value: 25000,
    weight: 500,
    origin: 'CN',
    destination: 'US',
    hsCode: '8471300000',
    status: 'DECLARED',
    declarant: 'Acme Imports Inc',
    carrier: 'Oceanic Freight',
  },
  createdAt: '2024-01-15T08:00:00Z',
  updatedAt: '2024-01-15T08:00:00Z',
};

// ============ Entity Type Collection ============

export const allEntityTypes: ArkaEntityType[] = [
  loanEntityType,
  shipmentEntityType,
];

export const allSampleEntities: ArkaEntity[] = [
  sampleLoanEntity,
  sampleHighRiskLoanEntity,
  sampleShipmentEntity,
];
