# Phases Implementation

## Overview
The game uses a custom phases system to structure gameplay into three distinct phases. Phase configuration is defined in `src/stores/phaseConfig.js`.

## Phase Structure

### 1. Setup Phase
- **Purpose**: Each player chooses their starting cities and receives a private contract
- **Flow**: 
  - Players take turns selecting from available starting city pairs
  - Upon selection, a private contract is automatically generated using starting contract logic
  - Player's turn automatically ends after choosing cities
  - Phase ends when all players have at least one private contract
- **Available Starting City Pairs** (limited to 6 options):
  1. Quebec City & Montreal
  2. Boston & Portland ME
  3. Philadelphia & New York
  4. Washington & Philadelphia
  5. Raleigh & Norfolk
  6. Charleston & Savannah
- **UI Changes**:
  - Top bar shows "Phase: Setup"
  - Dropdown selector shows available city pairs
  - Once a pair is chosen, it's removed from the dropdown for subsequent players
  - Button labeled "Choose Starting Cities" (disabled until a pair is selected)
  - No "End Turn" button (auto-advances after selection)
  - Market contracts and independent railroads are hidden
- **Note**: There is no special "starting" contract type. The `generateStartingContract` function uses different business logic to create the contract, but the resulting contract is a regular private contract (type: "private").

### 2. Play Phase
- **Purpose**: Main game with all normal actions
- **Flow**:
  - Players take turns performing game actions
  - End-of-round processing happens after last player's turn
  - Independent railroads grow at end of each round
  - Currently no end condition (game continues indefinitely)
- **UI Changes**:
  - Top bar shows "Phase: Play"
  - All normal game UI is visible
  - "End Turn" button appears
  - Market contracts section visible
  - Independent railroads section visible
  - Manual contract input available

### 3. Scoring Phase
- **Purpose**: Calculate final scores (stub for future implementation)
- **Flow**:
  - Currently unreachable (no code path triggers it)
  - Stub UI shows placeholder message
- **UI Changes**:
  - Top bar shows "Phase: Scoring"
  - Simple centered message: "Game scoring will be implemented here"
  - Most UI elements hidden

## Key Implementation Details

### Phase Configuration (phaseConfig.js)
- Phase definitions are configured in `src/stores/phaseConfig.js`
- Each phase has its own `moves`, `turn`, and `endIf` configurations
- Setup phase auto-ends when all players have at least one private contract
- Play phase has no automatic end condition yet
- Starting contracts use special generation logic but create regular private contracts (type: "private")

### Board.js Changes
- Added `currentPhase` variable from `ctx.phase`
- Defined `STARTING_CITY_PAIRS` constant with the 6 allowed starting city pair options
- Updated `TopButtonBar` to show phase-specific UI:
  - During setup: shows dropdown with available city pairs (filters out already chosen pairs)
  - During play: shows text input for manual contracts
  - Submit button is disabled until a valid selection is made
- Added conditional rendering for phase-appropriate components
- Scoring phase shows stub UI

## Future Enhancements

To add a game end condition, modify the Play phase's `endIf`:

```javascript
endIf: ({ G, ctx }) => {
  // Example: End when any player has 10 fulfilled contracts
  const maxFulfilled = Math.max(...G.players.map(([id, props]) => 
    G.contracts.filter(c => c.playerID === id && c.fulfilled).length
  ));
  return maxFulfilled >= 10;
}
```

Then implement the scoring phase logic with appropriate moves and UI.
