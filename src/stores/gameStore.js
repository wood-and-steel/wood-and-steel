import { create } from 'zustand';
import { initializeIndependentRailroads } from '../independentRailroads';

/**
 * @typedef {Object} Contract
 * @property {string} id - unique ID of the contract
 * @property {string} destinationKey
 * @property {string} commodity
 * @property {boolean} fulfilled
 * @property {string|null} playerID
 * @property {string} type - 'private' or 'market'
 */

/**
 * @typedef {Object} PlayerProps
 * @property {string} name
 * @property {Array<string>} activeCities
 */

/**
 * Initial game state (G) structure
 * @typedef {Object} GameState
 * @property {Array<Contract>} contracts - All contracts in the game
 * @property {Array<[string, PlayerProps]>} players - Array of [playerID, playerData] tuples
 * @property {Object} independentRailroads - Map of railroad name to railroad data
 */

/**
 * Initial context (ctx) structure
 * Mirrors boardgame.io's ctx object, excluding internal properties (prefixed with underscore)
 * @typedef {Object} GameContext
 * @property {string} phase - Current phase name ('setup', 'play', 'scoring')
 * @property {string} currentPlayer - ID of player whose turn it is ('0', '1', etc.)
 * @property {number} numPlayers - Total number of players (2)
 * @property {Array<string>} playOrder - Array of player IDs in turn order
 * @property {number} playOrderPos - Index in playOrder for current player
 * @property {number} turn - Current turn number
 * @property {number} [numMoves] - Number of moves made in current turn
 * @property {*} [*] - Additional public ctx properties from boardgame.io
 */

/**
 * Initial state factory
 * @param {number} numPlayers - Number of players (default: 2)
 * @returns {{G: GameState, ctx: GameContext}}
 */
function getInitialState(numPlayers = 2) {
  const independentRailroads = initializeIndependentRailroads();

  return {
    G: {
      contracts: [],
      players: Array.from({ length: numPlayers }, (_, i) => [
        String(i),
        { name: `Player ${i}`, activeCities: [] }
      ]),
      independentRailroads: independentRailroads,
    },
    ctx: {
      phase: 'setup',
      currentPlayer: '0',
      numPlayers: numPlayers,
      playOrder: Array.from({ length: numPlayers }, (_, i) => String(i)),
      playOrderPos: 0,
      turn: 0,
    }
  };
}

/**
 * Zustand store for game state
 * Mirrors boardgame.io's G and ctx structures
 */
export const useGameStore = create((set, get) => ({
  // Initial state
  ...getInitialState(),

  /**
   * Sync state from boardgame.io Client
   * One-way synchronization: bgio → Zustand
   * Copies all ctx properties except internal ones (prefixed with underscore)
   * @param {GameState} G - Game state from bgio
   * @param {GameContext} ctx - Context from bgio
   */
  syncFromBgio: (G, ctx) => {
    // Copy all ctx properties except internal ones (prefixed with underscore)
    const publicCtx = Object.fromEntries(
      Object.entries(ctx || {}).filter(([key]) => !key.startsWith('_'))
    );
    
    // Deep clone arrays and objects in ctx to ensure immutability
    const syncedCtx = {
      ...publicCtx,
      playOrder: [...(publicCtx.playOrder || [])],
    };

    set({
      G: {
        contracts: [...(G.contracts || [])],
        players: (G.players || []).map(([id, props]) => [
          id,
          {
            name: props.name,
            activeCities: [...(props.activeCities || [])]
          }
        ]),
        independentRailroads: { ...(G.independentRailroads || {}) }
      },
      ctx: syncedCtx
    });
  },

  /**
   * Reset state to initial values
   * @param {number} numPlayers - Number of players (default: 2)
   */
  resetState: (numPlayers = 2) => {
    set(getInitialState(numPlayers));
  },

  // Selector functions

  /**
   * Get all contracts for a specific player
   * @param {string} playerID - Player ID
   * @returns {Array<Contract>}
   */
  getPlayerContracts: (playerID) => {
    const { G } = get();
    return G.contracts.filter(c => c.playerID === playerID);
  },

  /**
   * Get all market contracts (contracts with type 'market')
   * @returns {Array<Contract>}
   */
  getMarketContracts: () => {
    const { G } = get();
    return G.contracts.filter(c => c.type === 'market');
  },

  /**
   * Get current player data
   * @returns {[string, PlayerProps]|undefined}
   */
  getCurrentPlayer: () => {
    const { G, ctx } = get();
    return G.players.find(([id]) => id === ctx.currentPlayer);
  },

  /**
   * Check if it's a specific player's turn
   * @param {string} playerID - Player ID to check
   * @returns {boolean}
   */
  isMyTurn: (playerID) => {
    const { ctx } = get();
    return ctx.currentPlayer === playerID;
  },

  /**
   * Get active cities for a specific player
   * @param {string} playerID - Player ID
   * @returns {Array<string>}
   */
  getPlayerActiveCities: (playerID) => {
    const { G } = get();
    const player = G.players.find(([id]) => id === playerID);
    return player ? player[1].activeCities : [];
  },
}));

// Expose store to window for console debugging (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  window.__gameStore = useGameStore;
  window.__getGameState = () => useGameStore.getState();
  console.log('🎮 Game store available in console:');
  console.log('  - window.__gameStore - Zustand store hook');
  console.log('  - window.__getGameState() - Get current state');
  console.log('  - Use: import { compareStates, logStateComparison } from "./utils/stateDebug"');
}