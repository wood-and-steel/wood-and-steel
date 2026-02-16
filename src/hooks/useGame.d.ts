import type { GameState, GameContext } from '../stores/gameStore';
import type { Moves } from '../stores/moves';

/** Moves object returned by useGame; same as store Moves. */
export type GameMoves = Moves;

export interface UseGameReturn {
  G: GameState;
  ctx: GameContext;
  moves: Moves;
  playerID: string | null;
}

export function useGame(expectedPlayerID?: string): UseGameReturn;
