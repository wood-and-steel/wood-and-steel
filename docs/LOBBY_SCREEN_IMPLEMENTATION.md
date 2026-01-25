# Lobby Screen Implementation Plan

## Overview
Transform the GameListDialog into a full-screen lobby that serves as the entry point for the application. The lobby allows players to manage their games (view, enter, delete, create new) and supports a state where there are no active games. Any game, including the most recently active game, can be deleted.

## Key Design Decisions

### Lobby as Entry Point
- App always starts in the lobby (no automatic game creation)
- Lobby is a full-screen replacement of the board
- When no games exist, lobby shows only "New Game" button (stub UI for now)
- When games exist, lobby shows sorted list (most recent first)

### State Management
- Lobby mode: Zustand store has a "lobby mode" state when no active game is selected
- Game metadata: Add timestamps to game storage for sorting by recency
- Lobby state: Placeholder for future lobby-specific state (filters, sort preferences, etc.)

### Navigation
- Game code button in TopButtonBar navigates to lobby (replaces opening dialog)
- Clicking a game in lobby enters that game
- No automatic game selection on app launch

### Future Cloud Storage Considerations
- Structure code so localStorage can transition to storing only game codes
- Game state will eventually be fetched from cloud
- Metadata (timestamps, player info) may also come from cloud
- No offline/online indicators needed

---

## Implementation Steps

### 1. Add Timestamps to Game Storage (`src/utils/gameManager.js`)

**Changes:**
- Update `saveGameState()` to store a `lastModified` timestamp in game metadata
- Update `listGames()` to:
  - Include `lastModified` timestamp in returned game objects
  - Sort games by `lastModified` descending (most recent first)
  - Include `numPlayers` in returned objects (already available from `ctx.numPlayers`)

**Storage:**
- Store timestamp in `GAME_METADATA_KEY` as part of game metadata
- Format: Unix timestamp (milliseconds) or ISO string
- Update timestamp whenever game state is saved

**Future Cloud Note:**
- Timestamps will eventually come from cloud storage
- Consider using ISO 8601 format for better cloud compatibility

---

### 2. Create Lobby State Management (`src/stores/lobbyStore.js`)

**New File:** Create a Zustand store for lobby-specific state

**State:**
- `isLobbyMode: boolean` - Whether app is in lobby mode (no active game)
- `selectedGameCode: string | null` - Currently selected/active game code
- `lobbyState: object` - Placeholder for future lobby UI state (filters, sort preferences, etc.)

**Actions:**
- `setLobbyMode(isLobby: boolean)` - Set lobby mode
- `setSelectedGame(code: string | null)` - Set active game code
- `clearSelection()` - Clear selection and return to lobby mode

**Future Cloud Note:**
- Lobby state may need to sync across devices when multiplayer is added
- Consider storing lobby preferences in localStorage separately

---

### 3. Create Lobby Screen Component (`src/components/LobbyScreen.js`)

**New File:** Create full-screen lobby component

**Props:**
- `gameManager` - Game management functions
- `onEnterGame` - Callback to enter a selected game (passed from App.js)
- `onNewGame` - Callback to create a new game (passed from App.js)

**State:**
- `games` - List of games (from `gameManager.onListGames()`)
- Refresh games list when needed (after delete, after create, etc.)

**UI Elements:**
- **Empty State** (when `games.length === 0`):
  - Simple message or just "New Game" button (stub UI as requested)
  
- **Games List** (when `games.length > 0`):
  - Table with columns:
    - Code
    - Phase
    - Players (numPlayers)
    - Last turn (lastModified formatted as readable date/time)
    - Delete button
  - Rows are clickable to enter game
  - Highlight current game if one is selected
  - Sort by lastModified descending (handled in `listGames()`)

- **Actions:**
  - "New Game" button (always visible)
  - Delete buttons on each game row (except current game if viewing it)

**Styling:**
- Reuse existing CSS classes (`table`, `button`, etc.)
- Full-screen layout (not a modal)
- Similar visual style to GameListDialog but as main screen

**Future Cloud Note:**
- Will need to fetch game list from cloud instead of localStorage
- May need loading states while fetching
- Player names/handles will come from cloud

---

### 4. Update Game Manager Functions (`src/utils/gameManager.js`)

**Changes to `saveGameState()`:**
- Add/update `lastModified` timestamp in game metadata when saving
- Store as ISO 8601 string or Unix timestamp

**Changes to `listGames()`:**
- Include `lastModified` from metadata in returned objects
- Include `numPlayers` from game state
- Sort by `lastModified` descending (most recent first)
- Return format: `{ code, phase, turn, numPlayers, lastModified, playerNames, metadata }`

**Changes to `createNewGame()`:**
- Still creates game code and initializes state
- Sets `lastModified` timestamp on creation
- Returns game code

**Changes to `deleteGame()`:**
- No changes needed (already works)

**Changes to `switchToGame()`:**
- No changes needed (already works)

**Future Cloud Note:**
- `saveGameState()` will eventually send to cloud API
- `listGames()` will fetch from cloud API
- `lastModified` will come from cloud timestamps

---

### 5. Update App.js (`src/app/App.js`)

**Major Changes:**

1. **Remove automatic game creation on mount**
   - Remove all logic that auto-creates games
   - Remove fallback game creation in error handlers
   - If no current game exists, go to lobby mode

2. **Add lobby mode state management**
   - Import `lobbyStore` (from step 2)
   - Check if there's a current game code on mount
   - If no game code or game doesn't exist, set lobby mode
   - If game exists, load it and set as selected

3. **Add conditional rendering**
   - Import `LobbyScreen` component
   - Check `isLobbyMode` from lobby store
   - If `isLobbyMode === true`, render `<LobbyScreen />`
   - Otherwise, render existing `<WoodAndSteelState />` components

4. **Add `onEnterGame` handler**
   - Function that:
     - Validates game code exists
     - Loads game state into Zustand store
     - Sets selected game in lobby store
     - Sets lobby mode to false
     - Renders board automatically

5. **Add `onNewGame` handler**
   - Function that:
     - Creates new game using `createNewGame()`
     - Initializes game state (reuse existing initialization logic)
     - Loads game into Zustand store
     - Sets selected game in lobby store
     - Sets lobby mode to false
     - Renders board automatically

6. **Update `gameManager.onDeleteGame`**
   - If deleting current game:
     - Clear current game code
     - Clear Zustand game state
     - Set lobby mode to true
     - Stay in lobby (don't create new game)
   - Update games list in lobby if it's open

7. **Update `gameManager.onSwitchGame`**
   - Load game state
   - Set selected game in lobby store
   - Set lobby mode to false
   - Don't reload page (let React re-render)

**Future Cloud Note:**
- Game loading will fetch from cloud API
- May need loading states during fetch
- Error handling for network failures

---

### 6. Update TopButtonBar (`src/components/TopButtonBar.js`)

**Changes:**
- Update game code button click handler
- Instead of `onShowGameList` (opening dialog), navigate to lobby
- Add new prop: `onNavigateToLobby` (passed from Board.js)
- Game code button calls `onNavigateToLobby()` instead of `onShowGameList()`

**Behavior:**
- Clicking game code button:
  - Clears selected game in lobby store
  - Sets lobby mode to true
  - App re-renders to show lobby screen

**Future Cloud Note:**
- No changes needed for cloud transition

---

### 7. Update Board.js (`src/Board.js`)

**Changes:**
- Remove `GameListDialog` import and usage
- Remove `showGameList` state
- Remove `onShowGameList` prop passing to `TopButtonBar`
- Add `onNavigateToLobby` handler:
  - Sets lobby mode to true
  - Clears selected game
  - App re-renders to show lobby

**Note:**
- Board only renders when not in lobby mode
- Lobby screen replaces board entirely

---

### 8. Update Game Store (`src/stores/gameStore.js`)

**Changes:**
- Add support for "lobby mode" - when no game is loaded
- Consider adding a flag or checking if `G` and `ctx` are empty/null
- Or rely on lobby store to track lobby mode

**Decision:**
- Use lobby store for lobby mode tracking
- Game store can have empty/minimal state when in lobby
- Or keep game store separate and only populate when game is loaded

**Recommendation:**
- Keep game store focused on game state only
- Use lobby store for lobby mode tracking
- Game store can be empty when in lobby (will be populated when game is entered)

---

### 9. Remove GameListDialog (`src/components/GameListDialog.js`)

**Action:**
- Delete the file (`src/components/GameListDialog.js`). All previous functionality has been migrated to `LobbyScreen`. The `GameListDialog` component is no longer needed and should be removed from the codebase to avoid confusion.

---

### 10. Update Documentation

**Files to Update:**
- `README.md` – Update if it mentions entry behavior
- Add architecture notes about lobby vs. game state separation

**New Documentation:**
- Document lobby as entry point
- Document lobby mode state management
- Document game metadata structure (timestamps, etc.)

---

## Implementation Order

1. **Add Timestamps** (Step 1) - Add lastModified to game storage
2. **Create Lobby Store** (Step 2) - Zustand store for lobby state
3. **Update Game Manager** (Step 4) - Update listGames and saveGameState
4. **Create Lobby Screen** (Step 3) - Full-screen lobby component
5. **Update App.js** (Step 5) - Conditional rendering and handlers
6. **Update TopButtonBar** (Step 6) - Navigate to lobby instead of dialog
7. **Update Board.js** (Step 7) - Remove dialog, add lobby navigation
8. **Update Game Store** (Step 8) - Ensure it handles empty state
9. **Remove GameListDialog** (Step 9) - Delete old component
10. **Update Documentation** (Step 10) - Document changes

---

## Testing Considerations

### Manual Testing Checklist:
- [ ] App launches to lobby when no games exist
- [ ] App launches to lobby when games exist (not auto-selecting)
- [ ] Games list shows all games sorted by recency (most recent first)
- [ ] Games list displays: Code, Phase, Players, Last turn
- [ ] Clicking a game enters that game (shows board)
- [ ] Clicking game code button in TopButtonBar returns to lobby
- [ ] "New Game" button creates game and enters it immediately
- [ ] Deleting a game removes it from list
- [ ] Deleting current game returns to lobby (empty state if no games)
- [ ] Deleting the only game shows empty state
- [ ] Last modified timestamps are saved and displayed correctly
- [ ] Number of players is displayed correctly
- [ ] Lobby state persists appropriately (no unnecessary state)

### Edge Cases:
- What happens if localStorage is corrupted?
- What happens if a game code exists but state is invalid?
- What happens if user deletes all games?
- What happens if user refreshes while in lobby?
- What happens if user refreshes while in a game?

---

## Future Cloud Storage Integration Points

### Locations where cloud storage will be integrated:

1. **gameManager.js**
   - `saveGameState()` - Send state to cloud API instead of localStorage
   - `loadGameState()` - Fetch from cloud API
   - `listGames()` - Fetch game list and metadata from cloud API
   - `deleteGame()` - Delete from cloud API
   - `createNewGame()` - Create game in cloud, get code from cloud

2. **lobbyStore.js**
   - May need to sync lobby preferences across devices
   - May need to handle offline/online state (though not showing indicators)

3. **LobbyScreen.js**
   - Add loading states while fetching games from cloud
   - Handle network errors gracefully
   - May need polling/real-time updates for game list

4. **App.js**
   - Handle authentication if needed for cloud access
   - Handle network failures when loading games
   - Cache game codes locally for offline access

5. **Metadata Structure**
   - `lastModified` will come from cloud timestamps
   - Player names/handles will come from cloud user data
   - Game codes will be stored in localStorage, state in cloud

---

## Code Structure Summary

```
src/
├── components/
│   ├── LobbyScreen.js          [NEW] - Full-screen lobby component
│   ├── TopButtonBar.js          [MODIFY] - Navigate to lobby instead of dialog
│   └── GameListDialog.js        [DELETE] - Replaced by LobbyScreen
├── stores/
│   ├── lobbyStore.js            [NEW] - Lobby state management
│   └── gameStore.js             [MODIFY] - Handle empty state
├── utils/
│   └── gameManager.js           [MODIFY] - Add timestamps, update listGames
├── app/
│   └── App.js                   [MODIFY] - Lobby as entry point, conditional rendering
├── Board.js                     [MODIFY] - Remove dialog, add lobby navigation
└── docs/
    └── LOBBY_SCREEN_IMPLEMENTATION.md [NEW] - This file
```

---

## Questions/Decisions Made

1. **Entry Point**: Lobby is always the entry point, no auto-game creation
2. **Component Organization**: Separate LobbyScreen component (React best practice)
3. **State Management**: Separate lobby store for lobby mode and selection
4. **Game Deletion**: Deleting current game returns to lobby, no auto-creation
5. **Timestamps**: Store in game metadata, use for sorting
6. **Navigation**: Game code button navigates to lobby (replaces dialog)
7. **Empty State**: Show "New Game" button when no games exist
8. **Game Creation**: Creates immediately and enters game (no setup screen yet)

---

## Notes

- Lobby is intentionally a stub UI for now - can be enhanced later
- All games are still 2 players (player count selection not in this plan)
- Lobby supports zero games state (empty state)
- Most recent game can be deleted (no special protection)
- Code structured to support future cloud storage transition
- Timestamps use ISO 8601 format for cloud compatibility
- Lobby state is separate from game state (clean separation)

---

## Future Enhancements (Not in This Plan)

- Player count selection before game creation
- Game setup screen after creation
- Completed games section
- Game filtering and search
- Better empty state UI
- Game metadata display (player names, game duration, etc.)
- Cloud storage integration
- Multiplayer join functionality
