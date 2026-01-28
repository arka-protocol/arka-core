/**
 * Demo Seed Data - Sample Events
 *
 * Pre-configured events for demonstrating rule evaluation.
 */

import type { ArkaEvent } from '@arka/types';

/**
 * Generate a unique event ID
 */
function eventId(): string {
  return `evt_demo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Standard compliant transactions (should ALLOW)
 */
export const compliantEvents: ArkaEvent[] = [
  {
    id: eventId(),
    source: 'core-banking',
    type: 'WIRE_TRANSFER',
    entityId: 'txn_compliant_001',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_compliant_001',
      amount: 5000,
      currency: 'USD',
      transactionType: 'DOMESTIC_WIRE',
      originCountry: 'US',
      destinationCountry: 'US',
      isCrossBorder: false,
      customer: {
        id: 'cust_001',
        name: 'John Smith',
        kycStatus: 'VERIFIED',
        isPEP: false,
        riskLevel: 'LOW',
      },
      accountAgeDays: 365,
    },
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  },
  {
    id: eventId(),
    source: 'core-banking',
    type: 'ACH_TRANSFER',
    entityId: 'txn_compliant_002',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_compliant_002',
      amount: 2500,
      currency: 'USD',
      transactionType: 'ACH_CREDIT',
      originCountry: 'US',
      destinationCountry: 'US',
      isCrossBorder: false,
      customer: {
        id: 'cust_002',
        name: 'Jane Doe',
        kycStatus: 'VERIFIED',
        isPEP: false,
        riskLevel: 'LOW',
      },
      accountAgeDays: 180,
    },
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  },
];

/**
 * Events that should trigger FLAGS (review required)
 */
export const flaggedEvents: ArkaEvent[] = [
  {
    id: eventId(),
    source: 'core-banking',
    type: 'CASH_DEPOSIT',
    entityId: 'txn_ctr_001',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_ctr_001',
      amount: 15000,
      currency: 'USD',
      transactionType: 'CASH_DEPOSIT',
      originCountry: 'US',
      customer: {
        id: 'cust_003',
        name: 'Robert Johnson',
        kycStatus: 'VERIFIED',
        isPEP: false,
        riskLevel: 'MEDIUM',
      },
      description: 'Large cash deposit - triggers CTR requirement',
    },
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  },
  {
    id: eventId(),
    source: 'core-banking',
    type: 'WIRE_TRANSFER',
    entityId: 'txn_pep_001',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_pep_001',
      amount: 25000,
      currency: 'USD',
      transactionType: 'DOMESTIC_WIRE',
      originCountry: 'US',
      destinationCountry: 'US',
      isCrossBorder: false,
      customer: {
        id: 'cust_pep_001',
        name: 'Ambassador Maria Garcia',
        kycStatus: 'VERIFIED',
        isPEP: true,
        pepType: 'FOREIGN_DIPLOMAT',
        riskLevel: 'HIGH',
      },
      description: 'PEP transaction - requires enhanced due diligence',
    },
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  },
  {
    id: eventId(),
    source: 'core-banking',
    type: 'INTERNATIONAL_WIRE',
    entityId: 'txn_xborder_001',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_xborder_001',
      amount: 75000,
      currency: 'USD',
      transactionType: 'INTERNATIONAL_WIRE',
      originCountry: 'US',
      destinationCountry: 'GB',
      isCrossBorder: true,
      customer: {
        id: 'cust_004',
        name: 'Tech Imports LLC',
        kycStatus: 'VERIFIED',
        isPEP: false,
        riskLevel: 'MEDIUM',
        businessType: 'IMPORT_EXPORT',
      },
      description: 'Large cross-border transfer - triggers review',
    },
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  },
  {
    id: eventId(),
    source: 'core-banking',
    type: 'CASH_DEPOSIT',
    entityId: 'txn_structuring_001',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_structuring_001',
      amount: 9500,
      currency: 'USD',
      transactionType: 'CASH_DEPOSIT',
      originCountry: 'US',
      dailyTransactionCount: 3,
      dailyTotalAmount: 28500,
      customer: {
        id: 'cust_005',
        name: 'Mike Wilson',
        kycStatus: 'VERIFIED',
        isPEP: false,
        riskLevel: 'MEDIUM',
      },
      description: 'Possible structuring - multiple deposits near $10k threshold',
    },
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  },
  {
    id: eventId(),
    source: 'fraud-detection',
    type: 'CARD_TRANSACTION',
    entityId: 'txn_geo_001',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_geo_001',
      amount: 2500,
      currency: 'USD',
      transactionType: 'CARD_PRESENT',
      originCountry: 'MX',
      geoAnomalyScore: 85,
      customer: {
        id: 'cust_006',
        name: 'Sarah Brown',
        kycStatus: 'VERIFIED',
        isPEP: false,
        riskLevel: 'LOW',
        homeCountry: 'US',
      },
      description: 'Geographic anomaly - card used in different country',
    },
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  },
];

/**
 * Events that should be DENIED (blocked)
 */
export const deniedEvents: ArkaEvent[] = [
  {
    id: eventId(),
    source: 'core-banking',
    type: 'INTERNATIONAL_WIRE',
    entityId: 'txn_sanctions_001',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_sanctions_001',
      amount: 10000,
      currency: 'USD',
      transactionType: 'INTERNATIONAL_WIRE',
      originCountry: 'US',
      destinationCountry: 'IR', // Iran - OFAC sanctioned
      isCrossBorder: true,
      customer: {
        id: 'cust_007',
        name: 'Global Trading Co',
        kycStatus: 'VERIFIED',
        isPEP: false,
        riskLevel: 'HIGH',
      },
      description: 'SANCTIONS VIOLATION - Wire to Iran',
    },
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  },
  {
    id: eventId(),
    source: 'core-banking',
    type: 'WIRE_TRANSFER',
    entityId: 'txn_kyc_fail_001',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_kyc_fail_001',
      amount: 5000,
      currency: 'USD',
      transactionType: 'DOMESTIC_WIRE',
      originCountry: 'US',
      destinationCountry: 'US',
      isCrossBorder: false,
      customer: {
        id: 'cust_unverified',
        name: 'Unknown Customer',
        kycStatus: 'PENDING',
        isPEP: false,
        riskLevel: 'UNKNOWN',
      },
      description: 'KYC not completed - transaction blocked',
    },
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  },
  {
    id: eventId(),
    source: 'lending-platform',
    type: 'LOAN_APPLICATION',
    entityId: 'loan_apr_001',
    entityType: 'Loan',
    payload: {
      loanId: 'loan_apr_001',
      amount: 5000,
      apr: 45, // Exceeds CA cap of 36%
      term: 24,
      loanType: 'CONSUMER',
      jurisdiction: 'US-CA',
      customer: {
        id: 'cust_008',
        name: 'David Chen',
        kycStatus: 'VERIFIED',
        isPEP: false,
        state: 'CA',
      },
      description: 'APR exceeds California cap - loan denied',
    },
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  },
  {
    id: eventId(),
    source: 'lending-platform',
    type: 'LOAN_APPLICATION',
    entityId: 'loan_mla_001',
    entityType: 'Loan',
    payload: {
      loanId: 'loan_mla_001',
      amount: 3000,
      mapr: 42, // Exceeds MLA cap of 36%
      term: 12,
      loanType: 'CONSUMER',
      customer: {
        id: 'cust_military_001',
        name: 'Sgt. James Miller',
        kycStatus: 'VERIFIED',
        isPEP: false,
        isMilitary: true,
        militaryBranch: 'ARMY',
        militaryStatus: 'ACTIVE_DUTY',
      },
      description: 'Military Lending Act violation - MAPR exceeds 36%',
    },
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  },
  {
    id: eventId(),
    source: 'fraud-detection',
    type: 'CARD_TRANSACTION',
    entityId: 'txn_device_fraud_001',
    entityType: 'Transaction',
    payload: {
      transactionId: 'txn_device_fraud_001',
      amount: 1500,
      currency: 'USD',
      transactionType: 'CARD_NOT_PRESENT',
      deviceRiskScore: 95,
      deviceFingerprint: 'fp_known_fraud_device',
      customer: {
        id: 'cust_009',
        name: 'Emily Watson',
        kycStatus: 'VERIFIED',
        isPEP: false,
      },
      description: 'High-risk device - known fraud association',
    },
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  },
];

/**
 * All demo events
 */
export const allDemoEvents: ArkaEvent[] = [
  ...compliantEvents,
  ...flaggedEvents,
  ...deniedEvents,
];

/**
 * Event scenarios for interactive demos
 */
export const demoScenarios = {
  compliant: {
    name: 'Compliant Transactions',
    description: 'Standard transactions that pass all compliance checks',
    expectedOutcome: 'ALLOW',
    events: compliantEvents,
  },
  ctrReporting: {
    name: 'CTR Reporting',
    description: 'Cash transactions over $10,000 requiring Currency Transaction Reports',
    expectedOutcome: 'FLAG',
    events: flaggedEvents.filter((e) => e.payload.transactionType === 'CASH_DEPOSIT'),
  },
  pepScreening: {
    name: 'PEP Screening',
    description: 'Transactions involving Politically Exposed Persons',
    expectedOutcome: 'FLAG',
    events: flaggedEvents.filter((e) => (e.payload as Record<string, unknown>).customer && ((e.payload as Record<string, { isPEP?: boolean }>).customer as { isPEP?: boolean })?.isPEP),
  },
  sanctions: {
    name: 'Sanctions Screening',
    description: 'Transactions involving OFAC sanctioned countries',
    expectedOutcome: 'DENY',
    events: deniedEvents.filter((e) =>
      e.payload.destinationCountry === 'IR' ||
      e.payload.destinationCountry === 'KP'
    ),
  },
  kycCompliance: {
    name: 'KYC Compliance',
    description: 'Customer verification status checks',
    expectedOutcome: 'DENY',
    events: deniedEvents.filter((e) => ((e.payload as Record<string, { kycStatus?: string }>).customer as { kycStatus?: string })?.kycStatus === 'PENDING'),
  },
  lendingCompliance: {
    name: 'Lending Compliance',
    description: 'Consumer protection rules for loans',
    expectedOutcome: 'DENY',
    events: deniedEvents.filter((e) => e.entityType === 'Loan'),
  },
  fraudDetection: {
    name: 'Fraud Detection',
    description: 'Real-time fraud prevention scenarios',
    expectedOutcome: 'MIXED',
    events: [
      ...flaggedEvents.filter((e) => e.payload.geoAnomalyScore),
      ...deniedEvents.filter((e) => e.payload.deviceRiskScore),
    ],
  },
};
