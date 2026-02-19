/**
 * Provides event functions for managing turns and phase transitions.
 */

import { useGameStore } from './gameStore';
import { executeTurnOnEnd } from './phaseConfig';
import { getCurrentGameCode, saveGameState } from '../utils/gameManager';

/**
 * End the current player's turn.
 * Advances to the next player, handles round detection, and executes turn hooks.
 */
export function endTurn(): void {
  const state = useGameStore.getState();
  const { G, ctx } = state;

  executeTurnOnEnd(ctx.phase, G, ctx);

  const nextPlayOrderPos = (ctx.playOrderPos + 1) % ctx.playOrder.length;
  const nextPlayer = ctx.playOrder[nextPlayOrderPos];

  const nextTurn = nextPlayOrderPos === 0 ? ctx.turn + 1 : ctx.turn;

  // Update state immutably
  // Note: If turn.onEnd hook mutated G, we need to update G as well
  useGameStore.setState((currentState) => ({
    G: {
      ...currentState.G,
      // Ensure independentRailroads is a new object reference if it was mutated by growIndependentRailroads
      independentRailroads: { ...currentState.G.independentRailroads },
    },
    ctx: {
      ...ctx,
      currentPlayer: nextPlayer,
      playOrderPos: nextPlayOrderPos,
      turn: nextTurn,
    },
  }));

  // Save state after turn change
  const gameCode = getCurrentGameCode();
  if (gameCode) {
    const updatedState = useGameStore.getState();
    saveGameState(gameCode, updatedState.G, updatedState.ctx).catch((error: unknown) => {
      console.error(
        '[endTurn] Failed to save game state:',
        error instanceof Error ? error.message : String(error)
      );
    });
  }
}
