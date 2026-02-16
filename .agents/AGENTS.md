# ocrbase

ocrbase is a Bun + Turborepo monorepo for converting PDFs into structured data with OCR and schema-driven extraction.

## Essentials

- Package manager: `bun@1.3.9` (do not use npm/yarn/pnpm).
- Build: `bun run build` (runs `turbo build` across workspaces).
- Typecheck: `bun check-types` (runs `turbo check-types` across workspaces).
- Lint/format: `bun x ultracite fix`.
- Runtime note: `bun dev` is usually already running in another terminal; avoid starting a duplicate unless needed.

## Task-Specific Guides

- [Workflow](docs/agents/workflow.md)
- [TypeScript conventions](docs/agents/typescript.md)
- [Git workflow](docs/agents/git.md)
- [Database operations](docs/agents/database.md)
