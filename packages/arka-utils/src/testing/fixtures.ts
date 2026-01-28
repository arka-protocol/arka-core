/**
 * ARKA Test Fixtures
 *
 * Provides sample data and fixture factories for testing.
 */

import { generatePrefixedId, generateId } from '../id.js';

/**
 * User fixture
 */
export interface UserFixture {
  id: string;
  email: string;
  name: string;
  roles: string[];
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createUserFixture(overrides: Partial<UserFixture> = {}): UserFixture {
  return {
    id: generatePrefixedId('usr'),
    email: `user-${Date.now()}@test.example.com`,
    name: 'Test User',
    roles: ['user'],
    tenantId: generatePrefixedId('ten'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Tenant fixture
 */
export interface TenantFixture {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export function createTenantFixture(overrides: Partial<TenantFixture> = {}): TenantFixture {
  const slug = `tenant-${Date.now()}`;
  return {
    id: generatePrefixedId('ten'),
    name: 'Test Tenant',
    slug,
    plan: 'starter',
    status: 'active',
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Rule fixture
 */
export interface RuleFixture {
  id: string;
  name: string;
  description: string;
  tenantId: string;
  entityType: string;
  condition: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  priority: number;
  status: 'active' | 'inactive' | 'draft';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function createRuleFixture(overrides: Partial<RuleFixture> = {}): RuleFixture {
  return {
    id: generatePrefixedId('rul'),
    name: 'Test Rule',
    description: 'A test rule for unit tests',
    tenantId: generatePrefixedId('ten'),
    entityType: 'transaction',
    condition: {
      operator: 'AND',
      conditions: [
        { field: 'amount', operator: '>', value: 1000 },
      ],
    },
    actions: [
      { type: 'flag', severity: 'medium' },
    ],
    priority: 100,
    status: 'active',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Event fixture
 */
export interface EventFixture {
  id: string;
  type: string;
  tenantId: string;
  entityId: string;
  entityType: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export function createEventFixture(overrides: Partial<EventFixture> = {}): EventFixture {
  return {
    id: generatePrefixedId('evt'),
    type: 'transaction.created',
    tenantId: generatePrefixedId('ten'),
    entityId: generatePrefixedId('ent'),
    entityType: 'transaction',
    payload: {
      amount: 1500,
      currency: 'USD',
      merchantId: 'merchant-123',
    },
    metadata: {
      source: 'api',
      version: '1.0',
    },
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Decision fixture
 */
export interface DecisionFixture {
  id: string;
  eventId: string;
  ruleId: string;
  tenantId: string;
  outcome: 'allow' | 'deny' | 'review' | 'flag';
  confidence: number;
  reasons: string[];
  actions: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export function createDecisionFixture(overrides: Partial<DecisionFixture> = {}): DecisionFixture {
  return {
    id: generatePrefixedId('dec'),
    eventId: generatePrefixedId('evt'),
    ruleId: generatePrefixedId('rul'),
    tenantId: generatePrefixedId('ten'),
    outcome: 'allow',
    confidence: 0.95,
    reasons: ['Rule passed all conditions'],
    actions: [],
    metadata: {},
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Entity fixture
 */
export interface EntityFixture {
  id: string;
  type: string;
  tenantId: string;
  externalId: string;
  attributes: Record<string, unknown>;
  riskScore: number;
  status: 'active' | 'inactive' | 'blocked';
  createdAt: Date;
  updatedAt: Date;
}

export function createEntityFixture(overrides: Partial<EntityFixture> = {}): EntityFixture {
  return {
    id: generatePrefixedId('ent'),
    type: 'customer',
    tenantId: generatePrefixedId('ten'),
    externalId: `ext-${Date.now()}`,
    attributes: {
      name: 'Test Customer',
      email: 'customer@test.example.com',
      country: 'US',
    },
    riskScore: 25,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * JWT token fixture
 */
export interface JwtPayloadFixture {
  sub: string;
  email: string;
  roles: string[];
  tenantId: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export function createJwtPayloadFixture(overrides: Partial<JwtPayloadFixture> = {}): JwtPayloadFixture {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: generatePrefixedId('usr'),
    email: 'user@test.example.com',
    roles: ['user'],
    tenantId: generatePrefixedId('ten'),
    iat: now,
    exp: now + 3600, // 1 hour
    iss: 'arka-test',
    aud: 'arka-api',
    ...overrides,
  };
}

/**
 * API response fixture
 */
export interface ApiResponseFixture<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export function createSuccessResponse<T>(data: T, meta?: ApiResponseFixture['meta']): ApiResponseFixture<T> {
  return {
    success: true,
    data,
    meta,
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiResponseFixture {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * Webhook fixture
 */
export interface WebhookFixture {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export function createWebhookFixture(overrides: Partial<WebhookFixture> = {}): WebhookFixture {
  return {
    id: generatePrefixedId('whk'),
    tenantId: generatePrefixedId('ten'),
    url: 'https://webhook.test.example.com/events',
    events: ['decision.created', 'rule.updated'],
    secret: `whsec_${generateId()}`,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
