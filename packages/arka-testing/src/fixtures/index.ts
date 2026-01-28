/**
 * ARKA Testing - Fixtures
 *
 * Pre-built test data fixtures for common testing scenarios.
 */

import type { ArkaRule, ArkaEvent, ArkaEntity } from '@arka/types';

// ============================================================================
// Sample Rules
// ============================================================================

/**
 * Collection of sample rules for testing
 */
export const sampleRules: Record<string, ArkaRule> = {
  /**
   * Simple amount threshold rule
   */
  amountThreshold: {
    id: 'rule_amount_threshold_10k',
    name: 'Amount Threshold $10,000',
    description: 'Flag transactions over $10,000',
    condition: {
      type: 'compare',
      field: 'payload.amount',
      operator: '>',
      value: 10000,
    },
    consequence: {
      decision: 'FLAG',
      code: 'HIGH_VALUE_TXN',
      message: 'Transaction amount exceeds $10,000 reporting threshold',
    },
    severity: 'MEDIUM',
    tags: ['aml', 'bsa', 'ctr'],
    metadata: { regulation: 'BSA' },
  },

  /**
   * Country sanctions rule
   */
  sanctionedCountries: {
    id: 'rule_sanctioned_countries',
    name: 'Sanctioned Countries Block',
    description: 'Block transactions from OFAC sanctioned countries',
    condition: {
      type: 'compare',
      field: 'payload.country',
      operator: 'in',
      value: ['KP', 'IR', 'SY', 'CU'],
    },
    consequence: {
      decision: 'DENY',
      code: 'SANCTIONED_COUNTRY',
      message: 'Transaction blocked: origin country is under sanctions',
    },
    severity: 'CRITICAL',
    tags: ['sanctions', 'ofac'],
    metadata: { regulation: 'OFAC' },
  },

  /**
   * PEP identification rule
   */
  pepCheck: {
    id: 'rule_pep_check',
    name: 'PEP Identification',
    description: 'Flag transactions involving Politically Exposed Persons',
    condition: {
      type: 'compare',
      field: 'payload.customer.isPEP',
      operator: '==',
      value: true,
    },
    consequence: {
      decision: 'FLAG',
      code: 'PEP_INVOLVED',
      message: 'Enhanced due diligence required: customer is a PEP',
    },
    severity: 'HIGH',
    tags: ['kyc', 'pep', 'edd'],
    metadata: {},
  },

  /**
   * Structuring detection rule
   */
  structuringDetection: {
    id: 'rule_structuring_detection',
    name: 'Structuring Detection',
    description: 'Flag multiple transactions just under reporting threshold',
    condition: {
      type: 'and',
      conditions: [
        { type: 'compare', field: 'payload.amount', operator: '>=', value: 8000 },
        { type: 'compare', field: 'payload.amount', operator: '<', value: 10000 },
        { type: 'compare', field: 'payload.dailyTransactionCount', operator: '>', value: 2 },
      ],
    },
    consequence: {
      decision: 'FLAG',
      code: 'POSSIBLE_STRUCTURING',
      message: 'Possible structuring detected: multiple transactions near threshold',
    },
    severity: 'HIGH',
    tags: ['aml', 'structuring'],
    metadata: {},
  },

  /**
   * KYC verification rule
   */
  kycVerification: {
    id: 'rule_kyc_verification',
    name: 'KYC Verification Required',
    description: 'Deny transactions for unverified customers',
    condition: {
      type: 'compare',
      field: 'payload.customer.kycStatus',
      operator: '!=',
      value: 'VERIFIED',
    },
    consequence: {
      decision: 'DENY',
      code: 'KYC_NOT_VERIFIED',
      message: 'Transaction denied: customer KYC verification incomplete',
    },
    severity: 'HIGH',
    tags: ['kyc'],
    metadata: {},
  },

  /**
   * Cross-border transaction rule
   */
  crossBorderHighValue: {
    id: 'rule_cross_border_high_value',
    name: 'Cross-Border High Value',
    description: 'Flag high-value cross-border transactions',
    condition: {
      type: 'and',
      conditions: [
        { type: 'compare', field: 'payload.isCrossBorder', operator: '==', value: true },
        { type: 'compare', field: 'payload.amount', operator: '>', value: 5000 },
      ],
    },
    consequence: {
      decision: 'FLAG',
      code: 'CROSS_BORDER_HIGH_VALUE',
      message: 'Cross-border transaction over $5,000 requires review',
    },
    severity: 'MEDIUM',
    tags: ['cross-border', 'aml'],
    metadata: {},
  },
};

/**
 * Get all sample rules as an array
 */
export function getAllSampleRules(): ArkaRule[] {
  return Object.values(sampleRules);
}

// ============================================================================
// Sample Events
// ============================================================================

/**
 * Collection of sample events for testing
 */
export const sampleEvents: Record<string, ArkaEvent> = {
  /**
   * Standard domestic transfer
   */
  domesticTransfer: {
    id: 'evt_domestic_001',
    source: 'core-banking',
    type: 'WIRE_TRANSFER',
    entityId: 'txn_001',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_001',
      amount: 5000,
      currency: 'USD',
      sourceAccount: 'ACC_12345',
      destinationAccount: 'ACC_67890',
      transactionType: 'DOMESTIC_WIRE',
      country: 'US',
      isCrossBorder: false,
      customer: {
        id: 'cust_001',
        kycStatus: 'VERIFIED',
        isPEP: false,
        riskLevel: 'LOW',
      },
    },
    occurredAt: '2024-01-15T10:30:00Z',
    receivedAt: '2024-01-15T10:30:01Z',
  },

  /**
   * High-value international transfer
   */
  internationalHighValue: {
    id: 'evt_intl_001',
    source: 'core-banking',
    type: 'WIRE_TRANSFER',
    entityId: 'txn_002',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_002',
      amount: 75000,
      currency: 'USD',
      sourceAccount: 'ACC_12345',
      destinationAccount: 'ACC_INTL_001',
      transactionType: 'INTERNATIONAL_WIRE',
      country: 'US',
      destinationCountry: 'GB',
      isCrossBorder: true,
      customer: {
        id: 'cust_002',
        kycStatus: 'VERIFIED',
        isPEP: false,
        riskLevel: 'MEDIUM',
      },
    },
    occurredAt: '2024-01-15T11:00:00Z',
    receivedAt: '2024-01-15T11:00:01Z',
  },

  /**
   * Transaction from sanctioned country
   */
  sanctionedCountryTransaction: {
    id: 'evt_sanctioned_001',
    source: 'core-banking',
    type: 'WIRE_TRANSFER',
    entityId: 'txn_003',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_003',
      amount: 1000,
      currency: 'USD',
      sourceAccount: 'ACC_INTL_002',
      destinationAccount: 'ACC_12345',
      transactionType: 'INCOMING_WIRE',
      country: 'IR', // Iran - sanctioned
      isCrossBorder: true,
      customer: {
        id: 'cust_003',
        kycStatus: 'VERIFIED',
        isPEP: false,
        riskLevel: 'HIGH',
      },
    },
    occurredAt: '2024-01-15T12:00:00Z',
    receivedAt: '2024-01-15T12:00:01Z',
  },

  /**
   * PEP transaction
   */
  pepTransaction: {
    id: 'evt_pep_001',
    source: 'core-banking',
    type: 'WIRE_TRANSFER',
    entityId: 'txn_004',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_004',
      amount: 25000,
      currency: 'USD',
      sourceAccount: 'ACC_PEP_001',
      destinationAccount: 'ACC_12345',
      transactionType: 'DOMESTIC_WIRE',
      country: 'US',
      isCrossBorder: false,
      customer: {
        id: 'cust_pep_001',
        kycStatus: 'VERIFIED',
        isPEP: true,
        pepType: 'FOREIGN_GOVERNMENT_OFFICIAL',
        riskLevel: 'HIGH',
      },
    },
    occurredAt: '2024-01-15T14:00:00Z',
    receivedAt: '2024-01-15T14:00:01Z',
  },

  /**
   * Possible structuring transaction
   */
  structuringTransaction: {
    id: 'evt_structuring_001',
    source: 'core-banking',
    type: 'CASH_DEPOSIT',
    entityId: 'txn_005',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_005',
      amount: 9500,
      currency: 'USD',
      destinationAccount: 'ACC_12345',
      transactionType: 'CASH_DEPOSIT',
      country: 'US',
      isCrossBorder: false,
      dailyTransactionCount: 4,
      dailyTotalAmount: 38000,
      customer: {
        id: 'cust_005',
        kycStatus: 'VERIFIED',
        isPEP: false,
        riskLevel: 'MEDIUM',
      },
    },
    occurredAt: '2024-01-15T15:00:00Z',
    receivedAt: '2024-01-15T15:00:01Z',
  },

  /**
   * Unverified customer transaction
   */
  unverifiedCustomer: {
    id: 'evt_unverified_001',
    source: 'core-banking',
    type: 'WIRE_TRANSFER',
    entityId: 'txn_006',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_006',
      amount: 2000,
      currency: 'USD',
      sourceAccount: 'ACC_UNVERIFIED',
      destinationAccount: 'ACC_12345',
      transactionType: 'DOMESTIC_WIRE',
      country: 'US',
      isCrossBorder: false,
      customer: {
        id: 'cust_unverified',
        kycStatus: 'PENDING',
        isPEP: false,
        riskLevel: 'UNKNOWN',
      },
    },
    occurredAt: '2024-01-15T16:00:00Z',
    receivedAt: '2024-01-15T16:00:01Z',
  },
};

/**
 * Get all sample events as an array
 */
export function getAllSampleEvents(): ArkaEvent[] {
  return Object.values(sampleEvents);
}

// ============================================================================
// Sample Entities
// ============================================================================

/**
 * Collection of sample entities for testing
 */
export const sampleEntities: Record<string, ArkaEntity> = {
  /**
   * Standard verified customer
   */
  verifiedCustomer: {
    id: 'ent_customer_001',
    type: 'Customer',
    data: {
      customerId: 'cust_001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      kycStatus: 'VERIFIED',
      riskLevel: 'LOW',
      isPEP: false,
      dateOfBirth: '1985-06-15',
      country: 'US',
      accountOpenDate: '2020-01-15',
    },
    createdAt: '2020-01-15T10:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },

  /**
   * High-risk business customer
   */
  highRiskBusiness: {
    id: 'ent_customer_002',
    type: 'Customer',
    data: {
      customerId: 'cust_002',
      businessName: 'Acme Trading LLC',
      businessType: 'MONEY_SERVICE_BUSINESS',
      kycStatus: 'VERIFIED',
      riskLevel: 'HIGH',
      isPEP: false,
      incorporationCountry: 'US',
      operatingCountries: ['US', 'MX', 'CA'],
      accountOpenDate: '2022-06-01',
    },
    createdAt: '2022-06-01T10:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },

  /**
   * PEP customer
   */
  pepCustomer: {
    id: 'ent_customer_pep',
    type: 'Customer',
    data: {
      customerId: 'cust_pep_001',
      firstName: 'Maria',
      lastName: 'Rodriguez',
      email: 'maria.rodriguez@gov.example',
      kycStatus: 'VERIFIED',
      riskLevel: 'HIGH',
      isPEP: true,
      pepType: 'FOREIGN_GOVERNMENT_OFFICIAL',
      pepPosition: 'Minister of Finance',
      pepCountry: 'BR',
      country: 'US',
      accountOpenDate: '2023-01-10',
    },
    createdAt: '2023-01-10T10:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
};

/**
 * Get all sample entities as an array
 */
export function getAllSampleEntities(): ArkaEntity[] {
  return Object.values(sampleEntities);
}

// ============================================================================
// Test Data Sets
// ============================================================================

/**
 * Complete test data set for integration testing
 */
export const integrationTestData = {
  rules: getAllSampleRules(),
  events: getAllSampleEvents(),
  entities: getAllSampleEntities(),
};

/**
 * Expected results for sample events against sample rules
 */
export const expectedResults: Record<string, { decision: string; flags: string[] }> = {
  domesticTransfer: { decision: 'ALLOW', flags: [] },
  internationalHighValue: {
    decision: 'ALLOW_WITH_FLAGS',
    flags: ['HIGH_VALUE_TXN', 'CROSS_BORDER_HIGH_VALUE'],
  },
  sanctionedCountryTransaction: { decision: 'DENY', flags: ['SANCTIONED_COUNTRY'] },
  pepTransaction: { decision: 'ALLOW_WITH_FLAGS', flags: ['HIGH_VALUE_TXN', 'PEP_INVOLVED'] },
  structuringTransaction: { decision: 'ALLOW_WITH_FLAGS', flags: ['POSSIBLE_STRUCTURING'] },
  unverifiedCustomer: { decision: 'DENY', flags: ['KYC_NOT_VERIFIED'] },
};
