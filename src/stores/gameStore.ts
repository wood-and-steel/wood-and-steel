import { create } from 'zustand';
import type { Contract } from '../Contract';
import { getCurrentGameCode, saveGameState } from '../utils/gameManager';
import { generatePlayerAvatarColor } from '../utils/playerAvatar';

export type RegionCode = 'NW' | 'NC' | 'NE' | 'SW' | 'SC' | 'SE';

export interface PlayerProps {
  name: string;
  activeCities: string[];
  hubCity: string | null;
  regionalOffice: RegionCode | null;
  avatarColor?: string;
}

/** A route owned by an independent railroad, with the round it was added. */
export interface IndependentRailroadRoute {
  key: string;
  addedInRound: number;
}

export interface GameState {
  contracts: Contract[];
  players: [string, PlayerProps][];
  independentRailroads: Record<
    string,
    { name: string; routes: IndependentRailroadRoute[] }
  >;
  byodGameStarted?: boolean;
  /** Set at end-of-round when growIndependentRailroads adds routes; cleared when user dismisses NavBar hint. */
  lastRoundRoutesAdded?: number;
}

/** Game context (ctx): phase, player, turn info. All player references are by ID. */
export interface GameContext {
  phase: string;
  currentPlayer: string;
  numPlayers: number;
  playOrder: string[];
  playOrderPos: number;
  turn: number;
  round: number;
}

/** Snapshot of game state at the start of the current player's turn (for undo). */
export type TurnStartSnapshot = { G: GameState; ctx: GameContext };

/** Full store state: G, ctx, and methods. */
export interface GameStoreState {
  G: GameState;
  ctx: GameContext;
  turnStartSnapshot: TurnStartSnapshot | null;
  hasMovedThisTurn: boolean;
  resetState: (numPlayers?: number) => void;
  setTurnStartSnapshot: (snapshot: TurnStartSnapshot | null) => void;
  undoCurrentTurn: () => void;
  getPlayerContracts: (playerID: string) => Contract[];
  getMarketContracts: () => Contract[];
  getCurrentPlayer: () => [string, PlayerProps] | undefined;
  isMyTurn: (playerID: string) => boolean;
  getPlayerActiveCities: (playerID: string) => string[];
}

/**
 * Returns the initial game state structure. Game-specific initialization (e.g. independent railroads)
 * is handled by App.js when creating or starting games.
 *
 * @param numPlayers - Number of players (default 2)
 * @returns Object with G (game state) and ctx (game context)
 */
function getInitialState(
  numPlayers: number = 2
): { G: GameState; ctx: GameContext; turnStartSnapshot: null; hasMovedThisTurn: false } {
  return {
    G: {
      contracts: [],
      players: Array.from({ length: numPlayers }, (_, i) => [
        String(i),
        {
          name: `Player ${i}`,
          activeCities: [],
          hubCity: null,
          regionalOffice: null,
          avatarColor: generatePlayerAvatarColor(),
        },
      ]),
      independentRailroads: {},
    },
    ctx: {
      phase: 'setup',
      currentPlayer: '0',
      numPlayers: numPlayers,
      playOrder: Array.from({ length: numPlayers }, (_, i) => String(i)),
      playOrderPos: 0,
      turn: 0,
      round: 0,
    },
    turnStartSnapshot: null,
    hasMovedThisTurn: false,
  };
}

/** Deep-clone G and ctx for snapshot/restore so stored snapshot is immutable. */
function cloneState(snapshot: TurnStartSnapshot): TurnStartSnapshot {
  return structuredClone(snapshot);
}

const storeImpl = (
  set: (partial: Partial<GameStoreState> | ((state: GameStoreState) => Partial<GameStoreState>)) => void,
  get: () => GameStoreState
): GameStoreState => ({
  ...getInitialState(),

  resetState: (numPlayers: number = 2) => {
    set({ ...getInitialState(numPlayers) });
  },

  setTurnStartSnapshot: (snapshot: TurnStartSnapshot | null) => {
    set({
      turnStartSnapshot: snapshot ? cloneState(snapshot) : null,
      hasMovedThisTurn: false,
    });
  },

  undoCurrentTurn: () => {
    const state = get();
    const { turnStartSnapshot } = state;
    if (!turnStartSnapshot || turnStartSnapshot.ctx.currentPlayer !== state.ctx.currentPlayer) {
      return;
    }
    const restored = cloneState(turnStartSnapshot);
    set({
      G: restored.G,
      ctx: restored.ctx,
      hasMovedThisTurn: false,
    });
    // Persist so BYOD stays in sync (same pattern as gameActions.saveCurrentGameState)
    const code = getCurrentGameCode();
    if (code) {
      saveGameState(code, restored.G, restored.ctx).catch((error: unknown) => {
        console.error(
          '[undoCurrentTurn] Failed to save game state:',
          error instanceof Error ? error.message : String(error)
        );
      });
    }
  },

  getPlayerContracts: (playerID: string) => {
    const { G } = get();
    return G.contracts.filter((c) => c.playerID === playerID);
  },

  getMarketContracts: () => {
    const { G } = get();
    return G.contracts.filter((c) => c.type === 'market' && c.playerID === null);
  },

  getCurrentPlayer: () => {
    const { G, ctx } = get();
    return G.players.find(([id]) => id === ctx.currentPlayer);
  },

  isMyTurn: (playerID: string) => {
    const { ctx } = get();
    return ctx.currentPlayer === playerID;
  },

  getPlayerActiveCities: (playerID: string) => {
    const { G } = get();
    const player = G.players.find(([id]) => id === playerID);
    return player ? player[1].activeCities : [];
  },
});

export const useGameStore = create(storeImpl);

// Expose store to window for console debugging (development only)
if (typeof window !== 'undefined' && !import.meta.env.PROD) {
  (window as unknown as { __gameStore?: typeof useGameStore }).__gameStore = useGameStore;
  (window as unknown as { __getGameState?: () => GameStoreState }).__getGameState = () =>
    useGameStore.getState();
  console.log('🎮 Game store available in console:');
  console.log('  - window.__gameStore - Zustand store hook');
  console.log('  - window.__getGameState() - Get current state');
}
