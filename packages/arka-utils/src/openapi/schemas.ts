/**
 * ARKA Common OpenAPI Schemas
 *
 * Reusable schema definitions for ARKA APIs.
 */

import type { OpenAPISchema, OpenAPIResponse, OpenAPISecurityScheme } from './types.js';

/**
 * Common schema definitions
 */
export const commonSchemas: Record<string, OpenAPISchema> = {
  // Standard API response wrapper
  ApiResponse: {
    type: 'object',
    required: ['success'],
    properties: {
      success: {
        type: 'boolean',
        description: 'Whether the request was successful',
      },
      data: {
        type: 'object',
        description: 'The response data',
        additionalProperties: true,
      },
      error: {
        $ref: '#/components/schemas/ApiError',
      },
      meta: {
        $ref: '#/components/schemas/ResponseMeta',
      },
    },
  },

  // API error structure
  ApiError: {
    type: 'object',
    required: ['code', 'message'],
    properties: {
      code: {
        type: 'string',
        description: 'Error code identifier',
        example: 'VALIDATION_ERROR',
      },
      message: {
        type: 'string',
        description: 'Human-readable error message',
        example: 'Invalid request parameters',
      },
      details: {
        type: 'object',
        description: 'Additional error details',
        additionalProperties: true,
      },
    },
  },

  // Response metadata
  ResponseMeta: {
    type: 'object',
    properties: {
      requestId: {
        type: 'string',
        description: 'Unique request identifier for tracing',
        example: 'req_01HXYZ123456',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'Response timestamp in ISO 8601 format',
      },
      page: {
        type: 'integer',
        description: 'Current page number (for paginated responses)',
        minimum: 1,
      },
      limit: {
        type: 'integer',
        description: 'Items per page',
        minimum: 1,
        maximum: 100,
      },
      total: {
        type: 'integer',
        description: 'Total number of items',
        minimum: 0,
      },
      hasMore: {
        type: 'boolean',
        description: 'Whether more items are available',
      },
    },
  },

  // Pagination parameters
  PaginationParams: {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
        description: 'Maximum number of items to return',
      },
      offset: {
        type: 'integer',
        minimum: 0,
        default: 0,
        description: 'Number of items to skip',
      },
    },
  },

  // ARKA Entity
  ArkaEntity: {
    type: 'object',
    required: ['id', 'type', 'data', 'createdAt'],
    properties: {
      id: {
        type: 'string',
        description: 'Unique entity identifier',
        example: 'ent_abc123def456',
      },
      type: {
        type: 'string',
        description: 'Entity type name',
        example: 'customer',
      },
      jurisdiction: {
        type: 'string',
        nullable: true,
        description: 'Jurisdiction code (ISO 3166-1 alpha-2)',
        example: 'US',
      },
      data: {
        type: 'object',
        description: 'Entity data payload',
        additionalProperties: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Creation timestamp',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Last update timestamp',
      },
    },
  },

  // ARKA Event
  ArkaEvent: {
    type: 'object',
    required: ['id', 'source', 'type', 'payload', 'occurredAt'],
    properties: {
      id: {
        type: 'string',
        description: 'Unique event identifier',
        example: 'evt_abc123def456',
      },
      source: {
        type: 'string',
        description: 'Event source system',
        example: 'payment-gateway',
      },
      type: {
        type: 'string',
        description: 'Event type',
        example: 'transaction.completed',
      },
      entityId: {
        type: 'string',
        nullable: true,
        description: 'Associated entity ID',
      },
      entityType: {
        type: 'string',
        nullable: true,
        description: 'Associated entity type',
      },
      jurisdiction: {
        type: 'string',
        nullable: true,
        description: 'Jurisdiction code',
      },
      payload: {
        type: 'object',
        description: 'Event data payload',
        additionalProperties: true,
      },
      occurredAt: {
        type: 'string',
        format: 'date-time',
        description: 'When the event occurred',
      },
    },
  },

  // ARKA Decision
  ArkaDecision: {
    type: 'object',
    required: ['id', 'eventId', 'status', 'createdAt'],
    properties: {
      id: {
        type: 'string',
        description: 'Unique decision identifier',
        example: 'dec_abc123def456',
      },
      eventId: {
        type: 'string',
        description: 'Associated event ID',
      },
      status: {
        type: 'string',
        enum: ['ALLOW', 'DENY', 'ALLOW_WITH_FLAGS'],
        description: 'Decision outcome',
      },
      flags: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/DecisionFlag',
        },
        description: 'Decision flags and alerts',
      },
      rulesEvaluated: {
        type: 'integer',
        description: 'Number of rules evaluated',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Decision confidence score',
      },
      reasons: {
        type: 'array',
        items: { type: 'string' },
        description: 'Reasons for the decision',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Decision timestamp',
      },
    },
  },

  // Decision Flag
  DecisionFlag: {
    type: 'object',
    required: ['code', 'severity'],
    properties: {
      code: {
        type: 'string',
        description: 'Flag code',
        example: 'HIGH_RISK_TRANSACTION',
      },
      severity: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        description: 'Flag severity level',
      },
      message: {
        type: 'string',
        description: 'Human-readable flag description',
      },
      ruleId: {
        type: 'string',
        description: 'Rule that triggered this flag',
      },
    },
  },

  // ARKA Rule
  ArkaRule: {
    type: 'object',
    required: ['id', 'name', 'status', 'version'],
    properties: {
      id: {
        type: 'string',
        description: 'Unique rule identifier',
        example: 'rul_abc123def456',
      },
      name: {
        type: 'string',
        description: 'Rule name',
        example: 'High Value Transaction Check',
      },
      description: {
        type: 'string',
        description: 'Rule description',
      },
      status: {
        type: 'string',
        enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
        description: 'Rule status',
      },
      version: {
        type: 'integer',
        description: 'Rule version number',
      },
      condition: {
        type: 'object',
        description: 'Rule condition definition',
        additionalProperties: true,
      },
      actions: {
        type: 'array',
        items: { type: 'object' },
        description: 'Actions to execute when rule matches',
      },
      priority: {
        type: 'integer',
        description: 'Rule evaluation priority',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
    },
  },

  // Health check response
  HealthCheck: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['healthy', 'degraded', 'unhealthy'],
        description: 'Overall service health status',
      },
      version: {
        type: 'string',
        description: 'Service version',
      },
      uptime: {
        type: 'number',
        description: 'Service uptime in seconds',
      },
      checks: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy'],
            },
            message: {
              type: 'string',
            },
          },
        },
        description: 'Individual health check results',
      },
    },
  },
};

/**
 * Common response definitions
 */
export const commonResponses: Record<string, OpenAPIResponse> = {
  // Success responses
  Ok: {
    description: 'Successful operation',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ApiResponse' },
      },
    },
  },

  Created: {
    description: 'Resource created successfully',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ApiResponse' },
      },
    },
  },

  NoContent: {
    description: 'Successful operation with no response body',
  },

  // Error responses
  BadRequest: {
    description: 'Invalid request parameters',
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'VALIDATION_ERROR' },
                    message: { type: 'string', example: 'Invalid request parameters' },
                  },
                },
              },
            },
          ],
        },
      },
    },
  },

  Unauthorized: {
    description: 'Authentication required',
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'UNAUTHORIZED' },
                    message: { type: 'string', example: 'Authentication required' },
                  },
                },
              },
            },
          ],
        },
      },
    },
  },

  Forbidden: {
    description: 'Insufficient permissions',
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'FORBIDDEN' },
                    message: { type: 'string', example: 'Insufficient permissions' },
                  },
                },
              },
            },
          ],
        },
      },
    },
  },

  NotFound: {
    description: 'Resource not found',
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'NOT_FOUND' },
                    message: { type: 'string', example: 'Resource not found' },
                  },
                },
              },
            },
          ],
        },
      },
    },
  },

  Conflict: {
    description: 'Resource conflict',
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'CONFLICT' },
                    message: { type: 'string', example: 'Resource already exists' },
                  },
                },
              },
            },
          ],
        },
      },
    },
  },

  TooManyRequests: {
    description: 'Rate limit exceeded',
    headers: {
      'X-RateLimit-Limit': {
        name: 'X-RateLimit-Limit',
        in: 'header',
        schema: { type: 'integer' },
        description: 'Request limit per time window',
      },
      'X-RateLimit-Remaining': {
        name: 'X-RateLimit-Remaining',
        in: 'header',
        schema: { type: 'integer' },
        description: 'Remaining requests in current window',
      },
      'X-RateLimit-Reset': {
        name: 'X-RateLimit-Reset',
        in: 'header',
        schema: { type: 'integer' },
        description: 'Unix timestamp when the window resets',
      },
    },
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'RATE_LIMIT_EXCEEDED' },
                    message: { type: 'string', example: 'Too many requests' },
                  },
                },
              },
            },
          ],
        },
      },
    },
  },

  InternalError: {
    description: 'Internal server error',
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'INTERNAL_ERROR' },
                    message: { type: 'string', example: 'An unexpected error occurred' },
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
};

/**
 * Common security schemes
 */
export const securitySchemes: Record<string, OpenAPISecurityScheme> = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT Bearer token authentication',
  },

  apiKey: {
    type: 'apiKey',
    name: 'X-API-Key',
    in: 'header',
    description: 'API key authentication',
  },

  oauth2: {
    type: 'oauth2',
    description: 'OAuth 2.0 authentication',
    flows: {
      authorizationCode: {
        authorizationUrl: '/oauth/authorize',
        tokenUrl: '/oauth/token',
        scopes: {
          'read:entities': 'Read entities',
          'write:entities': 'Create and update entities',
          'read:events': 'Read events and decisions',
          'write:events': 'Submit events',
          'read:rules': 'Read rules',
          'write:rules': 'Create and update rules',
          admin: 'Full administrative access',
        },
      },
    },
  },
};
