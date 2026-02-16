import { useGameContext } from '../providers/GameProvider';
import type { GameContextValue } from '../providers/GameProvider';

/**
 * Hook that provides easy access to game state and moves.
 *
 * Returns: G, ctx, moves, playerID.
 *
 * @param expectedPlayerID - Optional player ID to validate against provider's playerID (warns only)
 * @returns { G, ctx, moves, playerID }
 * @throws If used outside GameProvider
 */
export function useGame(expectedPlayerID?: string): GameContextValue {
  const context = useGameContext();

  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }

  const { G, ctx, moves, playerID } = context;

  if (expectedPlayerID !== undefined && expectedPlayerID !== playerID) {
    console.warn(
      `useGame: Expected playerID "${expectedPlayerID}" but provider has "${playerID}"`
    );
  }

  return { G, ctx, moves, playerID };
}
