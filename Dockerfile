# Unified Ledger - Production Dockerfile
# Multi-stage build for optimal image size and security

# Stage 1: Base image with pnpm
FROM node:20-alpine AS base
# Pin pnpm to v9 to avoid build-script approval behavior that blocks native deps in CI/Docker.
RUN npm install -g pnpm@9.15.5
WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json pnpm-lock.yaml ./
RUN chown -R node:node /app
USER node
RUN pnpm install --frozen-lockfile
USER root

# Stage 3: Build application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application with proper environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_IGNORE_BUILD_ERRORS=1
RUN mkdir -p /config
RUN pnpm build

# Stage 3.5: Migrator (runs schema sync against the persisted SQLite DB)
# This stage retains devDependencies so drizzle-kit is available.
FROM builder AS migrator
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
CMD ["pnpm", "drizzle-kit", "migrate", "--config", "drizzle.config.sqlite.ts"]

# Stage 4: Runtime - production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Install su-exec for privilege dropping (Unraid PUID/PGID support)
RUN apk add --no-cache su-exec

# Create persistent config directory (permissions set at runtime by init script)
RUN mkdir -p /config

# Copy built application from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy tooling needed for startup migrations
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy migrations + configs + entrypoint
COPY --from=builder /app/drizzle /app/drizzle
COPY --from=builder /app/drizzle.config.sqlite.ts /app/drizzle.config.sqlite.ts
COPY --from=builder /app/drizzle.config.pg.ts /app/drizzle.config.pg.ts
COPY --from=builder /app/lib/db /app/lib/db
COPY --from=builder /app/auth-schema.ts /app/auth-schema.ts
COPY --from=builder /app/auth-schema.pg.ts /app/auth-schema.pg.ts
COPY --from=builder /app/scripts/docker-entrypoint.mjs /app/scripts/docker-entrypoint.mjs

# Copy init script for PUID/PGID support
COPY scripts/docker-init.sh /app/scripts/docker-init.sh
RUN chmod +x /app/scripts/docker-init.sh

# Run as root initially - init script drops to PUID/PGID user
USER root

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start with init script (handles PUID/PGID then runs app)
CMD ["/app/scripts/docker-init.sh"]
