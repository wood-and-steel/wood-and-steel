# BYOD (Bring Your Own Device) — Agent Implementation Guide

**Audience:** AI agents writing production or test code for BYOD multiplayer functionality.  
**Purpose:** Reference for modifying or testing BYOD mode: each player uses their own device, joining via game codes. BYOD is the app's only game mode; games are stored in Supabase.

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
| **One mode** | Every game is a BYOD game stored in Supabase. `metadata.gameMode` is always `'byod'`; rows without it (created by older app versions) are hidden from the lobby and rejected with `WRONG_GAME_MODE`. |
| **Host creates game** | Host (first player) creates the game; `hostDeviceId` is stored in metadata. Host automatically joins as first seat. |
| **Waiting phase** | BYOD games start in `waiting_for_players` phase. Host sees game code; others join via code. |
| **Seat assignment** | Seats are assigned by device ID. First-come-first-served until game starts. |
| **Player IDs at start** | `playerID` per seat is assigned only when host calls `assignRandomPlayerIDs` after all players have joined. |
| **Single board per device** | Each device renders only its own player's board. |
| **Device not playing** | If device is not in a BYOD game's `playerSeats` (e.g., refreshed mid-game), return to lobby with join form prefill. |

---

## File Reference

| Path | Role |
|------|------|
| `src/utils/gameManager.js` | `createNewGame`, `assignPlayerSeat`, `updatePlayerName`, `assignRandomPlayerIDs`, `getDevicePlayerID`, `getDeviceSeat`, `getPlayerSeats`, `isHost`, `allPlayersJoined`, `getNumPlayersJoined`, `SeatAssignmentError`; playtest bot seats: `addBotSeat`, `removeBotSeat`, `isBotSeat`, `botSeatName`, `BOT_SEAT_PREFIX` |
| `src/providers/StorageProvider.js` | `joinGame`, `updateMyPlayerName`, `getMyPlayerID`, `getPlayerSeatsForGame`, `getMySeat`, `amIHost`, `startBYODGame`, `getDeviceId` |
| `src/components/WaitingForPlayersScreen.js` | BYOD waiting phase UI: game code, player list, name input, Start Game (host), Cancel |
| `src/components/LobbyScreen.tsx` | Join form (always shown); row click on a `waiting_for_players` game triggers join first |
| `src/stores/lobbyStore.js` | `joinFormPrefill` and `setJoinFormPrefill` used for device-not-playing return flow |
| `src/app/App.tsx` | Render logic; unsupported-game and device-not-playing checks; `WaitingForPlayersScreen` when phase is `waiting_for_players` |
| `src/stores/phaseConfig.ts` | Phase definitions including `waiting_for_players` |
| `src/utils/storage/supabaseAdapter.js` | Cloud storage; real-time subscriptions for BYOD |

---

## Production Code Reference

### 1. Game Creation

**`createNewGame(options)`**

- `options.hostDeviceId`: Required
- `options.numPlayers`: Number of players (default 3)
- `options.hostPlayerName`: Optional; defaults to `'Host'`

```js
const code = await createNewGame({
  hostDeviceId: deviceId,  // from storage.getDeviceId()
  numPlayers: 4
});
// Game starts in phase 'waiting_for_players'
// metadata = { gameMode: 'byod', hostDeviceId, playerSeats: { [hostDeviceId]: { joinedAt, playerName: 'Host' } } }
```

**Constraints:**
- Throws if `hostDeviceId` is missing

### 2. Seat Assignment (gameManager)

**`assignPlayerSeat(code, deviceId)`**

Returns: `{ success: boolean, error?: string, seat?: { joinedAt, playerName } }`

**Error codes (`SeatAssignmentError`):**
- `INVALID_CODE` — Bad game code or deviceId
- `GAME_NOT_FOUND` — Game doesn't exist
- `WRONG_GAME_MODE` — Game was created by an older app version (`metadata.gameMode !== 'byod'`)
- `GAME_FULL` — All seats filled
- `GAME_STARTED` — Past `waiting_for_players`, playerIDs already assigned
- `UPDATE_FAILED` — Metadata update failed or unexpected storage error
- `NOT_JOINED` / `NOT_HOST` — Used by related BYOD operations (`updatePlayerName`, `assignRandomPlayerIDs`)

**Reconnection behavior:**
- If the device already has a seat, `assignPlayerSeat` returns `{ success: true, seat }` (does not return `ALREADY_JOINED`).

**Other exports:**
- `updatePlayerName(code, deviceId, playerName)` → `{ success, error }`
- `isHost(code, deviceId)` → boolean
- `getNumPlayersJoined(code)` → `{ joined, total }` or null
- `allPlayersJoined(code)` → boolean
- `assignRandomPlayerIDs(code, deviceId)` → `{ success, error?, assignments? }` — host only; assigns playerIDs to all joined devices
- `getDevicePlayerID(code, deviceId)` → `'0' | '1' | ... | null`
- `getDeviceSeat(code, deviceId)` → `{ joinedAt, playerName, playerID? } | null`
- `getPlayerSeats(code)` → `{ [deviceId]: seat } | null`
- `isSupportedGameMetadata(metadata)` → boolean (`gameMode === 'byod'`)

### Bot seats (playtest only)

The host can fill open seats with bots before starting ([BOT_PLAN.md](BOT_PLAN.md)). A bot seat is a normal `playerSeats` entry keyed `bot:<uuid>` with `playerName: 'Name (bot)'` and a `bot: { name, strategy }` field. Seat counting, `allPlayersJoined`, and `assignRandomPlayerIDs` treat it like any seat, and the start-game flow copies its name into `G.players`.

- `addBotSeat(code, hostDeviceId, { name, strategy })` → `{ success, error?, seat?, seatKey? }`: host only, waiting phase only, needs an open seat. Errors: `NOT_HOST`, `GAME_STARTED`, `GAME_FULL`, `INVALID_BOT`, `GAME_NOT_FOUND`, `WRONG_GAME_MODE`, `UPDATE_FAILED`.
- `removeBotSeat(code, hostDeviceId, seatKey)` → `{ success, error? }`: host only, waiting phase only, bot seats only (`NOT_A_BOT` for a human seat, `NOT_JOINED` for a missing one).
- StorageProvider wraps both as `addBotSeat(gameCode, bot)` and `removeBotSeat(gameCode, seatKey)` with this device's ID.
- The controls live in `src/bots/host/BotSeatControls.tsx` and reach `WaitingForPlayersScreen` through its `botSeatControls` prop, only in playtest builds.

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
- `getPlayerSeatsForGame(gameCode)` — `{ [deviceId]: seat }`
- `getMySeat(gameCode)` — This device's seat
- `amIHost(gameCode)` — boolean
- `getDeviceId()` — UUID from localStorage or generated
- `startBYODGame(gameCode)` — Calls `assignRandomPlayerIDs` only; phase transition is handled in `App.js` by setting `G.byodGameStarted` and running `checkPhaseTransition`
- `getMetadata(gameCode)` — Game metadata (used by App to reject unsupported games)

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
      bot?: { name, strategy } // Bot seats only (playtest); keyed `bot:<uuid>`, not a device ID
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

### 6. App.tsx Rendering

**Render logic:**
- If `phase === 'waiting_for_players'` → `<WaitingForPlayersScreen />`
- Else if `myPlayerID` set → single `<GameProvider playerID={myPlayerID}>` with board
- Else → "Loading player assignment..."

**Unsupported game:**
- On load or enter, if `isSupportedGameMetadata(metadata)` is false → lobby with `setJoinFormPrefill(code, UNSUPPORTED_GAME_MESSAGE)`

**Device not playing:**
- On load, if `getMyPlayerID` returns null (game past waiting) → lobby with `setJoinFormPrefill(code, NOT_PLAYING_MESSAGE)`

### 7. LobbyScreen Join Flow

- Join form is always visible
- Submit: `storage.joinGame(code)` → on success, `onEnterGame(code)`
- Row click on a `waiting_for_players` game: same join flow, then enter
- Error mapping: `JOIN_ERROR_MESSAGES[result.error]` for user-facing text

---

## Test Code Reference

### Test File Locations

| Component / Area | Test File |
|------------------|-----------|
| gameManager BYOD APIs | `src/utils/gameManager.test.ts` |
| WaitingForPlayersScreen | `src/components/WaitingForPlayersScreen.test.js` (create if needed) |
| StorageProvider joinGame | Integrate in App or E2E tests |
| BYOD flow E2E | Manual or integration tests |

### Test Stack

- **Framework:** Vitest
- **React testing:** `@testing-library/react`
- **Mocks:** `vi.fn()`, `vi.mock()`, localStorage mock (current game code, device ID), in-memory storage adapter

### Mocking Patterns for BYOD

**In-memory storage adapter (required for gameManager):**
```ts
import { setStorageAdapter } from './storage';
import { MemoryStorageAdapter } from './storage/memoryStorageAdapter.testHelper';

const memoryAdapter = new MemoryStorageAdapter();
beforeAll(() => {
  globalThis.localStorage = localStorageMock;
  setStorageAdapter(memoryAdapter);
});
beforeEach(() => {
  localStorageMock.clear();
  memoryAdapter.clear();
  useGameStore.getState().resetState();
  vi.clearAllMocks();
});
```

**Metadata setup (gameManager tests):**
```ts
const gameCode = await createNewGame({ hostDeviceId: testDeviceId });
await updateGameMetadata(gameCode, {
  playerSeats: {
    [testDeviceId]: { joinedAt: new Date().toISOString(), playerName: 'Host' }
  },
});
```

### Required Test Coverage for BYOD

**gameManager (already in gameManager.test.ts):**
- [ ] `createNewGame` requires hostDeviceId, records host seat, starts in `waiting_for_players`
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

- Game from an older app version (`gameMode !== 'byod'`): `assignPlayerSeat` returns WRONG_GAME_MODE
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
5. **App.tsx** — Render logic, device-not-playing handling
6. **LobbyScreen** — Join form
7. **Tests** — Unit and integration

---

## Migration and Compatibility

- Games created by older app versions (no `gameMode: 'byod'`) are hidden from the lobby and can't be opened or joined. They can be removed from Supabase with:
  `delete from games where metadata->>'gameMode' is distinct from 'byod';`

---

## Out of Scope / Open Questions

- **Reconnection:** Can a disconnected player rejoin with same seat? (Current: ALREADY_JOINED returns success for same device.)
- **Host permissions:** Kick players? Start early? Change settings? (Not implemented.)
- **Seat selection:** Currently first-come-first-served; no seat picking.

---

## Related Files and Resources

- `docs/LOBBY_AGENT_GUIDE.md` — Lobby screen, join form
- `docs/CLOUD_STORAGE_TESTING.md` — Cloud and Supabase testing
- Supabase Realtime: https://supabase.com/docs/guides/realtime
