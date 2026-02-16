import type { GameState, GameContext } from '../stores/gameStore';

/** Moves object shape returned by useGame (subset used by Board and other consumers). */
export interface GameMoves {
  generateStartingContract: (pair: [string, string], playerID: string) => void;
  generateMarketContract: () => void;
  addContract: (commodity: string, destinationKey: string, type: string) => void;
  toggleContractFulfilled: (contractId: string) => void;
  deleteContract: (contractId: string) => void;
  endTurn: () => void;
  acquireIndependentRailroad: (railroadName: string) => void;
  [key: string]: (...args: unknown[]) => unknown;
}

export interface UseGameReturn {
  G: GameState;
  ctx: GameContext;
  moves: GameMoves;
  playerID: string | null;
}

export function useGame(expectedPlayerID?: string): UseGameReturn;
