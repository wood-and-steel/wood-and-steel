/** Independent railroad prices (docs/Game rules.md, Merge with an independent railroad). */
import type { Contract } from '../Contract';
import type { RegionCode } from '../stores/gameStore';
import { cityRegion } from './regions';
import { INDIE_PRICE_PER_ROUTE, INDIE_PRICE_PER_ROUTE_AFTER_WEST, WESTERN_REGIONS } from './rulesData';

/** True once any player has fulfilled a contract in a Western region. */
export function anyWesternDelivery(contracts: readonly Pick<Contract, 'destinationKey' | 'fulfilled'>[]): boolean {
  return contracts.some((c) => {
    const region = cityRegion(c.destinationKey) as RegionCode | undefined;
    return c.fulfilled && region !== undefined && WESTERN_REGIONS.includes(region);
  });
}

/** $3,000 per route, or $4,000 once anyone has delivered to the West. */
export function indiePricePerRoute(contracts: readonly Pick<Contract, 'destinationKey' | 'fulfilled'>[]): number {
  return anyWesternDelivery(contracts) ? INDIE_PRICE_PER_ROUTE_AFTER_WEST : INDIE_PRICE_PER_ROUTE;
}
