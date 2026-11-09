/**
 * Graph helpers over the map and over a player's own track (docs/BOT_PLAN.md, Bot engine).
 * Movement uses only the mover's own track; building and ranges use the whole map.
 */
import { cities, routes } from '../../data';
import { MAX_ROUTE_OWNERS } from '../../board/boardOps';
import { BUILD_MUST_CONNECT } from './rulesData';
import { playerProps, type BotWorld } from './world';

export interface Edge {
  route: string;
  neighbor: string;
}

export type Adjacency = Map<string, Edge[]>;

/** Adjacency over the given routes (all routes when omitted). */
export function adjacency(routeKeys?: Iterable<string>): Adjacency {
  const adj: Adjacency = new Map();
  const keys = routeKeys ?? routes.keys();
  for (const key of keys) {
    const route = routes.get(key);
    if (!route) continue;
    const [a, b] = route.cities;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ route: key, neighbor: b });
    adj.get(b)!.push({ route: key, neighbor: a });
  }
  return adj;
}

const MAP_ADJACENCY = adjacency();

export interface Bfs {
  /** Segments from the start, for every reached city. */
  dist: Map<string, number>;
  /** Previous step on a shortest path: city -> [previous city, route]. */
  prev: Map<string, [string, string]>;
}

/** Breadth-first search from `start` (one or more cities), up to maxSteps segments. */
export function bfs(start: string | Iterable<string>, adj: Adjacency, maxSteps = Infinity): Bfs {
  const starts = typeof start === 'string' ? [start] : [...start];
  const dist = new Map<string, number>(starts.map((c) => [c, 0]));
  const prev = new Map<string, [string, string]>();
  let frontier = starts;
  for (let step = 1; step <= maxSteps && frontier.length > 0; step++) {
    const next: string[] = [];
    for (const city of frontier) {
      // Sorted so ties break the same way every time.
      const edges = [...(adj.get(city) ?? [])].sort((x, y) => x.neighbor.localeCompare(y.neighbor));
      for (const { route, neighbor } of edges) {
        if (dist.has(neighbor)) continue;
        dist.set(neighbor, step);
        prev.set(neighbor, [city, route]);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return { dist, prev };
}

/** Cities from the search start to `target`, inclusive, or null if it wasn't reached. */
export function pathTo(search: Bfs, target: string): string[] | null {
  if (!search.dist.has(target)) return null;
  const path = [target];
  let city = target;
  while (search.prev.has(city)) {
    city = search.prev.get(city)![0];
    path.unshift(city);
  }
  return path;
}

/** Segments between two cities on the full map (undefined if unreachable within maxSteps). */
export function mapDistance(a: string, b: string, maxSteps = Infinity): number | undefined {
  return bfs(a, MAP_ADJACENCY, maxSteps).dist.get(b);
}

/** Cities within `steps` segments of `city` on the full map, including it. */
export function citiesWithin(city: string, steps: number): Set<string> {
  return new Set(bfs(city, MAP_ADJACENCY, steps).dist.keys());
}

export function mapAdjacency(): Adjacency {
  return MAP_ADJACENCY;
}

/** The route joining two neighboring cities, if any. */
export function routeBetween(a: string, b: string): string | null {
  return MAP_ADJACENCY.get(a)?.find((e) => e.neighbor === b)?.route ?? null;
}

// --- A player's network ---------------------------------------------------------

/** Routes the player has track on (primary or parallel). */
export function ownedRoutes(world: BotWorld, playerID: string = world.playerID): string[] {
  return Object.entries(world.board.track)
    .filter(([, owners]) => owners.includes(playerID))
    .map(([key]) => key)
    .sort();
}

/** Cities the player's track touches; before any track, their active cities. */
export function networkCities(world: BotWorld, playerID: string = world.playerID): Set<string> {
  const set = new Set<string>();
  for (const key of ownedRoutes(world, playerID)) {
    for (const city of routes.get(key)?.cities ?? []) set.add(city);
  }
  if (set.size === 0) for (const city of playerProps(world, playerID)?.activeCities ?? []) set.add(city);
  return set;
}

/** Adjacency over the player's own track (what their engines can move on). */
export function trackAdjacency(world: BotWorld, playerID: string = world.playerID): Adjacency {
  return adjacency(ownedRoutes(world, playerID));
}

/** Routes owned by independent railroads; no player can build on them. */
export function independentRouteKeys(world: BotWorld): Set<string> {
  const keys = new Set<string>();
  for (const railroad of Object.values(world.independentRailroads)) {
    for (const r of railroad.routes) keys.add(r.key);
  }
  return keys;
}

/** Whether the player could add track on this route, given cities already connected. */
export function canBuildRoute(world: BotWorld, routeKey: string, connected: Set<string>): boolean {
  const route = routes.get(routeKey);
  if (!route) return false;
  if (independentRouteKeys(world).has(routeKey)) return false;
  const owners = world.board.track[routeKey] ?? [];
  if (owners.includes(world.playerID) || owners.length >= MAX_ROUTE_OWNERS) return false;
  return !BUILD_MUST_CONNECT || route.cities.some((c) => connected.has(c));
}

/** Routes the player could build next, touching their network. */
export function buildableRoutes(world: BotWorld, connected: Set<string> = networkCities(world)): string[] {
  const candidates = new Set<string>();
  for (const city of connected) {
    for (const { route } of MAP_ADJACENCY.get(city) ?? []) candidates.add(route);
  }
  return [...candidates].filter((key) => canBuildRoute(world, key, connected)).sort();
}

/** The cities a route connects. */
export function routeCities(routeKey: string): [string, string] {
  const route = routes.get(routeKey);
  if (!route) throw new Error(`Unknown route: ${routeKey}`);
  return [route.cities[0], route.cities[1]];
}

export function cityRegion(city: string): string | undefined {
  return cities.get(city)?.region;
}
