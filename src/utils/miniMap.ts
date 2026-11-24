/**
 * Geometry for the round report's mini maps: one independent railroad's routes as straight
 * lines between its cities, cropped to that railroad with room for the city labels. Board
 * pixels throughout (src/data/cityPoints.ts); the SVG's viewBox does the zooming.
 */
import { CITY_POINTS } from '../data/cityPoints';
import { routes as ROUTES } from '../data/routes';

export interface MiniMapRoute {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isNew: boolean;
}

export interface MiniMapCity {
  name: string;
  x: number;
  y: number;
  /** Where the label's baseline goes: above the city, or below it near the top edge. */
  labelY: number;
}

export interface MiniMap {
  viewBox: string;
  routes: MiniMapRoute[];
  cities: MiniMapCity[];
  /** In board pixels; about 12px on a 290px-wide map. */
  fontSize: number;
  cityRadius: number;
}

/** The narrowest crop, so one short route isn't blown up to fill the map. */
const MIN_WIDTH = 1300;
/** Wider than this, a railroad in separate pieces gets one map per piece. */
const SPLIT_WIDTH = 2600;
/** A map is at most this tall for its width, and at least this short. */
const MAX_ASPECT = 0.8;
const MIN_ASPECT = 0.3;
/** Label size relative to the crop's width: about 12px on a 290px-wide map. */
const FONT_RATIO = 0.042;
/** Rough average width of a character, relative to the font size. */
const CHAR_WIDTH = 0.56;

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function citiesOf(key: string): [string, string] | null {
  const cities = ROUTES.get(key)?.cities;
  if (!cities || cities.length !== 2 || !CITY_POINTS[cities[0]] || !CITY_POINTS[cities[1]]) return null;
  return [cities[0], cities[1]];
}

/** Groups of route keys that share cities. */
function connectedPieces(keys: string[]): string[][] {
  const pieces: { keys: string[]; cities: Set<string> }[] = [];
  for (const key of keys) {
    const ends = citiesOf(key);
    if (!ends) continue;
    const touching = pieces.filter((p) => p.cities.has(ends[0]) || p.cities.has(ends[1]));
    const merged = { keys: [key], cities: new Set<string>(ends) };
    for (const p of touching) {
      merged.keys.push(...p.keys);
      p.cities.forEach((c) => merged.cities.add(c));
      pieces.splice(pieces.indexOf(p), 1);
    }
    pieces.push(merged);
  }
  return pieces.map((p) => p.keys);
}

function boxOf(cityNames: Iterable<string>): Box {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const name of cityNames) {
    const { x, y } = CITY_POINTS[name];
    box.minX = Math.min(box.minX, x);
    box.minY = Math.min(box.minY, y);
    box.maxX = Math.max(box.maxX, x);
    box.maxY = Math.max(box.maxY, y);
  }
  return box;
}

function citySet(keys: string[]): Set<string> {
  const cities = new Set<string>();
  for (const key of keys) citiesOf(key)?.forEach((c) => cities.add(c));
  return cities;
}

function buildMap(keys: string[], newKeys: ReadonlySet<string>): MiniMap {
  const names = [...citySet(keys)].sort();
  const cityBox = boxOf(names);
  const longest = Math.max(...names.map((n) => n.length));

  // The font depends on the crop's width and the crop on the labels' width, so settle it in two passes.
  let width = Math.max(MIN_WIDTH, cityBox.maxX - cityBox.minX);
  let fontSize = width * FONT_RATIO;
  for (let pass = 0; pass < 2; pass++) {
    const halfLabel = (longest * CHAR_WIDTH * fontSize) / 2;
    width = Math.max(MIN_WIDTH, cityBox.maxX - cityBox.minX + 2 * halfLabel + fontSize);
    fontSize = width * FONT_RATIO;
  }
  const cityRadius = fontSize * 0.42;
  const padY = fontSize * 2;
  let height = cityBox.maxY - cityBox.minY + 2 * padY;
  height = Math.min(Math.max(height, width * MIN_ASPECT), width * MAX_ASPECT);
  if (cityBox.maxY - cityBox.minY + 2 * padY > height) {
    // Tall railroad: widen the crop instead of squashing it.
    height = cityBox.maxY - cityBox.minY + 2 * padY;
    width = Math.max(width, height / MAX_ASPECT);
  }
  const cx = (cityBox.minX + cityBox.maxX) / 2;
  const cy = (cityBox.minY + cityBox.maxY) / 2;
  const left = cx - width / 2;
  const top = cy - height / 2;

  const routes: MiniMapRoute[] = keys.flatMap((key) => {
    const ends = citiesOf(key);
    if (!ends) return [];
    const [a, b] = [CITY_POINTS[ends[0]], CITY_POINTS[ends[1]]];
    return [{ key, x1: a.x, y1: a.y, x2: b.x, y2: b.y, isNew: newKeys.has(key) }];
  });
  const cities: MiniMapCity[] = names.map((name) => {
    const { x, y } = CITY_POINTS[name];
    const nearTop = y - top < fontSize * 1.8;
    return { name, x, y, labelY: nearTop ? y + cityRadius + fontSize : y - cityRadius - fontSize * 0.35 };
  });

  const r = (n: number) => Math.round(n);
  return { viewBox: `${r(left)} ${r(top)} ${r(width)} ${r(height)}`, routes, cities, fontSize, cityRadius };
}

/**
 * Mini maps for a railroad with routes `routeKeys`, of which `newKeys` were added this round:
 * one map, or one per separate piece when the whole railroad would be too wide to read.
 */
export function miniMapsFor(routeKeys: string[], newKeys: ReadonlySet<string>): MiniMap[] {
  const keys = [...new Set(routeKeys)].filter((k) => citiesOf(k) !== null);
  if (keys.length === 0) return [];
  const whole = boxOf(citySet(keys));
  const pieces = connectedPieces(keys);
  if (whole.maxX - whole.minX <= SPLIT_WIDTH || pieces.length === 1) return [buildMap(keys, newKeys)];
  // Only the pieces that grew are worth a map of their own.
  return pieces.filter((piece) => piece.some((k) => newKeys.has(k))).map((piece) => buildMap(piece, newKeys));
}
