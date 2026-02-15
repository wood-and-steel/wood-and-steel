# TypeScript Migration Decision Document

## Executive Summary

This document helps you decide whether to port the Wood and Steel project from JavaScript to TypeScript. It summarizes your current state, includes an interview to capture your context, and outlines factors, options, and recommended next steps.

**Recommendation:** Migrate gradually over a few days. Active development, upcoming BYOD work, and frequent refactor hesitation all favor TypeScript. Start with `Contract.js` and the data layer, then stores and core logic. Write new BYOD code in TypeScript from day one.

---

## Part 1: Current Project Snapshot

### What We Have Today

| Aspect | Current State |
|--------|---------------|
| **Language** | JavaScript (ES modules) |
| **Build** | Vite 7 |
| **Framework** | React 18 |
| **State** | Zustand |
| **Backend** | Supabase (storage, real-time) |
| **Testing** | Vitest + jsdom |
| **Files** | ~54 `.js`/`.jsx` files, 0 `.ts`/`.tsx` |
| **Type discipline** | JSDoc (@typedef, @param, @returns) in ~37 files |
| **Legacy TS artifact** | `Contract.d.ts` (orphan; JSDoc in Contract.js duplicates it) |

### Domain Complexity

- Rich, nested types: `Contract`, `GameState`, `GameContext`, `PlayerProps`, `SaveGameResult`, storage adapter interfaces
- Abstract `StorageAdapter` with multiple implementations (localStorage, Supabase)
- Complex game logic: contracts, phases, graph utilities, move validation
- Multi-device/BYOD mode with player seat and storage-type switching

### JSDoc Coverage

You already document types extensively. Examples:

- `gameStore.js`: `GameState`, `GameContext`, `GameStoreState`, `PlayerProps`
- `Contract.js`: `Contract` (in JSDoc and in `.d.ts`)
- Storage layer: `SaveGameResult`, adapter method signatures
- `gameManager.js`: ~83 JSDoc annotations

JSDoc provides some editor hints and basic checking when `checkJs` is enabled, but no compile-time guarantees or refactor support.

---

## Part 2: Factors For and Against TypeScript

### Benefits of Migrating

| Factor | Relevance to Your Project |
|--------|---------------------------|
| **Compile-time safety** | Game state (`G`, `ctx`), contract shapes, and storage adapter contracts are all typed in JSDoc; TS would enforce them at build time. |
| **Refactoring confidence** | Renaming types, changing function signatures, or updating `Contract` would propagate safely. |
| **IDE experience** | Autocomplete and “go to definition” improve, especially for `GameState`, `GameContext`, and adapter interfaces. |
| **Supabase integration** | Supabase client has first-class TS; types for generated tables can align with your game state shapes. |
| **Future BYOD work** | More complex flows and APIs will benefit from clear types. |
| **JSDoc reuse** | Existing JSDoc maps cleanly to TypeScript interfaces/types. |

### Costs and Risks

| Factor | Relevance to Your Project |
|--------|---------------------------|
| **Migration effort** | ~54 files to convert; JSDoc will speed this up but not eliminate work. |
| **Learning curve** | Depends on team experience (see Q2). |
| **Mixed codebase** | Gradual migration means living with both `.js` and `.ts` until complete. |
| **Build/config** | Need `tsconfig.json`, possibly tweaking Vite; generally straightforward with Vite. |
| **Supabase types** | Optional; you can add generated types later without blocking migration. |

### When TypeScript Tends to Pay Off

- Active development with nontrivial domain logic
- Multiple contributors or future contributors
- Long maintenance horizon
- Complex or evolving data shapes (game state, storage, contracts)

### When Staying in JavaScript Can Be Fine

- Mostly maintenance, little new logic
- Solo developer very comfortable with JSDoc
- Very tight deadlines with no room for migration
- Project likely to be retired soon

---

## Part 3: Migration Approaches

### Option A: Full Migration (Big Bang)

- Convert all files to `.ts`/`.tsx` in one pass
- **Best for:** Small codebase, dedicated migration window, preference for a clean cutover
- **Rough effort:** 2–5 days for your size, depending on TS experience

### Option B: Gradual Migration (Recommended if you migrate)

- Add `tsconfig.json` with `allowJs: true`
- Convert one module at a time (e.g. start with `Contract.js`, then `data/`, then stores, etc.)
- Keep JS and TS interoperating
- **Best for:** Incremental adoption, limited migration time per week
- **Rough effort:** Spread over weeks; each new file can be TS from day one

### Option C: Strengthen JSDoc (No TS)

- Add `// @ts-check` and tighten JSDoc
- Use `tsconfig.json` with `checkJs: true` for JS files
- Improves checking without changing file extensions
- **Best for:** Lower commitment, keeping JS, still getting some type checking

### Option D: Stay as-is

- Continue with current JSDoc and workflow
- **Best for:** No migration capacity, maintenance only, or short project life

---

## Part 4: Decision Framework

Use your interview answers to choose a path:

| If… | Then consider… |
|-----|-----------------|
| Active development + long horizon + refactor hesitation | **Migrate** (Option A or B) |
| BYOD or other big features soon | **Migrate** (start now or right before feature work) |
| Solo, maintenance-only, no type-related bugs | **Stay or strengthen JSDoc** (Option C or D) |
| Tight deadline soon | **Defer** migration until after the deadline |
| Team lacks TS experience | **Gradual migration** (Option B) and/or **JSDoc** (Option C) first |
| Can’t tolerate mixed JS/TS | **Full migration** (Option A) or **stay** (Option D) |

---

## Part 5: Recommendation Summary

**Recommended path:** **Option B — Gradual migration**, with a focused conversion plan. Aim to complete within a few days, prioritized over other work.

**Primary reason:** Active development + BYOD soon + frequent refactor hesitation. Types will give you the confidence to change game state, contract shapes, and storage flows without fear of hidden breakage. Your JSDoc foundation makes the conversion straightforward.

**Suggested first steps:**

1. Add `tsconfig.json` with `allowJs: true` and install TypeScript + `@types/react`, `@types/react-dom`, `@types/node`.
2. **Day 1:** Convert `Contract.js` → `Contract.ts` as a proof of concept. Use this to learn TS syntax; the JSDoc translates directly to interfaces. Delete the orphan `Contract.d.ts`.
3. **Day 2:** Convert `data/cities.js`, `data/commodities.js`, `data/routes.js`, `data/index.js`. These are mostly data + types, few dependencies.
4. **Day 3–4:** Convert stores (`gameStore.js`, `phaseManager.js`, `phaseConfig.js`) and core logic (`Board.js`, `independentRailroads.js`). These benefit most from type safety.
5. **Ongoing:** Convert utils, providers, and components as you touch them. New BYOD code should be written in TypeScript from the start.

**Learning note:** With no prior TS experience, `Contract.js` is a good teacher. Start strict; use `any` sparingly when you hit genuine type puzzles, then tighten later.

**Defer or skip if:** You find the learning curve too steep after Contract + data. In that case, Option C (strengthen JSDoc with `checkJs: true`) is a low-friction fallback that still improves checking.

---

## Part 6: Quick Start (If Migrating)

### Minimal Setup

```bash
npm install -D typescript @types/react @types/react-dom @types/node
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "allowJs": true,
    "checkJs": false
  },
  "include": ["src"]
}
```

### Vite

Vite supports TypeScript without extra config. Ensure `vite.config` can stay as `.js` or rename to `.ts` when convenient.

### First File to Convert

Start with `Contract.js`:

- Already has a `Contract.d.ts` and JSDoc
- Central to game logic
- Pure logic, few dependencies

Rename `Contract.js` → `Contract.ts`, convert JSDoc to TypeScript interfaces, and fix any reported errors. That validates your setup and gives a template for the rest.

---

## Appendix: File Inventory (for migration planning)

| Area | Files | Notes |
|------|-------|-------|
| Data | `cities.js`, `commodities.js`, `routes.js`, `index.js` | Good candidates for early conversion |
| Core logic | `Contract.js`, `Board.js`, `independentRailroads.js` | High-impact |
| Stores | `gameStore.js`, `lobbyStore.js`, `phaseManager.js`, etc. | Complex types |
| Utils | `gameManager.js`, `graph.js`, `geo.js`, storage adapters | Interfaces matter |
| Components | ~15 components | Convert after stores/utils |
| Providers | `GameProvider.js`, `StorageProvider.js` | After stores |
| Config | `setupTests.js`, `storage.js`, etc. | Lower priority |
