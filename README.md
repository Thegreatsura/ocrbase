# OCRBase

A powerful OCR document processing and structured data extraction API built with modern TypeScript tooling.

## Overview

OCRBase provides:

- Document OCR using PaddleOCR for accurate text extraction
- AI-powered structured data extraction using LLMs
- Custom schema support for targeted data extraction
- Real-time job status updates via WebSocket
- RESTful API with OpenAPI documentation

## Tech Stack

- **Bun** - Runtime environment
- **Elysia** - Type-safe, high-performance API framework
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database
- **Redis** - Queue management and pub/sub
- **MinIO** - S3-compatible object storage
- **PaddleOCR** - OCR engine
- **Better-Auth** - Authentication
- **BullMQ** - Job queue processing
- **Turborepo** - Monorepo build system

## Prerequisites

- [Bun](https://bun.sh/) installed globally
- Docker Desktop running
- PostgreSQL, Redis, MinIO containers
- PaddleOCR container (GPU recommended)

## Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd ocrbase
bun install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```bash
# Required
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ocrbase
BETTER_AUTH_SECRET=your-secret-key-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001

# Redis
REDIS_URL=redis://localhost:6379

# S3/MinIO Storage
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=ocrbase
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# OCR Service
PADDLE_OCR_URL=http://localhost:8080

# Optional - LLM for data extraction
OPENROUTER_API_KEY=your-openrouter-api-key

# Optional - GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 3. Start Infrastructure

```bash
docker compose up -d postgres redis minio paddleocr
```

### 4. Database Setup

```bash
bun run db:push
```

### 5. Run the Application

```bash
# Start all services
bun run dev

# Or start individually
bun run dev:server  # API server
bun run dev:web     # Web frontend
```

### 6. Start the Worker

In a separate terminal:

```bash
cd apps/server
bun run worker
```

## API Documentation

Once the server is running, access the OpenAPI documentation at:

- **Scalar UI**: http://localhost:3000/openapi

## Project Structure

```
ocrbase/
├── apps/
│   ├── web/                 # Frontend application (TanStack Start)
│   └── server/              # Backend API (Elysia)
│       ├── src/
│       │   ├── index.ts     # Entry point
│       │   ├── app.ts       # Application composition
│       │   ├── modules/     # Feature modules
│       │   │   ├── health/  # Health check endpoints
│       │   │   ├── jobs/    # Job management
│       │   │   └── schemas/ # Schema management
│       │   ├── plugins/     # Elysia plugins
│       │   ├── services/    # Core services
│       │   ├── workers/     # Background workers
│       │   └── lib/         # Utilities
├── packages/
│   ├── auth/               # Authentication (Better-Auth)
│   ├── db/                 # Database schema (Drizzle)
│   ├── env/                # Environment validation
│   ├── config/             # Shared TypeScript config
│   └── paddleocr-vl-ts/    # PaddleOCR TypeScript client
└── docker-compose.yml
```

## API Endpoints

### Health

- `GET /health/live` - Liveness check
- `GET /health/ready` - Readiness check with service status

### Authentication

- `POST /api/auth/*` - Better-Auth endpoints

### Jobs

- `POST /api/jobs` - Create OCR job (file upload or URL)
- `GET /api/jobs` - List jobs with pagination
- `GET /api/jobs/:id` - Get job details
- `DELETE /api/jobs/:id` - Delete job
- `GET /api/jobs/:id/download` - Download results (md/json)

### Schemas

- `POST /api/schemas` - Create extraction schema
- `GET /api/schemas` - List schemas
- `GET /api/schemas/:id` - Get schema
- `PATCH /api/schemas/:id` - Update schema
- `DELETE /api/schemas/:id` - Delete schema
- `POST /api/schemas/generate` - AI-generate schema from document

### WebSocket

- `WS /ws/jobs/:jobId` - Real-time job status updates

## Available Scripts

- `bun run dev` - Start all applications
- `bun run build` - Build all applications
- `bun run typecheck` - TypeScript type checking
- `bun run lint` - Lint all packages
- `bun run db:push` - Push schema to database
- `bun run db:studio` - Open database studio
- `bun run db:generate` - Generate migrations
- `bun run db:migrate` - Run migrations

## Docker Deployment

```bash
docker compose up --build
```

## License

MIT
