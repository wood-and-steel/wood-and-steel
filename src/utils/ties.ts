import { railroadTieValue, type Contract } from '../Contract';

/** Railroad ties a player has earned from fulfilled contracts (the count that ends the game at 30). */
export function contractTies(contracts: readonly Contract[], playerID: string): number {
  return contracts
    .filter((c) => c.playerID === playerID && c.fulfilled)
    .reduce((sum, c) => sum + railroadTieValue(c), 0);
}
