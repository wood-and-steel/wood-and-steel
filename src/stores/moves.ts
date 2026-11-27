import type { StoreApi, UseBoundStore } from 'zustand';
import type { GameStoreState } from './gameStore';
import {
  generateStartingContract,
  generatePrivateContract,
  generateMarketContract,
  fillMarketTableau,
  claimMarketContract,
  addContract,
  toggleContractFulfilled,
  deleteContract,
  replacePrivateContract,
  acquireIndependentRailroad,
  addCityToPlayer,
  claimHubCity,
  claimRegionalOffice,
  endTurn,
  borrow,
  repay,
  payForTrack,
  buyEngine,
  buyUpgrade,
  setCargo,
  setPlayerBoard,
  goFirstNextRound,
} from './gameActions';
import type { EngineSlot, EngineTypeId } from '../rules/playerBoard';
import type { UpgradeKey } from '../rules/rulesData';
import type { PlayerProps } from './gameStore';

/**
 * Moves API object that provides a consistent interface for game moves.
 * Components can use `moves.moveName(args)` to execute game actions.
 */
export interface Moves {
  generateStartingContract: (activeCities: string[], playerID?: string) => void;
  generatePrivateContract: () => void;
  generateMarketContract: () => void;
  fillMarketTableau: () => void;
  claimMarketContract: (contractID: string, cargoSlot?: EngineSlot) => boolean;
  addContract: (commodity: string, destinationKey: string, type: 'private' | 'market') => void;
  toggleContractFulfilled: (contractID: string, engineSlot?: EngineSlot) => boolean;
  deleteContract: (contractID: string) => void;
  replacePrivateContract: (playerID: string, commodity: string, destinationKey: string) => boolean;
  acquireIndependentRailroad: (railroadName: string) => boolean;
  addCityToPlayer: (cityKey: string) => void;
  claimHubCity: (cityKey: string) => boolean;
  claimRegionalOffice: (regionCode: string) => boolean;
  endTurn: () => void;
  borrow: (amount: number) => boolean;
  repay: (amount: number) => boolean;
  payForTrack: (amount: number) => boolean;
  buyEngine: (slot: EngineSlot, engineType: EngineTypeId) => boolean;
  buyUpgrade: (upgrade: UpgradeKey, choice?: string) => boolean;
  setCargo: (slot: EngineSlot, commodity: string | null) => boolean;
  goFirstNextRound: () => boolean;
  setPlayerBoard: (
    playerID: string,
    board: Partial<Pick<PlayerProps, 'cash' | 'debt' | 'engines' | 'cargo' | 'upgrades' | 'exchangeCommodity'>>
  ) => boolean;
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

    fillMarketTableau: () => fillMarketTableau(),

    claimMarketContract: (contractID, cargoSlot) => claimMarketContract(contractID, cargoSlot),

    addContract: (commodity: string, destinationKey: string, type: 'private' | 'market') =>
      addContract(commodity, destinationKey, type),

    toggleContractFulfilled: (contractID, engineSlot) => toggleContractFulfilled(contractID, engineSlot),

    deleteContract: (contractID: string) => deleteContract(contractID),

    replacePrivateContract: (playerID, commodity, destinationKey) =>
      replacePrivateContract(playerID, commodity, destinationKey),

    acquireIndependentRailroad: (railroadName: string) =>
      acquireIndependentRailroad(railroadName),

    addCityToPlayer: (cityKey: string) => addCityToPlayer(cityKey),

    claimHubCity: (cityKey: string) => claimHubCity(cityKey),

    claimRegionalOffice: (regionCode: string) => claimRegionalOffice(regionCode),

    endTurn: () => endTurn(),

    borrow: (amount) => borrow(amount),

    repay: (amount) => repay(amount),

    payForTrack: (amount) => payForTrack(amount),

    buyEngine: (slot, engineType) => buyEngine(slot, engineType),

    buyUpgrade: (upgrade, choice) => buyUpgrade(upgrade, choice),

    setCargo: (slot, commodity) => setCargo(slot, commodity),

    goFirstNextRound: () => goFirstNextRound(),

    setPlayerBoard: (playerID, board) => setPlayerBoard(playerID, board),
  };
}
