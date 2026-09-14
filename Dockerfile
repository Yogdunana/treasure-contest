# ============================================================================
# Stage 1: Install dependencies
# ============================================================================
FROM node:20-slim AS deps
WORKDIR /app

# Install build tools for native modules (e.g. better-sqlite3)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

# Copy workspace config and all package.json files for dependency resolution
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/

RUN pnpm install --frozen-lockfile

# ============================================================================
# Stage 2: Build
# ============================================================================
FROM deps AS builder
WORKDIR /app

# Copy full source (node_modules from deps stage are preserved)
COPY . .

# Build packages in dependency order: shared -> client -> server
RUN pnpm --filter shared build
RUN pnpm --filter client build
RUN pnpm --filter server build

# ============================================================================
# Stage 3: Production
# ============================================================================
FROM node:20-slim AS runner
WORKDIR /app

# Install build tools for native modules (production deps need better-sqlite3)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

# Copy workspace config and package.json files for production install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/

RUN pnpm install --prod --frozen-lockfile

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/client/dist ./apps/client/dist

# Production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/treasure.db

EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "apps/server/dist/index.js"]
