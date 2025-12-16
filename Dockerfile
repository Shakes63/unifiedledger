# Unified Ledger - Production Dockerfile
# Multi-stage build for optimal image size and security

# Stage 1: Base image with pnpm
FROM node:18-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 3: Build application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application with proper environment
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm build

# Stage 3.5: Migrator (runs schema sync against the persisted SQLite DB)
# This stage retains devDependencies so drizzle-kit is available.
FROM builder AS migrator
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
WORKDIR /app
CMD ["pnpm", "drizzle-kit", "push"]

# Stage 4: Runtime - production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create database directory with proper permissions
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Copy built application from builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy database schema files if they exist
COPY --chown=nextjs:nodejs drizzle /app/drizzle 2>/dev/null || true
COPY --chown=nextjs:nodejs drizzle.config.ts /app/ 2>/dev/null || true

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "server.js"]
