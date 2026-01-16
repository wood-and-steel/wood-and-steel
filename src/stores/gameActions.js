/**
 * Game action stubs that mirror the move structure from Game.js
 * These functions are initially stubs that don't modify state.
 * They will be implemented in future phases to update the Zustand store.
 * 
 * Each function mirrors the corresponding move from Game.js but without
 * the boardgame.io context objects (G, ctx, events).
 */

import { useGameStore } from './gameStore';
import { isMoveAllowed } from './moveValidation';
import { 
  generateStartingContract as generateStartingContractContract,
  generatePrivateContract as generatePrivateContractContract,
  generateMarketContract as generateMarketContractContract,
  newContract
} from '../Contract';
import { endTurn as endTurnEvent } from './events';

/**
 * Generate a starting contract for a player during the setup phase.
 * Mirrors: setup.moves.generateStartingContract
 * 
 * @param {Array<string>} activeCities - Array of two starting city keys
 * @returns {void}
 */
export function generateStartingContract(activeCities) {
  // Get current state from store
  const { G, ctx } = useGameStore.getState();

  // Validate move is allowed in current phase
  if (!isMoveAllowed('generateStartingContract', ctx)) {
    console.warn('[generateStartingContract] Move not allowed in current phase');
    return;
  }

  // Validate activeCities parameter
  if (!Array.isArray(activeCities) || activeCities.length !== 2) {
    console.error('[generateStartingContract] activeCities must be an array of 2 city keys');
    return;
  }

  // Generate the contract using Contract.js function
  const contract = generateStartingContractContract(G, activeCities, ctx.currentPlayer);
  
  if (!contract) {
    console.error('[generateStartingContract] Contract generation failed');
    return;
  }

  // Update state immutably
  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      // Add contract to beginning of contracts array
      contracts: [contract, ...state.G.contracts],
      // Update current player's activeCities
      players: state.G.players.map(([id, props]) =>
        id === ctx.currentPlayer
          ? [id, { ...props, activeCities: [...activeCities] }]
          : [id, props]
      )
    }
  }));

  // Automatically end turn after choosing starting cities
  endTurnEvent();
}

/**
 * Generate a private contract for the current player.
 * Mirrors: play.moves.generatePrivateContract
 * 
 * @returns {void}
 */
export function generatePrivateContract() {
  // Get current state from store
  const { G, ctx } = useGameStore.getState();

  // Validate move is allowed in current phase
  if (!isMoveAllowed('generatePrivateContract', ctx)) {
    console.warn('[generatePrivateContract] Move not allowed in current phase');
    return;
  }

  // Generate the contract using Contract.js function
  const contract = generatePrivateContractContract(G, ctx);
  
  if (!contract) {
    console.error('[generatePrivateContract] Contract generation failed');
    return;
  }

  // Update state immutably
  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      // Add contract to beginning of contracts array
      contracts: [contract, ...state.G.contracts]
    }
  }));
}

/**
 * Generate a market contract (available to all players).
 * Mirrors: play.moves.generateMarketContract
 * 
 * @returns {void}
 */
export function generateMarketContract() {
  // Get current state from store
  const { G, ctx } = useGameStore.getState();

  // Validate move is allowed in current phase
  if (!isMoveAllowed('generateMarketContract', ctx)) {
    console.warn('[generateMarketContract] Move not allowed in current phase');
    return;
  }

  // Generate the contract using Contract.js function
  const contract = generateMarketContractContract(G);
  
  if (!contract) {
    console.error('[generateMarketContract] Contract generation failed');
    return;
  }

  // Update state immutably
  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      // Add contract to beginning of contracts array
      contracts: [contract, ...state.G.contracts]
    }
  }));
}

/**
 * Add a manually created contract.
 * Mirrors: play.moves.addManualContract
 * 
 * @param {string} commodity - Commodity name
 * @param {string} destinationKey - Destination city key
 * @param {string} type - Contract type ('private' or 'market')
 * @returns {void}
 */
export function addManualContract(commodity, destinationKey, type) {
  // Get current state from store
  const { ctx } = useGameStore.getState();

  // Validate move is allowed in current phase
  if (!isMoveAllowed('addManualContract', ctx)) {
    console.warn('[addManualContract] Move not allowed in current phase');
    return;
  }

  // Validate parameters
  if (typeof commodity !== 'string' || !commodity) {
    console.error('[addManualContract] commodity must be a non-empty string');
    return;
  }

  if (typeof destinationKey !== 'string' || !destinationKey) {
    console.error('[addManualContract] destinationKey must be a non-empty string');
    return;
  }

  if (!['private', 'market'].includes(type)) {
    console.error('[addManualContract] type must be "private" or "market"');
    return;
  }

  // Create the contract using Contract.js function
  // For private contracts, set playerID to current player; for market contracts, leave it null
  const contract = newContract(destinationKey, commodity, { 
    type: type, 
    playerID: type === 'private' ? ctx.currentPlayer : null 
  });
  
  if (!contract) {
    console.error('[addManualContract] Contract creation failed');
    return;
  }

  // Update state immutably
  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      // Add contract to beginning of contracts array
      contracts: [contract, ...state.G.contracts]
    }
  }));
}

/**
 * Toggle the fulfilled status of a contract.
 * Mirrors: play.moves.toggleContractFulfilled
 * 
 * @param {string} contractID - ID of the contract to toggle
 * @returns {void}
 */
export function toggleContractFulfilled(contractID) {
  // Stub: Will be implemented to toggle fulfilled status
  // and update player active cities accordingly using the store's G and ctx
  console.log('[STUB] toggleContractFulfilled called with:', contractID);
}

/**
 * Delete an unfulfilled contract.
 * Mirrors: play.moves.deleteContract
 * 
 * @param {string} contractID - ID of the contract to delete
 * @returns {void}
 */
export function deleteContract(contractID) {
  // Stub: Will be implemented to remove a contract from the store's G.contracts
  // Only works if the contract is not fulfilled
  console.log('[STUB] deleteContract called with:', contractID);
}

/**
 * Acquire an independent railroad for the current player.
 * Mirrors: play.moves.acquireIndependentRailroad
 * 
 * @param {string} railroadName - Name of the independent railroad to acquire
 * @returns {void}
 */
export function acquireIndependentRailroad(railroadName) {
  // Stub: Will be implemented to:
  // 1. Validate railroad exists in store's G.independentRailroads
  // 2. Add all cities in the railroad to current player's activeCities
  // 3. Remove the railroad from G.independentRailroads
  console.log('[STUB] acquireIndependentRailroad called with:', railroadName);
}

/**
 * End the current player's turn.
 * Mirrors: play.moves.endTurn
 * 
 * @returns {void}
 */
export function endTurn() {
  // Stub: Will be implemented to advance to the next player
  // by updating ctx.currentPlayer, ctx.playOrderPos, and ctx.turn
  console.log('[STUB] endTurn called');
}
