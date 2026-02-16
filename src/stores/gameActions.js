/**
 * Game action functions that implement game moves.
 * These functions update the Zustand store to modify game state.
 * 
 * Each function accesses state directly from the store and updates it
 * according to game rules and move validation.
 */

import { useGameStore } from './gameStore.ts';
import { isMoveAllowed, isMoveAllowedForPlayer } from './moveValidation';
import { 
  generateStartingContract as generateStartingContractContract,
  generatePrivateContract as generatePrivateContractContract,
  generateMarketContract as generateMarketContractContract,
  newContract
} from '../Contract.ts';
import { endTurn as endTurnEvent } from './events';
import { checkPhaseTransition } from './phaseManager.ts';
import { routes, cities } from '../data';
import { getCurrentGameCode, saveGameState } from '../utils/gameManager';

/**
 * Helper function to save game state to storage after moves
 * Fire-and-forget: doesn't block UI, errors are logged but not thrown
 */
function saveCurrentGameState() {
  const code = getCurrentGameCode();
  if (code) {
    const { G, ctx } = useGameStore.getState();
    saveGameState(code, G, ctx).catch((error) => {
      console.error('[saveCurrentGameState] Failed to save game state:', error.message);
    });
  }
}

/**
 * Generate a starting contract for a player during the setup phase.
 * 
 * @param {Array<string>} activeCities - Array of two starting city keys
 * @returns {void}
 */
export function generateStartingContract(activeCities, playerID) {
  // Get current state from store
  const { G, ctx } = useGameStore.getState();
  // Validate move is allowed in current phase
  const moveAllowed = playerID
    ? isMoveAllowedForPlayer('generateStartingContract', playerID, ctx)
    : isMoveAllowed('generateStartingContract', ctx);
  if (!moveAllowed) {
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
  // Check for phase transition after state update
  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  // Save state to localStorage (after potential phase transition)
  saveCurrentGameState();

  // Automatically end turn after choosing starting cities
  // Note: endTurnEvent() saves state internally, so no need for additional save here
  endTurnEvent();
}

/**
 * Generate a private contract for the current player.
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

  // Save state to localStorage
  saveCurrentGameState();
}

/**
 * Generate a market contract (available to all players).
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

  // Check for phase transition after state update
  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  // Save state to localStorage
  saveCurrentGameState();
}

/**
 * Add a manually created contract.
 * 
 * @param {string} commodity - Commodity name
 * @param {string} destinationKey - Destination city key
 * @param {string} type - Contract type ('private' or 'market')
 * @returns {void}
 */
export function addContract(commodity, destinationKey, type) {
  // Get current state from store
  const { ctx } = useGameStore.getState();

  // Validate move is allowed in current phase
  if (!isMoveAllowed('addContract', ctx)) {
    console.warn('[addContract] Move not allowed in current phase');
    return;
  }

  // Validate parameters
  if (typeof commodity !== 'string' || !commodity) {
    console.error('[addContract] commodity must be a non-empty string');
    return;
  }

  if (typeof destinationKey !== 'string' || !destinationKey) {
    console.error('[addContract] destinationKey must be a non-empty string');
    return;
  }

  if (!['private', 'market'].includes(type)) {
    console.error('[addContract] type must be "private" or "market"');
    return;
  }

  // Create the contract using Contract.js function
  // For private contracts, set playerID to current player; for market contracts, leave it null
  const contract = newContract(destinationKey, commodity, { 
    type: type, 
    playerID: type === 'private' ? ctx.currentPlayer : null 
  });
  
  if (!contract) {
    console.error('[addContract] Contract creation failed');
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

  // Check for phase transition after state update
  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  // Save state to localStorage
  saveCurrentGameState();
}

/**
 * Toggle the fulfilled status of a contract.
 * 
 * @param {string} contractID - ID of the contract to toggle
 * @returns {void}
 */
export function toggleContractFulfilled(contractID) {
  // Get current state from store
  const { G, ctx } = useGameStore.getState();

  // Validate move is allowed in current phase
  if (!isMoveAllowed('toggleContractFulfilled', ctx)) {
    console.warn('[toggleContractFulfilled] Move not allowed in current phase');
    return;
  }

  // Validate contractID parameter
  if (typeof contractID !== 'string' || !contractID) {
    console.error('[toggleContractFulfilled] contractID must be a non-empty string');
    return;
  }

  // Find the contract
  const contractIndex = G.contracts.findIndex(c => c.id === contractID);
  if (contractIndex === -1) {
    console.error(`[toggleContractFulfilled] Contract with ID "${contractID}" not found`);
    return;
  }

  const contract = G.contracts[contractIndex];

  // Only toggle if it's the current player's contract or an unfulfilled market contract
  // or a fulfilled market contract by the current player
  const canToggle = 
    (contract.playerID === ctx.currentPlayer) || 
    (contract.type === 'market' && !contract.fulfilled) ||
    (contract.type === 'market' && contract.fulfilled && contract.playerID === ctx.currentPlayer);

  if (!canToggle) {
    console.warn(`[toggleContractFulfilled] Contract "${contractID}" cannot be toggled by current player`);
    return;
  }

  // Update state immutably
  useGameStore.setState((state) => {
    // Create updated contract with toggled fulfilled status
    const updatedContract = {
      ...contract,
      fulfilled: !contract.fulfilled
    };

    // Handle market contract playerID assignment
    if (updatedContract.fulfilled && updatedContract.type === 'market') {
      updatedContract.playerID = ctx.currentPlayer;
    } else if (!updatedContract.fulfilled && updatedContract.type === 'market') {
      updatedContract.playerID = null;
    }

    // Update contracts array with the modified contract
    const updatedContracts = state.G.contracts.map((c, idx) => 
      idx === contractIndex ? updatedContract : c
    );

    // Get current player's data
    const currentPlayerEntry = state.G.players.find(([id]) => id === ctx.currentPlayer);
    if (!currentPlayerEntry) {
      console.error(`[toggleContractFulfilled] Current player "${ctx.currentPlayer}" not found`);
      return state; // Return unchanged state on error
    }

    const [, playerProps] = currentPlayerEntry;
    let updatedActiveCities = [...playerProps.activeCities];

    if (updatedContract.fulfilled) {
      // Add the destination city to this player's active cities if it's not already there
      if (!updatedActiveCities.includes(updatedContract.destinationKey)) {
        updatedActiveCities = [...updatedActiveCities, updatedContract.destinationKey];
      }
    } else {
      // Remove the destination city from this player's active cities if this was their only fulfilled contract with it
      const hasOtherFulfilledContract = updatedContracts.some(c => 
        c.id !== contractID &&
        c.playerID === ctx.currentPlayer &&
        c.fulfilled &&
        c.destinationKey === updatedContract.destinationKey
      );

      if (!hasOtherFulfilledContract) {
        // Remove all instances of this city (in case of duplicates)
        updatedActiveCities = updatedActiveCities.filter(
          city => city !== updatedContract.destinationKey
        );
      }
    }

    // Update players array with modified active cities
    const updatedPlayers = state.G.players.map(([id, props]) =>
      id === ctx.currentPlayer
        ? [id, { ...props, activeCities: updatedActiveCities }]
        : [id, props]
    );

    return {
      G: {
        ...state.G,
        contracts: updatedContracts,
        players: updatedPlayers
      }
    };
  });

  // Check for phase transition after state update
  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  // Save state to localStorage
  saveCurrentGameState();
}

/**
 * Delete an unfulfilled contract.
 * 
 * @param {string} contractID - ID of the contract to delete
 * @returns {void}
 */
export function deleteContract(contractID) {
  // Get current state from store
  const { G, ctx } = useGameStore.getState();

  // Validate move is allowed in current phase
  if (!isMoveAllowed('deleteContract', ctx)) {
    console.warn('[deleteContract] Move not allowed in current phase');
    return;
  }

  // Validate contractID parameter
  if (typeof contractID !== 'string' || !contractID) {
    console.error('[deleteContract] contractID must be a non-empty string');
    return;
  }

  // Find the contract
  const contractIndex = G.contracts.findIndex(c => c.id === contractID);
  if (contractIndex === -1) {
    console.error(`[deleteContract] Contract with ID "${contractID}" not found`);
    return;
  }

  const contract = G.contracts[contractIndex];

  // Only delete if the contract is not fulfilled
  if (contract.fulfilled) {
    console.warn(`[deleteContract] Cannot delete fulfilled contract "${contractID}"`);
    return;
  }

  // Update state immutably by removing the contract
  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      contracts: state.G.contracts.filter((c, idx) => idx !== contractIndex)
    }
  }));

  // Check for phase transition after state update
  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  // Save state to localStorage
  saveCurrentGameState();
}

/**
 * Acquire an independent railroad for the current player.
 * 
 * @param {string} railroadName - Name of the independent railroad to acquire
 * @returns {void}
 */
export function acquireIndependentRailroad(railroadName) {
  // Get current state from store
  const { G, ctx } = useGameStore.getState();

  // Validate move is allowed in current phase
  if (!isMoveAllowed('acquireIndependentRailroad', ctx)) {
    console.warn('[acquireIndependentRailroad] Move not allowed in current phase');
    return;
  }

  // Validate railroadName parameter
  if (typeof railroadName !== 'string' || !railroadName) {
    console.error('[acquireIndependentRailroad] railroadName must be a non-empty string');
    return;
  }

  // Validate railroad exists
  const railroad = G.independentRailroads[railroadName];
  if (!railroad) {
    console.error(`[acquireIndependentRailroad] Railroad "${railroadName}" not found`);
    return;
  }

  // Get all the cities in this railroad from its routes
  const citiesInRailroad = new Set();
  railroad.routes.forEach(routeKey => {
    const route = routes.get(routeKey);
    if (route && route.cities) {
      route.cities.forEach(city => citiesInRailroad.add(city));
    }
  });

  // Update state immutably
  useGameStore.setState((state) => {
    // Get current player's data
    const currentPlayerEntry = state.G.players.find(([id]) => id === ctx.currentPlayer);
    if (!currentPlayerEntry) {
      console.error(`[acquireIndependentRailroad] Current player "${ctx.currentPlayer}" not found`);
      return state; // Return unchanged state on error
    }

    const [, playerProps] = currentPlayerEntry;
    
    // Add all cities from the railroad to current player's active cities
    // Use Set to avoid duplicates, then convert back to array
    const updatedActiveCities = Array.from(new Set([
      ...playerProps.activeCities,
      ...citiesInRailroad
    ]));

    // Update players array with modified active cities
    const updatedPlayers = state.G.players.map(([id, props]) =>
      id === ctx.currentPlayer
        ? [id, { ...props, activeCities: updatedActiveCities }]
        : [id, props]
    );

    // Remove the railroad from independentRailroads using destructuring
    const { [railroadName]: _removed, ...restRailroads } = state.G.independentRailroads;

    return {
      G: {
        ...state.G,
        players: updatedPlayers,
        independentRailroads: restRailroads
      }
    };
  });

  // Check for phase transition after state update
  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  // Save state to localStorage
  saveCurrentGameState();
}

/**
 * Add a city to the current player's active cities.
 * 
 * @param {string} cityKey - City key to add
 * @returns {void}
 */
export function addCityToPlayer(cityKey) {
  // Get current state from store
  const { G, ctx } = useGameStore.getState();

  // Validate move is allowed in current phase
  if (!isMoveAllowed('addCityToPlayer', ctx)) {
    console.warn('[addCityToPlayer] Move not allowed in current phase');
    return;
  }

  // Validate cityKey parameter
  if (typeof cityKey !== 'string' || !cityKey) {
    console.error('[addCityToPlayer] cityKey must be a non-empty string');
    return;
  }

  // Validate city exists
  if (!cities.get(cityKey)) {
    console.error(`[addCityToPlayer] City "${cityKey}" not found`);
    return;
  }

  // Get current player's data
  const currentPlayerEntry = G.players.find(([id]) => id === ctx.currentPlayer);
  if (!currentPlayerEntry) {
    console.error(`[addCityToPlayer] Current player "${ctx.currentPlayer}" not found`);
    return;
  }

  const [, playerProps] = currentPlayerEntry;
  
  // Check if city is already in player's active cities
  if (playerProps.activeCities.includes(cityKey)) {
    console.warn(`[addCityToPlayer] City "${cityKey}" is already in player's active cities`);
    return;
  }

  // Update state immutably
  useGameStore.setState((state) => {
    const updatedPlayers = state.G.players.map(([id, props]) =>
      id === ctx.currentPlayer
        ? [id, { ...props, activeCities: [...props.activeCities, cityKey] }]
        : [id, props]
    );

    return {
      G: {
        ...state.G,
        players: updatedPlayers
      }
    };
  });

  // Check for phase transition after state update
  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  // Save state to localStorage
  saveCurrentGameState();
}

/**
 * End the current player's turn.
 * 
 * @returns {void}
 */
export function endTurn() {
  // Get current state from store
  const { ctx } = useGameStore.getState();

  // Validate move is allowed in current phase
  if (!isMoveAllowed('endTurn', ctx)) {
    console.warn('[endTurn] Move not allowed in current phase');
    return;
  }

  // Call the events.endTurn() to advance turn
  endTurnEvent();

  // Save state to localStorage after turn ends
  saveCurrentGameState();
}
