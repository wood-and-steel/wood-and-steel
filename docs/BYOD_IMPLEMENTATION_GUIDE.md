# BYOD (Bring Your Own Device) Implementation Guide

## Overview

This guide helps an agent implement BYOD (bring your own device) multiplayer mode for Wood and Steel. BYOD mode allows each player to use their own device, connecting via game codes, as opposed to the current hotseat mode where all players share one device.

### Current State: Hotseat Mode

- All players use the same device
- Game state stored in localStorage (local) or Supabase (cloud)
- All player boards rendered simultaneously
- No player seat assignment needed

### Future State: BYOD Mode

- Each player uses their own device
- Game state stored in cloud (Supabase only)
- Each device renders only one player's board
- Players join via game code entry
- Each device tracks its assigned player seat
- "Waiting for players" phase before game starts

## What's Already Prepared

### StorageProvider Context

The `StorageProvider` (`src/providers/StorageProvider.js`) already includes:

1. **Player Seat Management Functions** (implemented, ready to use):
   - `getPlayerSeat(gameCode)` - Returns playerID assigned to this device
   - `setPlayerSeat(gameCode, playerID)` - Assigns player seat to this device
   - `clearPlayerSeat(gameCode)` - Removes player seat assignment
   - Stored in localStorage: `byod_player_seat_${gameCode}`

2. **Game Mode Utilities** (stubbed, need implementation):
   - `getGameMode(gameCode)` - Returns 'hotseat' or 'byod' (currently always returns 'hotseat')
   - `isBYODGame(gameCode)` - Checks if game is BYOD mode
   - `getMyPlayerID(gameCode)` - Returns player seat for BYOD, null for hotseat

### Storage Infrastructure

- Separate current game tracking: `current_game_local` and `current_game_cloud`
- StorageProvider manages active storage type ('local' | 'cloud')
- Supabase adapter supports real-time subscriptions (already used for hotseat cloud games)

## Architecture Changes Needed

### 1. Game Mode Metadata

**Location**: Game metadata in storage adapters

**Changes**:
- Add `gameMode: 'hotseat' | 'byod'` field to game metadata
- Update `createNewGame()` to accept `gameMode` parameter
- Update `StorageProvider.getGameMode()` to read from metadata

**Example**:
```javascript
const metadata = {
  lastModified: new Date().toISOString(),
  gameMode: 'byod', // or 'hotseat'
  // Future: playerSeats, hostDeviceId, etc.
};
```

### 2. Player Seat Assignment Flow

**When a player joins a BYOD game**:

1. Player enters game code in lobby
2. Check if game exists and is in BYOD mode
3. Check available player seats (from game metadata or state)
4. Assign next available seat to this device
5. Store assignment: `storage.setPlayerSeat(gameCode, playerID)`
6. Update game metadata/state with new player seat assignment
7. Load game and enter "waiting for players" phase

**Implementation Points**:
- Add `playerSeats` to game metadata: `{ '0': { deviceId?, joinedAt? }, '1': {...}, ... }`
- Or track in game state (G.players array already exists)
- Need to determine "next available seat" logic

### 3. "Waiting for Players" Phase

**Location**: `src/stores/phaseConfig.js`

**Changes**:
- Add new phase: `'waiting_for_players'`
- Phase should be before `'setup'`
- Game host immediately moves to this screen after starting the game
- Has its own screen that with:
  - The game code prominently displayed
  - A text box for this player to enter their name
  - A list of other players in the game, or "Open seat" as placeholders for the players who have not joined
  - A Start Game button that is disabled until all seats are filled
  - Cancel button that returns players to lobby
  - If the host clicks Cancel, all players are returned to the lobby and the game is deleted
- End condition: When all player seats filled (`ctx.numPlayers` players joined), the host clicks the Start Game button
- Transition: `'waiting_for_players'` → `'setup'` when all seats filled

**Phase Configuration**:
```javascript
{
  name: 'waiting_for_players',
  next: 'setup',
  endIf: ({ G, ctx }) => {
    // Check if all seats are filled
    // This might check metadata.playerSeats or G.players
    return allSeatsFilled(G, ctx);
  },
  // No moves allowed in this phase
  moves: {},
}
```

### 4. Host vs Player Distinction

**Considerations**:
- Host is the player who creates the game
- Host sees game code immediately
- Other players enter game code to join
- Host might have special permissions (e.g., kick players, start game)

**Implementation**:
- Store `hostDeviceId` in game metadata
- Use first player seat (playerID '0') as host
- Add UI indicators for host vs regular players

### 5. Device ID Tracking (Optional)

**Considerations**:
- Use unique device IDs to prevent duplicate joins and support re-joining
- Could use browser fingerprinting or generate UUID stored in localStorage
- Store device ID with player seat assignment

**Implementation**:
- Generate device ID on first use: `localStorage.getItem('device_id') || generateUUID()`
- Store with player seat: `metadata.playerSeats[playerID].deviceId = deviceId`

### 6. Join Flow UI

**Location**: `src/components/LobbyScreen.js`

**Changes**:
- Add "Join Game" section in lobby
- Text input for game code entry
- "Join" button
- Show error if game not found, already full, etc.
- After joining, transition to game board

**UI Flow**:
```
Lobby Screen
  ├─ Tab Bar (Local/Cloud) - existing
  ├─ Games List (existing)
  └─ Join Game Section (NEW)
      ├─ Text input: "Enter game code"
      └─ Button: "Join Game"
```

### 7. Rendering Logic Changes

**Location**: `src/app/App.js`

**Current**: Renders all player boards for hotseat mode
```javascript
{Array.from({ length: numPlayers }, (_, i) => (
  <GameProvider key={i} playerID={String(i)}>
    <WoodAndSteelState gameManager={gameManager} />
  </GameProvider>
))}
```

**Future**: Render single player board for BYOD mode
```javascript
const myPlayerID = await storage.getMyPlayerID(currentGameCode);
const isBYOD = await storage.isBYODGame(currentGameCode);

if (isBYOD && myPlayerID) {
  // BYOD mode: render only this player's board
  return (
    <GameProvider playerID={myPlayerID}>
      <WoodAndSteelState gameManager={gameManager} />
    </GameProvider>
  );
} else {
  // Hotseat mode: render all player boards
  return (
    <>
      {Array.from({ length: numPlayers }, (_, i) => (
        <GameProvider key={i} playerID={String(i)}>
          <WoodAndSteelState gameManager={gameManager} />
        </GameProvider>
      ))}
    </>
  );
}
```

### 8. Real-time Sync for BYOD

**Already Implemented**: Supabase adapter has `subscribeToGame()` method

**Usage**: Already used in `App.js` for hotseat cloud games

**For BYOD**:
- Same real-time subscription mechanism
- All devices subscribe to the same game code
- When any player makes a move, all devices receive update
- Zustand store updates trigger re-renders

**No changes needed** - existing implementation works for BYOD.

## StorageProvider Usage

### Getting Player Seat

```javascript
import { useStorage } from '../providers/StorageProvider';

function MyComponent() {
  const storage = useStorage();
  const gameCode = 'BCDFG';
  
  // Get this device's player seat
  const myPlayerID = storage.getPlayerSeat(gameCode);
  // Returns: '0', '1', '2', etc. or null if not assigned
}
```

### Setting Player Seat

```javascript
// When player joins game
storage.setPlayerSeat(gameCode, '0'); // Assign player 0 to this device
```

### Checking Game Mode

```javascript
const isBYOD = await storage.isBYODGame(gameCode);
const gameMode = await storage.getGameMode(gameCode);
const myPlayerID = await storage.getMyPlayerID(gameCode);
```

## Game Creation

### Hotseat Game (Current)

```javascript
const code = await createNewGame('local'); // or 'cloud'
// Game mode defaults to 'hotseat'
```

### BYOD Game (Future)

```javascript
// Need to update createNewGame() to accept gameMode parameter
const code = await createNewGame('cloud', { gameMode: 'byod', numPlayers: 4 });
// Game starts in 'waiting_for_players' phase
```

## Join Flow

### Step-by-Step

1. **Player enters game code** in lobby UI
2. **Validate game code**: Check format, existence
3. **Check game mode**: Must be BYOD game
4. **Check available seats**: Find next available playerID
5. **Assign seat**: `storage.setPlayerSeat(gameCode, playerID)`
6. **Update game metadata**: Add player to `playerSeats` or update game state
7. **Load game**: `loadGameState(gameCode, 'cloud')`
8. **Set current game**: `storage.setCurrentGameCode(gameCode)`
9. **Enter game**: Transition to game board (or waiting phase)

### Error Cases

- Game not found
- Game is hotseat mode (can't join)
- Game already full (all seats taken)
- Player already joined (device already has seat assignment)
- Game already started (past 'waiting_for_players' phase)

## Metadata Structure

### Current Metadata

```javascript
{
  lastModified: '2026-01-28T12:00:00.000Z',
  playerNames: ['Player 0', 'Player 1', ...],
}
```

### Future BYOD Metadata

```javascript
{
  lastModified: '2026-01-28T12:00:00.000Z',
  gameMode: 'byod', // or 'hotseat'
  hostPlayerID: '0', // Player who created the game
  playerSeats: {
    '0': {
      deviceId: 'uuid-here',
      joinedAt: '2026-01-28T12:00:00.000Z',
      playerName: 'Player 0',
    },
    '1': {
      deviceId: 'uuid-here',
      joinedAt: '2026-01-28T12:01:00.000Z',
      playerName: 'Player 1',
    },
    // ... more players
  },
}
```

## Testing Strategy

### Local Testing

1. **Multiple Browser Windows/Tabs**:
   - Open app in multiple tabs
   - Create BYOD game in one tab
   - Join from other tabs using game code
   - Verify each tab shows correct player board

2. **Device ID Simulation**:
   - Use different localStorage contexts
   - Or manually set `device_id` in localStorage

3. **Real-time Sync Testing**:
   - Make moves in one tab
   - Verify updates appear in other tabs
   - Check for conflicts/race conditions

### Cloud Testing

1. **Multiple Devices**:
   - Deploy to staging environment
   - Test on actual devices (phones, tablets, computers)
   - Verify Supabase real-time subscriptions work

2. **Network Conditions**:
   - Test with slow/unreliable connections
   - Test reconnection scenarios
   - Test conflict resolution

## Migration Considerations

### Existing Games

- All existing games are hotseat mode
- `getGameMode()` defaults to 'hotseat' if metadata missing
- No migration needed for existing games

### Backward Compatibility

- Hotseat games continue to work as before
- BYOD games are new, don't affect hotseat
- StorageProvider handles both modes

## Implementation Checklist

- [ ] Implement `getGameMode()` to read from metadata
- [ ] Add `gameMode` parameter to `createNewGame()`
- [ ] Add "waiting_for_players" phase to phaseConfig
- [ ] Implement join game UI in LobbyScreen
- [ ] Implement player seat assignment logic
- [ ] Update App.js rendering logic for BYOD
- [ ] Add device ID generation/tracking
- [ ] Add host vs player distinction
- [ ] Update game metadata structure
- [ ] Add error handling for join flow
- [ ] Test local multi-tab scenario
- [ ] Test cloud multi-device scenario
- [ ] Document API changes

## Questions to Resolve

1. **Reconnection**: What happens if a player disconnects?
   - Can they rejoin with same seat?
   - Or is seat released for others?

2. **Host Permissions**: What can host do that others can't?
   - Kick players?
   - Start game early?
   - Change game settings?

3. **Seat Selection**: Can players choose their seat, or is it automatic?
   - First-come-first-served?
   - Host assigns?
   - Players choose from available?

## Related Files

- `src/providers/StorageProvider.js` - Storage and BYOD utilities
- `src/utils/gameManager.js` - Game creation and management
- `src/stores/phaseConfig.js` - Phase definitions
- `src/components/LobbyScreen.js` - Lobby UI
- `src/app/App.js` - Main app and rendering logic
- `src/utils/storage/supabaseAdapter.js` - Cloud storage adapter

## Additional Resources

- Supabase Realtime documentation: https://supabase.com/docs/guides/realtime
- Zustand store documentation: https://github.com/pmndrs/zustand
- React Context API: https://react.dev/reference/react/createContext
