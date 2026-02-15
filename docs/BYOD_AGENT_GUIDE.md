# BYOD (Bring Your Own Device) — Agent Implementation Guide

**Audience:** AI agents writing production or test code for BYOD multiplayer functionality.  
**Purpose:** Reference for modifying or testing BYOD mode: each player uses their own device, joining via game codes.

---

## For Agents: How to Use This Guide

1. **Before editing BYOD code:** Read the [Behavioral Contracts](#behavioral-contracts) and [File Reference](#file-reference) so you understand invariants and where logic lives.
2. **Writing production code:** Use [Production Code Reference](#production-code-reference) for API contracts, metadata structure, and flow.
3. **Writing tests:** Use [Test Code Reference](#test-code-reference) for test structure, mocks, and required coverage.
4. **Implementing new features:** Follow the [Implementation Order](#implementation-order) for correct dependencies.

---

## Behavioral Contracts

These invariants must hold. Code and tests must respect them.

| Invariant | Description |
|-----------|-------------|
| **BYOD = cloud only** | BYOD games require cloud storage. `createNewGame` with `gameMode: 'byod'` throws if storage is not cloud. |
| **Host creates game** | Host (first player) creates the game; `hostDeviceId` is stored in metadata. Host automatically joins as first seat. |
| **Waiting phase** | BYOD games start in `waiting_for_players` phase. Host sees game code; others join via code. |
| **Seat assignment** | Seats are assigned by device ID. First-come-first-served until game starts. |
| **Player IDs at start** | `playerID` per seat is assigned only when host calls `assignRandomPlayerIDs` after all players have joined. |
| **Single board in BYOD** | When in BYOD mode, each device renders only its own player's board (unlike how all players' boards are rendered in hotseat mode). |
| **Device not playing** | If device is not in a BYOD game's `playerSeats` (e.g., refreshed mid-game), return to lobby with join form prefill. |

---

## File Reference

| Path | Role |
|------|------|
| `src/utils/gameManager.js` | `createNewGame`, `assignPlayerSeat`, `updatePlayerName`, `assignRandomPlayerIDs`, `getDevicePlayerID`, `getDeviceSeat`, `getPlayerSeats`, `isHost`, `allPlayersJoined`, `getNumPlayersJoined`, `SeatAssignmentError` |
| `src/providers/StorageProvider.js` | `joinGame`, `updateMyPlayerName`, `getMyPlayerID`, `isBYODGame`, `getPlayerSeatsForGame`, `getMySeat`, `amIHost`, `startBYODGame`, `getDeviceId` |
| `src/components/WaitingForPlayersScreen.js` | BYOD waiting phase UI: game code, player list, name input, Start Game (host), Cancel |
| `src/components/LobbyScreen.js` | Join form on Cloud (BYOD) tab; row click on `waiting_for_players` BYOD game triggers join first |
| `src/stores/lobbyStore.js` | `joinFormPrefill` and `setJoinFormPrefill` used for device-not-playing return flow |
| `src/app/App.js` | BYOD vs hotseat render logic; device-not-playing check; `WaitingForPlayersScreen` when phase is `waiting_for_players` |
| `src/stores/phaseConfig.js` | Phase definitions including `waiting_for_players` |
| `src/utils/storage/supabaseAdapter.js` | Cloud storage; real-time subscriptions for BYOD |

---

## Production Code Reference

### 1. Game Creation

**`createNewGame(storageType, options)`**

- `options.gameMode`: `'hotseat' | 'byod'` (default `'hotseat'`)
- `options.hostDeviceId`: Required when `gameMode === 'byod'`
- `options.numPlayers`: Number of players (default 3)

**BYOD creation:**
```js
const code = await createNewGame('cloud', {
  gameMode: 'byod',
  hostDeviceId: deviceId,  // from storage.getDeviceId()
  numPlayers: 4
});
// Game starts in phase 'waiting_for_players'
// metadata.playerSeats[hostDeviceId] = { joinedAt, playerName: 'Host' }
```

**Constraints:**
- BYOD requires `hostDeviceId`; throws if missing
- BYOD requires cloud storage; throws if `storageType !== 'cloud'`

### 2. Seat Assignment (gameManager)

**`assignPlayerSeat(code, deviceId, storageType = 'cloud')`**

Returns: `{ success: boolean, error?: string, seat?: { joinedAt, playerName } }`

**Error codes (`SeatAssignmentError`):**
- `INVALID_CODE` — Bad game code or deviceId
- `GAME_NOT_FOUND` — Game doesn't exist
- `WRONG_GAME_MODE` — Game is hotseat, not BYOD
- `GAME_FULL` — All seats filled
- `GAME_STARTED` — Past `waiting_for_players`, playerIDs already assigned
- `UPDATE_FAILED` — Metadata update failed or unexpected storage error
- `NOT_JOINED` / `NOT_HOST` — Used by related BYOD operations (`updatePlayerName`, `assignRandomPlayerIDs`)

**Reconnection behavior:**
- If the device already has a seat, `assignPlayerSeat` returns `{ success: true, seat }` (does not return `ALREADY_JOINED`).

**Other exports:**
- `updatePlayerName(code, deviceId, playerName, storageType)` → `{ success, error }`
- `isHost(code, deviceId, storageType)` → boolean
- `getNumPlayersJoined(code, storageType)` → `{ joined, total }` or null
- `allPlayersJoined(code, storageType)` → boolean
- `assignRandomPlayerIDs(code, deviceId, storageType)` → `{ success, error?, assignments? }` — host only; assigns playerIDs to all joined devices
- `getDevicePlayerID(code, deviceId, storageType)` → `'0' | '1' | ... | null`
- `getDeviceSeat(code, deviceId, storageType)` → `{ joinedAt, playerName, playerID? } | null`
- `getPlayerSeats(code, storageType)` → `{ [deviceId]: seat } | null`

### 3. StorageProvider BYOD API

**Join flow:**
```js
const result = await storage.joinGame(gameCode);
// Calls assignPlayerSeat internally with storage.getDeviceId()
if (result.success) { /* enter game */ }
else { /* show result.error */ }
```

**Other methods:**
- `updateMyPlayerName(gameCode, playerName)` — Update this device's name
- `getMyPlayerID(gameCode)` — This device's playerID (null until game started)
- `isBYODGame(gameCode)` — boolean
- `getPlayerSeatsForGame(gameCode)` — `{ [deviceId]: seat }`
- `getMySeat(gameCode)` — This device's seat
- `amIHost(gameCode)` — boolean
- `getDeviceId()` — UUID from localStorage or generated
- `startBYODGame(gameCode)` — Calls `assignRandomPlayerIDs` only; phase transition is handled in `App.js` by setting `G.byodGameStarted` and running `checkPhaseTransition`

### 4. Metadata Structure (BYOD)

```js
{
  lastModified: string,       // ISO 8601
  gameMode: 'byod',
  hostDeviceId: string,       // Device ID of creator
  playerSeats: {
    [deviceId: string]: {
      joinedAt: string,       // ISO 8601
      playerName: string | null,
      playerID?: string       // Assigned when host starts game
    }
  }
}
```

### 5. WaitingForPlayersScreen

**Props:**
- `gameCode` — Game code
- `numPlayers` — Total players
- `onStartGame` — Host clicks Start; calls `storage.startBYODGame(gameCode)`
- `onCancel` — Cancel/delete game
- `onReturnToLobby` — Navigate back to lobby

**Behavior:**
- Polls `getPlayerSeatsForGame`, `amIHost`, `getMySeat` (e.g. every 2s)
- Host: Start Game disabled until `allPlayersJoined`
- Host Cancel: deletes game; host returns to lobby immediately. Other clients detect missing game/state through refresh/subscription paths and then return to lobby flow.
- Players: set name via `updateMyPlayerName`, see others as "Open seat" or name

### 6. App.js BYOD Rendering

**Render logic:**
- If `phase === 'waiting_for_players'` and BYOD → `<WaitingForPlayersScreen />`
- Else if BYOD and `myPlayerID` set → single `<GameProvider playerID={myPlayerID}>` with board
- Else (hotseat) → all player boards

**Device not playing:**
- On load, if BYOD game and `getMyPlayerID` returns null (game past waiting) → lobby with `setJoinFormPrefill(code, NOT_PLAYING_MESSAGE)`

### 7. LobbyScreen Join Flow

- Join form visible on Cloud (BYOD) tab only
- Submit: `storage.joinGame(code)` → on success, `onEnterGame(code, { storageType: 'cloud' })`
- Row click on BYOD `waiting_for_players` game: same join flow, then enter
- Error mapping: `JOIN_ERROR_MESSAGES[result.error]` for user-facing text

---

## Test Code Reference

### Test File Locations

| Component / Area | Test File |
|------------------|-----------|
| gameManager BYOD APIs | `src/utils/gameManager.test.js` |
| WaitingForPlayersScreen | `src/components/WaitingForPlayersScreen.test.js` (create if needed) |
| StorageProvider joinGame | Integrate in App or E2E tests |
| BYOD flow E2E | Manual or integration tests |

### Test Stack

- **Framework:** Vitest
- **React testing:** `@testing-library/react`
- **Mocks:** `vi.fn()`, `vi.mock()`, localStorage mock

### Mocking Patterns for BYOD

**localStorage (required for gameManager):**
```js
beforeAll(() => { global.localStorage = localStorageMock; });
beforeEach(() => {
  localStorageMock.clear();
  useGameStore.getState().resetState();
  vi.clearAllMocks();
});
```

**BYOD metadata setup (gameManager tests):**
```js
// Create hotseat game, then overwrite metadata for BYOD
const gameCode = await createNewGame('local');
const metadataMap = JSON.parse(localStorage.getItem('game_metadata') || '[]');
const metadataMapObj = new Map(metadataMap);
metadataMapObj.set(gameCode, {
  gameMode: 'byod',
  hostDeviceId: testDeviceId,
  playerSeats: {
    [testDeviceId]: { joinedAt: new Date().toISOString(), playerName: 'Host' }
  },
  lastModified: new Date().toISOString(),
});
localStorage.setItem('game_metadata', JSON.stringify(Array.from(metadataMapObj.entries())));
```

### Required Test Coverage for BYOD

**gameManager (already in gameManager.test.js):**
- [ ] `createNewGame` BYOD requires hostDeviceId
- [ ] `createNewGame` BYOD requires cloud storage
- [ ] `assignPlayerSeat` — success, reconnection, GAME_NOT_FOUND, WRONG_GAME_MODE, GAME_FULL, GAME_STARTED
- [ ] `updatePlayerName` — success, NOT_JOINED, GAME_NOT_FOUND
- [ ] `isHost` — true for host, false for others
- [ ] `getNumPlayersJoined`, `allPlayersJoined`
- [ ] `assignRandomPlayerIDs` — success, NOT_HOST, GAME_STARTED (already assigned), INVALID_CODE, GAME_NOT_FOUND, WRONG_GAME_MODE, GAME_FULL (not all joined), UPDATE_FAILED
- [ ] `getDevicePlayerID`, `getDeviceSeat`, `getPlayerSeats`

**WaitingForPlayersScreen unit:**
- [ ] Host sees Start Game disabled until all joined
- [ ] Host Start Game calls onStartGame
- [ ] Player can update name
- [ ] Cancel/Return to lobby behavior

**Integration / E2E:**
- [ ] Create BYOD → waiting screen → join from second tab → host starts → both see board

### Edge Cases to Test

- Hotseat game: `assignPlayerSeat` returns WRONG_GAME_MODE
- Game full: `assignPlayerSeat` returns GAME_FULL
- Game started: `assignPlayerSeat` returns GAME_STARTED
- Reconnection: same device joins again → success with existing seat
- Non-host calls `assignRandomPlayerIDs` → NOT_HOST
- Invalid code/device ID handling for BYOD operations

---

## Implementation Order (When Adding or Changing Features)

1. **gameManager** — Metadata, seat assignment, host logic
2. **StorageProvider** — joinGame, getMyPlayerID, etc. (delegates to gameManager)
3. **Phase config** — `waiting_for_players` phase
4. **WaitingForPlayersScreen** — UI for waiting phase
5. **App.js** — BYOD render logic, device-not-playing handling
6. **LobbyScreen** — Join form, BYOD tab
7. **Tests** — Unit and integration

---

## Migration and Compatibility

- Existing games default to `gameMode: 'hotseat'` if metadata missing.
- Hotseat games unchanged by BYOD code.
- No migration needed for existing games.

---

## Out of Scope / Open Questions

- **Reconnection:** Can a disconnected player rejoin with same seat? (Current: ALREADY_JOINED returns success for same device.)
- **Host permissions:** Kick players? Start early? Change settings? (Not implemented.)
- **Seat selection:** Currently first-come-first-served; no seat picking.

---

## Related Files and Resources

- `docs/LOBBY_AGENT_GUIDE.md` — Lobby screen, join form, tabs
- `docs/CLOUD_STORAGE_TESTING.md` — Cloud and Supabase testing
- Supabase Realtime: https://supabase.com/docs/guides/realtime
