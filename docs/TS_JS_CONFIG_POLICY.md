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

## Commenting during JS → TS migration

When converting a `.js` (or `.jsx`) file to `.ts` / `.tsx`:

1. **Review the original file’s comments** — Before or after deleting the old file, read the comments in the JS version (e.g. from git: `git show HEAD:path/to/File.js` if already deleted).
2. **Add comments to the TS file** that are **relevant and not obvious from context** — e.g. module/section summaries, non-obvious invariants, “why” (e.g. fire-and-forget, backward compatibility, optimistic concurrency), and brief JSDoc where it clarifies intent or constraints.
3. **Omit** comments that merely restate the code (e.g. “Get current state from store”) or that document trivial behavior.

Apply this as part of each migration step so the TypeScript codebase retains the useful documentation from the JS sources.

## Rationale

Aligning both configs keeps diagnostics consistent whether the language service uses tsconfig or jsconfig, and ensures JS and TS files are checked under one strict policy during the migration.

## Note on typecheck with checkJs

With `checkJs: true`, `npm run typecheck` will report errors in remaining `.js` files until they are converted to TypeScript. That is intended: strict diagnostics apply to both JS and TS during incremental migration.

## Build and module resolution (avoid "file does not exist" errors)

When converting files from `.js` to `.ts`/`.tsx`, **delete the old `.js` file** so only the new file exists. To avoid Vite/build errors like "Failed to resolve import … from … .js. Does the file exist?":

1. **Vite resolve order** — In `vite.config.js`, set `resolve.extensions` so TypeScript is tried before JavaScript, e.g. `['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json']`. Then bare imports like `'./app/App'` resolve to `App.tsx` when `App.js` is gone.

2. **TypeScript entry point** — Use a TS entry for the app (e.g. `src/index.tsx`) and point `index.html` at it (e.g. `src="/src/index.tsx"`). Entering from a `.tsx` entry keeps resolution consistent and avoids the bundler requesting deleted `.js` files.

3. **After converting the app entry** — When the root becomes TypeScript, create `index.tsx` (or `main.tsx`), update `index.html` to reference it, and remove the old `index.js` (or leave it unused). Do not leave the HTML script tag pointing at a removed `.js` file.

4. **Restart dev server** — After changing the entry or resolve config, restart `npm start` so Vite picks up the new entry and clears cached resolution.
