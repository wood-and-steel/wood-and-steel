/**
 * What things cost and which purchases are open to the bot: track, engines, upgrades, and
 * independent railroads (docs/Game rules.md, Turn actions).
 */
import { cities, commodities, routes } from '../../data';
import { ENGINE_TYPES, type EngineTypeId } from '../../board/playerBoardData';
import type { EngineSlot } from '../../board/boardOps';
import type { RegionCode } from '../../stores/gameStore';
import {
  HUB_DISCOUNT,
  HUB_DISCOUNT_RANGE,
  HUB_ENGINE_SKIP_SURCHARGE,
  BUILD_LIMIT,
  BUILD_LIMIT_EMPLOYMENT_OFFICE,
  ENGINE_PRICES,
  INDIE_MUST_CONNECT,
  INDIE_PRICE_PER_ROUTE,
  INDIE_PRICE_PER_ROUTE_AFTER_WEST,
  JOHN_BULL_MUST_TRADE_IN,
  MAX_ENGINES,
  MIN_TRACK_COST,
  MONOPOLY_TIES,
  MOUNTAIN_MULTIPLIER,
  PARALLEL_SURCHARGE,
  REGIONAL_OFFICE_MIN_CITIES,
  SERVICE_YARD_UNLOCK_ENGINE,
  UPGRADE_PRICES,
  WESTERN_REGIONS,
  baseTrackCost,
  tradeInValue,
  type UpgradeKey,
} from './rulesData';
import { citiesWithin, networkCities, routeCities } from './network';
import {
  bestEngineLevel,
  engineCities,
  engineLevel,
  engineTypes,
  hasUpgrade,
  otherPlayerIDs,
  playerProps,
  type BotWorld,
} from './world';

// --- Track -------------------------------------------------------------------

export function buildLimit(world: BotWorld): number {
  return hasUpgrade(world, 'employment-office') ? BUILD_LIMIT_EMPLOYMENT_OFFICE : BUILD_LIMIT;
}

/** Cost for the bot to build on a route now: base by length, +$1,000 if parallel, x2 if mountainous, -$1,000 near its Hub. */
export function trackCost(world: BotWorld, routeKey: string): number {
  const route = routes.get(routeKey);
  if (!route) throw new Error(`Unknown route: ${routeKey}`);
  const parallel = (world.board.track[routeKey] ?? []).some((id) => id !== world.playerID);
  let cost = baseTrackCost(route.length) + (parallel ? PARALLEL_SURCHARGE : 0);
  if (route.mountainous) cost *= MOUNTAIN_MULTIPLIER;
  const hub = playerProps(world)?.hubCity;
  if (hub) {
    const nearHub = citiesWithin(hub, HUB_DISCOUNT_RANGE);
    if (routeCities(routeKey).some((c) => nearHub.has(c))) cost = Math.max(MIN_TRACK_COST, cost - HUB_DISCOUNT);
  }
  return cost;
}

// --- Engines -----------------------------------------------------------------

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

/** Engine purchases open to the bot, ignoring cash. A new token is placed later on any network city. */
export function enginePurchases(world: BotWorld): EnginePurchase[] {
  const types = engineTypes(world);
  const best = bestEngineLevel(world);
  const levels = [best + 1];
  if (playerProps(world)?.hubCity) levels.push(best + 2);
  const owned = types.filter((t) => t !== null).length;
  const johnBullSlot = types.findIndex((t) => t === 'john-bull');
  const options: EnginePurchase[] = [];
  for (const level of levels) {
    const target = ENGINE_TYPES[level];
    if (!target) continue;
    const skip = level === best + 2;
    const price = ENGINE_PRICES[target.id] + (skip ? HUB_ENGINE_SKIP_SURCHARGE : 0);
    for (const slot of [0, 1] as EngineSlot[]) {
      const current = types[slot];
      if (JOHN_BULL_MUST_TRADE_IN && johnBullSlot !== -1 && slot !== johnBullSlot) continue;
      if (current) {
        options.push({ engine: target.id, slot, tradeIn: current, skip, cost: price - tradeInValue(current) });
      } else if (owned < MAX_ENGINES) {
        options.push({ engine: target.id, slot, tradeIn: null, skip, cost: price });
      }
    }
  }
  return options;
}

/** Whether the bot owns an engine at least as good as `engine`. */
export function ownsEngineAtLeast(world: BotWorld, engine: EngineTypeId, playerID: string = world.playerID): boolean {
  return bestEngineLevel(world, playerID) >= engineLevel(engine);
}

// --- Independent railroads -------------------------------------------------------

/** True once any player has fulfilled a contract in a Western region. */
export function anyWesternDelivery(world: BotWorld): boolean {
  return world.contracts.some((c) => {
    const region = cities.get(c.destinationKey)?.region as RegionCode | undefined;
    return c.fulfilled && region !== undefined && WESTERN_REGIONS.includes(region);
  });
}

export function indiePricePerRoute(world: BotWorld): number {
  return anyWesternDelivery(world) ? INDIE_PRICE_PER_ROUTE_AFTER_WEST : INDIE_PRICE_PER_ROUTE;
}

export interface IndiePurchase {
  name: string;
  routes: string[];
  cost: number;
}

/** Independent railroads the bot could acquire, ignoring cash. */
export function indiePurchases(world: BotWorld): IndiePurchase[] {
  const network = networkCities(world);
  const perRoute = indiePricePerRoute(world);
  return Object.entries(world.independentRailroads)
    .map(([name, railroad]) => ({ name, routes: railroad.routes.map((r) => r.key) }))
    .filter(({ routes: keys }) => !INDIE_MUST_CONNECT || keys.some((k) => routeCities(k).some((c) => network.has(c))))
    .map(({ name, routes: keys }) => ({ name, routes: keys, cost: keys.length * perRoute }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// --- Upgrades ----------------------------------------------------------------

export interface UpgradePurchase {
  upgrade: UpgradeKey;
  cost: number;
  /** Hub or Railyard city. */
  city?: string;
  /** Regional Office region. */
  region?: RegionCode;
  /** Commodities Exchange commodity. */
  commodity?: string;
}

/** Commodities supplied by 4, 5, or 6 cities. */
export function monopolizableCommodities(): string[] {
  return [...commodities.entries()]
    .filter(([, c]) => MONOPOLY_TIES[c.cities.length] !== undefined)
    .map(([key]) => key)
    .sort();
}

/** Whether a player's network reaches every city supplying the commodity. */
export function connectedToAllSuppliers(world: BotWorld, commodity: string, playerID: string = world.playerID): boolean {
  const network = networkCities(world, playerID);
  return (commodities.get(commodity)?.cities ?? []).every((c) => network.has(c));
}

const REGIONS: readonly RegionCode[] = ['NW', 'NC', 'NE', 'SW', 'SC', 'SE'];

/** Regions where the bot touches 5+ cities and no other player touches any, and no one else holds the office. */
export function regionalOfficeRegions(world: BotWorld): RegionCode[] {
  const mine = networkCities(world);
  const others = otherPlayerIDs(world).map((id) => networkCities(world, id));
  const claimed = new Set(
    world.players.filter(([id]) => id !== world.playerID).map(([, p]) => p.regionalOffice).filter(Boolean)
  );
  return REGIONS.filter((region) => {
    if (claimed.has(region)) return false;
    const inRegion = [...mine].filter((c) => cities.get(c)?.region === region).length;
    const contested = others.some((set) => [...set].some((c) => cities.get(c)?.region === region));
    return inRegion >= REGIONAL_OFFICE_MIN_CITIES && !contested;
  });
}

/** Upgrades open to the bot now, ignoring cash. */
export function upgradePurchases(world: BotWorld): UpgradePurchase[] {
  const props = playerProps(world);
  const network = [...networkCities(world)].sort();
  const options: UpgradePurchase[] = [];
  const add = (upgrade: UpgradeKey, extra: Omit<UpgradePurchase, 'upgrade' | 'cost'> = {}) =>
    options.push({ upgrade, cost: UPGRADE_PRICES[upgrade], ...extra });

  const serviceYardOpen = world.players.some(([id]) => ownsEngineAtLeast(world, SERVICE_YARD_UNLOCK_ENGINE, id));
  if (serviceYardOpen && !hasUpgrade(world, 'service-yard')) add('service-yard');
  for (const upgrade of ['upgraded-stations', 'timetable', 'roundhouse', 'employment-office'] as const) {
    if (!hasUpgrade(world, upgrade)) add(upgrade);
  }
  if (!props?.hubCity) {
    const otherHubs = new Set(world.players.filter(([id]) => id !== world.playerID).map(([, p]) => p.hubCity));
    for (const city of network) if (!otherHubs.has(city)) add('hub', { city });
  }
  if (!world.board.railyards[world.playerID]) {
    const otherYards = new Set(
      Object.entries(world.board.railyards).filter(([id]) => id !== world.playerID).map(([, c]) => c)
    );
    for (const city of network) if (!otherYards.has(city)) add('railyard', { city });
  }
  if (!props?.regionalOffice) {
    for (const region of regionalOfficeRegions(world)) add('regional-office', { region });
  }
  if (!hasUpgrade(world, 'commodities-exchange')) {
    for (const commodity of monopolizableCommodities()) {
      if (connectedToAllSuppliers(world, commodity)) add('commodities-exchange', { commodity });
    }
  }
  return options;
}

/** Where the bot's engines are, and which slots hold an engine but aren't on the board yet. */
export function unplacedEngineSlots(world: BotWorld): EngineSlot[] {
  const types = engineTypes(world);
  const placed = engineCities(world);
  return ([0, 1] as EngineSlot[]).filter((slot) => types[slot] !== null && placed[slot] === null);
}
