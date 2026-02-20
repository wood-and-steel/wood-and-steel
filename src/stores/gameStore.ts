import { create } from 'zustand';
import type { Contract } from '../Contract';

export interface PlayerProps {
  name: string;
  activeCities: string[];
}

export interface GameState {
  contracts: Contract[];
  players: [string, PlayerProps][];
  independentRailroads: Record<string, { name: string; routes: string[] }>;
  /** Set when host starts a BYOD game (all players joined). */
  byodGameStarted?: boolean;
}

/** Game context (ctx): phase, player, turn info. All player references are by ID. */
export interface GameContext {
  /** Current phase name (e.g. 'setup', 'play', 'scoring'). */
  phase: string;
  currentPlayer: string;
  numPlayers: number;
  playOrder: string[];
  playOrderPos: number;
  turn: number;
  numMoves?: number;
}

/** Full store state: G, ctx, and methods. */
export interface GameStoreState {
  G: GameState;
  ctx: GameContext;
  resetState: (numPlayers?: number) => void;
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
function getInitialState(numPlayers: number = 2): { G: GameState; ctx: GameContext } {
  return {
    G: {
      contracts: [],
      players: Array.from({ length: numPlayers }, (_, i) => [
        String(i),
        { name: `Player ${i}`, activeCities: [] },
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
    },
  };
}

const storeImpl = (
  set: (partial: Partial<GameStoreState> | ((state: GameStoreState) => Partial<GameStoreState>)) => void,
  get: () => GameStoreState
): GameStoreState => ({
  ...getInitialState(),

  resetState: (numPlayers: number = 2) => {
    set(getInitialState(numPlayers));
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
