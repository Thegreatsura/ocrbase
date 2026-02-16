# TypeScript Conventions

## Rule Overrides

- Do not use inline rule-disables (`eslint-disable`, `@ts-ignore`, `@ts-nocheck`, etc.).
- If a rule needs adjustment, update `.oxlintrc.json` or `.oxfmtrc.json`.

## Code Conventions

- Prefer `unknown` over `any` when the type is not yet known.
- Use `as const` for immutable literals that should stay narrow.
- Prefer type narrowing and type guards over broad type assertions.
- Extract magic numbers into named constants.
