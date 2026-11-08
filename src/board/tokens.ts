/**
 * Engine and Railyard tokens (docs/archived/BOARD_APP_PLAN.md, M4): identity, where each one is,
 * how tokens sharing a city are laid out, and snapping a drop point to a city.
 */
import type { BoardOp, BoardState, EngineSlot } from './boardOps';
import { CITY_POINTS } from './geometry/cityPoints';
import type { Point } from './geometry/pathData';

export type TokenRef = { kind: 'engine'; playerID: string; slot: EngineSlot } | { kind: 'railyard'; playerID: string };

/** Token sizes on the map, in board pixels. */
export const ENGINE_WIDTH = 64;
export const ENGINE_HEIGHT = 40;
export const RAILYARD_RADIUS = 24;
const TOKEN_GAP = 6;

export function tokenId(token: TokenRef): string {
  return token.kind === 'engine' ? `engine-${token.playerID}-${token.slot}` : `railyard-${token.playerID}`;
}

export function sameToken(a: TokenRef | null | undefined, b: TokenRef): boolean {
  return !!a && tokenId(a) === tokenId(b);
}

export function tokenLabel(token: TokenRef): string {
  if (token.kind === 'railyard') return 'Railyard';
  return token.slot === 0 ? 'Light engine' : 'Dark engine';
}

/** The city a token is on, or null if it is in its tray. */
export function tokenCity(board: BoardState | null, token: TokenRef): string | null {
  if (!board) return null;
  if (token.kind === 'railyard') return board.railyards[token.playerID] ?? null;
  return board.engines[token.playerID]?.[token.slot] ?? null;
}

export function moveTokenOp(token: TokenRef, city: string | null): BoardOp {
  return token.kind === 'engine'
    ? { type: 'moveEngine', playerID: token.playerID, slot: token.slot, city }
    : { type: 'moveRailyard', playerID: token.playerID, city };
}

/** Every player's tokens, in play order: Railyard, light engine, dark engine. */
export function allTokens(playerIDs: string[]): TokenRef[] {
  return playerIDs.flatMap((playerID): TokenRef[] => [
    { kind: 'railyard', playerID },
    { kind: 'engine', playerID, slot: 0 },
    { kind: 'engine', playerID, slot: 1 },
  ]);
}

export interface PlacedToken {
  token: TokenRef;
  city: string;
  /** Token center in board pixels */
  x: number;
  y: number;
}

const tokenWidth = (token: TokenRef): number => (token.kind === 'engine' ? ENGINE_WIDTH : RAILYARD_RADIUS * 2);

/**
 * Positions for tokens on the board: Railyards first, then engines, in play order,
 * in a row centered on their city.
 */
export function layoutTokens(board: BoardState | null, playerIDs: string[]): PlacedToken[] {
  const tokens = [...allTokens(playerIDs)].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'railyard' ? -1 : 1));
  const byCity = new Map<string, TokenRef[]>();
  for (const token of tokens) {
    const city = tokenCity(board, token);
    if (city && CITY_POINTS[city]) byCity.set(city, [...(byCity.get(city) ?? []), token]);
  }
  const placed: PlacedToken[] = [];
  for (const [city, cityTokens] of byCity) {
    const center = CITY_POINTS[city];
    const total = cityTokens.reduce((sum, t) => sum + tokenWidth(t), 0) + TOKEN_GAP * (cityTokens.length - 1);
    let x = center.x - total / 2;
    for (const token of cityTokens) {
      const w = tokenWidth(token);
      placed.push({ token, city, x: x + w / 2, y: center.y });
      x += w + TOKEN_GAP;
    }
  }
  return placed;
}

/** The city nearest to a board point, if within maxDistance (board pixels) of its edge. */
export function nearestCity(point: Point, maxDistance: number): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const [city, p] of Object.entries(CITY_POINTS)) {
    const d = Math.hypot(point.x - p.x, point.y - p.y) - p.r;
    if (d < bestDistance) {
      best = city;
      bestDistance = d;
    }
  }
  return bestDistance <= maxDistance ? best : null;
}
