# Plan: Remove Local and Cloud (Hotseat) modes

**Status (2026-11-07):** implemented. `switchToGame` is kept (used by tests). `StorageProvider` keeps the `current_game_cloud` localStorage key so devices keep their current game. The unused `byod_player_seat_*` helpers were removed.

After this change the app has a single mode: **cloud BYOD** (Supabase storage, one device per player). The lobby loses its tab control, and every `'local'` / `'hotseat'` code path, type, and doc reference is removed.

## Decisions (recommended defaults, confirm before starting)

| Topic | Recommendation |
|---|---|
| Existing hotseat games in Supabase | Hide them: the lobby lists only rows with `metadata.gameMode === 'byod'`. Provide an optional one-off SQL cleanup (`delete from games where metadata->>'gameMode' is distinct from 'byod'`) for Jeff to run in the dashboard. No in-app conversion. |
| Existing localStorage games | Dropped. Delete `migration.ts` and `testMigration.ts` (local → Supabase migration) along with `LocalStorageAdapter`. |
| Tests that ran on `LocalStorageAdapter` | Replace with a small in-memory `StorageAdapter` that lives in test code only (`src/utils/storage/memoryAdapter.test-helper.ts` or similar) and is injected via `vi.mock('./storage')`. No product code path can reach it. |
| Supabase not configured | Lobby shows the existing "cloud unavailable" error state instead of silently falling back to localStorage. |
| `gameMode` metadata field | Keep writing `gameMode: 'byod'` so old rows stay distinguishable, but the type becomes the literal `'byod'` and nothing branches on it. |
| Name "BYOD" | Keep as-is in code (`isBYODMode` props go away; BYOD seat/metadata names stay). Renaming is out of scope. |

## Code changes

### 1. Lobby — `src/components/LobbyScreen.tsx`
- Delete `TAB_*` constants, `LOBBY_TAB_KEY`, `VALID_TABS`, `LobbyTab`, `getStorageTypeForTab`, `getGameModeForTab`, `activeTab` state, the mount-time storage-type sync effect, and `handleTabSwitch`.
- Delete the `.lobbyScreen__tabs` button row. Keep the loading spinner by moving it next to the title (or into the join-form row).
- Join form always renders (no `activeTab === TAB_CLOUD_BYOD` guard). Cloud-error banner/empty state drop the `activeTab !== TAB_LOCAL` checks.
- `filteredGames`: filter to `metadata.gameMode === 'byod'` (hides legacy hotseat rows).
- Remove all `setActiveTab(...)` and `storage.setStorageType("cloud")` calls in `doJoinGame`, the prefill effect, and `handleRowClick`.
- `handleNewGame(numPlayers)` → `onNewGame(numPlayers)`; `onNewGame` prop type loses `gameMode`. `onEnterGame` loses the `{ storageType }` option.
- Remove `WRONG_GAME_MODE` from `JOIN_ERROR_MESSAGES` (and the code that returns it in `gameManager.assignPlayerSeat`).
- Optional cleanup: one-time `localStorage.removeItem('lobby_active_tab')` is not needed; leave stale keys alone.

### 2. Lobby CSS — `src/shared/styles/lobby-screen.css`
- Remove `.lobbyScreen__tabs`, `.lobbyScreen__tab*` rules (incl. the two media-query blocks ~L225 and ~L295). Re-home `.lobbyScreen__loadingIndicator` positioning if it depended on the tab row.

### 3. App shell — `src/app/App.tsx`
- Remove `isBYODGame` state and every `setIsBYODGame` call; every game is BYOD.
- `initializeApp` / `handleEnterGame`: drop `storage.isBYODGame()` checks; always run the "device not playing" check and `getMyPlayerID`. Drop the `storageType` option and the `setStorageType` / `setCurrentGameCodeForType` calls (use `setCurrentGameCode`).
- `handleNewGame(numPlayers)`: remove `gameMode` param and the hotseat branch (`resetState` + `initializeIndependentRailroads` + `saveGameState`); keep only the BYOD path. `AppGameManager.onNewGame` signature updated.
- Remove the final "Hotseat mode: render all player boards" return; the BYOD render becomes the default. Drop `isBYODMode={true}`.
- `gameExists` / `loadGameState` / `deleteGame` / `listGames` calls lose their `storage.storageType` argument.
- Remove `import type { StorageType }` and the console strings mentioning hotseat.
- Keep the `testMigration` dev import removal in sync with step 6.

### 4. Board components
- `src/Board.tsx`: remove `isBYODMode` prop; `isHidden` (hotseat "hide when not your turn") goes away entirely.
- `src/components/PlayerBoard.tsx`, `src/components/PlayerToolbar.tsx`: remove `isBYODMode`; `effectivePlayerID = playerID ?? ctx.currentPlayer`, `isPlayerTurn = playerID === ctx.currentPlayer`, `showTurnToolbar = isPlayerTurn`.
- `src/components/WaitingForPlayersScreen.tsx`: review its 6 hits; remove any hotseat/local branches.

### 5. Storage provider — `src/providers/StorageProvider.tsx`
- Remove `storageType` state, `setStorageType`, `STORAGE_PREFERENCE_KEY`, `CURRENT_GAME_LOCAL_KEY`, `getCurrentGameCodeForType`, `setCurrentGameCodeForType`, `getGameMode`, `isBYODGame` from the context value and `StorageContextValue`.
- Adapter: always `getStorageAdapter()` (Supabase). Current-game key: only `current_game_cloud` (consider renaming to `current_game`; if renamed, read the old key once as a fallback).
- `getMyPlayerID` calls `getDevicePlayerID` directly; `getMetadata` no longer passes a storage type.
- Remove the unused hotseat-era `getPlayerSeat` / `setPlayerSeat` / `clearPlayerSeat` (`byod_player_seat_*` localStorage) **if** nothing calls them (grep first; the doc comment says seats live in cloud metadata).
- Update the file header comment.

### 6. Storage layer — `src/utils/storage/`
- Delete `localStorageAdapter.ts`, `migration.ts`, `testMigration.ts`.
- `index.ts`: remove `LocalStorageAdapter` import/export, `export * from './migration'`, `NormalizedStorageType`, `normalizeStorageType`, and the `storageType` parameters; `getStorageAdapter()` returns the cached Supabase adapter and throws `CloudUnavailableError` if Supabase isn't configured. Remove the per-type `adapterCache` map (single instance).
- `src/config/storage.js`: remove the deprecated `STORAGE_TYPE` / `VITE_STORAGE_TYPE` and the `STORAGE_TYPE === 'supabase'` branch.

### 7. Game manager — `src/utils/gameManager.ts`
- Delete `export type StorageType` and every `storageType` parameter (≈20 functions); `getAdapter()` takes no argument.
- `getCurrentGameCode` / `setCurrentGameCode` / `clearCurrentGameCode`: single key, no `storage_preference` lookup.
- `saveGameState` / `loadGameState`: remove the "which current-game key has this code" adapter resolution and the "try cloud then local" fallback.
- `createNewGame(options)`: no `storageType`; `gameMode` option removed (always `'byod'`, `hostDeviceId` required); always starts in `waiting_for_players`. `GameMetadata.gameMode` type → `'byod'`.
- `assignPlayerSeat`: remove the `WRONG_GAME_MODE` hotseat check (or keep it to reject legacy rows — recommend keep, since hidden legacy rows can still be reached via `/g/CODE`; then keep the lobby message but reword to "This game uses a mode that is no longer supported.").
- Callers in `src/stores/events.ts`, `gameActions.ts`, `gameStore.ts`, `phaseManager.ts` already call `getCurrentGameCode()` / `saveGameState(code, G, ctx)` without a type; verify they compile and drop any comments about local/hotseat (`phaseConfig.ts` L30, `phaseManager.ts`, `gameStore.ts`).

### 8. Phases
- `src/stores/phaseConfig.ts`: `waiting_for_players` is now always the first phase; update the comment ("BYOD only… Hotseat skips this").
- Check `gameStore.resetState()` default `ctx.phase`; if it defaults to `'setup'` for hotseat, change to `'waiting_for_players'` or leave it and note it's only used for clearing state.

### 9. Tests
- `src/utils/gameManager.test.ts`: swap the `'local'` adapter for the in-memory test adapter; delete the "7. Game Mode support" hotseat tests and `'returns error for hotseat game'` (or rewrite as the legacy-row rejection if kept); create games with `{ hostDeviceId }`. Expect the `phase` of new games to be `waiting_for_players`.
- `src/app/App.test.tsx` L20–21: assert the tab buttons are **absent** and the join form is present.
- Run `npm test`, `npm run typecheck` (or `tsc --noEmit`), `npm run build`.

## Docs

- **`docs/BOARD_APP_PLAN.md`** (see exact edits below).
- `AGENTS.md`: Lobby/BYOD bullets: drop "lobby mode" tab wording if any; note single cloud BYOD mode.
- `docs/LOBBY_AGENT_GUIDE.md`: remove tab control, Local/Hotseat sections; describe the single list + join form.
- `docs/BYOD_AGENT_GUIDE.md`: remove hotseat comparisons and `storageType` parameters; BYOD is the only mode.
- `docs/PHASES_AGENT_GUIDE.md`: `waiting_for_players` always first.
- `docs/BUILD_AND_RUN.md`: remove `VITE_STORAGE_TYPE`; Supabase env vars are required.
- `docs/CLOUD_STORAGE_TESTING.md`: remove the `VITE_STORAGE_TYPE=supabase` step and migration instructions.
- `docs/GAME_DATA_SCHEMA.md`, `docs/Game rules.md`, `docs/COMMIT_MESSAGE_GUIDE.md`, `README.md`: remove hotseat/local mentions (check each hit; the commit guide hit may just be an example and can stay).
- Leave `docs/archived/*` untouched.

### `docs/BOARD_APP_PLAN.md` edits

| Line | Current | New |
|---|---|---|
| 12 (Persistence / sync) | "…with Realtime. localStorage fallback for local games. Works on one shared screen or several synced browsers." | "…with Realtime. Works on one shared screen or several synced browsers." |
| 35 (Reading the game) | "With no code, show a small picker using `listGames('cloud')` (and local games)." | "With no code, show a small picker using `listGames()`." |
| 59 (Board state → Persistence) | "`BoardStateAdapter` with `supabase` and `localStorage` implementations, picked by the game's storage type." | "`BoardStateAdapter` backed by Supabase (one implementation; the interface stays so tests can use an in-memory fake)." |
| 132 (M2) | "adapters (Supabase + local)" | "Supabase adapter" |
| 148 (Open questions) | "**Local-storage games:** [Not supported]." | Remove the bullet (local games no longer exist). |

Also consider in the Board plan: the "current player" default for click-claim and the read-only sync now always come from a BYOD game, so no change is needed there.

## Order of work

1. Storage layer + gameManager (steps 6–7) with the in-memory test adapter, and get `gameManager.test.ts` green.
2. StorageProvider (step 5).
3. App shell, Board components, phases (steps 3, 4, 8).
4. Lobby UI + CSS + App test (steps 1, 2, 9).
5. Docs, including `BOARD_APP_PLAN.md`.
6. Full `npm test`, typecheck, `npm run build`, then click through: lobby → new game → waiting room → join from a second browser → play a turn.
