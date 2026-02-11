import {
  generateStartingContract,
  generatePrivateContract,
  generateMarketContract,
  addContract,
  toggleContractFulfilled,
  deleteContract,
  acquireIndependentRailroad,
  addCityToPlayer,
  endTurn
} from './gameActions';

/**
 * Moves API object that provides a consistent interface for game moves.
 * Components can use `moves.moveName(args)` to execute game actions.
 * 
 * @param {Object} store - Zustand store instance (for future flexibility, currently unused)
 * @returns {Object} Object containing all available moves
 */

export const createMoves = (store) => ({
  generateStartingContract: (activeCities, playerID) => 
    generateStartingContract(activeCities, playerID),
  
  generatePrivateContract: () => 
    generatePrivateContract(),
  
  generateMarketContract: () => 
    generateMarketContract(),
  
  addContract: (commodity, destinationKey, type) => 
    addContract(commodity, destinationKey, type),
  
  toggleContractFulfilled: (contractID) => 
    toggleContractFulfilled(contractID),
  
  deleteContract: (contractID) => 
    deleteContract(contractID),
  
  acquireIndependentRailroad: (railroadName) => 
    acquireIndependentRailroad(railroadName),
  
  addCityToPlayer: (cityKey) => 
    addCityToPlayer(cityKey),
  
  endTurn: () => 
    endTurn()
});
