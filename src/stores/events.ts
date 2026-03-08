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

  // Update state immutably; set turn-start snapshot for the next player so they can undo their turn
  // Note: If turn.onEnd hook mutated G, we need to update G as well
  useGameStore.setState((currentState) => {
    const newG = {
      ...currentState.G,
      independentRailroads: { ...currentState.G.independentRailroads },
    };
    const newCtx = {
      ...ctx,
      currentPlayer: nextPlayer,
      playOrderPos: nextPlayOrderPos,
      turn: nextTurn,
    };
    return {
      G: newG,
      ctx: newCtx,
      turnStartSnapshot: structuredClone({ G: newG, ctx: newCtx }),
      hasMovedThisTurn: false,
    };
  });

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
