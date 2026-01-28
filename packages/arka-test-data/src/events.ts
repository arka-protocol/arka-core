/**
 * Test Event Fixtures
 */

import type { ArkaEvent, CreateEventInput } from '@arka/types';

// ============ Loan Events ============

export const loanCreatedEvent: ArkaEvent = {
  id: 'evt_loan_created_001',
  source: 'arka-loans',
  type: 'LOAN_CREATED',
  entityId: 'ent_loan_001',
  entityType: 'Loan',
  jurisdiction: 'US-CA',
  payload: {
    loan: {
      apr: 0.25,
      amount: 10000,
      termMonths: 36,
      purpose: 'Debt consolidation',
    },
    borrower: {
      creditScore: 720,
      income: 65000,
      employmentStatus: 'EMPLOYED',
    },
    lender: {
      id: 'lender_001',
      name: 'First National Bank',
    },
  },
  occurredAt: '2024-01-15T10:00:00Z',
  receivedAt: '2024-01-15T10:00:01Z',
};

export const loanHighAprEvent: ArkaEvent = {
  id: 'evt_loan_created_002',
  source: 'arka-loans',
  type: 'LOAN_CREATED',
  entityId: 'ent_loan_002',
  entityType: 'Loan',
  jurisdiction: 'US-CA',
  payload: {
    loan: {
      apr: 0.45,
      amount: 50000,
      termMonths: 72,
      purpose: 'Business expansion',
    },
    borrower: {
      creditScore: 580,
      income: 35000,
      employmentStatus: 'SELF_EMPLOYED',
    },
    lender: {
      id: 'lender_002',
      name: 'Quick Cash Lending',
    },
  },
  occurredAt: '2024-01-16T14:30:00Z',
  receivedAt: '2024-01-16T14:30:01Z',
};

export const loanFundedEvent: ArkaEvent = {
  id: 'evt_loan_funded_001',
  source: 'arka-loans',
  type: 'LOAN_FUNDED',
  entityId: 'ent_loan_001',
  entityType: 'Loan',
  jurisdiction: 'US-CA',
  payload: {
    loanId: 'ent_loan_001',
    fundingAmount: 10000,
    fundingDate: '2024-01-20',
    disbursementMethod: 'ACH',
  },
  occurredAt: '2024-01-20T09:00:00Z',
  receivedAt: '2024-01-20T09:00:01Z',
};

// ============ Shipment Events ============

export const shipmentDeclaredEvent: ArkaEvent = {
  id: 'evt_shipment_declared_001',
  source: 'arka-tariff',
  type: 'SHIPMENT_DECLARED',
  entityId: 'ent_shipment_001',
  entityType: 'Shipment',
  jurisdiction: 'US',
  payload: {
    shipment: {
      value: 25000,
      weight: 500,
      origin: 'CN',
      destination: 'US',
      hsCode: '8471300000',
    },
    declarant: {
      id: 'declarant_001',
      name: 'Acme Imports Inc',
      licenseNumber: 'IMP-12345',
    },
    carrier: {
      name: 'Oceanic Freight',
      vesselName: 'Pacific Star',
    },
  },
  occurredAt: '2024-01-15T08:00:00Z',
  receivedAt: '2024-01-15T08:00:01Z',
};

export const shipmentHighValueEvent: ArkaEvent = {
  id: 'evt_shipment_declared_002',
  source: 'arka-tariff',
  type: 'SHIPMENT_DECLARED',
  entityId: 'ent_shipment_002',
  entityType: 'Shipment',
  jurisdiction: 'US',
  payload: {
    shipment: {
      value: 150000,
      weight: 2000,
      origin: 'CN',
      destination: 'US',
      hsCode: '8471300000',
    },
    declarant: {
      id: 'declarant_002',
      name: 'Tech Distributors LLC',
      licenseNumber: 'IMP-67890',
    },
    carrier: {
      name: 'Global Shipping',
      vesselName: 'Atlantic Voyager',
    },
  },
  occurredAt: '2024-01-17T12:00:00Z',
  receivedAt: '2024-01-17T12:00:01Z',
};

// ============ Event Input Fixtures ============

export const createLoanEventInput: CreateEventInput = {
  source: 'arka-loans',
  type: 'LOAN_CREATED',
  entityType: 'Loan',
  jurisdiction: 'US-CA',
  payload: {
    loan: {
      apr: 0.28,
      amount: 15000,
      termMonths: 48,
      purpose: 'Home improvement',
    },
    borrower: {
      creditScore: 680,
      income: 55000,
      employmentStatus: 'EMPLOYED',
    },
  },
};

export const createShipmentEventInput: CreateEventInput = {
  source: 'arka-tariff',
  type: 'SHIPMENT_DECLARED',
  entityType: 'Shipment',
  jurisdiction: 'US',
  payload: {
    shipment: {
      value: 30000,
      weight: 750,
      origin: 'DE',
      destination: 'US',
      hsCode: '8703230000',
    },
    declarant: {
      id: 'declarant_003',
      name: 'Euro Auto Imports',
    },
  },
};

// ============ Event Collections ============

export const allLoanEvents: ArkaEvent[] = [
  loanCreatedEvent,
  loanHighAprEvent,
  loanFundedEvent,
];

export const allShipmentEvents: ArkaEvent[] = [
  shipmentDeclaredEvent,
  shipmentHighValueEvent,
];

export const allSampleEvents: ArkaEvent[] = [
  ...allLoanEvents,
  ...allShipmentEvents,
];
