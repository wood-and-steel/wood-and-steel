import { useGameContext } from '../providers/GameProvider';

/**
 * Hook that provides easy access to game state and moves
 * 
 * Returns:
 * - G: Game state
 * - ctx: Game context (phase, currentPlayer, etc.)
 * - moves: Object containing all available moves
 * - playerID: Current player ID
 * 
 * @param {string} [expectedPlayerID] - Optional player ID to validate against provider's playerID
 * @returns {Object} { G, ctx, moves, playerID }
 * @throws {Error} If used outside GameProvider or if playerID doesn't match
 */
export function useGame(expectedPlayerID) {
  const context = useGameContext();

  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }

  const { G, ctx, moves, playerID } = context;

  // Optional validation: warn if expected playerID doesn't match
  if (expectedPlayerID !== undefined && expectedPlayerID !== playerID) {
    console.warn(
      `useGame: Expected playerID "${expectedPlayerID}" but provider has "${playerID}"`
    );
  }

  return { G, ctx, moves, playerID };
}
