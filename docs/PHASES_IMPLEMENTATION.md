# Phases Implementation

**For AI agents:** This doc is the source of truth for the game’s phase system. When changing phase behavior, phase transitions, or phase-specific UI, update the relevant files listed below and keep this doc in sync.

---

## Quick reference: where phase code lives

| Concern | File | What to change |
|--------|------|----------------|
| Phase definitions, `endIf`, `onEnd`, `next`, turn hooks | `src/stores/phaseConfig.ts` | Add/edit phase entries; `PhaseConfigEntry` |
| Phase transition (when to run `endIf`, persist) | `src/stores/phaseManager.ts` | Rarely; uses `phaseConfig` |
| Turn end (e.g. grow indies) | `src/stores/events.js` | Calls `executeTurnOnEnd(ctx.phase, G, ctx)` |
| Which moves are allowed in which phase | `src/stores/moveValidation.js` | `MOVES_BY_PHASE` |
| Move implementation + phase checks + `checkPhaseTransition` | `src/stores/gameActions.js` | Per-move `ctx.phase` checks; call `checkPhaseTransition` after state-changing moves |
| Initial phase (hotseat/BYOD) | `src/stores/gameStore.ts` (initial ctx), `src/utils/gameManager.js` (BYOD initial phase) | Default `ctx.phase` |
| Phase in UI (tabs, scoring stub, setup→play hint) | `src/Board.tsx` | `currentPhase`, scoring branch, `prevPhaseRef` effect |
| Phase label and phase-specific controls | `src/components/NavBar.js` | `currentPhase` prop |
| Setup: starting city pairs + “Choose Starting Cities” | `src/components/PlayerBoard.js` | `STARTING_CITY_PAIRS`, setup-only UI |
| BYOD waiting screen and start-game transition | `src/app/App.js`, `src/components/WaitingForPlayersScreen.js` | `waiting_for_players` handling |
| Phase in serialization/persistence | `src/utils/stateSerialization.js`, storage adapters | Ensure `ctx.phase` is read/written |
| Phase transition and phase state tests | `src/utils/gameManager.test.js` | Tests for `checkPhaseTransition` and phase in saved state |

---

## Phase structure (overview)

Phases are defined in `src/stores/phaseConfig.ts`. Each phase has:

- **`next`**: Phase ID to transition to when `endIf` is true.
- **`endIf`**: `(params) => boolean`. When true, phase ends and transition to `next` runs.
- **`onEnd`**: Optional hook run when the phase ends (before switching to `next`).
- **`turn.onEnd`**: Optional hook run at the end of each turn (e.g. end-of-round logic).

Phase transitions are triggered by **`checkPhaseTransition(G, ctx)`** in `src/stores/phaseManager.ts`. Game actions that change state (e.g. adding a contract, ending turn) call it after updating state so setup→play (and future play→scoring) can happen automatically.

---

## Phase definitions

### 1. `waiting_for_players` (BYOD only)

- **Purpose:** Players join; host starts the game. Hotseat skips this and starts in `setup`.
- **Flow:** `endIf` is true when `G.byodGameStarted === true`. Then transition to `setup`.
- **Where:** `phaseConfig.ts`; start-game flow in `App.js` and `WaitingForPlayersScreen.js`.

### 2. Setup phase (`setup`)

- **Purpose:** Each player chooses starting cities and receives one private contract.
- **Flow:**
  - Players take turns selecting from available starting city pairs.
  - On selection, a starting contract is generated (see “Starting contracts” below); turn advances.
  - Phase ends when all players have at least one private contract (`endIf` in `phaseConfig.ts`).
- **Starting city pairs** (exactly 6; order in UI is defined in code):
  1. Montreal & Quebec City  
  2. Boston & Portland ME  
  3. New York & Philadelphia  
  4. Philadelphia & Washington  
  5. Norfolk & Raleigh  
  6. Charleston & Savannah  

  Defined in `src/components/PlayerBoard.js` as `STARTING_CITY_PAIRS`. Filter out already-chosen pairs in the same component (or parent) when rendering options.
- **UI:** “Phase: Setup”; starting-city selector and “Choose Starting Cities” (no manual “End Turn”); market contracts and independent railroads hidden. NavBar and PlayerBoard use `currentPhase === 'setup'`.
- **Moves allowed:** Only `generateStartingContract` (see `MOVES_BY_PHASE` in `moveValidation.js`).

### 3. Play phase (`play`)

- **Purpose:** Main game; all normal actions.
- **Flow:** Turn-based play; after the last player’s turn, `turn.onEnd` runs (e.g. `growIndependentRailroads`). No phase end condition yet (`endIf` returns false).
- **UI:** “Phase: Play”; full UI including “End Turn”, market contracts, independent railroads, manual contract input.
- **Moves allowed:** Listed in `MOVES_BY_PHASE.play` in `moveValidation.js` (e.g. `generatePrivateContract`, `generateMarketContract`, `addContract`, `toggleContractFulfilled`, `deleteContract`, `acquireIndependentRailroad`, `addCityToPlayer`, `endTurn`).

### 4. Scoring phase (`scoring`)

- **Purpose:** Final scoring (stub).
- **Flow:** Not reachable yet (no play→scoring transition). Stub UI only.
- **UI:** “Phase: Scoring”; simple message (e.g. “Game scoring will be implemented here”); most UI hidden. Handled in `Board.tsx` with `currentPhase === 'scoring'`.
- **Moves allowed:** None (`MOVES_BY_PHASE.scoring` is empty).

---

## Starting contracts

There is no separate “starting” contract type. The function that generates a starting contract (e.g. `generateStartingContract` in `gameActions.js`) uses different business logic, but the stored contract is a normal private contract (`type: 'private'`). Setup phase completion is based on “each player has at least one private contract,” not a special type.

---

## Agent checklist: changing phase behavior

Use this when adding phases, changing transitions, or updating phase-specific logic.

1. **Add or edit a phase**
   - In `src/stores/phaseConfig.ts`: add/update the phase key, `next`, `endIf`, `onEnd`, and `turn.onEnd`.
   - If the phase is reachable from another phase, ensure that phase’s `next` points to it (or that you add a new transition path).

2. **Allow a move in a phase**
   - In `src/stores/moveValidation.js`: add the move name to `MOVES_BY_PHASE[phaseName]`.
   - In `src/stores/gameActions.js`: ensure the move’s implementation does not block that phase (remove or adjust any `ctx.phase !== 'play'`-style checks that would disallow the move in the new phase).

3. **Trigger phase transition after a move**
   - In `src/stores/gameActions.js`: after updating `G`/ctx for that move, call `checkPhaseTransition(G, ctx)` (and persist if needed; phaseManager already persists when a game code exists).

4. **Phase-specific UI**
   - **Board layout / scoring stub:** `src/Board.tsx` — use `currentPhase` (from `ctx.phase`) to branch (e.g. scoring view) and pass `currentPhase` to NavBar and PlayerBoard.
   - **Nav bar:** `src/components/NavBar.js` — use `currentPhase` for labels and which controls show.
   - **Starting cities / setup-only UI:** `src/components/PlayerBoard.js` — use `currentPhase === 'setup'` and `STARTING_CITY_PAIRS`; filter out already-chosen pairs when rendering.

5. **New phase in types**
   - If you add a new phase ID, update any TypeScript or JSDoc types that enumerate phases (e.g. `'play' | 'setup' | 'scoring'` in `Board.tsx` or `NavBar.d.ts`) to include the new phase.

6. **Tests**
   - In `src/utils/gameManager.test.js`: adjust or add tests for phase transitions and for `ctx.phase` in saved state when you change transition logic or add phases.

7. **Docs**
   - Update this file: add the phase to “Phase definitions,” update “Quick reference” if new files or responsibilities appear.

---

## Example: adding a game end condition (play → scoring)

1. **`src/stores/phaseConfig.ts`** — in the `play` entry, set `endIf` to your condition, e.g.:

```ts
play: {
  next: 'scoring',
  endIf: ({ G, ctx }) => {
    const maxFulfilled = Math.max(
      ...G.players.map(([, props]) =>
        (props.fulfilledCount ?? 0)
      )
    );
    return maxFulfilled >= 10; // example
  },
  // ... rest unchanged
},
```

2. **When to run the check:** Ensure `checkPhaseTransition(G, ctx)` is called after moves that can change the condition (e.g. after `toggleContractFulfilled` or whatever updates fulfilled count). This is already the pattern in `gameActions.js`.

3. **Scoring phase:** Implement scoring logic (in phase config `onEnd` or in UI) and any new UI in `Board.tsx` for `currentPhase === 'scoring'`.

---

## Summary

- **Single source of phase structure:** `src/stores/phaseConfig.ts`.
- **Transitions:** `phaseManager.checkPhaseTransition`; called from `gameActions.js` after relevant moves.
- **Moves per phase:** `moveValidation.js` → `MOVES_BY_PHASE`; enforce in `gameActions.js`.
- **UI:** `Board.tsx` (routing/scoring), `NavBar.js` (phase label/controls), `PlayerBoard.js` (setup city pairs and setup-only UI).
- When in doubt, search for `ctx.phase`, `currentPhase`, and phase names (`'setup'`, `'play'`, `'scoring'`, `'waiting_for_players'`) to find all call sites.
