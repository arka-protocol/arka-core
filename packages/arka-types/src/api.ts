/**
 * ARKA API Types
 *
 * Request/response types for API endpoints.
 */

import type { DecisionSummary, ArkaAuditRecord, ArkaDecision } from './decision.js';
import type { CreateEntityInput, ArkaEntity, UpdateEntityInput } from './entity.js';
import type { CreateEventInput, ArkaEvent } from './event.js';
import type { CreateRuleInput, ArkaRule, RuleFilterParams, UpdateRuleInput } from './rule.js';

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  pagination?: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Pagination parameters for list endpoints
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// ============ Event API Types ============

/**
 * POST /v1/events/process request
 */
export interface ProcessEventRequest {
  event: CreateEventInput;
  context?: Record<string, unknown>;
}

/**
 * POST /v1/events/process response
 */
export interface ProcessEventResponse {
  decisionId: string;
  auditId: string;
  status: ArkaDecision['status'];
  summary: DecisionSummary;
}

// ============ Decision API Types ============

/**
 * GET /v1/decisions/:id response
 */
export interface GetDecisionResponse {
  decision: ArkaDecision;
  event: ArkaEvent;
  entity?: ArkaEntity | null;
}

/**
 * GET /v1/decisions query params
 */
export interface ListDecisionsParams extends PaginationParams {
  eventId?: string;
  entityId?: string;
  status?: ArkaDecision['status'];
  startDate?: string;
  endDate?: string;
}

// ============ Audit API Types ============

/**
 * GET /v1/audits/:id response
 */
export interface GetAuditResponse {
  audit: ArkaAuditRecord;
  decision: ArkaDecision;
}

// ============ Rule API Types ============

/**
 * POST /v1/rules request
 */
export interface CreateRuleRequest {
  rule: CreateRuleInput;
}

/**
 * POST /v1/rules response
 */
export interface CreateRuleResponse {
  rule: ArkaRule;
}

/**
 * PUT /v1/rules/:id request
 */
export interface UpdateRuleRequest {
  rule: UpdateRuleInput;
  changeDescription?: string;
}

/**
 * GET /v1/rules query params
 */
export interface ListRulesParams extends PaginationParams, RuleFilterParams {}

/**
 * GET /v1/rules response
 */
export interface ListRulesResponse {
  rules: ArkaRule[];
}

// ============ Entity API Types ============

/**
 * POST /v1/entities request
 */
export interface CreateEntityRequest {
  entity: CreateEntityInput;
}

/**
 * PUT /v1/entities/:id request
 */
export interface UpdateEntityRequest {
  entity: UpdateEntityInput;
}

/**
 * GET /v1/entities query params
 */
export interface ListEntitiesParams extends PaginationParams {
  type?: string;
  jurisdiction?: string;
}

// ============ Health Check Types ============

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: Record<string, {
    status: 'up' | 'down';
    latencyMs?: number;
  }>;
}
