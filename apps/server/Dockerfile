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

# Production stage - using bun slim for db migrations support
FROM oven/bun:1-slim

WORKDIR /app

# Copy the compiled binaries
COPY --from=builder /app/apps/server/server /app/server
COPY --from=builder /app/apps/server/worker /app/worker

# Copy files needed for db:push
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/bun.lock /app/bun.lock
COPY --from=builder /app/packages/db /app/packages/db
COPY --from=builder /app/packages/env /app/packages/env
COPY --from=builder /app/node_modules /app/node_modules

# Copy entrypoint script
COPY apps/server/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 3000

# Default to server (override with CMD ["worker"] for worker)
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["server"]
