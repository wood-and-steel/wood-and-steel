/**
 * Acquisition auto-convert (docs/archived/BOARD_APP_PLAN.md, M5): compare the board's snapshot of
 * independent railroads with G and build the op that converts acquired railroads to track.
 */
import { routes } from '../data/routes';
import type { GameContext, GameState } from '../stores/gameStore';
import type { BoardOp, BoardState } from './boardOps';
import { independentRailroadKeys } from './boardSeed';

function sameRailroads(a: Record<string, string[]>, b: Record<string, string[]>): boolean {
  const names = Object.keys(a);
  if (names.length !== Object.keys(b).length) return false;
  return names.every((name) => {
    const x = a[name];
    const y = b[name];
    return y !== undefined && x.length === y.length && x.every((key, i) => key === y[i]);
  });
}

function citiesOf(routeKeys: string[]): string[] {
  return [...new Set(routeKeys.flatMap((key) => routes.get(key)?.cities ?? []))];
}

/**
 * Who acquired a railroad: the acquire move adds all of its cities to the acquirer's
 * activeCities. If exactly one player has them all, it's that player; if several do,
 * the current player if among them; otherwise unknown (null).
 */
export function findAcquirer(G: GameState, ctx: GameContext, routeKeys: string[]): string | null {
  const cities = citiesOf(routeKeys);
  if (cities.length === 0) return null;
  const candidates = (G.players ?? [])
    .filter(([, props]) => {
      const active = new Set(props.activeCities ?? []);
      return cities.every((city) => active.has(city));
    })
    .map(([id]) => id);
  if (candidates.length === 1) return candidates[0];
  return candidates.includes(ctx.currentPlayer) ? ctx.currentPlayer : null;
}

/**
 * The op that brings the board's snapshot in line with G, or null if it already matches.
 * Railroads missing from G get an acquirer; new railroads and new routes (end-of-round
 * growth) only update the snapshot.
 */
export function reconcileOp(board: BoardState, G: GameState, ctx: GameContext): BoardOp | null {
  const railroads = independentRailroadKeys(G);
  if (sameRailroads(board.seenIndependentRailroads, railroads)) return null;
  const acquirers: Record<string, string | null> = {};
  for (const [name, routeKeys] of Object.entries(board.seenIndependentRailroads)) {
    if (!(name in railroads)) acquirers[name] = findAcquirer(G, ctx, routeKeys);
  }
  return { type: 'reconcileIndependentRailroads', railroads, acquirers };
}
