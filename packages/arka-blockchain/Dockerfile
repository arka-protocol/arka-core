# PACT Blockchain Package - Docker Build
# This builds the @pact/blockchain package as part of a multi-stage build

# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm and build dependencies
RUN apk add --no-cache python3 make g++ && \
    npm install -g pnpm@9

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy all package.json and tsconfig files first for better caching
COPY packages/pact-types/package.json packages/pact-types/tsconfig.json ./packages/pact-types/
COPY packages/pact-utils/package.json packages/pact-utils/tsconfig.json ./packages/pact-utils/
COPY packages/pact-crypto/package.json packages/pact-crypto/tsconfig.json ./packages/pact-crypto/
COPY packages/pact-blockchain/package.json packages/pact-blockchain/tsconfig.json ./packages/pact-blockchain/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/pact-types ./packages/pact-types
COPY packages/pact-utils ./packages/pact-utils
COPY packages/pact-crypto ./packages/pact-crypto
COPY packages/pact-blockchain ./packages/pact-blockchain

# Build dependencies in order
RUN pnpm --filter @pact/types build
RUN pnpm --filter @pact/utils build
RUN pnpm --filter @pact/crypto build
RUN pnpm --filter @pact/blockchain build

# Run tests
RUN pnpm --filter @pact/blockchain test

# ============================================
# Stage 2: Production image
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 pact

# Copy built packages
COPY --from=builder /app/packages/pact-types/dist ./packages/pact-types/dist
COPY --from=builder /app/packages/pact-types/package.json ./packages/pact-types/
COPY --from=builder /app/packages/pact-utils/dist ./packages/pact-utils/dist
COPY --from=builder /app/packages/pact-utils/package.json ./packages/pact-utils/
COPY --from=builder /app/packages/pact-crypto/dist ./packages/pact-crypto/dist
COPY --from=builder /app/packages/pact-crypto/package.json ./packages/pact-crypto/
COPY --from=builder /app/packages/pact-blockchain/dist ./packages/pact-blockchain/dist
COPY --from=builder /app/packages/pact-blockchain/package.json ./packages/pact-blockchain/

# Copy workspace files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile || true

# Set ownership
RUN chown -R pact:nodejs /app

USER pact

# Default command (can be overridden)
CMD ["node", "-e", "console.log('@pact/blockchain package ready')"]

# Labels
LABEL org.opencontainers.image.title="PACT Blockchain"
LABEL org.opencontainers.image.description="Blockchain adapter interfaces and implementations for PACT Protocol"
LABEL org.opencontainers.image.version="0.1.0"
LABEL org.opencontainers.image.vendor="PACT Protocol"
