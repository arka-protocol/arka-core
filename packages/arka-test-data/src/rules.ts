/**
 * Test Rule Fixtures
 */

import type { ArkaRule } from '@arka-protocol/types';

// ============ Loan Rules ============

/**
 * California APR Cap Rule
 * California limits consumer loan APR to 36%
 */
export const californiaAprCapRule: ArkaRule = {
  id: 'rul_ca_apr_cap',
  name: 'California APR Cap',
  description: 'Enforces the California maximum APR cap of 36% for consumer loans',
  appliesToEntityType: 'Loan',
  appliesToEventType: 'LOAN_CREATED',
  jurisdiction: 'US-CA',
  severity: 'CRITICAL',
  condition: {
    type: 'compare',
    field: 'loan.apr',
    operator: '>',
    value: 0.36,
  },
  consequence: {
    decision: 'DENY',
    code: 'CA_APR_EXCEEDED',
    message: 'Loan APR exceeds California maximum of 36%',
    remediation: 'Reduce the APR to 36% or below to comply with California law',
  },
  tags: ['compliance', 'california', 'apr', 'consumer-protection'],
  metadata: {
    legalReference: 'California Civil Code Section 1916-1',
    effectiveDate: '2020-01-01',
  },
  status: 'ACTIVE',
  version: 1,
};

/**
 * High-Risk Loan Detection Rule
 * Flags loans with high APR AND long terms
 */
export const highRiskLoanRule: ArkaRule = {
  id: 'rul_high_risk_loan',
  name: 'High Risk Loan Detection',
  description: 'Flags loans that combine high APR with long terms as high risk',
  appliesToEntityType: 'Loan',
  appliesToEventType: 'LOAN_CREATED',
  severity: 'HIGH',
  condition: {
    type: 'and',
    conditions: [
      { type: 'compare', field: 'loan.apr', operator: '>', value: 0.25 },
      { type: 'compare', field: 'loan.termMonths', operator: '>', value: 48 },
    ],
  },
  consequence: {
    decision: 'FLAG',
    code: 'HIGH_RISK_COMBINATION',
    message: 'High APR combined with long term creates excessive risk for borrower',
    remediation: 'Consider reducing APR or shortening term',
  },
  tags: ['risk', 'monitoring', 'loan-quality'],
  metadata: {
    riskCategory: 'credit',
  },
  status: 'ACTIVE',
  version: 1,
};

/**
 * Large Loan Amount Rule
 * Requires review for loans over $100,000
 */
export const largeLoanAmountRule: ArkaRule = {
  id: 'rul_large_loan_amount',
  name: 'Large Loan Amount Review',
  description: 'Requires manual review for loans exceeding $100,000',
  appliesToEntityType: 'Loan',
  appliesToEventType: 'LOAN_CREATED',
  severity: 'MEDIUM',
  condition: {
    type: 'compare',
    field: 'loan.amount',
    operator: '>',
    value: 100000,
  },
  consequence: {
    decision: 'FLAG',
    code: 'LARGE_LOAN_REVIEW',
    message: 'Loan amount exceeds $100,000 and requires additional review',
    remediation: 'Submit for senior underwriter approval',
  },
  tags: ['review', 'underwriting', 'amount'],
  metadata: {},
  status: 'ACTIVE',
  version: 1,
};

/**
 * Low Credit Score Rule
 * Denies loans to borrowers with very low credit scores
 */
export const lowCreditScoreRule: ArkaRule = {
  id: 'rul_low_credit_score',
  name: 'Minimum Credit Score',
  description: 'Denies loans to borrowers with credit scores below 500',
  appliesToEntityType: 'Loan',
  appliesToEventType: 'LOAN_CREATED',
  severity: 'HIGH',
  condition: {
    type: 'compare',
    field: 'borrower.creditScore',
    operator: '<',
    value: 500,
  },
  consequence: {
    decision: 'DENY',
    code: 'CREDIT_SCORE_TOO_LOW',
    message: 'Borrower credit score is below minimum threshold',
    remediation: 'Applicant must improve credit score before reapplying',
  },
  tags: ['credit', 'underwriting', 'risk'],
  metadata: {},
  status: 'ACTIVE',
  version: 1,
};

// ============ Shipment/Tariff Rules ============

/**
 * High Value Shipment Rule
 * Flags shipments over $100,000 for inspection
 */
export const highValueShipmentRule: ArkaRule = {
  id: 'rul_high_value_shipment',
  name: 'High Value Shipment Inspection',
  description: 'Flags high-value shipments for customs inspection',
  appliesToEntityType: 'Shipment',
  appliesToEventType: 'SHIPMENT_DECLARED',
  severity: 'MEDIUM',
  condition: {
    type: 'compare',
    field: 'shipment.value',
    operator: '>',
    value: 100000,
  },
  consequence: {
    decision: 'FLAG',
    code: 'HIGH_VALUE_INSPECTION',
    message: 'Shipment value exceeds $100,000 - requires inspection',
    remediation: 'Route to inspection queue',
  },
  tags: ['customs', 'inspection', 'high-value'],
  metadata: {},
  status: 'ACTIVE',
  version: 1,
};

/**
 * Restricted Origin Rule
 * Flags shipments from certain countries
 */
export const restrictedOriginRule: ArkaRule = {
  id: 'rul_restricted_origin',
  name: 'Restricted Origin Countries',
  description: 'Flags shipments from countries with trade restrictions',
  appliesToEntityType: 'Shipment',
  appliesToEventType: 'SHIPMENT_DECLARED',
  severity: 'HIGH',
  condition: {
    type: 'compare',
    field: 'shipment.origin',
    operator: 'in',
    value: ['KP', 'IR', 'CU', 'SY'],
  },
  consequence: {
    decision: 'DENY',
    code: 'RESTRICTED_ORIGIN',
    message: 'Shipment originates from a restricted country',
    remediation: 'Cannot process shipments from this origin',
  },
  tags: ['customs', 'sanctions', 'compliance'],
  metadata: {
    regulatoryBasis: 'OFAC Sanctions',
  },
  status: 'ACTIVE',
  version: 1,
};

/**
 * Electronics HS Code Rule
 * Requires documentation for electronics imports
 */
export const electronicsHsCodeRule: ArkaRule = {
  id: 'rul_electronics_documentation',
  name: 'Electronics Import Documentation',
  description: 'Requires FCC documentation for electronics imports',
  appliesToEntityType: 'Shipment',
  appliesToEventType: 'SHIPMENT_DECLARED',
  severity: 'LOW',
  condition: {
    type: 'compare',
    field: 'shipment.hsCode',
    operator: 'starts_with',
    value: '8471',
  },
  consequence: {
    decision: 'FLAG',
    code: 'ELECTRONICS_DOCUMENTATION',
    message: 'Electronics shipment requires FCC compliance documentation',
    remediation: 'Provide FCC certification or declaration',
  },
  tags: ['customs', 'electronics', 'documentation'],
  metadata: {
    requiredDocuments: ['FCC Declaration', 'Product Certification'],
  },
  status: 'ACTIVE',
  version: 1,
};

// ============ Rule Collections ============

export const loanRules: ArkaRule[] = [
  californiaAprCapRule,
  highRiskLoanRule,
  largeLoanAmountRule,
  lowCreditScoreRule,
];

export const shipmentRules: ArkaRule[] = [
  highValueShipmentRule,
  restrictedOriginRule,
  electronicsHsCodeRule,
];

export const allSampleRules: ArkaRule[] = [
  ...loanRules,
  ...shipmentRules,
];
