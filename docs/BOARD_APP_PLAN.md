# Board App Plan (`/board`)

A shared, playtest-only digital map board that mirrors the physical board: track, engine tokens, Hub/Railyard tokens, Regional Office discs, and independent railroad routes. Built only on request; the main app neither imports nor depends on it.

## Decisions (from Q&A, 2026-11-01)

| Topic | Decision |
|---|---|
| Relationship to `G`/`ctx` | **Read-only.** The board never calls moves or `saveGameState`. Anything the app can change is only changeable from the app. |
| Board-only state | Player track (incl. parallel), engine token positions, Railyard tokens. Stored outside `G`/`ctx`. |
| Displayed from `G` (read-only) | Independent railroad routes, Hub cities, Regional Offices, current player, round, phase, player names/colors. |
| Persistence / sync | New Supabase table `board_states` (one row per game code) with Realtime. Works on one shared screen or several synced browsers. |
| Build gating | Copy the `/sim` pattern: `__INCLUDE_BOARD__` flag, `npm run build:board`, always on in dev, lazy-loaded, excluded from `npm run build`. |
| Map art | `docs/map-board-full.png` as background; route curves **approximated from the PNG** (auto-trace + dev fix-up tool). No SVG source exists. |
| Seeding | On first open, draw each player's starting route from `G`. **No engines placed.** After that, all board state is independent. |
| Claim gesture | Click a route. Unclaimed → instant claim for `ctx.currentPlayer`. Claimed (or shift/right-click) → popover. |
| Tokens | Drag and drop between cities and per-player trays. |
| Rule enforcement | **Silent.** Rules only inform defaults (current player). No warnings, no confirms. |
| Acquisitions | When an indie railroad disappears from `G`, auto-convert its routes to board track for the acquiring player. |
| Undo / history | None. |
| Layout | Non-responsive, min width 1000px. Default zoom = fit browser width; zoom in/out + pan. |

## Architecture

### Isolation and gating

- All code lives in **`src/board/`** (plus a dev-only `scripts/trace-routes.py`). The main app imports nothing from it.
- `vite.config.js`: `__INCLUDE_BOARD__: ['development', 'test', 'board'].includes(mode)`; declare in `src/global.d.ts`.
- `package.json`: `"build:board": "vite build --mode board"`.
- `App.tsx`: one lazy branch alongside `/sim`, e.g. `if (__INCLUDE_BOARD__ && location.pathname.startsWith('/board') && BoardApp) …`. Wrapped in `StorageProvider` but **not** `AppContent`.
- Removing `src/board/` and that branch leaves the main app fully working. If the `board_states` table doesn't exist, only the board shows an error.

### Reading the game (read-only)

- URL: `/board?game=ABCDE`. With no code, show a small picker using `listGames()`.
- `useBoardGameSync(code)`: `loadGameState` + `adapter.subscribeToGame`, hydrating the existing `useGameStore` with `{ G, ctx }` (complies with AGENTS.md: there's no second store for game state). Never calls `gameActions`, `moves`, or `saveGameState`.
- A vitest guard asserts no file in `src/board/` imports `stores/gameActions`, `stores/moves`, or `saveGameState`.

### Board state

New Zustand store `src/board/boardStore.ts`. This is a documented exception in AGENTS.md: it's playtest-only and holds no `G`/`ctx` data.

```ts
interface BoardState {
  version: 1;
  seeded: boolean;
  /** routeKey -> up to 4 owners [primary, ...parallel] as playerIDs */
  track: Record<string, string[]>;
  /** playerID -> [lightEngineCity, darkEngineCity]; null = in tray */
  engines: Record<string, [string | null, string | null]>;
  /** playerID -> city key or null (one Railyard per player) */
  railyards: Record<string, string | null>;
  /** last-seen G.independentRailroads (name -> route keys), for acquisition detection */
  seenIndependentRailroads: Record<string, string[]>;
}
```

- All edits are **pure ops** (`claimRoute`, `setRouteOwners`, `unclaimRoute`, `moveEngine`, `moveRailyard`, `applyAcquisition`) in `boardOps.ts`, so they can be unit-tested and replayed.
- **Persistence:** `BoardStateAdapter` backed by Supabase (one implementation; the interface stays so tests can use an in-memory fake). Each save sends the expected `updated_at`. On conflict, the board reloads, re-applies the op to the fresh state, and saves again. This avoids clobbering when two screens edit at once.

```sql
create table board_states (
  code text primary key references games(code) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter publication supabase_realtime add table board_states;
-- RLS policies mirroring the existing `games` table
```

SQL is kept in `src/board/supabase/board_states.sql`. Jeff applies it in the Supabase dashboard.

### Seeding (first open, no row yet)

- For each player, find the starting route whose two cities are both in `activeCities` (from the six starting-route options) and set it as that player's track.
- Snapshot `G.independentRailroads` into `seenIndependentRailroads`. Engines and railyards start in the trays. Set `seeded: true`.

### Acquisition auto-convert

On every `G` update, diff `seenIndependentRailroads` against `G.independentRailroads`:

- **Railroad removed:** pick the acquirer as the player whose `activeCities` now include all of the railroad's cities (the acquire move adds them). If several players qualify, prefer `ctx.currentPlayer`. Add its routes to that player's track: primary if empty, otherwise parallel.
- **Routes added (end-of-round growth):** just update the snapshot.
- The snapshot and the track change are written in the same save, so the conflict check keeps two open boards from converting twice.

## Rendering

- One `<svg>` in **full-PNG pixel space** (viewBox `0 0 6660 4173`). Background `<image>` is a pre-scaled WebP of the board art (~3330px wide, generated once) to keep it light.
- Layers, bottom to top:
  1. Background art
  2. Indie routes (black, from `G`)
  3. Player track (player hue; a parallel owner is drawn as a second stroke offset from the curve)
  4. Hub markers (from `G.players[].hubCity`)
  5. Regional Office discs in the printed Regional Offices panel (from `G.players[].regionalOffice`)
  6. Railyard tokens
  7. Engine tokens (light/dark shade of the player hue)
  8. Invisible wide-stroke route hit areas
- **Zoom/pan:** fit to width by default; `+`/`−`/reset buttons and Ctrl/⌘+wheel; drag empty space to pan when zoomed. Body `min-width: 1000px`.
- **Chrome:** a slim top bar (game code, phase, round, current player, sync status, zoom) and a player tray strip (name, color, unplaced engines and railyard, current player highlighted).
- **Hover tooltip on a route:** key, length, mountainous. It's informational only.
- Styling follows `CSS_ARCHITECTURE.md`: `src/shared/styles/board.css` with BEM classes, no inline styles. Dynamic SVG attributes (coordinates, fills) are attributes, not style objects.

## Interactions

| Action | Gesture |
|---|---|
| Claim unclaimed route | Click → owner = current player |
| Edit claimed route | Click (or shift/right-click any route) → popover: set primary owner, add/change parallel owner (current player preselected), unclaim. Player swatches in play order. |
| Move engine / railyard | Drag from tray or city; snaps to nearest city within a radius; drop on tray (or off-board) to remove |
| No current player (e.g. setup phase) | Click opens the popover instead of instant-claiming |

Anything is allowed: claims off-network, more than 2 builds per turn, engines anywhere, and claims overlapping indie routes (both drawn).

## Route geometry (milestone 0)

The full board PNG (6660×4173) looks like a 6× scale of `simple-map.png` (1110×696), so the existing `CITY_PIXELS` give a starting estimate.

1. **City points:** scale `CITY_PIXELS` ×6, then refine each point to the center of the nearest white city circle (circle detection). Output to `src/board/geometry/cityPoints.ts`. Regional Office disc centers are added by hand (6 points).
2. **Route curves:** `scripts/trace-routes.py` (OpenCV/scikit-image, dev-only, never bundled):
   - mask the white route lines
   - for each route, find a path along the mask between its two city circles
   - fit 1–2 cubic Béziers
   - output `src/board/geometry/routePaths.ts` (`routeKey -> SVG path d`)
   - flag low-confidence fits
3. **Fix-up tool:** `/board/edit-paths` (dev-only) overlays every path on the art, highlights flagged routes, lets you drag endpoints and control points, and saves via the File System Access API (same approach as `/pick-coords`).

## Milestones

1. **M0 Geometry:** city points, traced route paths, fix-up page; Jeff reviews the overlay.
   - *Status (2026-11-01):* built. All 56 cities and the 6 RO discs are auto-detected, and 105/105 routes have paths. The PNG is not an exact 6× scale of `simple-map.png`, so cities are matched by an affine fit plus optimal assignment. Three routes have **no stroke in the art** and fall back to flagged straight lines: Chicago–Saint Louis (only its price pill is printed), Flagstaff–Phoenix, and Los Angeles–Phoenix. Re-running `scripts/trace-routes.py` keeps routes listed in `EDITED_ROUTES`.
2. **M1 Shell:** flag/script/route, lazy load, read-only `G` sync, background, indie routes, hubs, RO discs, zoom/pan, top bar, trays.
   - *Status (2026-11-07):* built. `src/board/BoardApp.tsx` (picker + view), `useBoardGameSync.ts`, `useZoomPan.ts` (scroll-container zoom, 50–400%), `BoardMap.tsx`, `BoardChrome.tsx`, styles in `src/shared/styles/board.css` (imported only by the board chunk). Background is `src/board/assets/map-board.webp` (3330px, ~320 KB) from `scripts/make-board-webp.py`. Route hover tooltips are native `<title>`s on the hit layer. The import guard test (`boardIsolation.test.ts`) landed early. Trays show all tokens as unplaced until M2/M4.
3. **M2 Board state:** ops, store, Supabase adapter, SQL, conflict-retry, seeding.
   - *Status (2026-11-07):* built; **needs `src/board/supabase/board_states.sql` applied** (until then the board shows a banner and the game view still works). `boardOps.ts` (state shape, pure ops incl. `applyAcquisition`/`snapshotIndependentRailroads` for M5, `BoardOp` union, `normalizeBoardState`), `boardSeed.ts`, `boardStateAdapter.ts` (Supabase, own client), `boardStore.ts` (`confirmed` + `pending` ops → `board`), `boardSync.ts` (load, realtime, seed, queued saves with conflict re-apply, 5 attempts), `useBoardStateSync.ts`. Owners per route are capped at 4 (`[primary, ...parallel]`). Seeding waits until the phase is past `setup`; if several starting pairs match (first opened mid-game), each player gets one not already given to an earlier player. `STARTING_CITY_PAIRS` moved to `src/data/startingRoutes.ts`. Track isn't drawn yet (M3); trays now hide placed tokens.
4. **M3 Track:** click-claim, popover, parallel rendering.
   - *Status (2026-11-07):* built. `geometry/trackPaths.ts` samples each route's Béziers into a polyline, trims it at both city circles, and offsets it along the normals: primary on the curve, parallels alternating sides one track width apart (slots 0, +1, −1, +2). On a route an indie also owns, track starts at slot +1 so the black indie stroke stays visible. `RoutePopover.tsx` applies every click immediately (Owner row replaces the primary; Parallel row toggles; Unclaim). "Current player preselected" means the current player's Parallel swatch is highlighted and focused, not staged. Instant claim only happens in the `play` phase. Shift-click and right-click always open the popover. Clicks that end a drag-pan are ignored (`useZoomPan().didPan()`). The popover closes on Escape, a press outside, scroll, or zoom, and is positioned through CSS custom properties set from a ref (no inline style objects).
5. **M4 Tokens:** engine and railyard drag/drop.
6. **M5 Acquisitions:** diff and auto-convert.
7. **M6 Hardening:**
   - vitest for ops, seeding, acquisition diff, import guard
   - `npm run build` produces no board chunk (grep `dist/` for `board_states`)
   - typecheck
   - docs: `docs/BOARD_AGENT_GUIDE.md`, AGENTS.md exception, BUILD_AND_RUN, GAME_DATA_SCHEMA note

## Open questions (non-blocking; defaults in brackets)

- **Owners per route:** cap at 4, primary + parallel
- **Railyard tokens per player:** 1
- **Hub token on the board:** read-only from `G`. Should the board also show where a player *physically* put their Hub marker if it differs? [No.]
