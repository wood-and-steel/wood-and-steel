/**
 * Delivery plans (docs/BOT_PLAN.md, Heuristic player): for a contract, the best engine and
 * supplying city, the track still to build, and an estimate of the turns, cost, and payoff.
 * Plans are scored by utility per turn so contracts, offers, and engines can be compared.
 */
import { commodities } from '../../data';
import { railroadTieValue, type Contract, type PrivateContractSpec } from '../../Contract';
import { MAX_ROUTE_OWNERS, type EngineSlot } from '../../board/boardOps';
import { buildLimit, trackCost } from '../engine/costs';
import { debtServiceForDelivery, deliveryPayment } from '../engine/finance';
import { canClaimMarket, engineReach, suppliedAt } from '../engine/movement';
import { citiesWithin, independentRouteKeys, mapAdjacency, networkCities } from '../engine/network';
import { RAILYARD_RANGE } from '../engine/rulesData';
import {
  cargo,
  claimedMarketContracts,
  engineCities,
  engineTypes,
  hasUpgrade,
  openMarketContracts,
  openPrivateContracts,
  type BotWorld,
} from '../engine/world';
import type { Params } from './params';

// --- Cheapest path over the map, where the bot's own track is free --------------------

export interface PathPlan {
  cities: string[];
  /** Routes along the path, in order. */
  routes: string[];
  /** Routes along the path the bot doesn't own yet, in order. */
  toBuild: string[];
  buildCost: number;
}

/** Edge cost: free on own track, the build cost elsewhere, impossible on independent or full routes. */
function edgeCost(world: BotWorld, routeKey: string, indies: Set<string>): number {
  const owners = world.board.track[routeKey] ?? [];
  if (owners.includes(world.playerID)) return 0;
  if (indies.has(routeKey) || owners.length >= MAX_ROUTE_OWNERS) return Infinity;
  return trackCost(world, routeKey);
}

/** Cheapest way from any start city to any goal city (ties broken by fewer segments). */
export function cheapestPath(world: BotWorld, from: Iterable<string>, to: Iterable<string>): PathPlan | null {
  const goals = new Set(to);
  const indies = independentRouteKeys(world);
  const adj = mapAdjacency();
  // Dijkstra on (cost, hops).
  const best = new Map<string, [number, number]>();
  const prev = new Map<string, [string, string]>();
  const queue: [number, number, string][] = [];
  for (const city of from) {
    best.set(city, [0, 0]);
    queue.push([0, 0, city]);
  }
  while (queue.length > 0) {
    queue.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]));
    const [cost, hops, city] = queue.shift()!;
    const known = best.get(city)!;
    if (known[0] < cost || (known[0] === cost && known[1] < hops)) continue;
    if (goals.has(city)) {
      const cityPath = [city];
      const routePath: string[] = [];
      let at = city;
      while (prev.has(at)) {
        const [before, route] = prev.get(at)!;
        cityPath.unshift(before);
        routePath.unshift(route);
        at = before;
      }
      const toBuild = routePath.filter((r) => !(world.board.track[r] ?? []).includes(world.playerID));
      return { cities: cityPath, routes: routePath, toBuild, buildCost: cost };
    }
    for (const { route, neighbor } of adj.get(city) ?? []) {
      const step = edgeCost(world, route, indies);
      if (step === Infinity) continue;
      const next: [number, number] = [cost + step, hops + 1];
      const seen = best.get(neighbor);
      if (!seen || next[0] < seen[0] || (next[0] === seen[0] && next[1] < seen[1])) {
        best.set(neighbor, next);
        prev.set(neighbor, [city, route]);
        queue.push([next[0], next[1], neighbor]);
      }
    }
  }
  return null;
}

// --- Delivery plans ------------------------------------------------------------------

export interface DeliveryPlan {
  /** The contract (or offer) this plan delivers. */
  contractId: string | null;
  commodity: string;
  destination: string;
  /** Market contract claimed at pickup. */
  claim: boolean;
  slot: EngineSlot;
  /** Where the engine starts (null: a new engine placed on the network). */
  start: string;
  /** Pickup city, or null if the engine already carries the commodity. */
  pickup: string | null;
  /** Start → pickup → destination. */
  path: PathPlan;
  turns: number;
  payment: number;
  ties: number;
  /** Payment less debt service plus ties in dollars, times the region factor. */
  utility: number;
  /** (utility − charged track cost) per turn. */
  rate: number;
  /** The track can be paid for with cash plus the bot's remaining borrowing room. */
  affordable: boolean;
}

/** Income the bot can count on while saving up, for estimating waits. */
const SAVING_PER_TURN = 3000;

/** Cities that can supply `commodity` to the bot: suppliers, plus its Railyard if one is in range. */
export function supplyCities(world: BotWorld, commodity: string): string[] {
  const list = new Set(commodities.get(commodity)?.cities ?? []);
  const yard = world.board.railyards[world.playerID];
  if (yard && suppliedAt(world, yard).has(commodity)) list.add(yard);
  return [...list].sort();
}

/** Start → pickup and pickup → destination as one plan; a route on both legs is built (and paid) once. */
function joinPaths(world: BotWorld, a: PathPlan, b: PathPlan): PathPlan {
  const toBuild = [...a.toBuild];
  for (const r of b.toBuild) if (!toBuild.includes(r)) toBuild.push(r);
  return {
    cities: [...a.cities, ...b.cities.slice(1)],
    routes: [...a.routes, ...b.routes],
    toBuild,
    buildCost: toBuild.reduce((sum, r) => sum + trackCost(world, r), 0),
  };
}

/** Estimated turns to build what's missing and run the engine there (two actions a turn). */
export function estimateTurns(world: BotWorld, plan: Pick<PathPlan, 'toBuild'>, legs: number[], reach: number): number {
  const builds = Math.ceil(plan.toBuild.length / buildLimit(world));
  const runs = legs.reduce((sum, hops) => sum + Math.max(hops > 0 ? 1 : 0, Math.ceil(hops / Math.max(1, reach))), 0);
  return Math.max(1, Math.ceil((builds + runs) / 2));
}

/** Engines the bot could use: placed ones, or (for planning) any network city if it has none placed. */
function engineStarts(world: BotWorld): { slot: EngineSlot; city: string; reach: number; load: string | null }[] {
  const types = engineTypes(world);
  const places = engineCities(world);
  const loads = cargo(world);
  const starts: { slot: EngineSlot; city: string; reach: number; load: string | null }[] = [];
  for (const slot of [0, 1] as EngineSlot[]) {
    if (!types[slot]) continue;
    const reach = engineReach(world, slot);
    if (places[slot]) starts.push({ slot, city: places[slot]!, reach, load: loads[slot] });
    else for (const city of networkCities(world)) starts.push({ slot, city, reach, load: null });
  }
  return starts;
}

/** The best plan to deliver `commodity` to `destination`, or null if it can't be reached. */
export function planDelivery(
  world: BotWorld,
  p: Params,
  target: { contractId: string | null; commodity: string; destination: string; claim?: boolean },
  only?: EngineSlot
): DeliveryPlan | null {
  const suppliers = supplyCities(world, target.commodity);
  const contract = { commodity: target.commodity, destinationKey: target.destination };
  const ties = railroadTieValue(contract);
  let best: DeliveryPlan | null = null;
  for (const start of engineStarts(world)) {
    if (only !== undefined && start.slot !== only) continue;
    // An engine loaded with something else would have to deliver it first; skip it.
    if (start.load !== null && start.load !== target.commodity) continue;
    const engine = engineTypes(world)[start.slot];
    const payment = deliveryPayment(contract, engine, hasUpgrade(world, 'upgraded-stations'));
    const service = debtServiceForDelivery(world.bot, target.destination).service;
    const utility = (payment - service + ties * p.tieDollars) * p.regionFactor(target.destination);

    const pickups = start.load === target.commodity ? [null] : suppliers;
    for (const pickup of pickups) {
      let path: PathPlan | null;
      let legs: number[];
      if (pickup === null) {
        path = cheapestPath(world, [start.city], [target.destination]);
        legs = path ? [path.routes.length] : [];
      } else {
        const first = cheapestPath(world, [start.city], [pickup]);
        const second = first && cheapestPath(world, [pickup], [target.destination]);
        path = first && second ? joinPaths(world, first, second) : null;
        legs = first && second ? [first.routes.length, second.routes.length] : [];
      }
      if (!path) continue;
      const available = world.bot.cash + Math.max(0, p.maxDebt - world.bot.debt);
      const affordable = path.buildCost <= available;
      // Unaffordable track means waiting for income first.
      const wait = affordable ? 0 : 2 + Math.ceil((path.buildCost - available) / SAVING_PER_TURN);
      const turns = estimateTurns(world, path, legs, start.reach) + wait;
      const rate = (utility - path.buildCost * p.trackCostShare) / turns;
      if (!best || rate > best.rate) {
        best = {
          contractId: target.contractId,
          commodity: target.commodity,
          destination: target.destination,
          claim: target.claim ?? false,
          slot: start.slot,
          start: start.city,
          pickup,
          path,
          turns,
          payment,
          ties,
          utility,
          rate,
          affordable,
        };
      }
    }
  }
  return best;
}

export function planForContract(world: BotWorld, p: Params, contract: Contract, only?: EngineSlot): DeliveryPlan | null {
  const claim = contract.type === 'market' && contract.playerID === null;
  return planDelivery(world, p, { contractId: contract.id, commodity: contract.commodity, destination: contract.destinationKey, claim }, only);
}

export function planForOffer(world: BotWorld, p: Params, offer: PrivateContractSpec): DeliveryPlan | null {
  return planDelivery(world, p, { contractId: null, commodity: offer.commodity, destination: offer.destinationKey });
}

/** Plans for every contract the bot could work on now, best first. */
export function rankPlans(world: BotWorld, p: Params): DeliveryPlan[] {
  const contracts = [...openPrivateContracts(world), ...claimedMarketContracts(world)];
  if (canClaimMarket(world)) contracts.push(...openMarketContracts(world));
  return contracts
    .map((c) => planForContract(world, p, c))
    .filter((plan): plan is DeliveryPlan => plan !== null)
    .sort((a, b) => b.rate - a.rate);
}

/** How many routes a city has on the map, a rough measure of how central it is. */
export function cityDegree(city: string): number {
  return mapAdjacency().get(city)?.length ?? 0;
}

/** Commodities available within the Railyard range of a city. */
export function commoditiesNear(city: string): Set<string> {
  const set = new Set<string>();
  for (const near of citiesWithin(city, RAILYARD_RANGE)) {
    for (const [key, c] of commodities) if (c.cities.includes(near)) set.add(key);
  }
  return set;
}
