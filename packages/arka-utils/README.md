<p align="center">
  <img src="https://www.arkaprotocol.com/logo.svg" alt="ARKA Protocol" width="120" />
</p>

<h1 align="center">@arka-protocol/utils</h1>

<p align="center">
  <strong>Production-ready utility library for building robust, scalable services</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@arka-protocol/utils"><img src="https://img.shields.io/npm/v/@arka-protocol/utils.svg?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="https://github.com/arka-protocol/arka-core/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-green.svg?style=flat-square" alt="license" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0+-blue.svg?style=flat-square" alt="TypeScript" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18+-green.svg?style=flat-square" alt="Node.js" /></a>
</p>

<p align="center">
  <a href="#features">Features</a> |
  <a href="#installation">Installation</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#api-reference">API Reference</a> |
  <a href="https://www.arkaprotocol.com/docs">Documentation</a>
</p>

---

## Features

- **Structured Logging** - Production-ready logging with JSON output and log levels
- **Resilience Patterns** - Circuit breaker, bulkhead, and retry with exponential backoff
- **Caching** - In-memory and Redis-backed caching with TTL and tag-based invalidation
- **Rate Limiting** - Configurable rate limiters for API protection
- **Error Handling** - Typed error classes with HTTP status codes
- **ID Generation** - UUID-based identifiers with type prefixes
- **Date/Time Utilities** - ISO date handling and duration formatting
- **Object Utilities** - Deep clone, merge, pick, omit, and nested path access
- **Configuration** - Type-safe environment variable loading
- **Middleware** - Express middleware for auth, correlation IDs, and security headers
- **Metrics** - OpenTelemetry-compatible metrics and tracing

---

## Installation

```bash
npm install @arka-protocol/utils
```

```bash
yarn add @arka-protocol/utils
```

```bash
pnpm add @arka-protocol/utils
```

---

## Quick Start

```typescript
import {
  createLogger,
  retry,
  CircuitBreaker,
  createMemoryCache,
  ids,
} from '@arka-protocol/utils';

// Create a structured logger
const logger = createLogger({ service: 'my-service', level: 'info' });
logger.info('Application started', { version: '1.0.0' });

// Generate typed IDs
const eventId = ids.event();     // evt_a1b2c3d4...
const decisionId = ids.decision(); // dec_e5f6g7h8...

// Retry with exponential backoff
const result = await retry(
  () => fetch('https://api.example.com/data'),
  { maxRetries: 3, initialDelayMs: 100 }
);

// Use circuit breaker for fault tolerance
const breaker = new CircuitBreaker({ name: 'external-api' });
const data = await breaker.execute(() => fetchExternalData());

// Cache with TTL
const cache = createMemoryCache({ defaultTtl: 300 });
await cache.set('user:123', userData);
const cached = await cache.get('user:123');
```

---

## API Reference

### Logging

Create structured loggers for your services with configurable log levels and JSON output.

```typescript
import { createLogger, type Logger } from '@arka-protocol/utils';

const logger = createLogger({
  service: 'payment-service',
  level: 'debug',      // 'debug' | 'info' | 'warn' | 'error'
  pretty: true,        // Pretty print in development
});

// Log at different levels
logger.debug('Processing request', { requestId: 'abc123' });
logger.info('Payment processed', { amount: 100, currency: 'USD' });
logger.warn('Rate limit approaching', { current: 95, limit: 100 });
logger.error('Payment failed', new Error('Insufficient funds'), { userId: '123' });

// Wrap async operations with automatic timing
const result = await logger.withLogging(
  'process-payment',
  () => processPayment(order),
  { orderId: order.id }
);

// Create child loggers with additional context
const childLogger = logger.child({ requestId: 'req_123' });
```

---

### Error Handling

Typed error classes with HTTP status codes for consistent error handling.

```typescript
import {
  PactError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  isPactError,
  wrapError,
} from '@arka-protocol/utils';

// Validation errors (400)
throw new ValidationError('Invalid email format', {
  field: 'email',
  value: 'not-an-email',
});

// Not found errors (404)
throw new NotFoundError('User', 'user_123');
// -> "User with ID 'user_123' not found"

// Conflict errors (409)
throw new ConflictError('Email already exists', { email: 'user@example.com' });

// Rate limit errors (429)
throw new RateLimitError('Too many requests', 60000);

// Type guard for error handling
if (isPactError(error)) {
  res.status(error.statusCode).json(error.toJSON());
}

// Wrap unknown errors
const pactError = wrapError(unknownError);
```

---

### Retry with Exponential Backoff

Resilient async operations with configurable retry logic.

```typescript
import {
  retry,
  withRetry,
  isRetryableHttpError,
  sleep,
  calculateBackoff,
} from '@arka-protocol/utils';

// Basic retry
const data = await retry(
  () => fetchDataFromAPI(),
  {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  }
);

// With retry callback
const result = await retry(
  () => unreliableOperation(),
  {
    maxRetries: 5,
    onRetry: (attempt, error, delayMs) => {
      logger.warn(`Retry attempt ${attempt} after ${delayMs}ms`, { error });
    },
    isRetryable: isRetryableHttpError,
  }
);

// Create a retryable version of any async function
const fetchWithRetry = withRetry(fetch, { maxRetries: 3 });
const response = await fetchWithRetry('https://api.example.com');
```

---

### Circuit Breaker

Prevent cascading failures with the circuit breaker pattern.

```typescript
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  withCircuitBreaker,
} from '@arka-protocol/utils';

// Create a circuit breaker
const breaker = new CircuitBreaker({
  name: 'payment-gateway',
  failureThreshold: 5,      // Open after 5 failures
  successThreshold: 2,      // Close after 2 successes in half-open
  resetTimeout: 30000,      // Try again after 30s
  callTimeout: 10000,       // Timeout individual calls at 10s
  onStateChange: (from, to) => {
    logger.info(`Circuit ${from} -> ${to}`);
  },
});

// Execute through circuit breaker
try {
  const result = await breaker.execute(() => callPaymentGateway(data));
} catch (error) {
  if (error instanceof CircuitBreakerError) {
    // Circuit is open, use fallback
    return fallbackResponse();
  }
  throw error;
}

// Get circuit breaker stats
const stats = breaker.getStats();
// { state: 'CLOSED', failures: 0, totalCalls: 150, ... }

// Use a registry for multiple circuit breakers
const registry = new CircuitBreakerRegistry();
const apiBreaker = registry.get('external-api');
const dbBreaker = registry.get('database');
```

---

### Caching

Flexible caching with in-memory and Redis backends.

```typescript
import { createMemoryCache, type MemoryCache } from '@arka-protocol/utils';

// Create cache with options
const cache = createMemoryCache({
  defaultTtl: 300,        // 5 minutes default TTL
  maxSize: 10000,         // Maximum entries
  namespace: 'myapp',     // Key prefix
  onEvict: (key, reason) => {
    logger.debug(`Cache evicted: ${key} (${reason})`);
  },
});

// Basic operations
await cache.set('user:123', { name: 'John', email: 'john@example.com' });
const user = await cache.get<User>('user:123');
await cache.delete('user:123');

// With custom TTL
await cache.set('session:abc', sessionData, { ttl: 3600 }); // 1 hour

// Tag-based invalidation
await cache.set('product:1', product1, { tags: ['products', 'category:electronics'] });
await cache.set('product:2', product2, { tags: ['products', 'category:books'] });
await cache.invalidateByTag('products'); // Invalidates both

// Bulk operations
const results = await cache.mget(['user:1', 'user:2', 'user:3']);
await cache.mset(new Map([['key1', val1], ['key2', val2]]));

// Cache statistics
const stats = cache.getStats();
// { hits: 1250, misses: 50, hitRate: 0.96, size: 500, ... }
```

---

### Rate Limiting

Protect your APIs with configurable rate limiters.

```typescript
import {
  createRateLimiter,
  rateLimiters,
  createTenantRateLimiter,
} from '@arka-protocol/utils/middleware';

// Create custom rate limiter
const limiter = createRateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000,     // 1 minute
  message: 'Rate limit exceeded',
  headers: true,           // Include X-RateLimit-* headers
});

app.use('/api', limiter);

// Pre-configured rate limiters
app.use('/api', rateLimiters.standard());   // 100/min
app.use('/auth', rateLimiters.auth());       // 5/min
app.use('/health', rateLimiters.relaxed()); // 1000/min

// Multi-tenant rate limiting
const tenantLimiter = createTenantRateLimiter({
  maxRequests: 1000,
  windowMs: 60 * 1000,
});
```

---

### ID Generation

Generate unique, typed identifiers for your entities.

```typescript
import {
  generateId,
  generatePrefixedId,
  ids,
  isValidId,
  getIdPrefix,
} from '@arka-protocol/utils';

// Generate UUIDs
const uuid = generateId();  // "550e8400-e29b-41d4-a716-446655440000"

// Generate prefixed IDs
const customId = generatePrefixedId('ord');  // "ord_550e8400e29b41d4a716446655440000"

// Use pre-defined generators
const eventId = ids.event();       // "evt_..."
const decisionId = ids.decision(); // "dec_..."
const ruleId = ids.rule();         // "rul_..."
const entityId = ids.entity();     // "ent_..."
const auditId = ids.audit();       // "aud_..."
const proposalId = ids.proposal(); // "prp_..."
const simId = ids.simulation();    // "sim_..."
const reqId = ids.request();       // "req_..."

// Validate IDs
isValidId('evt_550e8400e29b41d4a716446655440000');  // true
isValidId('invalid');                                 // false

// Extract prefix
getIdPrefix('evt_abc123');  // "evt"
getIdPrefix('plain-uuid');  // null
```

---

### Date/Time Utilities

Consistent date handling and formatting.

```typescript
import {
  now,
  parseISODate,
  isWithinRange,
  isEffective,
  startOfDay,
  endOfDay,
  addDays,
  durationMs,
  formatDuration,
} from '@arka-protocol/utils';

// Current time as ISO string
const timestamp = now();  // "2024-01-15T10:30:00.000Z"

// Parse ISO dates
const date = parseISODate('2024-01-15T10:30:00Z');

// Check date ranges
const inRange = isWithinRange(
  new Date(),
  '2024-01-01T00:00:00Z',
  '2024-12-31T23:59:59Z'
);

// Check if a rule is effective
const active = isEffective(
  rule.effectiveFrom,
  rule.effectiveTo,
  new Date()
);

// Date manipulation
const tomorrow = addDays(new Date(), 1);
const dayStart = startOfDay(new Date());
const dayEnd = endOfDay(new Date());

// Duration calculations
const ms = durationMs('2024-01-01', '2024-01-02');  // 86400000
const formatted = formatDuration(ms);               // "24.00h"
formatDuration(1500);   // "1500ms"
formatDuration(45000);  // "45.00s"
formatDuration(120000); // "2.00m"
```

---

### Object Utilities

Deep operations on nested objects.

```typescript
import {
  getNestedValue,
  setNestedValue,
  hasNestedValue,
  deepClone,
  deepMerge,
  pick,
  omit,
  flattenObject,
} from '@arka-protocol/utils';

const data = {
  user: {
    profile: {
      name: 'John',
      email: 'john@example.com',
    },
    settings: {
      theme: 'dark',
    },
  },
};

// Access nested values with dot notation
const name = getNestedValue(data, 'user.profile.name');  // "John"
const missing = getNestedValue(data, 'user.address.city'); // undefined

// Set nested values (returns new object)
const updated = setNestedValue(data, 'user.profile.age', 30);

// Check for nested values
hasNestedValue(data, 'user.profile.name');  // true
hasNestedValue(data, 'user.address');       // false

// Deep clone
const clone = deepClone(data);

// Deep merge
const merged = deepMerge(defaults, userConfig, overrides);

// Pick/omit keys
const picked = pick(user, ['id', 'name', 'email']);
const safe = omit(user, ['password', 'ssn']);

// Flatten nested object
const flat = flattenObject(data);
// { 'user.profile.name': 'John', 'user.profile.email': '...', ... }
```

---

### Configuration

Type-safe environment variable loading.

```typescript
import {
  getEnv,
  getEnvOptional,
  getEnvNumber,
  getEnvBoolean,
  getEnvArray,
  loadBaseConfig,
  loadDatabaseConfig,
} from '@arka-protocol/utils';

// Required environment variable (throws if missing)
const apiKey = getEnv('API_KEY');

// With default value
const port = getEnv('PORT', '3000');

// Optional (returns undefined if missing)
const debugMode = getEnvOptional('DEBUG');

// Typed getters
const maxConnections = getEnvNumber('MAX_CONNECTIONS', 10);
const enableCache = getEnvBoolean('ENABLE_CACHE', true);
const allowedOrigins = getEnvArray('ALLOWED_ORIGINS', ['http://localhost:3000']);

// Pre-built config loaders
const baseConfig = loadBaseConfig();
// { nodeEnv: 'production', port: 3000, logLevel: 'info' }

const dbConfig = loadDatabaseConfig();
// { url: '...', maxConnections: 10 }
```

---

### Hash Utilities

Cryptographic hashing for integrity verification.

```typescript
import {
  sha256,
  generateIntegrityHash,
  verifyIntegrityHash,
} from '@arka-protocol/utils';

// Generate SHA-256 hash
const hash = sha256('hello world');
const objectHash = sha256({ key: 'value' });

// Generate integrity hash for audit records
const integrityHash = generateIntegrityHash(
  entitySnapshot,
  eventSnapshot,
  rulesetSnapshot,
  context
);

// Verify integrity
const isValid = verifyIntegrityHash(
  storedHash,
  entitySnapshot,
  eventSnapshot,
  rulesetSnapshot,
  context
);
```

---

### Middleware (Express)

Production-ready Express middleware.

```typescript
import {
  createRateLimiter,
  correlationIdMiddleware,
  securityHeadersMiddleware,
  authMiddleware,
} from '@arka-protocol/utils/middleware';

import express from 'express';

const app = express();

// Add correlation IDs to all requests
app.use(correlationIdMiddleware());

// Security headers (HSTS, CSP, etc.)
app.use(securityHeadersMiddleware());

// Rate limiting
app.use('/api', createRateLimiter({
  maxRequests: 100,
  windowMs: 60000,
}));

// Authentication
app.use('/api', authMiddleware({
  validateToken: async (token) => {
    // Your token validation logic
    return { userId: '123', roles: ['user'] };
  },
}));
```

---

## Subpath Exports

Import only what you need:

```typescript
// Full package
import { createLogger, retry } from '@arka-protocol/utils';

// Specific modules
import { createRateLimiter } from '@arka-protocol/utils/middleware';
import { createMemoryCache } from '@arka-protocol/utils/cache';
import { CircuitBreaker } from '@arka-protocol/utils/resilience';
import { QueryBuilder } from '@arka-protocol/utils/database';
import { createMetrics } from '@arka-protocol/utils/metrics';
```

---

## Requirements

- **Node.js** >= 18.0.0
- **TypeScript** >= 5.0 (for type definitions)

---

## Documentation

For comprehensive documentation, visit:

- [ARKA Protocol Documentation](https://www.arkaprotocol.com/docs)
- [API Reference](https://www.arkaprotocol.com/docs/api/utils)
- [Getting Started Guide](https://www.arkaprotocol.com/docs/getting-started)

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/arka-protocol/arka-core/blob/main/CONTRIBUTING.md) for details.

---

## License

[Apache-2.0](https://github.com/arka-protocol/arka-core/blob/main/LICENSE) - ARKA Protocol

---

<p align="center">
  Built with care by the <a href="https://www.arkaprotocol.com">ARKA Protocol</a> team
</p>
