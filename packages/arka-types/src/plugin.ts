/**
 * ARKA Plugin Types
 *
 * Extended plugin interfaces for the ARKA v1 plugin suite.
 * These interfaces extend the basic plugin SDK types to support
 * advanced functionality like audit logging, risk scoring, and compliance AI.
 */

import type { ArkaEvent } from './event.js';
import type { ArkaEntity } from './entity.js';
import type { ArkaRule } from './rule.js';
import type { ArkaDecision } from './decision.js';

// ============================================================================
// Core Plugin Context
// ============================================================================

/**
 * Transaction data normalized for ARKA processing
 */
export interface ArkaTransaction {
  /** Unique transaction identifier */
  id: string;
  /** Source system identifier */
  source: string;
  /** Transaction type (e.g., "wire_transfer", "crypto_transfer") */
  type: string;
  /** Sending entity */
  fromEntity?: ArkaTransactionParty | null;
  /** Receiving entity */
  toEntity?: ArkaTransactionParty | null;
  /** Transaction amount */
  amount: number;
  /** Currency code (ISO 4217 or crypto symbol) */
  currency: string;
  /** Jurisdiction code */
  jurisdiction?: string | null;
  /** Asset type for categorization */
  assetType?: AssetType | null;
  /** Additional transaction metadata */
  metadata: Record<string, unknown>;
  /** When the transaction occurred */
  occurredAt: string;
  /** When the transaction was received by ARKA */
  receivedAt: string;
  /** Reference to the original event */
  eventId?: string | null;
}

/**
 * Party to a transaction (sender or receiver)
 */
export interface ArkaTransactionParty {
  /** Entity ID if known */
  entityId?: string | null;
  /** Account/wallet identifier */
  accountId?: string | null;
  /** Jurisdiction of the party */
  jurisdiction?: string | null;
  /** Party name if available */
  name?: string | null;
  /** Entity type (e.g., "individual", "business") */
  entityType?: string | null;
  /** Additional party metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Asset types for categorization
 */
export type AssetType =
  | 'fiat'
  | 'crypto'
  | 'security'
  | 'commodity'
  | 'nft'
  | 'stablecoin'
  | 'privacy_coin'
  | 'other';

// ============================================================================
// Audit Types
// ============================================================================

/**
 * Represents an immutable audit record
 */
export interface AuditRecord {
  /** Unique audit record ID */
  id: string;
  /** Audit event type */
  eventType: AuditEventType;
  /** When the audit event occurred */
  timestamp: string;
  /** Actor who initiated the action (user ID, system, etc.) */
  actor?: AuditActor | null;
  /** Correlation IDs for tracing */
  correlationIds: AuditCorrelationIds;
  /** Category of the audit event */
  category: AuditCategory;
  /** Severity level */
  severity: AuditSeverity;
  /** Human-readable description */
  description: string;
  /** Structured audit data */
  data: Record<string, unknown>;
  /** Evidence attachments */
  evidence?: EvidenceAttachment[];
  /** Hash of the previous record for chain integrity */
  previousHash?: string | null;
  /** Hash of this record */
  recordHash: string;
}

/**
 * Types of audit events
 */
export type AuditEventType =
  | 'transaction_received'
  | 'transaction_processed'
  | 'rule_evaluated'
  | 'rule_fired'
  | 'alert_generated'
  | 'risk_score_computed'
  | 'decision_made'
  | 'manual_override'
  | 'entity_created'
  | 'entity_updated'
  | 'config_changed'
  | 'plugin_loaded'
  | 'plugin_unloaded'
  | 'report_generated'
  | 'external_query'
  | 'custom';

/**
 * Actor in an audit event
 */
export interface AuditActor {
  /** Actor type */
  type: 'user' | 'system' | 'api' | 'plugin';
  /** Actor identifier */
  id: string;
  /** Actor name */
  name?: string | null;
  /** IP address if applicable */
  ipAddress?: string | null;
  /** Additional actor metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Correlation IDs for audit tracing
 */
export interface AuditCorrelationIds {
  /** Transaction ID */
  transactionId?: string | null;
  /** Entity ID */
  entityId?: string | null;
  /** Rule ID */
  ruleId?: string | null;
  /** Alert ID */
  alertId?: string | null;
  /** Request/trace ID */
  requestId?: string | null;
  /** Session ID */
  sessionId?: string | null;
  /** External reference ID */
  externalId?: string | null;
}

/**
 * Categories for audit events
 */
export type AuditCategory =
  | 'transaction'
  | 'compliance'
  | 'risk'
  | 'security'
  | 'configuration'
  | 'system'
  | 'reporting';

/**
 * Severity levels for audit events
 */
export type AuditSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical';

/**
 * Evidence attachment for audit records
 */
export interface EvidenceAttachment {
  /** Attachment ID */
  id: string;
  /** Type of evidence */
  type: EvidenceType;
  /** MIME type */
  mimeType: string;
  /** Filename */
  filename?: string | null;
  /** Size in bytes */
  size: number;
  /** Hash of the content */
  contentHash: string;
  /** Storage location reference */
  storageRef: string;
  /** When the evidence was captured */
  capturedAt: string;
  /** Description */
  description?: string | null;
}

/**
 * Types of evidence
 */
export type EvidenceType =
  | 'transaction_data'
  | 'rule_context'
  | 'entity_snapshot'
  | 'external_response'
  | 'screenshot'
  | 'document'
  | 'log_excerpt'
  | 'other';

/**
 * Query parameters for audit records
 */
export interface AuditQuery {
  /** Filter by event types */
  eventTypes?: AuditEventType[];
  /** Filter by categories */
  categories?: AuditCategory[];
  /** Filter by severity levels */
  severities?: AuditSeverity[];
  /** Filter by actor ID */
  actorId?: string;
  /** Filter by correlation IDs */
  correlationIds?: Partial<AuditCorrelationIds>;
  /** Start timestamp (inclusive) */
  fromTimestamp?: string;
  /** End timestamp (exclusive) */
  toTimestamp?: string;
  /** Maximum records to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort order */
  orderBy?: 'timestamp_asc' | 'timestamp_desc';
}

// ============================================================================
// Risk Scoring Types
// ============================================================================

/**
 * Complete risk score bundle
 */
export interface RiskScoreBundle {
  /** Overall computed risk score (0-100) */
  overallScore: number;
  /** Risk level classification */
  riskLevel: RiskLevel;
  /** Individual risk factors contributing to the score */
  factors: PluginRiskFactor[];
  /** Entity-level risk scores */
  entityScores?: PluginEntityRiskScore[];
  /** When the score was computed */
  computedAt: string;
  /** Model version used */
  modelVersion: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Explanation of the score */
  explanation?: string | null;
  /** Transaction ID if scoring a transaction */
  transactionId?: string | null;
}

/**
 * Risk levels
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Individual risk factor for plugins
 */
export interface PluginRiskFactor {
  /** Factor identifier */
  id: string;
  /** Factor category */
  category: RiskFactorCategory;
  /** Human-readable name */
  name: string;
  /** Weight in the model (0-1) */
  weight: number;
  /** Raw score for this factor (0-100) */
  score: number;
  /** Weighted contribution to overall score */
  contribution: number;
  /** Description of why this factor applies */
  description?: string | null;
  /** Source data that triggered this factor */
  sourceData?: Record<string, unknown>;
}

/**
 * Categories of risk factors
 */
export type RiskFactorCategory =
  | 'jurisdiction'
  | 'amount'
  | 'velocity'
  | 'entity'
  | 'asset'
  | 'pattern'
  | 'history'
  | 'kyc'
  | 'network'
  | 'sanctions'
  | 'custom';

/**
 * Risk score for an entity (plugin-specific)
 */
export interface PluginEntityRiskScore {
  /** Entity ID */
  entityId: string;
  /** Entity type */
  entityType: string;
  /** Risk score (0-100) */
  score: number;
  /** Risk level */
  riskLevel: RiskLevel;
  /** Contributing factors */
  factors: string[];
  /** Last updated */
  updatedAt: string;
}

/**
 * Input for risk computation
 */
export interface RiskInput {
  /** Transaction being scored */
  transaction?: ArkaTransaction | null;
  /** Entity being scored */
  entity?: ArkaEntity | null;
  /** Related events */
  events?: ArkaEvent[];
  /** Historical context */
  history?: RiskHistoryContext | null;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Historical context for risk scoring
 */
export interface RiskHistoryContext {
  /** Past transactions count (30 days) */
  recentTransactionCount: number;
  /** Total transaction volume (30 days) */
  recentTransactionVolume: number;
  /** Previous alerts count */
  previousAlertCount: number;
  /** Previous risk scores */
  previousRiskScores: Array<{ score: number; timestamp: string }>;
  /** Known relationships */
  relationships?: string[];
}

// ============================================================================
// Alert Types
// ============================================================================

/**
 * Alert generated by the system
 */
export interface Alert {
  /** Unique alert ID */
  id: string;
  /** Alert type */
  type: AlertType;
  /** Severity level */
  severity: AlertSeverity;
  /** Alert category */
  category: AlertCategory;
  /** Alert title */
  title: string;
  /** Detailed description */
  description: string;
  /** Related references */
  references: AlertReferences;
  /** When the alert was generated */
  generatedAt: string;
  /** Alert status */
  status: AlertStatus;
  /** Priority (1-10, higher = more urgent) */
  priority: number;
  /** Risk score that triggered this alert */
  riskScore?: number | null;
  /** Recommended actions */
  recommendedActions?: string[];
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Alert types
 */
export type AlertType =
  | 'threshold_breach'
  | 'pattern_detected'
  | 'sanctions_hit'
  | 'velocity_anomaly'
  | 'structuring_suspected'
  | 'high_risk_entity'
  | 'high_risk_jurisdiction'
  | 'rule_violation'
  | 'system_error'
  | 'custom';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'high' | 'critical';

/**
 * Alert categories
 */
export type AlertCategory =
  | 'aml'
  | 'fraud'
  | 'policy_violation'
  | 'anomaly'
  | 'compliance'
  | 'operational'
  | 'security';

/**
 * Alert status
 */
export type AlertStatus =
  | 'new'
  | 'acknowledged'
  | 'investigating'
  | 'escalated'
  | 'resolved'
  | 'false_positive'
  | 'dismissed';

/**
 * References linked to an alert
 */
export interface AlertReferences {
  /** Transaction IDs */
  transactionIds?: string[];
  /** Entity IDs */
  entityIds?: string[];
  /** Rule IDs */
  ruleIds?: string[];
  /** Related alert IDs */
  relatedAlertIds?: string[];
  /** External reference IDs */
  externalIds?: string[];
}

/**
 * Alert channel configuration
 */
export interface AlertChannelConfig {
  /** Channel type */
  type: AlertChannelType;
  /** Whether the channel is enabled */
  enabled: boolean;
  /** Minimum severity to send through this channel */
  minSeverity: AlertSeverity;
  /** Categories to include (empty = all) */
  categories?: AlertCategory[];
  /** Channel-specific configuration */
  config: Record<string, unknown>;
}

/**
 * Alert channel types
 */
export type AlertChannelType =
  | 'webhook'
  | 'email'
  | 'kafka'
  | 'rabbitmq'
  | 'slack'
  | 'internal'
  | 'custom';

// ============================================================================
// Regulatory Documentation Types
// ============================================================================

/**
 * Reference to a regulatory document/clause
 */
export interface RegulationReference {
  /** Unique reference ID */
  id: string;
  /** Regulatory body (e.g., "FinCEN", "FCA", "FATF") */
  authority: string;
  /** Regulation identifier (e.g., "31 CFR 1010.320") */
  regulationId: string;
  /** Section/clause reference */
  section?: string | null;
  /** Title of the regulation */
  title: string;
  /** Description/summary */
  description?: string | null;
  /** URL to official documentation */
  url?: string | null;
  /** Applicable jurisdictions */
  jurisdictions: string[];
  /** Effective date */
  effectiveDate?: string | null;
  /** Tags for categorization */
  tags: string[];
}

/**
 * Mapping between rules and regulatory references
 */
export interface RuleRegMapping {
  /** Rule ID */
  ruleId: string;
  /** Regulation reference IDs */
  regulationRefIds: string[];
  /** Compliance requirement type */
  requirementType: RequirementType;
  /** Notes about the mapping */
  notes?: string | null;
}

/**
 * Types of compliance requirements
 */
export type RequirementType =
  | 'mandatory'
  | 'recommended'
  | 'optional'
  | 'prohibited';

/**
 * Request for an explanation
 */
export interface ExplanationRequest {
  /** Type of explanation requested */
  type: ExplanationType;
  /** Decision/alert to explain */
  decision?: ArkaDecision | null;
  /** Alert to explain */
  alert?: Alert | null;
  /** Transaction context */
  transaction?: ArkaTransaction | null;
  /** Rules that were evaluated */
  rules?: ArkaRule[];
  /** Risk score context */
  riskScore?: RiskScoreBundle | null;
  /** Audience for the explanation */
  audience: ExplanationAudience;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Types of explanations
 */
export type ExplanationType =
  | 'decision'
  | 'alert'
  | 'risk_score'
  | 'rule_evaluation'
  | 'compliance_status';

/**
 * Target audience for explanations
 */
export type ExplanationAudience =
  | 'compliance_officer'
  | 'regulator'
  | 'executive'
  | 'technical'
  | 'customer';

/**
 * Response containing an explanation
 */
export interface ExplanationResponse {
  /** Request ID */
  requestId: string;
  /** Type of explanation */
  type: ExplanationType;
  /** Natural language explanation */
  explanation: string;
  /** Structured summary points */
  summaryPoints: string[];
  /** Relevant regulatory references */
  regulatoryReferences: RegulationReference[];
  /** Supporting evidence */
  evidence?: EvidenceAttachment[];
  /** Confidence in the explanation (0-1) */
  confidence: number;
  /** When generated */
  generatedAt: string;
}

/**
 * Context for report generation
 */
export interface ReportContext {
  /** Report type */
  type: ReportType;
  /** Time period start */
  periodStart: string;
  /** Time period end */
  periodEnd: string;
  /** Entities to include */
  entityIds?: string[];
  /** Transactions to include */
  transactionIds?: string[];
  /** Alerts to include */
  alertIds?: string[];
  /** Target audience */
  audience: ExplanationAudience;
  /** Report format */
  format: ReportFormat;
  /** Additional parameters */
  parameters?: Record<string, unknown>;
}

/**
 * Types of reports
 */
export type ReportType =
  | 'sar'
  | 'ctr'
  | 'str'
  | 'compliance_summary'
  | 'risk_assessment'
  | 'audit_report'
  | 'executive_summary'
  | 'custom';

/**
 * Report output formats
 */
export type ReportFormat = 'json' | 'pdf' | 'html' | 'markdown' | 'xml';

/**
 * Generated report draft
 */
export interface ReportDraft {
  /** Draft ID */
  id: string;
  /** Report type */
  type: ReportType;
  /** Report title */
  title: string;
  /** Generated content */
  content: string;
  /** Format of the content */
  format: ReportFormat;
  /** Structured sections */
  sections: ReportSection[];
  /** References used */
  references: RegulationReference[];
  /** Status of the draft */
  status: 'draft' | 'review' | 'approved' | 'submitted';
  /** When generated */
  generatedAt: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Warnings/notes for reviewer */
  reviewerNotes?: string[];
}

/**
 * Section of a report
 */
export interface ReportSection {
  /** Section ID */
  id: string;
  /** Section title */
  title: string;
  /** Section content */
  content: string;
  /** Order in the report */
  order: number;
  /** Whether AI-generated */
  aiGenerated: boolean;
}

// ============================================================================
// Protocol/Data Integration Types
// ============================================================================

/**
 * gRPC source configuration
 */
export interface GrpcSourceConfig {
  /** Unique source identifier */
  id: string;
  /** gRPC server host */
  host: string;
  /** gRPC server port */
  port: number;
  /** Whether to use TLS */
  useTls: boolean;
  /** Path to CA certificate */
  caCertPath?: string | null;
  /** Path to client certificate */
  clientCertPath?: string | null;
  /** Path to client key */
  clientKeyPath?: string | null;
  /** Service name */
  serviceName: string;
  /** Method name for streaming */
  methodName: string;
  /** Proto file path */
  protoPath: string;
  /** Message type name */
  messageType: string;
  /** Connection timeout in ms */
  connectionTimeoutMs: number;
  /** Request timeout in ms */
  requestTimeoutMs: number;
  /** Retry configuration */
  retry?: RetryConfig;
}

/**
 * Kafka source configuration
 */
export interface KafkaSourceConfig {
  /** Unique source identifier */
  id: string;
  /** Kafka broker addresses */
  brokers: string[];
  /** Topic to consume from */
  topic: string;
  /** Consumer group ID */
  groupId: string;
  /** Where to start reading */
  fromBeginning: boolean;
  /** SASL configuration */
  sasl?: KafkaSaslConfig | null;
  /** SSL configuration */
  ssl?: KafkaSslConfig | null;
  /** Message format */
  messageFormat: 'json' | 'avro' | 'protobuf';
  /** Schema registry URL (for Avro/Protobuf) */
  schemaRegistryUrl?: string | null;
  /** Max batch size */
  maxBatchSize: number;
  /** Session timeout in ms */
  sessionTimeoutMs: number;
  /** Heartbeat interval in ms */
  heartbeatIntervalMs: number;
}

/**
 * Kafka SASL configuration
 */
export interface KafkaSaslConfig {
  mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
  username: string;
  password: string;
}

/**
 * Kafka SSL configuration
 */
export interface KafkaSslConfig {
  rejectUnauthorized: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

/**
 * Blockchain/on-chain data source configuration
 */
export interface ChainSourceConfig {
  /** Unique source identifier */
  id: string;
  /** Chain type */
  chainType: ChainType;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** WebSocket URL for subscriptions */
  wsUrl?: string | null;
  /** Chain ID */
  chainId: number;
  /** Contract addresses to monitor */
  contractAddresses?: string[];
  /** Block confirmations required */
  confirmations: number;
  /** Starting block number */
  startBlock?: number | null;
  /** Polling interval in ms (if not using WebSocket) */
  pollIntervalMs: number;
  /** API key if required */
  apiKey?: string | null;
  /** Rate limit (requests per second) */
  rateLimit: number;
}

/**
 * Supported chain types
 */
export type ChainType =
  | 'ethereum'
  | 'polygon'
  | 'bsc'
  | 'avalanche'
  | 'arbitrum'
  | 'optimism'
  | 'solana'
  | 'bitcoin'
  | 'custom';

/**
 * Retry configuration for external connections
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Protocol event from external source
 */
export interface ProtocolEvent {
  /** Unique event ID */
  id: string;
  /** Source identifier */
  sourceId: string;
  /** Source type */
  sourceType: 'grpc' | 'kafka' | 'chain';
  /** Raw message data */
  rawData: Buffer | string;
  /** Parsed data */
  parsedData: Record<string, unknown>;
  /** When the event was received */
  receivedAt: string;
  /** When the event occurred (if available) */
  occurredAt?: string | null;
  /** Message metadata */
  metadata: ProtocolEventMetadata;
}

/**
 * Metadata for protocol events
 */
export interface ProtocolEventMetadata {
  /** Kafka offset or block number */
  offset?: number | string;
  /** Kafka partition */
  partition?: number;
  /** Block hash for chain events */
  blockHash?: string;
  /** Transaction hash for chain events */
  txHash?: string;
  /** gRPC method called */
  grpcMethod?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

// ============================================================================
// AML/Compliance Types
// ============================================================================

/**
 * Monitoring profile for transaction monitoring
 */
export interface MonitoringProfile {
  /** Profile ID */
  id: string;
  /** Profile name */
  name: string;
  /** Description */
  description: string;
  /** Industry type this profile applies to */
  industryType: IndustryType;
  /** Enabled rules for this profile */
  enabledRuleIds: string[];
  /** Thresholds specific to this profile */
  thresholds: MonitoringThresholds;
  /** Risk appetite (affects scoring) */
  riskAppetite: RiskLevel;
  /** Active jurisdictions */
  jurisdictions: string[];
  /** Whether the profile is active */
  active: boolean;
}

/**
 * Industry types for monitoring profiles
 */
export type IndustryType =
  | 'retail_banking'
  | 'crypto_exchange'
  | 'payment_processor'
  | 'lender'
  | 'insurance'
  | 'securities'
  | 'money_service'
  | 'custom';

/**
 * Monitoring thresholds
 */
export interface MonitoringThresholds {
  /** Large transaction threshold (in base currency) */
  largeTransactionAmount: number;
  /** Structuring detection threshold */
  structuringThreshold: number;
  /** Structuring window (hours) */
  structuringWindowHours: number;
  /** Maximum transactions per window for velocity */
  velocityMaxTransactions: number;
  /** Velocity window (hours) */
  velocityWindowHours: number;
  /** High-risk amount threshold */
  highRiskAmountThreshold: number;
}

/**
 * Monitoring rule definition
 */
export interface MonitoringRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule category */
  category: MonitoringRuleCategory;
  /** Rule description */
  description: string;
  /** Whether the rule is enabled */
  enabled: boolean;
  /** Severity when triggered */
  severity: AlertSeverity;
  /** Rule parameters */
  parameters: Record<string, unknown>;
  /** Jurisdictions where this rule applies */
  jurisdictions?: string[];
}

/**
 * Categories of monitoring rules
 */
export type MonitoringRuleCategory =
  | 'threshold'
  | 'velocity'
  | 'structuring'
  | 'jurisdiction'
  | 'entity'
  | 'pattern'
  | 'sanctions'
  | 'custom';

/**
 * Suspicious activity detected by monitoring
 */
export interface SuspiciousActivity {
  /** Activity ID */
  id: string;
  /** Type of suspicious activity */
  type: SuspiciousActivityType;
  /** Transaction(s) involved */
  transactionIds: string[];
  /** Entity/entities involved */
  entityIds: string[];
  /** Rules that triggered this detection */
  triggeredRuleIds: string[];
  /** Severity level */
  severity: AlertSeverity;
  /** Description of the activity */
  description: string;
  /** AML flags raised */
  flags: AmlFlag[];
  /** When detected */
  detectedAt: string;
  /** Status */
  status: 'new' | 'under_review' | 'escalated' | 'cleared' | 'reported';
}

/**
 * Types of suspicious activity
 */
export type SuspiciousActivityType =
  | 'structuring'
  | 'rapid_movement'
  | 'unusual_pattern'
  | 'sanctions_match'
  | 'pep_transaction'
  | 'high_risk_jurisdiction'
  | 'velocity_anomaly'
  | 'layering'
  | 'round_tripping'
  | 'other';

/**
 * AML flag raised on a transaction or entity
 */
export interface AmlFlag {
  /** Flag ID */
  id: string;
  /** Flag type */
  type: AmlFlagType;
  /** Flag severity */
  severity: AlertSeverity;
  /** Description */
  description: string;
  /** When the flag was raised */
  raisedAt: string;
  /** Source of the flag */
  source: string;
  /** Related transaction/entity IDs */
  references: Record<string, string[]>;
}

/**
 * Types of AML flags
 */
export type AmlFlagType =
  | 'ctr_required'
  | 'sar_recommended'
  | 'enhanced_due_diligence'
  | 'sanctions_screening'
  | 'pep_check'
  | 'source_of_funds'
  | 'beneficial_ownership'
  | 'high_risk'
  | 'watch_list'
  | 'custom';

// ============================================================================
// Extended Plugin Interfaces
// ============================================================================

/**
 * Core context available to all plugins
 */
export interface ArkaCoreContext {
  /** Rule engine access */
  rules: RuleEngineAccess;
  /** Entity registry access */
  entities: EntityRegistryAccess;
  /** Transaction stream */
  transactions: TransactionStreamAccess;
  /** Audit log service */
  auditLog: AuditLogServiceAccess;
  /** Alert/notification service */
  alerts: AlertServiceAccess;
  /** Configuration access */
  config: ConfigAccess;
  /** Secrets manager */
  secrets: SecretsAccess;
}

/**
 * Rule engine access interface
 */
export interface RuleEngineAccess {
  evaluate(event: ArkaEvent, entity?: ArkaEntity | null): Promise<ArkaDecision>;
  getRules(filter?: Record<string, unknown>): Promise<ArkaRule[]>;
  registerRule(rule: ArkaRule): Promise<void>;
  updateRule(ruleId: string, updates: Partial<ArkaRule>): Promise<void>;
}

/**
 * Entity registry access interface
 */
export interface EntityRegistryAccess {
  getEntity(id: string): Promise<ArkaEntity | null>;
  createEntity(entity: Omit<ArkaEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ArkaEntity>;
  updateEntity(id: string, updates: Partial<ArkaEntity>): Promise<ArkaEntity>;
  queryEntities(filter: Record<string, unknown>): Promise<ArkaEntity[]>;
}

/**
 * Transaction stream access interface
 */
export interface TransactionStreamAccess {
  onTransaction(handler: (tx: ArkaTransaction) => Promise<void>): () => void;
  getTransaction(id: string): Promise<ArkaTransaction | null>;
  queryTransactions(filter: Record<string, unknown>): Promise<ArkaTransaction[]>;
}

/**
 * Audit log service access interface
 */
export interface AuditLogServiceAccess {
  recordEvent(record: Omit<AuditRecord, 'id' | 'timestamp' | 'recordHash' | 'previousHash'>): Promise<AuditRecord>;
  queryEvents(query: AuditQuery): Promise<AuditRecord[]>;
  exportEvents(query: AuditQuery): AsyncIterable<AuditRecord>;
}

/**
 * Alert service access interface
 */
export interface AlertServiceAccess {
  createAlert(alert: Omit<Alert, 'id' | 'generatedAt' | 'status'>): Promise<Alert>;
  updateAlert(id: string, updates: Partial<Alert>): Promise<Alert>;
  getAlert(id: string): Promise<Alert | null>;
  queryAlerts(filter: Record<string, unknown>): Promise<Alert[]>;
}

/**
 * Configuration access interface
 */
export interface ConfigAccess {
  get<T>(key: string, defaultValue?: T): T;
  getAll(): Record<string, unknown>;
}

/**
 * Secrets manager access interface
 */
export interface SecretsAccess {
  getSecret(key: string): Promise<string | null>;
}

/**
 * Extended plugin interface for v1 plugins
 */
export interface ArkaPlugin {
  /** Unique plugin ID */
  id: string;
  /** Plugin version */
  version: string;
  /** Plugin name */
  name: string;
  /** Plugin description */
  description: string;
  /** Initialize the plugin */
  init(core: ArkaCoreContext): Promise<void>;
  /** Shutdown the plugin */
  shutdown?(): Promise<void>;
  /** Event hooks */
  hooks?: ArkaPluginHooks;
}

/**
 * Plugin lifecycle hooks
 */
export interface ArkaPluginHooks {
  /** Called when a transaction is received */
  onTransaction?(tx: ArkaTransaction): Promise<void>;
  /** Called when an event is received */
  onEvent?(event: ArkaEvent): Promise<void>;
  /** Called when a rule is evaluated */
  onRuleEvaluation?(rule: ArkaRule, result: ArkaDecision): Promise<void>;
  /** Called when an alert is generated */
  onAlert?(alert: Alert): Promise<void>;
  /** Called when risk score is computed */
  onRiskScore?(input: RiskInput, result: RiskScoreBundle): Promise<void>;
}
