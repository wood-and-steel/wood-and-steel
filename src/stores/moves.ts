import type { StoreApi, UseBoundStore } from 'zustand';
import type { GameStoreState } from './gameStore';
import {
  generateStartingContract,
  generatePrivateContract,
  generateMarketContract,
  claimMarketContract,
  addContract,
  toggleContractFulfilled,
  deleteContract,
  acquireIndependentRailroad,
  addCityToPlayer,
  claimHubCity,
  claimRegionalOffice,
  endTurn,
} from './gameActions';

/**
 * Moves API object that provides a consistent interface for game moves.
 * Components can use `moves.moveName(args)` to execute game actions.
 */
export interface Moves {
  generateStartingContract: (activeCities: string[], playerID?: string) => void;
  generatePrivateContract: () => void;
  generateMarketContract: () => void;
  claimMarketContract: (contractID: string) => void;
  addContract: (commodity: string, destinationKey: string, type: 'private' | 'market') => void;
  toggleContractFulfilled: (contractID: string) => void;
  deleteContract: (contractID: string) => void;
  acquireIndependentRailroad: (railroadName: string) => void;
  addCityToPlayer: (cityKey: string) => void;
  claimHubCity: (cityKey: string) => void;
  claimRegionalOffice: (regionCode: string) => void;
  endTurn: () => void;
}

/**
 * Creates the moves API bound to the given store.
 *
 * @param store - Zustand store instance (for future flexibility, currently unused)
 * @returns Object containing all available moves
 */
export function createMoves(
  _store: UseBoundStore<StoreApi<GameStoreState>>
): Moves {
  return {
    generateStartingContract: (activeCities: string[], playerID?: string) =>
      generateStartingContract(activeCities, playerID),

    generatePrivateContract: () => generatePrivateContract(),

    generateMarketContract: () => generateMarketContract(),

    claimMarketContract: (contractID: string) => claimMarketContract(contractID),

    addContract: (commodity: string, destinationKey: string, type: 'private' | 'market') =>
      addContract(commodity, destinationKey, type),

    toggleContractFulfilled: (contractID: string) => toggleContractFulfilled(contractID),

    deleteContract: (contractID: string) => deleteContract(contractID),

    acquireIndependentRailroad: (railroadName: string) =>
      acquireIndependentRailroad(railroadName),

    addCityToPlayer: (cityKey: string) => addCityToPlayer(cityKey),

    claimHubCity: (cityKey: string) => claimHubCity(cityKey),

    claimRegionalOffice: (regionCode: string) => claimRegionalOffice(regionCode),

    endTurn: () => endTurn(),
  };
}
