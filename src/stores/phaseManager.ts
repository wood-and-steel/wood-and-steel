import { useGameStore } from './gameStore';
import { getPhaseConfig, executePhaseOnEnd,PhaseConfigEntry } from './phaseConfig';
import { getCurrentGameCode, saveGameState } from '../utils/gameManager';
import type { GameState, GameContext } from './gameStore';

/**
 * Check if the current phase should end and transition to the next phase.
 * Evaluates the phase's endIf condition, runs onEnd hook, updates state, and persists.
 * @returns true if a phase transition occurred, false otherwise.
 */
export function checkPhaseTransition(G: GameState, ctx: GameContext): boolean {
  const currentPhaseConfig: PhaseConfigEntry | undefined = getPhaseConfig(ctx.phase);

  if (!currentPhaseConfig) {
    console.warn(`[checkPhaseTransition] Unknown phase: ${ctx.phase}`);
    return false;
  }

  const endIfResult = currentPhaseConfig.endIf
    ? currentPhaseConfig.endIf({ G, ctx })
    : false;

  if (!endIfResult) {
    return false;
  }

  const nextPhase = currentPhaseConfig.next;

  if (!nextPhase) {
    console.warn(
      `[checkPhaseTransition] Phase ${ctx.phase} has no next phase defined`
    );
    return false;
  }

  // Run current phase's onEnd hook before switching phase
  executePhaseOnEnd(ctx.phase, G, ctx);

  // Update store: next phase; spread currentState so any onEnd mutations to G are kept
  useGameStore.setState((currentState) => ({
    G: { ...currentState.G },
    ctx: {
      ...currentState.ctx,
      phase: nextPhase,
    },
  }));

  // Persist state after transition (when we have a game code, e.g. BYOD)
  const gameCode = getCurrentGameCode();
  if (gameCode) {
    const updatedState = useGameStore.getState();
    saveGameState(gameCode, updatedState.G, updatedState.ctx).catch((error) => {
      console.error(
        '[checkPhaseTransition] Failed to save game state:',
        (error as Error).message
      );
    });
  }

  console.log(
    `[checkPhaseTransition] Phase transition: ${ctx.phase} → ${nextPhase}`
  );
  return true;
}
