/**
 * Running trains (docs/Game rules.md, Run trains): engines move along the player's own track up
 * to their distance, picking up a commodity in a city that supplies it and delivering it to a
 * city with an open contract for it. Delivering ends the move unless the player has a Timetable.
 * With a Roundhouse, an empty engine can meet a loaded one and carry its commodity on.
 */
import { cities, commodities } from '../../data';
import type { Contract } from '../../Contract';
import type { EngineSlot } from '../../board/boardOps';
import { engineDistance } from '../../board/playerBoardData';
import { MARKET_CONTRACT_MIN_ENGINE, RAILYARD_RANGE, ROUNDHOUSE_APPROACH } from './rulesData';
import { ownsEngineAtLeast } from './costs';
import { bfs, citiesWithin, pathTo, routeBetween, trackAdjacency } from './network';
import {
  cargo,
  claimedMarketContracts,
  deliverableContracts,
  engineCities,
  engineTypes,
  hasUpgrade,
  openMarketContracts,
  type BotWorld,
} from './world';

export type RunEvent =
  /** Pick up `commodity` at path[at]; `claim` names a market contract claimed with this pickup. */
  | { at: number; kind: 'pickup'; commodity: string; claim?: string }
  /** Deliver to `contractId` at path[at]. */
  | { at: number; kind: 'deliver'; contractId: string };

export interface EngineRun {
  slot: EngineSlot;
  /** Cities visited, starting where the engine starts this run. */
  path: string[];
  events: RunEvent[];
}

export interface RoundhouseTransfer {
  /** The receiving engine's route to the meeting city (where the carrier's run ends), at most 4 segments. */
  approach: string[];
}

/** One Run Trains action: one or both engines; with `roundhouse`, runs[0] carries and runs[1] receives. */
export interface RunTrains {
  runs: EngineRun[];
  roundhouse?: RoundhouseTransfer;
}

/** Segments an engine may move this run. */
export function engineReach(world: BotWorld, slot: EngineSlot): number {
  const type = engineTypes(world)[slot];
  return type ? engineDistance(type, hasUpgrade(world, 'service-yard')).total : 0;
}

/** Commodities a city supplies to the bot: its own, plus everything within two segments if the bot's Railyard is there. */
export function suppliedAt(world: BotWorld, city: string): Set<string> {
  const supplied = new Set(cities.get(city)?.commodities ?? []);
  if (world.board.railyards[world.playerID] === city) {
    for (const near of citiesWithin(city, RAILYARD_RANGE)) {
      for (const c of cities.get(near)?.commodities ?? []) supplied.add(c);
    }
  }
  return supplied;
}

/** Whether the bot may claim a market contract now: it owns a Mogul or better and holds no other unfulfilled market contract. */
export function canClaimMarket(world: BotWorld): boolean {
  return ownsEngineAtLeast(world, MARKET_CONTRACT_MIN_ENGINE) && claimedMarketContracts(world).length === 0;
}

/** Engines that can run now: they have a type, are on the board, and haven't run this turn. */
export function runnableSlots(world: BotWorld): EngineSlot[] {
  const types = engineTypes(world);
  const placed = engineCities(world);
  return ([0, 1] as EngineSlot[]).filter(
    (slot) => types[slot] !== null && placed[slot] !== null && !world.turnState.enginesRun.includes(slot)
  );
}

// --- Generating runs -------------------------------------------------------------

interface Want {
  commodity: string;
  /** Market contract to claim on pickup, if the pickup is for one. */
  claim?: string;
}

/** Commodities worth picking up: for contracts the bot can deliver, and claimable market contracts. */
function wants(world: BotWorld): Want[] {
  const list: Want[] = deliverableContracts(world).map((c) => ({ commodity: c.commodity }));
  if (canClaimMarket(world)) {
    for (const c of openMarketContracts(world)) list.push({ commodity: c.commodity, claim: c.id });
  }
  const seen = new Set<string>();
  return list.filter((w) => {
    const key = `${w.commodity}|${w.claim ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** First index from `from` where a contract in `contracts` for `commodity` can be delivered. */
function firstDelivery(path: string[], from: number, commodity: string, contracts: Contract[]): RunEvent | null {
  for (let i = from; i < path.length; i++) {
    const contract = contracts.find((c) => c.commodity === commodity && c.destinationKey === path[i]);
    if (contract) return { at: i, kind: 'deliver', contractId: contract.id };
  }
  return null;
}

/** Events along a path for an engine carrying `load` (or empty), aiming at `want`; returns the trimmed path too. */
function plan(
  world: BotWorld,
  path: string[],
  load: string | null,
  want: Want | null,
  timetable: boolean
): { path: string[]; events: RunEvent[] } | null {
  const events: RunEvent[] = [];
  let carrying = load;
  const contracts = deliverableContracts(world);
  let i = 0;
  if (carrying === null && want) {
    const at = path.findIndex((city) => suppliedAt(world, city).has(want.commodity));
    if (at === -1) return null;
    events.push({ at, kind: 'pickup', commodity: want.commodity, ...(want.claim ? { claim: want.claim } : {}) });
    carrying = want.commodity;
    i = at;
  }
  if (carrying !== null) {
    // A just-claimed market contract is deliverable too.
    const claimed = want?.claim ? world.contracts.filter((c) => c.id === want.claim) : [];
    const delivery = firstDelivery(path, i, carrying, [...contracts, ...claimed]);
    if (delivery) {
      events.push(delivery);
      if (!timetable) return { path: path.slice(0, delivery.at + 1), events };
    }
  }
  if (events.length === 0 && want) return null;
  return { path, events };
}

/**
 * Candidate runs for one engine: to each city it can reach, a plain move plus variants that pick
 * up a wanted commodity on the way and deliver it if a contract's city is on the path.
 */
export function runOptions(world: BotWorld, slot: EngineSlot): EngineRun[] {
  if (!runnableSlots(world).includes(slot)) return [];
  const start = engineCities(world)[slot]!;
  const load = cargo(world)[slot];
  const timetable = hasUpgrade(world, 'timetable');
  const search = bfs(start, trackAdjacency(world), engineReach(world, slot));
  const wantList = load === null ? wants(world) : [];
  const runs = new Map<string, EngineRun>();
  const add = (run: EngineRun) => runs.set(JSON.stringify(run), run);

  for (const target of [...search.dist.keys()].sort()) {
    const path = pathTo(search, target)!;
    if (path.length > 1) add({ slot, path, events: [] });
    const variants = load !== null ? [plan(world, path, load, null, timetable)] : wantList.map((w) => plan(world, path, null, w, timetable));
    for (const v of variants) {
      if (v && v.events.length > 0) add({ slot, path: v.path, events: v.events });
    }
  }
  return [...runs.values()];
}

/** Roundhouse runs that end in a delivery: the loaded engine moves, the empty one meets it and carries on. */
export function roundhouseOptions(world: BotWorld): RunTrains[] {
  if (!hasUpgrade(world, 'roundhouse')) return [];
  const slots = runnableSlots(world);
  if (slots.length < 2) return [];
  const loads = cargo(world);
  const carrier = slots.find((s) => loads[s] !== null);
  const receiver = slots.find((s) => loads[s] === null);
  if (carrier === undefined || receiver === undefined) return [];
  const commodity = loads[carrier]!;
  const destinations = new Set(deliverableContracts(world).filter((c) => c.commodity === commodity).map((c) => c.destinationKey));
  if (destinations.size === 0) return [];

  const adj = trackAdjacency(world);
  const places = engineCities(world);
  const carrierSearch = bfs(places[carrier]!, adj, engineReach(world, carrier));
  const receiverSearch = bfs(places[receiver]!, adj, ROUNDHOUSE_APPROACH);
  const options: RunTrains[] = [];
  for (const meet of [...carrierSearch.dist.keys()].sort()) {
    const carrierPath = pathTo(carrierSearch, meet)!;
    if (carrierPath.slice(1).some((c) => destinations.has(c))) continue; // it would just deliver itself
    const approach = pathTo(receiverSearch, meet);
    if (!approach) continue;
    const onward = bfs(meet, adj, engineReach(world, receiver));
    for (const destination of [...destinations].sort()) {
      const path = pathTo(onward, destination);
      if (!path) continue;
      const contract = deliverableContracts(world).find((c) => c.commodity === commodity && c.destinationKey === destination)!;
      options.push({
        runs: [
          { slot: carrier, path: carrierPath, events: [] },
          { slot: receiver, path, events: [{ at: path.length - 1, kind: 'deliver', contractId: contract.id }] },
        ],
        roundhouse: { approach },
      });
    }
  }
  return options;
}

// --- Checking runs ---------------------------------------------------------------

/** Error message if consecutive cities aren't joined by the bot's own track. */
export function checkPath(world: BotWorld, path: string[]): string | null {
  if (path.length === 0) return 'empty path';
  const owned = new Set(Object.entries(world.board.track).filter(([, o]) => o.includes(world.playerID)).map(([k]) => k));
  for (let i = 1; i < path.length; i++) {
    const route = routeBetween(path[i - 1], path[i]);
    if (!route || !owned.has(route)) return `no track of yours between ${path[i - 1]} and ${path[i]}`;
  }
  return null;
}

/** Whether a city supplies the commodity to the bot (used by checks and narration). */
export function suppliesCommodity(world: BotWorld, city: string, commodity: string): boolean {
  return commodities.has(commodity) && suppliedAt(world, city).has(commodity);
}
