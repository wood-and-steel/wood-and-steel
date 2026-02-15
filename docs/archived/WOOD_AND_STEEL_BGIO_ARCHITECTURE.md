# Wood and Steel Architecture: boardgame.io Integration

> **⚠️ ARCHIVED DOCUMENTATION**  
> This document describes the historical boardgame.io (bgio) implementation that has since been removed. The codebase now uses a Zustand-based implementation with custom state management, moves, and phase/turn management. This document is kept for reference purposes only.

This document describes how Wood and Steel previously used boardgame.io (bgio) and what was implemented to replace it with a local implementation.

## Table of Contents

1. [Overview](#overview)
2. [Game State (G Object)](#game-state-g-object)
3. [Context (ctx Object)](#context-ctx-object)
4. [Moves System](#moves-system)
5. [Turns System](#turns-system)
6. [Phases System](#phases-system)
7. [Client Component Integration](#client-component-integration)
8. [Persistence and Storage](#persistence-and-storage)
9. [Replacement Strategy](#replacement-strategy)

## Overview

Wood and Steel uses boardgame.io as its game engine, which provides:
- State management and synchronization
- Turn-based game flow control
- Phase transitions
- Move validation and execution
- Local multiplayer with persistence
- React component integration

The game is configured as a 2-player local multiplayer game with three phases: `setup`, `play`, and `scoring`.

## Game State (G Object)

### Structure

The `G` object (global game state) is defined in `Game.js` via the `setup` function and has the following structure:

```javascript
{
  contracts: Array<Contract>,           // All contracts in the game
  players: Array<[string, PlayerProps]>, // Array of [playerID, playerData] tuples
  independentRailroads: Object          // Map of railroad name to railroad data
}
```

### Key Properties

#### `contracts` (Array)
- Contains all contracts (both private and market)
- Each contract has: `id`, `destinationKey`, `commodity`, `type`, `fulfilled`, `playerID`
- Contracts are added via `unshift()` to appear at the top
- Accessed throughout the codebase for filtering and display

**Usage Examples:**
- `G.contracts.filter(c => c.playerID === playerID)` - Get player's contracts
- `G.contracts.find(c => c.id === contractID)` - Find specific contract
- `G.contracts.unshift(contract)` - Add new contract

#### `players` (Array of Tuples)
- Format: `[playerID, { name, activeCities }]`
- `playerID` is a string ("0", "1", etc.)
- `activeCities` is an array of city keys
- Used to track which cities each player has activated

**Usage Examples:**
- `G.players.find(([id, props]) => id === ctx.currentPlayer)` - Get current player
- `G.players.forEach(([key, value]) => ...)` - Iterate all players
- `player[1].activeCities.push(city)` - Add city to player

#### `independentRailroads` (Object)
- Keys are railroad company names (strings)
- Values are objects with `name` and `routes` array
- Modified by `growIndependentRailroads()` at end of rounds
- Deleted when acquired by players

**Usage Examples:**
- `Object.values(G.independentRailroads)` - Get all railroads
- `G.independentRailroads[railroadName]` - Get specific railroad
- `delete G.independentRailroads[railroadName]` - Remove railroad

### State Mutations

**Important:** In boardgame.io, `G` is treated as mutable within moves. The framework handles immutability internally through its state management system. When replacing bgio, you'll need to implement proper immutability handling.

**Direct Mutations Observed:**
- `G.contracts.unshift(contract)` - Adding contracts
- `G.contracts.splice(index, 1)` - Removing contracts
- `G.contracts[index].fulfilled = !G.contracts[index].fulfilled` - Toggling fulfillment
- `G.contracts[index].playerID = ctx.currentPlayer` - Assigning player to market contract
- `player[1].activeCities.push(city)` - Adding cities to players
- `player[1].activeCities.splice(index, 1)` - Removing cities
- `delete G.independentRailroads[name]` - Removing railroads

## Context (ctx Object)

### Structure

The `ctx` object is provided by boardgame.io and contains game metadata:

```javascript
{
  phase: string,              // Current phase name ('setup', 'play', 'scoring')
  currentPlayer: string,      // ID of player whose turn it is ('0', '1', etc.)
  numPlayers: number,         // Total number of players (2)
  playOrder: Array<string>,   // Array of player IDs in turn order
  playOrderPos: number,      // Index in playOrder for current player
  turn: number               // Current turn number
}
```

### Usage Throughout Codebase

#### Phase Checking
- `ctx.phase` - Used to determine current game phase
- Examples: `ctx.phase === 'setup'`, `ctx.phase === 'play'`, `ctx.phase === 'scoring'`

#### Current Player Identification
- `ctx.currentPlayer` - Used extensively to identify whose turn it is
- Examples:
  - `ctx.currentPlayer === playerID` - Check if viewing player's turn
  - `G.players.find(([id, props]) => id === ctx.currentPlayer)` - Get current player data
  - `contract.playerID === ctx.currentPlayer` - Check contract ownership

#### Turn Management
- `ctx.playOrderPos` - Used to detect end of round
- Example: `ctx.playOrderPos === ctx.playOrder.length - 1` - Last player in round
- `ctx.numPlayers` - Used in phase end conditions
- Example: `playersWithContracts.size >= ctx.numPlayers` - All players have contracts

### Context Access Patterns

**In Moves:**
```javascript
moves: {
  myMove: ({ G, ctx }, arg) => {
    // ctx.currentPlayer identifies the acting player
    // ctx.phase identifies current phase
  }
}
```

**In Components:**
```javascript
function MyComponent({ ctx, G }) {
  const isMyTurn = ctx.currentPlayer === playerID;
  const currentPhase = ctx.phase;
}
```

## Moves System

### Definition

Moves are defined in the `moves` object within each phase in `Game.js`:

```javascript
phases: {
  setup: {
    moves: {
      generateStartingContract: ({ G, ctx, events }, activeCities) => { ... }
    }
  },
  play: {
    moves: {
      generatePrivateContract: ({ G, ctx }) => { ... },
      generateMarketContract: ({ G }) => { ... },
      // ... more moves
    }
  }
}
```

### Move Function Signature

All moves receive:
1. **Destructured object** containing:
   - `G` - Global game state
   - `ctx` - Game context
   - `events` - Event API (for `events.endTurn()`, etc.)
2. **Arguments** - Any parameters passed from the UI

### Move Execution Flow

1. **UI calls move** via `moves.moveName(args)`
2. **boardgame.io validates** the move (checks phase, turn, etc.)
3. **Move function executes** with access to G, ctx, events
4. **State updates** are applied
5. **UI re-renders** with new state

### Available Moves

#### Setup Phase
- `generateStartingContract(activeCities)` - Creates starting contract for player

#### Play Phase
- `generatePrivateContract()` - Creates a private contract for current player
- `generateMarketContract()` - Creates a market contract available to all
- `addContract(commodity, destinationKey, type)` - Manually add a contract
- `toggleContractFulfilled(contractID)` - Toggle fulfillment status of a contract
- `deleteContract(contractID)` - Remove an unfulfilled contract
- `acquireIndependentRailroad(railroadName)` - Player acquires an independent railroad
- `endTurn()` - Manually end the current turn

### Events API

The `events` object provides:
- `events.endTurn()` - End the current player's turn
- Used in: `generateStartingContract` (auto-ends after selection), `endTurn` move

### Move Validation

boardgame.io automatically validates:
- Move exists in current phase
- It's the correct player's turn
- Move is called during appropriate phase

**Note:** The codebase doesn't implement additional validation beyond bgio's built-in checks. Some moves check for existence (e.g., `if (!contract) return;`) but don't throw errors.

## Turns System

### Configuration

Turns are configured per phase using `TurnOrder.DEFAULT`:

```javascript
phases: {
  setup: {
    turn: {
      order: TurnOrder.DEFAULT,  // Sequential: 0, 1, 0, 1, ...
    }
  },
  play: {
    turn: {
      order: TurnOrder.DEFAULT,
      onEnd: ({ G, ctx }) => {
        // End-of-turn logic
        if (ctx.playOrderPos === ctx.playOrder.length - 1) {
          // Last player in round - do round-end actions
          growIndependentRailroads(G);
        }
      }
    }
  }
}
```

### Turn Flow

1. **Turn starts** - Current player can make moves
2. **Player makes moves** - Multiple moves allowed per turn
3. **Turn ends** - Either:
   - Automatically (via `events.endTurn()`)
   - Manually (via `endTurn` move)
   - When phase ends
4. **onEnd hook fires** - If defined, executes after turn ends
5. **Next player's turn begins** - Automatically advanced by bgio

### Turn Order

- Uses `TurnOrder.DEFAULT` which cycles through players sequentially
- `ctx.playOrder` contains `["0", "1"]` for 2 players
- `ctx.playOrderPos` indicates position in the cycle (0 or 1)

### Round Detection

The code detects end of round (all players have taken a turn) using:
```javascript
if (ctx.playOrderPos === ctx.playOrder.length - 1) {
  // This is the last player in the round
  growIndependentRailroads(G);
}
```

## Phases System

### Phase Structure

Phases are defined in the `phases` object in `Game.js`:

```javascript
phases: {
  setup: {
    start: true,        // This phase starts the game
    next: 'play',       // Next phase after this one ends
    turn: { ... },
    moves: { ... },
    endIf: ({ G, ctx }) => { ... },  // Condition to end phase
    onEnd: ({ G }) => { ... }        // Hook when phase ends
  },
  play: { ... },
  scoring: { ... }
}
```

### Phase Properties

#### `start: true`
- Marks the initial phase
- Only one phase should have this

#### `next: 'phaseName'`
- Defines the next phase after this one ends
- Can be the same phase for loops (e.g., `scoring` → `scoring`)

#### `endIf: ({ G, ctx }) => boolean`
- Function that returns `true` when phase should end
- Evaluated after each move
- **Setup phase:** Ends when all players have at least one private contract
- **Play phase:** Currently always returns `false` (no end condition)

#### `onEnd: ({ G, ctx }) => void`
- Hook executed when phase ends
- Used for cleanup or phase transition logic

### Phase Transitions

1. **Game starts** → `setup` phase (marked with `start: true`)
2. **Setup ends** → `play` phase (when `endIf` returns true)
3. **Play ends** → `scoring` phase (when `endIf` returns true - currently never)
4. **Scoring ends** → `scoring` phase (loops to itself)

### Phase-Specific Behavior

#### Setup Phase
- Only `generateStartingContract` move available
- Turn auto-ends after move execution
- UI shows city pair selector
- Market contracts and independent railroads hidden

#### Play Phase
- All normal moves available
- Round-end processing in `turn.onEnd`
- Full UI visible
- No automatic end condition

#### Scoring Phase
- Stub implementation
- No moves defined
- Shows placeholder UI
- Currently unreachable

### Phase Access in Code

**In Moves:**
- `ctx.phase` - Current phase name
- Moves are scoped to their phase (can't call setup moves from play phase)

**In Components:**
- `ctx.phase` - Used for conditional rendering
- Example: `{currentPhase === 'play' && <MarketContracts />}`

## Client Component Integration

### Setup

The boardgame.io Client is configured in `App.js`:

```javascript
import { Client } from 'boardgame.io/react';
import { Local } from 'boardgame.io/multiplayer';

const WoodAndSteelClient = Client({ 
  game: WoodAndSteel,           // Game definition
  multiplayer: Local({ persist: true }),  // Local multiplayer with persistence
  numPlayers: 2,                 // Number of players
  board: WoodAndSteelState,       // React component to render
  debug: false,                  // Debug mode
});
```

### Client Usage

Two Client instances are rendered (one per player):

```javascript
<WoodAndSteelClient 
  playerID="0" 
  matchID={currentGameCode}
  gameManager={gameManager}
/>
<WoodAndSteelClient 
  playerID="1" 
  matchID={currentGameCode}
  gameManager={gameManager}
/>
```

### Props Passed to Board Component

The Client automatically passes these props to the `board` component:

- **`G`** - Current game state
- **`ctx`** - Game context
- **`moves`** - Object containing all available moves
- **`playerID`** - ID of this client instance ("0" or "1")
- **Custom props** - Any additional props passed to Client (e.g., `gameManager`)

### Move Invocation

Moves are called from the UI via the `moves` object:

```javascript
function handleSubmit(e) {
  switch (e.nativeEvent.submitter.name) {
    case "privateContract":
      moves.generatePrivateContract();  // Call move
      break;
    // ...
  }
}
```

### State Synchronization

boardgame.io automatically:
- Synchronizes state between multiple Client instances
- Updates UI when state changes
- Handles turn validation
- Manages phase transitions

## Persistence and Storage

### Storage Format

boardgame.io's `Local` multiplayer uses localStorage with these keys:

- `bgio_state` - Current game state (Map of matchID → state)
- `bgio_metadata` - Game metadata (Map of matchID → metadata)
- `bgio_initial` - Initial game state (Map of matchID → initial state)

### Storage Structure

Each key stores a JSON-serialized Map:
```javascript
// Stored as: JSON.stringify(Array.from(map.entries()))
[
  ["GAME_CODE_1", { G: {...}, ctx: {...}, _stateID: 0 }],
  ["GAME_CODE_2", { G: {...}, ctx: {...}, _stateID: 1 }],
  // ...
]
```

### Game Manager Integration

The `gameManager.js` utility works with bgio's storage:

- **`getBgioData(key)`** - Reads and parses bgio storage
- **`setBgioData(key, dataMap)`** - Writes to bgio storage
- **`createNewGame()`** - Generates unique 4-letter game code
- **`switchToGame(code)`** - Changes active game
- **`deleteGame(code)`** - Removes game from all storage keys
- **`listGames()`** - Lists all saved games

### Persistence Behavior

- **Automatic:** State is saved after each move
- **Per-match:** Each `matchID` (game code) has separate state
- **State history:** bgio maintains state history for time-travel debugging (not used in this codebase)

## Replacement Strategy

To replace boardgame.io with a local implementation, you would need to implement:

### 1. State Management

**Requirements:**
- Immutable state updates (or mutable with proper cloning)
- State history (optional, for undo/time-travel)
- State serialization for persistence

**Implementation:**
- Use React state or a state management library (Redux, Zustand, etc.)
- Implement state update functions that return new state
- Handle state cloning for nested objects/arrays

### 2. Context Object

**Requirements:**
- Track current phase
- Track current player
- Track turn number
- Track play order and position

**Implementation:**
```javascript
const ctx = {
  phase: 'setup' | 'play' | 'scoring',
  currentPlayer: '0' | '1',
  numPlayers: 2,
  playOrder: ['0', '1'],
  playOrderPos: 0 | 1,
  turn: number
};
```

### 3. Moves System

**Requirements:**
- Move validation (phase, turn, player)
- Move execution with state updates
- Move history (optional)

**Implementation:**
- Create a `moves` object with move functions
- Each move receives `(G, ctx, ...args)` and returns new state
- Validate move is allowed before execution
- Update both `G` and `ctx` as needed

### 4. Turn Management

**Requirements:**
- Automatic turn progression
- Turn order cycling
- Turn end hooks

**Implementation:**
- After each move, check if turn should end
- Advance `ctx.currentPlayer` and `ctx.playOrderPos`
- Call turn end hooks when appropriate
- Detect round end (all players have played)

### 5. Phase Management

**Requirements:**
- Phase transitions
- Phase-specific moves
- Phase end conditions
- Phase hooks

**Implementation:**
- After each move, check `endIf` condition
- If true, transition to `next` phase
- Call `onEnd` hook
- Filter available moves by current phase

### 6. React Integration

**Requirements:**
- Component receives G, ctx, moves, playerID
- State updates trigger re-renders
- Move calls update state

**Implementation:**
- Create a custom hook or context provider
- Pass state and move functions to components
- Use React state or context for reactivity

### 7. Persistence

**Requirements:**
- Save state to localStorage
- Load state from localStorage
- Multiple game instances (matchID system)
- Game management (create, delete, list, switch)

**Implementation:**
- Serialize state to JSON
- Store in localStorage with matchID key
- Implement game manager functions
- Load state on app initialization

### 8. Multiplayer Synchronization

**Requirements:**
- Multiple Client instances see same state
- State updates propagate to all instances
- Turn validation across instances

**Implementation:**
- Use shared state (React Context, global state, or event system)
- Broadcast state updates to all instances
- Validate moves against shared state

### Key Implementation Points

1. **State Immutability:** bgio handles this internally. Your implementation must either:
   - Use immutable updates (return new state)
   - Or implement deep cloning before mutations

2. **Move Validation:** Implement checks for:
   - Correct phase
   - Correct player's turn
   - Move exists in current phase

3. **State Structure:** Maintain the same `G` structure:
   - `contracts` array
   - `players` array of tuples
   - `independentRailroads` object

4. **Context Structure:** Maintain the same `ctx` structure for compatibility

5. **Event System:** Replace `events.endTurn()` with direct state updates

### Migration Path

1. **Phase 1:** Implement state management alongside bgio
2. **Phase 2:** Implement moves system
3. **Phase 3:** Implement turn/phase management
4. **Phase 4:** Replace Client component with custom React integration
5. **Phase 5:** Implement persistence
6. **Phase 6:** Remove bgio dependency
7. **Phase 7:** Final cleanup
   - Remove `useGameState` wrapper hook (migration artifact)
   - Migrate components to use `useGameStore` directly with selectors
   - Remove `useBgioSync` hook
   - Remove any remaining bgio compatibility code

### Estimated Complexity

- **State Management:** Medium (React state/context is straightforward)
- **Moves System:** Medium (validation logic needed)
- **Turn/Phase Management:** Medium-High (state machine logic)
- **Persistence:** Low-Medium (localStorage is simple)
- **Multiplayer Sync:** Medium (shared state management)
- **Overall:** Medium complexity, significant code volume

## Summary

Wood and Steel uses boardgame.io for:
- **State management** via the `G` object (contracts, players, railroads)
- **Game flow** via the `ctx` object (phase, currentPlayer, turn)
- **Move execution** via phase-scoped move functions
- **Turn management** via TurnOrder and turn hooks
- **Phase transitions** via phase definitions with end conditions
- **React integration** via Client component
- **Persistence** via Local multiplayer with localStorage

Replacing bgio requires implementing all of these systems, with particular attention to:
- Maintaining the same state structure (`G` and `ctx`)
- Implementing proper move validation
- Handling state immutability
- Synchronizing multiple client instances
- Preserving existing saved games (or migrating them)
