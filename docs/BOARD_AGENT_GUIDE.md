# Board App — Agent Implementation Guide

**Audience:** AI agents writing production or test code for the playtest board at `/board`.
**Purpose:** Where the board's code lives, the invariants it must keep, and how to change it safely.
Design history and decisions: [BOARD_APP_PLAN.md](archived/BOARD_APP_PLAN.md) and [BOARD_APP_PHASE_2_PLAN.md](archived/BOARD_APP_PHASE_2_PLAN.md) (archived).

The board is a shared, playtest-only digital copy of the physical map board and player boards: player track, engine and Railyard tokens, Hubs, Regional Offices, independent railroads, and each player's engine types, cargo, and upgrades. It runs on one shared screen or several synced browsers.

---

## Behavioral Contracts

| Invariant | Description |
|-----------|-------------|
| **Read-only toward the game** | The board never calls moves (`stores/gameActions`, `stores/moves`) or `saveGameState`. It reads `G`/`ctx` and hydrates the existing `useGameStore`; only the app changes `G`/`ctx`. Enforced by `boardIsolation.test.ts`. |
| **Isolated** | All code lives in `src/board/`. The main app imports nothing from it except two lazy imports in `src/app/App.tsx`: `BoardApp` behind `__INCLUDE_BOARD__`, and the dev-only `/board/edit-paths` page behind `import.meta.env.DEV`. Deleting `src/board/` and those branches leaves the app working. Enforced by `boardIsolation.test.ts`. |
| **Not in production builds** | `__INCLUDE_BOARD__` is true only in `development`, `test`, and `board` modes. `npm run build` must contain no board code; `npm run check:board-build` verifies it. |
| **Board-only state is separate** | Track, engine positions, Railyards, engine types, cargo, upgrades, and the independent-railroad snapshot live in `boardStore` and the `board_states` table, never in `G`/`ctx`. |
| **Every edit is an op** | Edits are serializable `BoardOp`s applied by pure functions in `boardOps.ts`. Ops must stay **re-appliable**: after a save conflict the same op is applied to fresh state from another screen. |
| **Silent rules** | No rule enforcement, warnings, or confirms. Rules only inform defaults (e.g. the current player claims). Anything is allowed. |
| **Board errors stay local** | If `board_states` is missing or a save fails, the board shows a banner; the game view (indie routes, hubs, top bar) keeps working. |

---

## File Reference

All paths under `src/board/` unless noted.

| Path | Role |
|------|------|
| `BoardApp.tsx` | Entry (`/board?game=CODE`): game picker, `BoardView` (wires sync, map, chrome, popover, token drag). |
| `useBoardGameSync.ts` | Read-only `G`/`ctx` load + realtime, hydrating `useGameStore`. |
| `useBoardStateSync.ts` | Opens board state when the game is live, seeds it, and runs acquisition reconciliation on every `G` change. |
| `boardOps.ts` | `BoardState` shape, `BoardOp` union, pure ops, `applyBoardOp`, `normalizeBoardState`. |
| `boardStore.ts` | Zustand store: `confirmed` (last saved state + `updatedAt`), `pending` ops, derived `board`, `status`, `error`. |
| `boardSync.ts` | Session controller: `openBoard`, `closeBoard`, `trySeedBoard`, `dispatchBoardOp` (optimistic apply, queued conditional saves, conflict reload + re-apply, 5 attempts). |
| `boardStateAdapter.ts` | `BoardStateAdapter` (the generic JSON row adapter) pointed at `board_states`, `getBoardStateAdapter` / `setBoardStateAdapter`. |
| `botNarration.ts`, `useBotNarration.ts` | Playtest bots' narration in their tray cards: reads `bot_states` (read-only, realtime) and works out each bot's last turn and whether the host's app is running it ([BOT_PLAN.md](BOT_PLAN.md)). |
| `jsonRowAdapter.ts` | One JSON row per game code in a Supabase table: conditional saves on `updated_at`, realtime. Also used by playtest bots for `bot_states` ([BOT_PLAN.md](BOT_PLAN.md)). |
| `memoryBoardStateAdapter.testHelper.ts` | In-memory adapter for tests (conditional saves, realtime, `beforeSave` hook to simulate another screen). |
| `boardSeed.ts` | First-open seeding from `G`: starting routes, empty trays, indie snapshot. |
| `boardAcquisitions.ts` | `findAcquirer`, `reconcileOp`: converts acquired indie railroads to track. |
| `boardPlayers.ts` | Player display data (play order, light/dark shades), `formatPhase`. |
| `BoardMap.tsx` | The SVG map and all its layers; route click handling. |
| `BoardChrome.tsx` | Top bar. |
| `PlayerTrays.tsx` | Right column with one card per player: engine rows (token, type, cargo, distance, effects), upgrade checkboxes, unplaced Railyard. Owns which picker is open. |
| `TrayPicker.tsx` | Popover and option lists for choosing an engine type or commodity; `CommodityIcon`. |
| `playerBoardData.ts` | Static engine, upgrade, and commodity-group data from the rules; `engineDistance` and formatting helpers. |
| `useBoardPopover.ts` | Shared popover placement and dismissal (Escape, outside press). Used by `RoutePopover` and `TrayPicker`. |
| `RoutePopover.tsx` | Owner / Parallel / Unclaim popover for a route. |
| `tokens.ts`, `useTokenDrag.ts`, `TokenIcon.tsx` | Token identity and layout, pointer-event drag and drop, tray icons and drag ghost. |
| `useZoomPan.ts` | Scroll-container zoom (50–400%, fit width = 100%) and drag-to-pan. |
| `geometry/cityPoints.ts`, `geometry/routePaths.ts` | Generated board geometry in full-PNG pixels (6660×4173). Regenerate with `scripts/trace-routes.py`; fix by hand at `/board/edit-paths` (dev only). |
| `geometry/trackPaths.ts` | Route polylines trimmed at city circles and offset for parallel owners. Used for both player track and indie routes. |
| `supabase/board_states.sql` | Table, anon RLS policies, realtime publication. Applied by hand in the Supabase dashboard. |
| `assets/map-board.webp` | Background art, generated by `scripts/make-board-webp.py`. |
| `src/shared/styles/board.css` | All board styles. Imported only by `BoardApp.tsx` (not `index.css`), so it ships in the board chunk. |
| `scripts/check-board-build.mjs` | Scans `dist/` for board code; see `npm run check:board-build`. |

---

## Data Flow

```
games row ──realtime──▶ useBoardGameSync ──▶ useGameStore { G, ctx }   (read-only)
                                                   │
                                                   ▼
                                    useBoardStateSync: seed / reconcileOp
                                                   │ BoardOp
user click / drag ──────────────────────▶ dispatchBoardOp ──▶ boardStore.pending ──▶ board (rendered)
                                                   │
                                                   ▼  save(state, expected updatedAt)
board_states row ◀──── conflict? reload, re-apply op, retry ────┘
        │
        └──realtime──▶ boardStore.confirmed (only if newer)
```

- **Status:** `loading` → `unseeded` (no row; waits until the phase is past `setup`) or `ready`; `error` on load/seed failure. Edits are ignored unless `ready`.
- **Saves:** one op at a time, conditional on the row's `updated_at` (insert if no row). Save errors drop pending ops, roll the display back, and set `error`.
- **Acquisitions:** `reconcileIndependentRailroads` converts only railroads still in the snapshot it is applied to, then replaces the snapshot. That makes it idempotent across screens.

---

## Player Tracking

`BoardApp` lays out `.boardMain` as a row: the map viewport takes the remaining width and `PlayerTrays` is a fixed-width column (`--board-trays-width`) that scrolls when its cards don't fit. Dropping a token anywhere on the column returns it to its tray.

Slot `0` is the light token and slot `1` the dark token, as in `engines`.

```ts
engineTypes: Record<string, [EngineTypeId | null, EngineTypeId | null]>; // null = no engine
cargo: Record<string, [string | null, string | null]>;                   // commodity key; null = empty
upgrades: Record<string, UpgradeId[]>;                                   // upgrades bought
```

- **Read through the helpers.** A player with no `engineTypes` entry has a John Bull on the light token. That default is applied by `playerEngineTypes` and `setEngineType`, not at seeding, so read with `playerEngineTypes` and `playerCargo` instead of indexing the records.
- **Ops set absolute values and touch one slot or one upgrade.** A toggle would flip back when re-applied after a conflict, and writing a whole pair would overwrite another screen's edit to the other slot.
- **Clearing an engine clears that slot's cargo.** Changing to another engine type keeps it.
- **Service Yard is display only.** `engineDistance` adds 1 for a Consolidation or later, and nothing limits how far a token moves.
- Hub, Railyard, and Regional Office purchases are not tracked here.

---

## Rendering Layers (bottom to top)

1. Background art (`<image>`, WebP stretched over the full viewBox)
2. Indie routes (black, trimmed at cities)
3. Player track (casing + player-color stroke per owner; primary at slot 0, parallels at ±1, ±2; slot 0 is left free when an indie also owns the route)
4. Hub rings
5. Regional Office discs
6. Route hit areas (invisible wide strokes; click, hover, tooltip)
7. Snap-target ring and tokens. These sit **above** the hit areas so tokens stay grabbable where routes meet at a city.

SVG coordinates and colors are attributes, never style objects. The HTML overlays placed at screen coordinates (`RoutePopover`, `TrayPicker`, `TokenGhost`) are positioned with CSS custom properties set from a ref, not inline `style={}`.

---

## Implementing Changes

- **New kind of edit:** add a variant to `BoardOp` and a pure function in `boardOps.ts`, wire it into `applyBoardOp`, and dispatch with `dispatchBoardOp`. Make sure re-applying it to someone else's newer state does the right thing.
- **New field in `BoardState`:** add it to the interface, `emptyBoardState`, `normalizeBoardState` (tolerate old rows that lack it), and seeding if needed. Bump `BOARD_STATE_VERSION` for any field an already-open tab must not lose: `normalizeBoardState` rebuilds state field by field, so a stale tab would drop the unknown field on its next save. Older boards refuse newer rows and ask for a reload.
- **New thing shown from `G`:** read it in `BoardMap`/`BoardChrome`/`PlayerTrays` from `useGameStore`. Never write it back.
- **Schema change to the table:** edit `supabase/board_states.sql` so it stays safe to re-run, and tell Jeff to apply it.

---

## Test Code Reference

| File | Covers |
|------|--------|
| `boardOps.test.ts` | Every op, replay, normalization, version 1 rows |
| `playerBoardData.test.ts` | Engine, upgrade, and commodity-group data; `engineDistance` |
| `boardSeed.test.ts` | Starting-route seeding, setup gating, mid-game ambiguity |
| `boardAcquisitions.test.ts` | Acquirer choice, diff, growth, idempotence |
| `boardSync.test.ts` | Load, seed, queued saves, conflict re-apply, realtime (incl. stale), errors, two-screen acquisition and player tracking |
| `boardStateAdapter.test.ts` | Supabase adapter with a fake client: conditional insert/update, conflicts, missing-table error, realtime |
| `tokens.test.ts`, `geometry/trackPaths.test.ts` | Token layout and snapping; track geometry |
| `BoardApp.test.tsx` | Integration through `App`: picker, rendering, seeding, click-claim, popover, token drag (stubbed layout + `PointerEvent`), engine rows, cargo, upgrades, acquisitions, zoom, error banner |
| `boardIsolation.test.ts` | Read-only and isolation guards |

Tests must call `setBoardStateAdapter(new MemoryBoardStateAdapter())` (and `setStorageAdapter` for games). Vitest loads `.env`, so a test that renders the board without them would talk to the real Supabase project.
