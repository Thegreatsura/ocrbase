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
COPY packages/paddleocr-vl-ts/package.json ./packages/paddleocr-vl-ts/

# Install dependencies
RUN bun install --ignore-scripts

# Copy source code
COPY . .

# Build the server binary
WORKDIR /app/apps/server
RUN bun run compile

# Production stage - minimal distroless image
FROM gcr.io/distroless/base-debian12:nonroot

WORKDIR /app

# Copy the compiled binaries
COPY --from=builder /app/apps/server/server /app/server
COPY --from=builder /app/apps/server/worker /app/worker

# Copy server source files for OpenAPI schema generation
COPY --from=builder /app/apps/server/src /app/apps/server/src

# Expose port
EXPOSE 3000

# Default to server (override with CMD ["./worker"] for worker)
CMD ["./server"]
