/**
 * Move validation module
 * Validates that moves are allowed in the current phase and turn
 */

/**
 * Map of moves allowed in each phase
 * @type {Object<string, Array<string>>}
 */
const MOVES_BY_PHASE = {
  setup: [
    'generateStartingContract'
  ],
  play: [
    'generatePrivateContract',
    'generateMarketContract',
    'addContract',
    'toggleContractFulfilled',
    'deleteContract',
    'acquireIndependentRailroad',
    'addCityToPlayer',
    'endTurn'
  ],
  scoring: [
    // No moves allowed in scoring phase (stub)
  ]
};

/**
 * Check if a move is allowed in the current phase
 * @param {string} moveName - Name of the move to validate
 * @param {string} phase - Current phase name ('setup', 'play', 'scoring')
 * @returns {boolean} True if move is allowed in this phase
 */
export function isMoveAllowedInPhase(moveName, phase) {
  const allowedMoves = MOVES_BY_PHASE[phase];
  if (!allowedMoves) {
    console.warn(`[moveValidation] Unknown phase: ${phase}`);
    return false;
  }
  return allowedMoves.includes(moveName);
}

/**
 * Check if it's the correct player's turn
 * @param {string} playerID - Player ID attempting the move
 * @param {string} currentPlayer - Current player ID from ctx
 * @returns {boolean} True if it's the correct player's turn
 */
export function isCorrectPlayerTurn(playerID, currentPlayer) {
  return playerID === currentPlayer;
}

/**
 * Validate that a move is allowed in the current phase
 * @param {string} moveName - Name of the move to validate
 * @param {Object} ctx - Game context object
 * @returns {boolean} True if move is allowed
 */
export function isMoveAllowed(moveName, ctx) {
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
 * @param {string} moveName - Name of the move to validate
 * @param {string} playerID - Player ID attempting the move
 * @param {Object} ctx - Game context object
 * @returns {boolean} True if move is allowed and it's the correct turn
 */
export function isMoveAllowedForPlayer(moveName, playerID, ctx) {
  if (!isMoveAllowed(moveName, ctx)) {
    return false;
  }

  if (!playerID) {
    console.error('[moveValidation] playerID is required');
    return false;
  }

  if (!ctx.currentPlayer) {
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
