/**
 * Engine purchases and the gates that depend on engines (docs/Game rules.md, Buy an engine,
 * Service Yard, Monopolies). Pure functions over plain values, shared by the player app and the bots.
 */
import { commodities } from '../data';
import { ENGINE_TYPES, type EngineSlot, type EngineTypeId, type EngineTypePair } from './playerBoard';
import {
  ENGINE_PRICES,
  HUB_ENGINE_SKIP_SURCHARGE,
  MAX_ENGINES,
  MONOPOLY_TIES,
  SERVICE_YARD_UNLOCK_ENGINE,
  tradeInValue,
} from './rulesData';

/** An engine's position in the upgrade order (John Bull = 0). */
export function engineLevel(engine: EngineTypeId): number {
  return ENGINE_TYPES.findIndex((e) => e.id === engine);
}

/** The best engine level among `types`, or -1 with no engines. */
export function bestEngineLevel(types: readonly (EngineTypeId | null)[]): number {
  return Math.max(-1, ...types.map((t) => (t ? engineLevel(t) : -1)));
}

export interface EnginePurchase {
  engine: EngineTypeId;
  /** Token the new engine goes on. */
  slot: EngineSlot;
  /** Engine traded in from that token, or null for a new token. */
  tradeIn: EngineTypeId | null;
  /** Two levels up with a Hub, for $5,000 more. */
  skip: boolean;
  /** Net cost after any trade-in credit. */
  cost: number;
}

/**
 * Engine purchases open to a player, ignoring cash: one level above their best engine, or two
 * with a Hub for $5,000 more. Each can trade in the engine on a token, or go on an empty token
 * while the player has fewer than two engines.
 */
export function enginePurchaseOptions(types: EngineTypePair, hasHub: boolean): EnginePurchase[] {
  const best = bestEngineLevel(types);
  const levels = [best + 1];
  if (hasHub) levels.push(best + 2);
  const owned = types.filter((t) => t !== null).length;
  const options: EnginePurchase[] = [];
  for (const level of levels) {
    const target = ENGINE_TYPES[level];
    if (!target) continue;
    const skip = level === best + 2;
    const price = ENGINE_PRICES[target.id] + (skip ? HUB_ENGINE_SKIP_SURCHARGE : 0);
    for (const slot of [0, 1] as EngineSlot[]) {
      const current = types[slot];
      if (current) {
        options.push({ engine: target.id, slot, tradeIn: current, skip, cost: price - tradeInValue(current) });
      } else if (owned < MAX_ENGINES) {
        options.push({ engine: target.id, slot, tradeIn: null, skip, cost: price });
      }
    }
  }
  return options;
}

/** The Service Yard can be bought once any player owns a Consolidation or better. */
export function serviceYardOpen(fleets: readonly EngineTypePair[]): boolean {
  const unlock = engineLevel(SERVICE_YARD_UNLOCK_ENGINE);
  return fleets.some((types) => bestEngineLevel(types) >= unlock);
}

/** Commodities supplied by 4, 5, or 6 cities: the ones a Commodities Exchange can monopolize. */
export function monopolizableCommodities(): string[] {
  return [...commodities.entries()]
    .filter(([, c]) => MONOPOLY_TIES[c.cities.length] !== undefined)
    .map(([key]) => key)
    .sort();
}
