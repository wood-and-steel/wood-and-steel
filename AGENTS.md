# For AI Agents (e.g. Cursor)

This file is the entrypoint for AI agents to find project conventions and avoid unnecessary complexity when editing code.

## State map

- **Game state** lives only in Zustand:
  - **`src/stores/gameStore.ts`** — `G` (game state: contracts, players, independent railroads) and `ctx` (phase, currentPlayer, turn, playOrder, etc.). All game and turn state lives here.
  - **`src/stores/lobbyStore.js`** — Lobby mode, selected game code, join form prefill. No other store for lobby or game list.
- **Phase** — Definitions and transition logic live in **`src/stores/phaseConfig.ts`** and **`src/stores/phaseManager.ts`**. Phase is stored in `ctx.phase`; transitions run via `checkPhaseTransition(G, ctx)`. Do not add a separate store or context for phase.
- **Moves** — Implemented in **`src/stores/gameActions.js`**; which moves are allowed per phase is in **`src/stores/moveValidation.js`** (`MOVES_BY_PHASE`). There is no other source of truth for “allowed moves.”
- **Persistence** — Game state is persisted via the existing layer (e.g. `stateSerialization.js`, storage adapters). Do not add a second persistence or derivation path for game state.

## Docs to read

- [docs/PHASES_AGENT_GUIDE.md](docs/PHASES_AGENT_GUIDE.md) — Phase system, transitions, where phase code lives
- [docs/LOBBY_AGENT_GUIDE.md](docs/LOBBY_AGENT_GUIDE.md) — Lobby screen, game list, entry/exit behavior
- [docs/BYOD_AGENT_GUIDE.md](docs/BYOD_AGENT_GUIDE.md) — BYOD multiplayer, seat assignment, waiting phase
- [docs/CSS_ARCHITECTURE.md](docs/CSS_ARCHITECTURE.md) — Styling: no inline styles, centralized CSS, BEM, variables
- [docs/Game rules.md](docs/Game%20rules.md) — Game rules and implementation status
- [docs/TS_JS_CONFIG_POLICY.md](docs/TS_JS_CONFIG_POLICY.md) — TypeScript/JS migration, extensionless imports
- When relevant: [docs/Contract generation.md](docs/Contract%20generation.md), [docs/CLOUD_STORAGE_TESTING.md](docs/CLOUD_STORAGE_TESTING.md)

## Anti-patterns (avoid these)

**Game state**

- Do not add a separate state store (Redux, another context, or a new Zustand store) for game state, phase, or current player. Use `gameStore` and `phaseConfig.ts` / `phaseManager.ts` only.
- Do not duplicate phase or “current phase” in component state; read `ctx.phase` from the store (or via `useGame()` / GameProvider).
- Do not add a second source of truth for “allowed moves”; keep it in `moveValidation.js` (`MOVES_BY_PHASE`) and enforce in `gameActions.js`.
- Do not persist or derive game state from somewhere other than the Zustand store and the existing persistence layer.

**Lobby / BYOD**

- Do not add a separate store or context for lobby mode or selected game; use `lobbyStore` and `gameManager` only.
- Do not add a new place for BYOD metadata or seat assignment; use `gameManager` and the metadata shape in BYOD_AGENT_GUIDE.

**React and styling**

- Do not use inline styles or JavaScript style objects; use CSS classes and `src/shared/styles/index.css` (see [docs/CSS_ARCHITECTURE.md](docs/CSS_ARCHITECTURE.md)).
- Do not introduce new state libraries (e.g. Redux, Jotai) for app or game state; the codebase uses Zustand only.
- Do not over-abstract components (e.g. unnecessary wrappers, a generic “game state context” beyond the existing GameProvider); follow existing patterns in `Board.tsx`, `GameProvider`, and the agent guides.

## File naming / stack

- Use **extensionless imports** (e.g. `from './stores/events'` not `from './stores/events.js'`). See [docs/TS_JS_CONFIG_POLICY.md](docs/TS_JS_CONFIG_POLICY.md).
- TypeScript and JavaScript coexist; key entrypoints include `src/app/App.tsx`, `src/Board.tsx`, `src/providers/GameProvider.tsx`, and store files (mix of `.ts` and `.js`).
