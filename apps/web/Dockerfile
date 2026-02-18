# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY packages/env/package.json ./packages/env/
COPY packages/config/package.json ./packages/config/
COPY packages/sdk/package.json ./packages/sdk/

# Install dependencies
RUN bun install --ignore-scripts

# Copy source code
COPY . .

# Build the web app (VITE_SERVER_URL must be set at build time)
WORKDIR /app/apps/web
ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN bunx fumadocs-mdx && bun run build

# Production stage
FROM oven/bun:1-slim

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.output .output

EXPOSE 3001

CMD ["bun", "run", ".output/server/index.mjs"]
