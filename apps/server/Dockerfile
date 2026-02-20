# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lock ./
COPY apps/server/package.json ./apps/server/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY packages/env/package.json ./packages/env/
COPY packages/config/package.json ./packages/config/

# Install dependencies
RUN bun install --ignore-scripts

# Copy source code
COPY . .

# Build the server binary and generate OpenAPI spec
WORKDIR /app/apps/server
# Build-only env vars are scoped to this RUN and not persisted in image metadata.
RUN export BETTER_AUTH_SECRET=build-time-dummy-secret-at-least-32-chars \
    BETTER_AUTH_URL=http://localhost:3000 \
    CORS_ORIGINS=http://localhost:3000 \
    DATABASE_URL=postgresql://x:x@localhost/x \
    && mkdir -p dist \
    && bun run ./scripts/generate-openapi.ts \
    && bun run compile

# Copy bull-board UI assets for production (compiled binary can't resolve node_modules)
RUN mkdir -p /app/bull-board && \
    UI_PKG=$(bun -e "process.stdout.write(require('path').dirname(require.resolve('@bull-board/ui/package.json')))") && \
    cp -r "$UI_PKG/dist" /app/bull-board/dist

# Production stage - minimal distroless image
FROM gcr.io/distroless/base-debian12:nonroot

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy the compiled binaries, OpenAPI spec, and bull-board UI assets
COPY --from=builder /app/apps/server/server /app/server
COPY --from=builder /app/apps/server/worker /app/worker
COPY --from=builder /app/apps/server/dist/openapi.json /app/dist/openapi.json
COPY --from=builder /app/bull-board /app/bull-board

# Expose port
EXPOSE 3000

# Default to server (override with CMD ["./worker"] for worker)
CMD ["./server"]
