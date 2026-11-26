import { railroadTieValue, type Contract } from '../Contract';
import { ACQUISITION_TIES } from '../rules/rulesData';
import type { PlayerProps } from '../stores/gameStore';

/** Railroad ties a player has earned from fulfilled contracts (the count that ends the game at 30). */
export function contractTies(contracts: readonly Contract[], playerID: string): number {
  return contracts
    .filter((c) => c.playerID === playerID && c.fulfilled)
    .reduce((sum, c) => sum + railroadTieValue(c), 0);
}

/** Railroad ties earned from acquiring independent railroads. */
export function acquisitionTies(player: Pick<PlayerProps, 'railroadsAcquired'> | undefined): number {
  return (player?.railroadsAcquired ?? 0) * ACQUISITION_TIES;
}

/** Every railroad tie the app tracks for a player: fulfilled contracts plus acquisitions. */
export function playerTies(
  contracts: readonly Contract[],
  playerID: string,
  player: Pick<PlayerProps, 'railroadsAcquired'> | undefined
): number {
  return contractTies(contracts, playerID) + acquisitionTies(player);
}
