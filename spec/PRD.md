# OCRBase - Summary

**Self-hosted OCR SaaS** using open-weight vLLM models for document parsing and LLM-powered data extraction.

## Core Features

| Feature           | Description                                        |
| ----------------- | -------------------------------------------------- |
| **Parse**         | PDF/Image → Markdown                               |
| **Extract**       | PDF/Image → Markdown → JSON (with optional schema) |
| **AI Schema Gen** | LLM suggests JSON schema from sample document      |

## Tech Stack

- **Backend**: Elysia + Bun + PostgreSQL + Drizzle + BullMQ + Redis + MinIO
- **Frontend**: TanStack Start + Eden Treaty + shadcn/ui (sidebar-07)
- **Auth**: Better Auth (GitHub + email/password, organizations)
- **OCR**: PaddleOCR-VL via `@ocrbase/paddleocr-vl-ts` SDK (extensible to GOT-OCR, etc.)
- **LLM**: Vercel AI SDK (`@ai-sdk/openai`) → OpenRouter / local vLLM

## Multi-Model OCR (Future)

- Config-based model registry
- User selects OCR model per job (PaddleOCR-VL, GOT-OCR, etc.)
- Each model has its own TS SDK wrapper
- Hot-swappable without downtime

## Key Patterns

- **Prefixed IDs**: `job_xxx`, `sch_xxx` for instant identification
- **Type-safe**: Drizzle → Elysia → Eden end-to-end
- **DX-first**: Ultracite, t3-env, OpenAPI auto-docs

## Scale

- 20k+ docs/day, 200MB max, RTX 3060 baseline

## Monorepo

```
apps/server, apps/web
packages/db, packages/env, packages/auth, packages/paddleocr-vl-ts
```
