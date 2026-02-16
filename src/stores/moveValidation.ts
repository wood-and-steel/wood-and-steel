/**
 * Move validation module
 * Validates that moves are allowed in the current phase and turn
 */

/** Phase names. */
export type PhaseName = 'setup' | 'play' | 'scoring';

/** Map of moves allowed in each phase. */
const MOVES_BY_PHASE: Record<PhaseName, readonly string[]> = {
  setup: ['generateStartingContract'],
  play: [
    'generatePrivateContract',
    'generateMarketContract',
    'addContract',
    'toggleContractFulfilled',
    'deleteContract',
    'acquireIndependentRailroad',
    'addCityToPlayer',
    'endTurn',
  ],
  scoring: [],
};

/**
 * Check if a move is allowed in the current phase
 */
export function isMoveAllowedInPhase(moveName: string, phase: string): boolean {
  const allowedMoves = MOVES_BY_PHASE[phase as PhaseName];
  if (!allowedMoves) {
    console.warn(`[moveValidation] Unknown phase: ${phase}`);
    return false;
  }
  return (allowedMoves as readonly string[]).includes(moveName);
}

/**
 * Check if it's the correct player's turn
 */
export function isCorrectPlayerTurn(playerID: string, currentPlayer: string): boolean {
  return playerID === currentPlayer;
}

/** Minimal ctx shape needed for move validation. */
export interface CtxForValidation {
  phase: string;
  currentPlayer?: string;
}

/**
 * Validate that a move is allowed in the current phase
 */
export function isMoveAllowed(moveName: string, ctx: CtxForValidation | null | undefined): boolean {
  if (!ctx) {
    console.error('[moveValidation] ctx is required');
    return false;
  }

  if (!ctx.phase) {
    console.error('[moveValidation] ctx.phase is required');
    return false;
  }

  if (!moveName) {
    console.error('[moveValidation] moveName is required');
    return false;
  }

  const phaseAllowed = isMoveAllowedInPhase(moveName, ctx.phase);
  if (!phaseAllowed) {
    console.warn(
      `[moveValidation] Move "${moveName}" is not allowed in phase "${ctx.phase}"`
    );
    return false;
  }

  return true;
}

/**
 * Validate that a move is allowed and it's the correct player's turn
 */
export function isMoveAllowedForPlayer(
  moveName: string,
  playerID: string,
  ctx: CtxForValidation | null | undefined
): boolean {
  if (!isMoveAllowed(moveName, ctx)) {
    return false;
  }

  if (!playerID) {
    console.error('[moveValidation] playerID is required');
    return false;
  }

  if (ctx?.currentPlayer == null || ctx.currentPlayer === '') {
    console.error('[moveValidation] ctx.currentPlayer is required');
    return false;
  }

  const correctTurn = isCorrectPlayerTurn(playerID, ctx.currentPlayer);
  if (!correctTurn) {
    console.warn(
      `[moveValidation] Move "${moveName}" attempted by player "${playerID}" but current player is "${ctx.currentPlayer}"`
    );
    return false;
  }

  return true;
}
