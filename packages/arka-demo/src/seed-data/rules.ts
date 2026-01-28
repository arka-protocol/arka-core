/**
 * Demo Seed Data - Compliance Rules
 *
 * Pre-configured rules for demonstrating ARKA Engine capabilities.
 */

import type { ArkaRule } from '@arka/types';

/**
 * AML (Anti-Money Laundering) Rules
 */
export const amlRules: ArkaRule[] = [
  {
    id: 'aml-ctr-threshold',
    name: 'Currency Transaction Report Threshold',
    description: 'Flag cash transactions over $10,000 for CTR filing (BSA requirement)',
    condition: {
      type: 'and',
      conditions: [
        { type: 'compare', field: 'payload.amount', operator: '>', value: 10000 },
        { type: 'compare', field: 'payload.transactionType', operator: 'in', value: ['CASH_DEPOSIT', 'CASH_WITHDRAWAL'] },
      ],
    },
    consequence: {
      decision: 'FLAG',
      code: 'CTR_REQUIRED',
      message: 'Cash transaction exceeds $10,000 - Currency Transaction Report required',
    },
    severity: 'HIGH',
    tags: ['aml', 'bsa', 'ctr', 'cash'],
    metadata: {
      regulation: 'Bank Secrecy Act',
      threshold: 10000,
      currency: 'USD',
    },
  },
  {
    id: 'aml-structuring-detection',
    name: 'Structuring Detection',
    description: 'Detect potential structuring - multiple transactions just under reporting threshold',
    condition: {
      type: 'and',
      conditions: [
        { type: 'compare', field: 'payload.amount', operator: '>=', value: 8000 },
        { type: 'compare', field: 'payload.amount', operator: '<', value: 10000 },
        { type: 'compare', field: 'payload.dailyTransactionCount', operator: '>=', value: 2 },
      ],
    },
    consequence: {
      decision: 'FLAG',
      code: 'POSSIBLE_STRUCTURING',
      message: 'Possible structuring detected - multiple transactions near $10,000 threshold',
    },
    severity: 'CRITICAL',
    tags: ['aml', 'structuring', 'suspicious'],
    metadata: {
      regulation: 'Bank Secrecy Act',
      pattern: 'structuring',
    },
  },
  {
    id: 'aml-high-risk-country',
    name: 'High-Risk Country Transaction',
    description: 'Flag transactions involving FATF high-risk jurisdictions',
    condition: {
      type: 'or',
      conditions: [
        { type: 'compare', field: 'payload.originCountry', operator: 'in', value: ['IR', 'KP', 'MM', 'SY'] },
        { type: 'compare', field: 'payload.destinationCountry', operator: 'in', value: ['IR', 'KP', 'MM', 'SY'] },
      ],
    },
    consequence: {
      decision: 'FLAG',
      code: 'HIGH_RISK_JURISDICTION',
      message: 'Transaction involves FATF high-risk or non-cooperative jurisdiction',
    },
    severity: 'CRITICAL',
    tags: ['aml', 'fatf', 'high-risk', 'jurisdiction'],
    metadata: {
      regulation: 'FATF Recommendations',
      riskLevel: 'HIGH',
    },
  },
  {
    id: 'aml-sanctions-ofac',
    name: 'OFAC Sanctions Block',
    description: 'Block transactions with OFAC sanctioned countries',
    condition: {
      type: 'or',
      conditions: [
        { type: 'compare', field: 'payload.originCountry', operator: 'in', value: ['CU', 'IR', 'KP', 'SY', 'RU'] },
        { type: 'compare', field: 'payload.destinationCountry', operator: 'in', value: ['CU', 'IR', 'KP', 'SY', 'RU'] },
      ],
    },
    consequence: {
      decision: 'DENY',
      code: 'OFAC_SANCTIONS_VIOLATION',
      message: 'Transaction blocked - involves OFAC sanctioned jurisdiction',
    },
    severity: 'CRITICAL',
    tags: ['aml', 'ofac', 'sanctions', 'blocked'],
    metadata: {
      regulation: 'OFAC Sanctions',
      enforcement: 'AUTOMATIC_BLOCK',
    },
  },
  {
    id: 'aml-pep-edd',
    name: 'PEP Enhanced Due Diligence',
    description: 'Flag transactions involving Politically Exposed Persons for enhanced review',
    condition: {
      type: 'compare',
      field: 'payload.customer.isPEP',
      operator: '==',
      value: true,
    },
    consequence: {
      decision: 'FLAG',
      code: 'PEP_EDD_REQUIRED',
      message: 'Customer is a PEP - Enhanced Due Diligence required',
    },
    severity: 'HIGH',
    tags: ['aml', 'kyc', 'pep', 'edd'],
    metadata: {
      regulation: 'FATF Recommendation 12',
      reviewRequired: true,
    },
  },
  {
    id: 'aml-velocity-24h',
    name: 'High Velocity Alert (24H)',
    description: 'Flag unusual transaction velocity within 24 hours',
    condition: {
      type: 'and',
      conditions: [
        { type: 'compare', field: 'payload.transactionCount24h', operator: '>', value: 10 },
        { type: 'compare', field: 'payload.totalAmount24h', operator: '>', value: 50000 },
      ],
    },
    consequence: {
      decision: 'FLAG',
      code: 'HIGH_VELOCITY_24H',
      message: 'Unusual transaction velocity - more than 10 transactions totaling $50,000+ in 24 hours',
    },
    severity: 'HIGH',
    tags: ['aml', 'velocity', 'suspicious'],
    metadata: {
      timeWindow: '24h',
      pattern: 'velocity',
    },
  },
];

/**
 * KYC (Know Your Customer) Rules
 */
export const kycRules: ArkaRule[] = [
  {
    id: 'kyc-verification-required',
    name: 'KYC Verification Required',
    description: 'Block transactions from customers without completed KYC',
    condition: {
      type: 'compare',
      field: 'payload.customer.kycStatus',
      operator: '!=',
      value: 'VERIFIED',
    },
    consequence: {
      decision: 'DENY',
      code: 'KYC_NOT_VERIFIED',
      message: 'Transaction blocked - Customer KYC verification incomplete',
    },
    severity: 'HIGH',
    tags: ['kyc', 'verification', 'onboarding'],
    metadata: {
      regulation: 'CDD Rule',
      requirement: 'MANDATORY',
    },
  },
  {
    id: 'kyc-expired-documents',
    name: 'Expired KYC Documents',
    description: 'Flag customers with expired identification documents',
    condition: {
      type: 'compare',
      field: 'payload.customer.documentsExpired',
      operator: '==',
      value: true,
    },
    consequence: {
      decision: 'FLAG',
      code: 'KYC_DOCUMENTS_EXPIRED',
      message: 'Customer identification documents have expired - re-verification required',
    },
    severity: 'MEDIUM',
    tags: ['kyc', 'documents', 'expiry'],
    metadata: {
      regulation: 'CDD Rule',
      action: 'REVERIFICATION',
    },
  },
  {
    id: 'kyc-high-risk-business',
    name: 'High-Risk Business Type',
    description: 'Flag transactions from high-risk business categories',
    condition: {
      type: 'compare',
      field: 'payload.customer.businessType',
      operator: 'in',
      value: ['MSB', 'CRYPTO_EXCHANGE', 'GAMBLING', 'ADULT_ENTERTAINMENT', 'WEAPONS'],
    },
    consequence: {
      decision: 'FLAG',
      code: 'HIGH_RISK_BUSINESS_TYPE',
      message: 'Customer operates in high-risk business category - enhanced monitoring required',
    },
    severity: 'HIGH',
    tags: ['kyc', 'business', 'high-risk'],
    metadata: {
      regulation: 'CDD Rule',
      monitoringLevel: 'ENHANCED',
    },
  },
];

/**
 * Cross-Border Transaction Rules
 */
export const crossBorderRules: ArkaRule[] = [
  {
    id: 'xborder-large-transfer',
    name: 'Large Cross-Border Transfer',
    description: 'Flag large international wire transfers for review',
    condition: {
      type: 'and',
      conditions: [
        { type: 'compare', field: 'payload.isCrossBorder', operator: '==', value: true },
        { type: 'compare', field: 'payload.amount', operator: '>', value: 25000 },
      ],
    },
    consequence: {
      decision: 'FLAG',
      code: 'LARGE_CROSS_BORDER_TRANSFER',
      message: 'Cross-border transfer over $25,000 requires additional review',
    },
    severity: 'MEDIUM',
    tags: ['cross-border', 'wire', 'international'],
    metadata: {
      threshold: 25000,
      currency: 'USD',
    },
  },
  {
    id: 'xborder-correspondent-bank',
    name: 'Correspondent Bank Check',
    description: 'Flag transactions through high-risk correspondent banks',
    condition: {
      type: 'compare',
      field: 'payload.correspondentBankRisk',
      operator: '==',
      value: 'HIGH',
    },
    consequence: {
      decision: 'FLAG',
      code: 'HIGH_RISK_CORRESPONDENT',
      message: 'Transaction routes through high-risk correspondent bank',
    },
    severity: 'HIGH',
    tags: ['cross-border', 'correspondent', 'bank-risk'],
    metadata: {
      regulation: 'Wolfsberg Principles',
    },
  },
];

/**
 * Lending/Consumer Protection Rules
 */
export const lendingRules: ArkaRule[] = [
  {
    id: 'lending-apr-cap-ca',
    name: 'California APR Cap',
    description: 'Enforce California maximum APR for consumer loans',
    condition: {
      type: 'and',
      conditions: [
        { type: 'compare', field: 'payload.jurisdiction', operator: '==', value: 'US-CA' },
        { type: 'compare', field: 'payload.apr', operator: '>', value: 36 },
        { type: 'compare', field: 'payload.loanType', operator: '==', value: 'CONSUMER' },
      ],
    },
    consequence: {
      decision: 'DENY',
      code: 'APR_EXCEEDS_CA_CAP',
      message: 'APR exceeds California maximum of 36% for consumer loans',
    },
    severity: 'CRITICAL',
    jurisdiction: 'US-CA',
    tags: ['lending', 'apr', 'consumer-protection', 'california'],
    metadata: {
      regulation: 'California Fair Access to Credit Act',
      maxApr: 36,
    },
  },
  {
    id: 'lending-dti-limit',
    name: 'Debt-to-Income Ratio Limit',
    description: 'Flag loans where DTI exceeds 43%',
    condition: {
      type: 'compare',
      field: 'payload.dtiRatio',
      operator: '>',
      value: 43,
    },
    consequence: {
      decision: 'FLAG',
      code: 'HIGH_DTI_RATIO',
      message: 'Debt-to-income ratio exceeds 43% - manual underwriting review required',
    },
    severity: 'MEDIUM',
    tags: ['lending', 'dti', 'underwriting'],
    metadata: {
      regulation: 'QM Rule',
      threshold: 43,
    },
  },
  {
    id: 'lending-military-mla',
    name: 'Military Lending Act Protection',
    description: 'Enforce MLA protections for active duty military',
    condition: {
      type: 'and',
      conditions: [
        { type: 'compare', field: 'payload.customer.isMilitary', operator: '==', value: true },
        { type: 'compare', field: 'payload.mapr', operator: '>', value: 36 },
      ],
    },
    consequence: {
      decision: 'DENY',
      code: 'MLA_VIOLATION',
      message: 'MAPR exceeds 36% for military servicemember - Military Lending Act violation',
    },
    severity: 'CRITICAL',
    tags: ['lending', 'military', 'mla', 'consumer-protection'],
    metadata: {
      regulation: 'Military Lending Act',
      maxMapr: 36,
    },
  },
];

/**
 * Fraud Detection Rules
 */
export const fraudRules: ArkaRule[] = [
  {
    id: 'fraud-new-account-high-value',
    name: 'New Account High-Value Transaction',
    description: 'Flag high-value transactions from accounts less than 30 days old',
    condition: {
      type: 'and',
      conditions: [
        { type: 'compare', field: 'payload.accountAgeDays', operator: '<', value: 30 },
        { type: 'compare', field: 'payload.amount', operator: '>', value: 5000 },
      ],
    },
    consequence: {
      decision: 'FLAG',
      code: 'NEW_ACCOUNT_HIGH_VALUE',
      message: 'High-value transaction from account less than 30 days old',
    },
    severity: 'HIGH',
    tags: ['fraud', 'new-account', 'velocity'],
    metadata: {
      pattern: 'new_account_abuse',
    },
  },
  {
    id: 'fraud-geo-anomaly',
    name: 'Geographic Anomaly Detection',
    description: 'Flag transactions from unusual geographic locations',
    condition: {
      type: 'compare',
      field: 'payload.geoAnomalyScore',
      operator: '>',
      value: 80,
    },
    consequence: {
      decision: 'FLAG',
      code: 'GEO_ANOMALY_DETECTED',
      message: 'Transaction from unusual geographic location for this customer',
    },
    severity: 'HIGH',
    tags: ['fraud', 'geo', 'anomaly'],
    metadata: {
      pattern: 'geographic_anomaly',
      threshold: 80,
    },
  },
  {
    id: 'fraud-device-fingerprint',
    name: 'Suspicious Device Fingerprint',
    description: 'Block transactions from devices associated with fraud',
    condition: {
      type: 'compare',
      field: 'payload.deviceRiskScore',
      operator: '>',
      value: 90,
    },
    consequence: {
      decision: 'DENY',
      code: 'HIGH_RISK_DEVICE',
      message: 'Transaction blocked - device associated with fraudulent activity',
    },
    severity: 'CRITICAL',
    tags: ['fraud', 'device', 'fingerprint'],
    metadata: {
      pattern: 'device_fraud',
      threshold: 90,
    },
  },
];

/**
 * All demo rules combined
 */
export const allDemoRules: ArkaRule[] = [
  ...amlRules,
  ...kycRules,
  ...crossBorderRules,
  ...lendingRules,
  ...fraudRules,
];

/**
 * Rule categories for demo organization
 */
export const ruleCategories = {
  aml: {
    name: 'Anti-Money Laundering',
    description: 'BSA/AML compliance rules including CTR, sanctions, and suspicious activity detection',
    rules: amlRules,
  },
  kyc: {
    name: 'Know Your Customer',
    description: 'Customer identification and verification rules',
    rules: kycRules,
  },
  crossBorder: {
    name: 'Cross-Border Transactions',
    description: 'International wire transfer and correspondent banking rules',
    rules: crossBorderRules,
  },
  lending: {
    name: 'Lending & Consumer Protection',
    description: 'Consumer lending regulations including APR caps and MLA',
    rules: lendingRules,
  },
  fraud: {
    name: 'Fraud Detection',
    description: 'Real-time fraud detection and prevention rules',
    rules: fraudRules,
  },
};
