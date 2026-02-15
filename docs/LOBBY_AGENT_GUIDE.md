# Lobby Screen — Agent Implementation Guide

**Audience:** AI agents writing production or test code for lobby functionality.  
**Purpose:** Reference for implementing, modifying, or testing the lobby screen and related state management.

---

## For Agents: How to Use This Guide

1. **Before editing lobby code:** Read the [Behavioral Contracts](#behavioral-contracts) and [File Reference](#file-reference) so you understand invariants and where logic lives.
2. **Writing production code:** Use [Production Code Reference](#production-code-reference) for file paths, API contracts, and patterns.
3. **Writing tests:** Use [Test Code Reference](#test-code-reference) for test structure, mocks, and required coverage.
4. **Implementing new features:** Follow the [Implementation Order](#implementation-order) for correct dependencies.

---

## Behavioral Contracts

These invariants must hold. Code and tests must respect them.

| Invariant | Description |
|-----------|-------------|
| **Entry point** | App always starts in lobby when no current game exists or game doesn't exist in storage. No automatic game creation on mount. |
| **Lobby mode** | When `isLobbyMode === true`, the lobby screen is the main view (full-screen, not a modal). When false, the board is shown. |
| **Game list sort** | Games are sorted by `lastModified` descending (most recent first). |
| **Deletion** | Any game can be deleted, including the currently active one. Deleting current game returns to lobby without creating a new game. |
| **Navigation** | Game code button in TopButtonBar navigates to lobby (clears selection, sets lobby mode). Clicking a game row enters that game. |
| **New game** | "New Game" creates a game immediately and enters it (no setup screen). |
| **Empty state** | When no games exist, lobby shows only "New Game" controls (player count selectors). |

---

## File Reference

| Path | Role |
|------|------|
| `src/components/LobbyScreen.js` | Full-screen lobby UI; manages games list, tabs, join form, new game |
| `src/stores/lobbyStore.js` | Zustand store for lobby mode, selected game, join form prefill |
| `src/utils/gameManager.js` | `listGames`, `createNewGame`, `deleteGame`, `loadGameState`; uses storage adapter |
| `src/app/App.js` | Entry point; conditional lobby vs board render; `onEnterGame`, `onNewGame` handlers |
| `src/components/TopButtonBar.js` | Game code button triggers `onNavigateToLobby` |
| `src/Board.js` | Board container; passes `onNavigateToLobby` to TopButtonBar |
| `src/providers/StorageProvider.js` | Storage type (local/cloud); `joinGame`, `getCurrentGameCode`, etc. |

---

## Production Code Reference

### 1. `lobbyStore.js` — Lobby State

**State shape:**
```js
{
  isLobbyMode: boolean,      // true = show lobby, false = show board
  selectedGameCode: string | null,
  lobbyState: object,        // placeholder for future UI state
  joinFormPrefill: { code: string|null, error: string|null }
}
```

**Actions:**
- `setLobbyMode(isLobby: boolean)`
- `setSelectedGame(code: string | null)` — also sets `isLobbyMode` to `code === null`
- `clearSelection()` — sets `selectedGameCode: null`, `isLobbyMode: true`
- `setJoinFormPrefill(code, error)` — used when returning from "device not playing" BYOD error
- `clearJoinFormPrefill()` — clears prefill

### 2. `gameManager.js` — Game List Contract

**`listGames(storageType)`** returns an array of game objects. Each object must have:
- `code: string` — game code
- `phase: string` — e.g. `'setup'`, `'play'`, `'waiting_for_players'`
- `numPlayers: number`
- `lastModified: string` — ISO 8601 timestamp
- `metadata?: object` — includes `gameMode: 'hotseat' | 'byod'` for cloud games

Games are sorted by `lastModified` descending (most recent first).

### 3. `LobbyScreen.js` — Props and Behavior

**Props:**
- `gameManager: { onListGames, onDeleteGame, ... }` — game management API
- `onEnterGame(gameCode, options?)` — callback to enter a game; `options.storageType` can force storage type
- `onNewGame(numPlayers, gameMode)` — callback to create a new game

**Tabs:**
- `local` — local storage, hotseat only
- `cloud-hotseat` — cloud storage, hotseat games
- `cloud-byod` — cloud storage, BYOD games; includes Join form

**UI behavior:**
- Row click: enter game; for BYOD `waiting_for_players` games, join first then enter
- Delete button: `window.confirm`, then `gameManager.onDeleteGame(code)`, then refresh list
- New game: player count buttons (2–5), `onNewGame(num, gameMode)`
- Join form (Cloud BYOD tab): `storage.joinGame(code)` then `onEnterGame(code, { storageType: 'cloud' })`

**CSS:** Uses `lobbyScreen`, `lobbyScreen__*` BEM classes. See `docs/CSS_ARCHITECTURE.md`.

### 4. `App.js` — Entry and Handlers

**Initialization (mount only):**
- If no `getCurrentGameCode()` or game doesn't exist → lobby mode
- If BYOD game and device not playing → lobby mode with `setJoinFormPrefill(code, error)`
- Otherwise load game, `setSelectedGame`, `setLobbyMode(false)`

**`onEnterGame(gameCode, options?)`:**
- Load game state; set game store; `setSelectedGame(code)`; `setLobbyMode(false)`; set current game code

**`onNewGame(numPlayers, gameMode)`:**
- `createNewGame`; initialize state; load into store; `setSelectedGame`; `setLobbyMode(false)`

**Conditional render:**
- `isLobbyMode === true` → `<LobbyScreen />`
- Otherwise → `<WoodAndSteelState />` (board)

### 5. Navigation to Lobby

- `TopButtonBar` receives `onNavigateToLobby`
- Clicking game code button calls `onNavigateToLobby()`
- Handler: `clearSelection()` (or `setLobbyMode(true)` + `setSelectedGame(null)`)

---

## Test Code Reference

### Test File Locations

| Component / Area | Test File |
|------------------|-----------|
| App (lobby entry) | `src/app/App.test.js` |
| Game manager (listGames, etc.) | `src/utils/gameManager.test.js` |
| LobbyScreen (unit) | `src/components/LobbyScreen.test.js` (create if needed) |
| lobbyStore (unit) | `src/stores/lobbyStore.test.js` (create if needed) |

### Test Stack

- **Framework:** Vitest
- **React testing:** `@testing-library/react` (`render`, `screen`, `waitFor`, `act`)
- **Mocks:** `vi.fn()`, `vi.mock()` from Vitest

### Mocking Patterns

**localStorage:**
```js
const localStorageMock = {
  getItem: vi.fn((key) => store[key] || null),
  setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
  removeItem: vi.fn((key) => { delete store[key]; }),
  clear: vi.fn(() => { store = {}; }),
};
beforeAll(() => { global.localStorage = localStorageMock; });
```

**Store reset (per test):**
```js
beforeEach(() => {
  localStorageMock.clear();
  useGameStore.getState().resetState();
  useLobbyStore.getState().clearSelection?.(); // if available
  vi.clearAllMocks();
});
```

### Required Test Coverage for Lobby

**App-level:**
- [ ] App renders lobby when no current game
- [ ] App renders lobby when current game does not exist in storage
- [ ] Lobby shows Local / Cloud (Hotseat) / Cloud (BYOD) tabs
- [ ] Clicking game code button returns to lobby
- [ ] New game creates and enters game (exits lobby)
- [ ] Entering a game loads board (exits lobby)

**LobbyScreen unit:**
- [ ] Empty state: shows "No games found" and New Game controls
- [ ] Games list: shows Code, Phase, Players, Last Turn; sorted by recency
- [ ] Row click enters game
- [ ] Delete with confirm removes game and refreshes list
- [ ] New Game buttons call `onNewGame(numPlayers, gameMode)` with correct args
- [ ] Tab switch updates storage type and refreshes list
- [ ] Join form (BYOD tab): validation, error display, success flow

**lobbyStore unit:**
- [ ] `setLobbyMode` updates `isLobbyMode`
- [ ] `setSelectedGame` updates `selectedGameCode` and `isLobbyMode`
- [ ] `clearSelection` sets both to lobby mode

**gameManager (listGames):**
- [ ] Returns games with `code`, `phase`, `numPlayers`, `lastModified`, `metadata`
- [ ] Sorted by `lastModified` descending

### Edge Cases to Test

- localStorage corrupted or missing
- Game code exists but state invalid
- User deletes all games → empty state
- Refresh while in lobby
- Refresh while in game → restores game or lobby as appropriate
- BYOD: device not playing → lobby with join form prefill

---

## Implementation Order (When Adding or Changing Features)

1. **gameManager** — Timestamps, `listGames` contract
2. **lobbyStore** — State and actions
3. **LobbyScreen** — UI component
4. **App.js** — Conditional render, `onEnterGame`, `onNewGame`, delete behavior
5. **TopButtonBar** — `onNavigateToLobby`
6. **Board.js** — Remove dialog usage, wire lobby navigation
7. **Tests** — Add/update tests for each layer

---

## Cloud Storage Notes

- `listGames(storageType)` uses storage adapter; cloud adapter fetches from API.
- `lastModified` should be ISO 8601 for cloud compatibility.
- LobbyScreen filters by `metadata.gameMode` for cloud tabs.
- Future: loading states, polling, offline/online handling.

---

## Out of Scope (Not Part of Current Lobby Plan)

- Player count selection before game creation (supported; not a separate setup screen)
- Completed games section
- Game filtering / search
- Cloud storage integration (partially implemented; see StorageProvider)
