/**
 * Events API for Phase 3 (Turn Management)
 * Provides event functions for managing turns and phase transitions.
 */

import { useGameStore } from './gameStore';
import { executeTurnOnEnd } from './phaseConfig';

/**
 * End the current player's turn.
 * Advances to the next player, handles round detection, and executes turn hooks.
 * 
 * Implementation:
 * - Executes phase-specific turn onEnd hook before advancing (e.g., growIndependentRailroads)
 *   The hook itself checks if it's the end of a round
 * - Advances ctx.currentPlayer to next player
 * - Updates ctx.playOrderPos
 * - Increments ctx.turn when wrapping to player 0 (completing a full round)
 * 
 * @returns {void}
 */
export function endTurn() {
  const state = useGameStore.getState();
  const { G, ctx } = state;

  // Execute phase-specific turn onEnd hook before advancing
  // This runs at the end of the current player's turn, before moving to next player
  // For play phase, this calls growIndependentRailroads at end of round
  // The hook receives the current G and ctx, and may mutate G (e.g., growIndependentRailroads)
  executeTurnOnEnd(ctx.phase, G, ctx);

  // Calculate next player position
  const nextPlayOrderPos = (ctx.playOrderPos + 1) % ctx.playOrder.length;
  const nextPlayer = ctx.playOrder[nextPlayOrderPos];

  // Increment turn when wrapping to player 0 (completing a full round)
  const nextTurn = nextPlayOrderPos === 0 ? ctx.turn + 1 : ctx.turn;

  // Update state immutably
  // Note: If turn.onEnd hook mutated G (e.g., growIndependentRailroads), we need to update G as well
  // Since growIndependentRailroads mutates G in place, we create a new reference to trigger re-render
  useGameStore.setState((currentState) => ({
    G: {
      ...currentState.G,
      // Ensure independentRailroads is a new object reference if it was mutated
      independentRailroads: { ...currentState.G.independentRailroads }
    },
    ctx: {
      ...ctx,
      currentPlayer: nextPlayer,
      playOrderPos: nextPlayOrderPos,
      turn: nextTurn
    }
  }));
}
