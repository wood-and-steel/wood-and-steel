import { create } from 'zustand';
import type { Contract } from '../Contract';
import { getCurrentGameCode, saveGameState } from '../utils/gameManager';
import { getPlayerAvatarColorForIndex } from '../utils/playerAvatar';
import type { CargoPair, EngineTypePair, PlayerUpgradeId } from '../rules/playerBoard';
import { newPlayerProps } from './playerDefaults';

export type RegionCode = 'NW' | 'NC' | 'NE' | 'SW' | 'SC' | 'SE';

/**
 * What the tabletop player board used to track, plus money (docs/PLAYER_APP_REDESIGN_PLAN.md,
 * Data model). Start values and normalization of old saves are in playerDefaults.ts.
 */
export interface PlayerBoardFields {
  /** Dollars; never negative. */
  cash: number;
  /** Dollars, in $5,000 steps. */
  debt: number;
  /** Engine type on the light and dark tokens. */
  engines: EngineTypePair;
  /** Commodity each engine carries, if the player recorded it (optional; null = not recorded). */
  cargo: CargoPair;
  upgrades: PlayerUpgradeId[];
  /** The commodity a Commodities Exchange covers, once bought. */
  exchangeCommodity: string | null;
  /** A delivery to a Central region has been made (its one-time debt service is settled). */
  centralDebtServicePaid: boolean;
  /** A delivery to a Western region has been made; debt service is due on every delivery from then on. */
  westernDeliveryMade: boolean;
}

export interface PlayerProps extends PlayerBoardFields {
  name: string;
  activeCities: string[];
  hubCity: string | null;
  regionalOffice: RegionCode | null;
  avatarColor?: string;
}

/** One change to a player's cash or debt this turn, for the money log. */
export interface LedgerEntry {
  label: string;
  /** Dollars; positive adds to cash. */
  amount: number;
}

/** The current player's money changes this turn; cleared when the turn ends. */
export interface TurnLedger {
  playerID: string;
  entries: LedgerEntry[];
}

/** A contract named in the round report; kept as a copy since expired contracts leave `contracts`. */
export interface ReportedContract {
  id: string;
  commodity: string;
  destinationKey: string;
}

/** What changed at the end of the last round, for the round report. */
export interface RoundReport {
  /** The round that just ended. */
  round: number;
  /** Railroad name -> route keys it gained. */
  routesAdded: Record<string, string[]>;
  marketExpired: ReportedContract[];
  marketAdded: ReportedContract[];
  /** Open market contracts that entered their last round at this round end. */
  marketLastRound: ReportedContract[];
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
  /**
   * Market round-ends in a row with no expiration countdown started.
   * Absent until the market opens (first round-end with any open market contract).
   */
  marketRoundsWithoutExpirationStart?: number;
  /** Money changes in the current turn. Absent until the first one. */
  turnLedger?: TurnLedger;
  /** What changed at the last round end. Absent until a round ends. */
  roundReport?: RoundReport;
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
        newPlayerProps(`Player ${i}`, getPlayerAvatarColorForIndex(i)),
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
    // Persist so other devices stay in sync (same pattern as gameActions.saveCurrentGameState)
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
