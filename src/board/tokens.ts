/**
 * Engine and Railyard tokens (docs/archived/BOARD_APP_PLAN.md, M4): identity, where each one is,
 * how tokens sharing a city are laid out, and snapping a drop point to a city.
 */
import type { BoardOp, BoardState, EngineSlot } from './boardOps';
import { CITY_POINTS } from '../data/cityPoints';
import type { Point } from '../map/pathData';

export type TokenRef = { kind: 'engine'; playerID: string; slot: EngineSlot } | { kind: 'railyard'; playerID: string };

/** Token sizes on the map, in board pixels. Engines are right triangles with legs of ENGINE_SIZE. */
export const ENGINE_SIZE = 64;
/** The Railyard is a bold R as tall as a big city circle (r ≈ 46.9). */
export const RAILYARD_SIZE = 94;
/** Cap height of a bold sans-serif R, as a fraction of its font size. */
const CAP_HEIGHT = 0.71;

/** Font size that makes the Railyard R's cap height equal to size. */
export function railyardFontSize(size: number): number {
  return size / CAP_HEIGHT;
}

/** SVG points for an engine triangle centered on (x, y): right angle at the bottom left. */
export function enginePoints(x: number, y: number, size: number): string {
  const h = size / 2;
  return `${x - h},${y - h} ${x - h},${y + h} ${x + h},${y + h}`;
}
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

const tokenWidth = (token: TokenRef): number => (token.kind === 'engine' ? ENGINE_SIZE : RAILYARD_SIZE);

/** Total width of tokens laid side by side with TOKEN_GAP between them. */
const rowWidth = (tokens: TokenRef[]): number =>
  tokens.reduce((sum, t) => sum + tokenWidth(t), 0) + TOKEN_GAP * Math.max(tokens.length - 1, 0);

/**
 * Positions for tokens on the board, in play order. A city's Railyard is centered on it (several
 * Railyards share the center as a row), and its engines alternate left and right of the Railyard,
 * starting on the left and working outward. With no Railyard, engines form a row centered on the city.
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
    const place = (token: TokenRef, x: number) => placed.push({ token, city, x, y: center.y });
    const yards = cityTokens.filter((t) => t.kind === 'railyard');
    const engines = cityTokens.filter((t) => t.kind === 'engine');
    const centerRow = yards.length > 0 ? yards : engines;

    // The center row (Railyards, or engines when there is none) is centered on the city.
    let x = center.x - rowWidth(centerRow) / 2;
    for (const token of centerRow) {
      place(token, x + tokenWidth(token) / 2);
      x += tokenWidth(token) + TOKEN_GAP;
    }
    if (yards.length === 0) continue;

    // Engines alternate sides of the Railyards, left first.
    let left = center.x - rowWidth(yards) / 2 - TOKEN_GAP;
    let right = center.x + rowWidth(yards) / 2 + TOKEN_GAP;
    engines.forEach((token, i) => {
      const w = tokenWidth(token);
      if (i % 2 === 0) {
        place(token, left - w / 2);
        left -= w + TOKEN_GAP;
      } else {
        place(token, right + w / 2);
        right += w + TOKEN_GAP;
      }
    });
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
