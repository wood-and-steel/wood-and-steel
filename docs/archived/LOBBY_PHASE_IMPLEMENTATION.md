# ⚠️ ARCHIVED - Lobby Phase Implementation Plan

> **Status:** This plan has been archived. Creating a new phase was determined to be the wrong approach for implementing the lobby functionality.

---

# Lobby Phase Implementation Plan

## Overview
Add a new "in-lobby" phase that occurs before the setup phase. This phase allows the host to select the number of players (2-6) before starting the game. The game code is created when the host clicks "Start Game", and the game then transitions to the setup phase.

## Key Design Decisions

### Phase Flow
- **in-lobby** → **setup** → **play** → **scoring**
- The lobby phase is the entry point for new games
- Game code is created when transitioning from lobby to setup (not before)

### State Management
- Lobby state (selected player count) is stored in localStorage, separate from game state (G/ctx)
- Game state (G/ctx) is only initialized when "Start Game" is clicked
- The lobby phase uses a minimal state structure

### Component Organization
- Create a new `LobbyScreen` component as a separate top-level component
- Use conditional rendering in `App.js` based on `ctx.phase`
- Lobby screen reuses styles but shares no UI code with the board

### Future Multiplayer Considerations
- Note locations where multiplayer join logic will be added
- Host identification will be needed when players join from separate devices
- Game code sharing will be implemented in future changes

---

## Implementation Steps

### 1. Update Phase Configuration (`src/stores/phaseConfig.js`)

**Changes:**
- Add `in-lobby` phase configuration with:
  - `next: 'setup'` - transitions to setup phase
  - `endIf: ({ G, ctx }) => false` - only ends when host clicks "Start Game" (handled manually)
  - `onEnd: null` - no special cleanup needed
  - `turn.onEnd: null` - no turn logic in lobby

**Future Multiplayer Note:**
- When multiplayer is added, `endIf` may need to check that all expected players have joined
- `onEnd` may need to validate player connections before transitioning

---

### 2. Create Lobby State Management (`src/utils/lobbyManager.js`)

**New File:** Create utility functions for managing lobby state in localStorage

**Functions:**
- `getLobbyPlayerCount()` - Get saved player count selection (returns number or null)
- `setLobbyPlayerCount(count)` - Save player count selection to localStorage
- `clearLobbyState()` - Clear lobby state (optional cleanup function)

**Storage Key:**
- Use a separate localStorage key: `'lobby_state'` or `'lobby_player_count'`
- Store as simple JSON: `{ playerCount: number }`

**Future Multiplayer Note:**
- This storage may need to be per-game-code when multiplayer is added
- May need to store additional lobby metadata (host ID, joined players, etc.)

---

### 3. Create Lobby Screen Component (`src/components/LobbyScreen.js`)

**New File:** Create the lobby screen component

**Props:**
- `gameManager` - Game management functions (for returning to active game)
- `onStartGame` - Callback function to start the game (passed from App.js)

**State:**
- `selectedPlayerCount` - Currently selected player count (from localStorage or default)
- `hasActiveGame` - Whether there's an active game to return to (from gameManager)

**UI Elements:**
- Title: "Game Lobby" or similar
- Player count selector: 6 buttons labeled "2 Players", "3 Players", etc. (2-6)
  - Selected button should be visually distinct (use existing button styles)
  - Clicking a button updates `selectedPlayerCount` and saves to localStorage
- "Start Game" button
  - Enabled when a player count is selected
  - Calls `onStartGame(selectedPlayerCount)`
- "Return to Game" button (if `hasActiveGame` is true)
  - Disabled if no active game exists
  - Calls `gameManager.onSwitchGame(currentGameCode)` or similar

**Styling:**
- Reuse existing CSS classes from `src/shared/styles/`
- Use `button`, `button--primary` classes for buttons
- Center the content vertically and horizontally
- Keep it simple and clean (skeleton UI as requested)

**Future Multiplayer Note:**
- Will need to display list of joined players
- Will need to show game code for sharing
- Will need "Ready" indicators for each player
- Host controls will need to be restricted to actual host

---

### 4. Update Game Store (`src/stores/gameStore.js`)

**Changes:**
- Update `getInitialState()` to accept `phase` parameter (default: 'setup')
  - This allows creating state in 'in-lobby' phase initially
- Update `resetState()` to accept optional `phase` parameter
- Update JSDoc for `GameContext` to include 'in-lobby' as a valid phase

**Lobby Phase State Handling:**

- **Approach:** Do **not** create or initialize the main game state (`G` or `ctx`) until the player clicks "Start Game".
- While in the lobby, only lobby-related state (like player count selection) is stored, typically in localStorage or simple React state within the lobby screen component.
- The actual game state is **created and initialized only after starting the game**. At that point, the app transitions to the setup phase with newly-created state.

**Rationale:**  
There is no need to create placeholder or minimal `G/ctx` state for the lobby. Deferring all game state initialization results in a cleaner separation and avoids unnecessary boilerplate for the lobby, which does not use the main game mechanisms.

---

### 5. Create Game Initialization Function (`src/utils/gameInitialization.js`)

**New File:** Extract game initialization logic from `App.js`

**Function:**
- `initializeGameState(numPlayers)` - Creates and initializes full game state
  - Generates game code using `generateUniqueGameCode()`
  - Sets current game code using `setCurrentGameCode()`
  - Creates initial state using `getInitialState(numPlayers)` with `phase: 'setup'`
  - Saves initial state to localStorage using `saveGameState()`
  - Updates Zustand store with new state
  - Returns the game code

**Error Handling:**
- Validate that numPlayers is between 2 and 6
- Handle localStorage errors gracefully
- Return error information for display

**Future Multiplayer Note:**
- May need to accept additional parameters (host ID, player connections)
- May need to validate that all expected players are connected before initializing

---

### 6. Update App.js (`src/app/App.js`)

**Major Changes:**

1. **Remove automatic game creation on mount**
   - Remove the logic that creates a game if none exists
   - Only load existing games if they exist

2. **Add lobby state loading**
   - On mount, check if there's a current game
   - If no game exists, check if there's saved lobby state
   - If lobby state exists, initialize Zustand store with minimal state (phase: 'in-lobby')

3. **Add conditional rendering based on phase**
   - Import `LobbyScreen` component
   - Import `useGameStore` to read current phase
   - Check `ctx.phase` from store
   - If `phase === 'in-lobby'`, render `<LobbyScreen />`
   - Otherwise, render existing `<WoodAndSteelState />` components

4. **Add `onStartGame` handler**
   - Function that:
     - Validates selected player count (2-6)
     - Calls `initializeGameState(numPlayers)` from gameInitialization.js
     - Handles errors (show alert if validation fails)
     - On success, the phase will be 'setup' and board will render automatically

5. **Update `gameManager.onNewGame`**
   - Instead of creating a game immediately, initialize lobby state
   - Set Zustand store to minimal state with `phase: 'in-lobby'`
   - Don't create game code yet
   - Don't reload page (let React re-render to show lobby)

6. **Update game loading logic**
   - If loaded game has `phase: 'in-lobby'`, show lobby screen
   - This handles the case where user returns to a game that's still in lobby

**Future Multiplayer Note:**
- `onStartGame` may need to wait for all players to be ready
- May need to handle game code sharing before starting
- May need to validate player connections

---

### 7. Update Game Manager (`src/utils/gameManager.js`)

**Changes to `createNewGame()`:**
- Currently creates a game code immediately
- **Change:** Don't create game code or state
- **Change:** Just initialize lobby state (set phase to 'in-lobby' in a minimal state)
- **Alternative:** Remove `createNewGame()` usage from "New Game" flow entirely
  - Let the lobby handle game creation when "Start Game" is clicked

**Decision:**
- Keep `createNewGame()` for backward compatibility but update its behavior
- Or create a new function `initializeLobby()` that sets up lobby state
- **Recommendation:** Create `initializeLobby()` and update `onNewGame` to use it

**New Function:**
- `initializeLobby()` - Sets up lobby state without creating game code
  - Sets current game code to null or a temporary value
  - Initializes Zustand store with minimal state: `{ G: {}, ctx: { phase: 'in-lobby' } }`
  - Saves lobby player count preference if it exists

---

### 8. Update Game List Dialog (`src/components/GameListDialog.js`)

**Changes:**
- Update `handleNewGame()` function
- Instead of calling `gameManager.onNewGame()` (which currently creates a game), it should:
  - Call a new function that initializes the lobby
  - Close the dialog
  - Let App.js render the lobby screen

**Note:**
- The "New Game" button should now lead to the lobby, not directly create a game

---

### 9. Update Phase Manager (`src/stores/phaseManager.js`)

**Changes:**
- Ensure `checkPhaseTransition()` can handle 'in-lobby' phase
- The lobby phase will transition manually (not via `endIf`), but the function should still work

**Note:**
- The lobby → setup transition will be triggered by the "Start Game" button, not by `checkPhaseTransition()`
- We may need a manual transition function: `transitionToPhase(nextPhase)`

**New Function (if needed):**
- `transitionToPhase(phaseName, G, ctx)` - Manually transition to a specific phase
  - Updates Zustand store with new phase
  - Executes phase hooks if needed
  - Saves state

---

### 10. Update Documentation

**Files to Update:**
- `docs/PHASES_IMPLEMENTATION.md` - Add in-lobby phase documentation
- Update phase flow diagram if one exists
- Add notes about lobby state management

**New Section in PHASES_IMPLEMENTATION.md:**
```markdown
### 0. Lobby Phase (in-lobby)
- **Purpose**: Host selects number of players before game starts
- **Flow**: 
  - Host selects player count (2-6)
  - Host clicks "Start Game"
  - Game code is created
  - Full game state is initialized
  - Phase transitions to setup
- **UI**: Simple lobby screen with player count selector and Start Game button
- **State**: Lobby preferences stored separately in localStorage
```

---

## Implementation Order

1. **Phase Configuration** (Step 1) - Define the phase structure
2. **Lobby State Management** (Step 2) - Create utilities for localStorage
3. **Game Initialization Function** (Step 5) - Extract and create reusable initialization
4. **Lobby Screen Component** (Step 3) - Create the UI
5. **Update Game Store** (Step 4) - Support lobby phase in state
6. **Update App.js** (Step 6) - Add conditional rendering and handlers
7. **Update Game Manager** (Step 7) - Modify game creation flow
8. **Update Game List Dialog** (Step 8) - Change "New Game" behavior
9. **Update Phase Manager** (Step 9) - Ensure phase transitions work
10. **Update Documentation** (Step 10) - Document the new phase

---

## Testing Considerations

### Manual Testing Checklist:
- [ ] Clicking "New Game" in game list shows lobby screen
- [ ] Player count buttons work and save to localStorage
- [ ] "Start Game" button is disabled until player count is selected
- [ ] "Start Game" creates game code and transitions to setup phase
- [ ] Game state is properly initialized with correct number of players
- [ ] Returning to a game in lobby phase shows lobby screen
- [ ] "Return to Game" button works when there's an active game
- [ ] "Return to Game" button is disabled when there's no active game
- [ ] Lobby state persists across page refreshes
- [ ] Error handling works (invalid state, localStorage full, etc.)

### Edge Cases:
- What happens if localStorage is full when saving lobby state?
- What happens if game code generation fails?
- What happens if user refreshes during lobby phase?
- What happens if user has multiple games and switches between them?

---

## Future Multiplayer Integration Points

### Locations where multiplayer logic will be added:

1. **LobbyScreen.js**
   - Add player list display
   - Add "Ready" status indicators
   - Add game code display for sharing
   - Add host-only controls

2. **lobbyManager.js**
   - Store lobby state per game code
   - Store joined players list
   - Store host information

3. **gameInitialization.js**
   - Validate all players are connected
   - Initialize player connections in state
   - Handle player disconnections

4. **App.js**
   - Handle player join events
   - Handle game code entry for joining
   - Handle host vs. non-host views

5. **phaseConfig.js**
   - Update `endIf` to check player readiness
   - Add validation for minimum players

---

## Code Structure Summary

```
src/
├── components/
│   ├── LobbyScreen.js          [NEW] - Lobby UI component
│   └── GameListDialog.js        [MODIFY] - Update New Game button
├── stores/
│   ├── phaseConfig.js           [MODIFY] - Add in-lobby phase
│   ├── phaseManager.js          [MODIFY] - Support manual transitions
│   └── gameStore.js             [MODIFY] - Support lobby phase
├── utils/
│   ├── lobbyManager.js          [NEW] - Lobby state utilities
│   ├── gameInitialization.js    [NEW] - Game initialization logic
│   └── gameManager.js            [MODIFY] - Update createNewGame flow
├── app/
│   └── App.js                   [MODIFY] - Conditional rendering, lobby handlers
└── docs/
    └── PHASES_IMPLEMENTATION.md [MODIFY] - Document new phase
```

---

## Questions/Decisions Made

1. **State Initialization Timing**: Don't initialize game state until "Start Game" is clicked
2. **Component Organization**: Conditional rendering in App.js based on phase
3. **Lobby State Storage**: Separate localStorage key, outside G/ctx
4. **Game Code Creation**: Happens when "Start Game" is clicked, not before
5. **Error Handling**: Console logs for errors, alerts for user-facing validation failures
6. **Return to Game**: Button to return to active game (if exists) from lobby

---

## Notes

- The lobby phase is intentionally minimal - just player count selection
- All game state initialization happens in one place (gameInitialization.js)
- The phase system already supports this structure, just needs the new phase added
- Future multiplayer changes will be additive, not requiring major refactoring
