/**
 * First-open seeding (docs/BOARD_APP_PLAN.md, Seeding): each player's starting route from G,
 * engines and Railyards in the trays, and a snapshot of the independent railroads.
 */
import { routes } from '../data/routes';
import { STARTING_CITY_PAIRS } from '../data/startingRoutes';
import type { GameContext, GameState } from '../stores/gameStore';
import { emptyBoardState, type BoardState } from './boardOps';

/** Phases in which players have not all picked their starting routes yet. */
const PRE_START_PHASES = new Set(['waiting_for_players', 'setup']);

export function findRouteKey(a: string, b: string): string | null {
  for (const [key, route] of routes) {
    if (route.cities.includes(a) && route.cities.includes(b)) return key;
  }
  return null;
}

/** independentRailroads as name -> route keys */
export function independentRailroadKeys(G: GameState): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(G.independentRailroads ?? {}).map(([name, railroad]) => [name, railroad.routes.map((r) => r.key)])
  );
}

/** True once every player has a starting route, so seeding won't miss anyone. */
export function canSeedBoard(G: GameState, ctx: GameContext): boolean {
  return !PRE_START_PHASES.has(ctx.phase) && (G.players?.length ?? 0) > 0;
}

/**
 * Starting route per player: the starting pair whose cities are both active. If several match
 * (the board was first opened mid-game), prefer one no earlier player was given.
 */
export function startingRouteKeys(G: GameState, ctx: GameContext): Record<string, string> {
  const players = new Map(G.players ?? []);
  const order = ctx.playOrder?.length ? ctx.playOrder.filter((id) => players.has(id)) : [...players.keys()];
  const taken = new Set<string>();
  const result: Record<string, string> = {};
  for (const id of order) {
    const active = new Set(players.get(id)!.activeCities ?? []);
    const candidates = STARTING_CITY_PAIRS.filter(([a, b]) => active.has(a) && active.has(b))
      .map(([a, b]) => findRouteKey(a, b))
      .filter((key): key is string => key !== null);
    const key = candidates.find((k) => !taken.has(k)) ?? candidates[0];
    if (key) {
      result[id] = key;
      taken.add(key);
    }
  }
  return result;
}

export function seedBoardState(G: GameState, ctx: GameContext): BoardState {
  const state = emptyBoardState();
  for (const [id, key] of Object.entries(startingRouteKeys(G, ctx))) {
    state.track[key] = [...(state.track[key] ?? []), id];
  }
  for (const [id] of G.players ?? []) {
    state.engines[id] = [null, null];
    state.railyards[id] = null;
  }
  state.seenIndependentRailroads = independentRailroadKeys(G);
  state.seeded = true;
  return state;
}
