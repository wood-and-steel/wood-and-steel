# TypeScript / JavaScript config alignment policy

This document records the final ts/js config alignment for **strict incremental migration**.

## Source of truth

- **tsconfig.json** is the primary config. `npm run typecheck` runs `tsc --noEmit` and uses it.
- **jsconfig.json** is aligned with tsconfig so that any tool or editor using it sees the same checking behavior.

## Aligned options (both configs)

- **Strict**: `strict: true` — full strict mode (strictNullChecks, noImplicitAny, etc.).
- **JS checking**: `allowJs: true`, `checkJs: true` — `.js` files are type-checked with the same strictness as `.ts` during migration.
- **Module / JSX**: `moduleResolution: "Bundler"`, `jsx: "react-jsx"` — matches Vite and modern React.
- **Paths / types**: Same `baseUrl`, `paths`, `types`, `include`, `exclude` (including `dist`).

## Strict policy (first pass)

- **No broad `any`** — avoid `any` except where narrowly justified and documented.
- **No blanket `@ts-nocheck`** — do not add file-level suppressions; fix or type properly.
- Migrate in small batches; run typecheck and tests after each conversion.

## Rationale

Aligning both configs keeps diagnostics consistent whether the language service uses tsconfig or jsconfig, and ensures JS and TS files are checked under one strict policy during the migration.

## Note on typecheck with checkJs

With `checkJs: true`, `npm run typecheck` will report errors in remaining `.js` files until they are converted to TypeScript. That is intended: strict diagnostics apply to both JS and TS during incremental migration.
