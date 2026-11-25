/**
 * Geometry for the round report's mini maps: one independent railroad's routes on the map art,
 * cropped to that railroad with room for the city labels, plus other railroads' routes that fall
 * inside the crop. Board pixels throughout (src/data/cityPoints.ts); the SVG's viewBox does the
 * zooming.
 */
import { BOARD_HEIGHT, BOARD_WIDTH, CITY_POINTS } from '../data/cityPoints';
import { routes as ROUTES } from '../data/routes';
import type { MapRoute } from './MapRoutes';
import { routePolyline } from './trackPaths';

export interface MiniMapCity {
  name: string;
  x: number;
  y: number;
  /** The label's anchor point and alignment: on the side of the city away from its routes. */
  labelX: number;
  labelY: number;
  anchor: 'start' | 'middle' | 'end';
}

export interface MiniMap {
  viewBox: string;
  /** The railroad's routes (`indie`, or `new` if added this round) and others' in the crop (`faint`). */
  routes: MapRoute[];
  /** The railroad's cities, to label. The art draws the circles. */
  cities: MiniMapCity[];
  /** In board pixels; about 12px on a 290px-wide map. */
  fontSize: number;
  /** Route stroke widths' multiplier, so a wide crop's routes are as thick on screen as a narrow one's. */
  routeScale: number;
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
/** Text heights relative to the font size: capitals above the baseline, and the box a label takes. */
const CAP_HEIGHT = 0.72;

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

function citySet(keys: string[]): Set<string> {
  const cities = new Set<string>();
  for (const key of keys) citiesOf(key)?.forEach((c) => cities.add(c));
  return cities;
}

/** The box around the routes' cities and their curves, which can bulge past the cities. */
function boxOf(keys: string[]): Box {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const add = ({ x, y }: { x: number; y: number }) => {
    box.minX = Math.min(box.minX, x);
    box.minY = Math.min(box.minY, y);
    box.maxX = Math.max(box.maxX, x);
    box.maxY = Math.max(box.maxY, y);
  };
  for (const name of citySet(keys)) add(CITY_POINTS[name]);
  for (const key of keys) routePolyline(key)?.forEach(add);
  return box;
}

/** Slide a crop inside the board, where it fits, so it doesn't run off the art. */
function clampToBoard(start: number, size: number, boardSize: number): number {
  return size >= boardSize ? (boardSize - size) / 2 : Math.min(Math.max(start, 0), boardSize - size);
}

const overlaps = (a: Box, b: Box): boolean => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
const contains = (box: Box, p: { x: number; y: number }, pad: number): boolean =>
  p.x >= box.minX - pad && p.x <= box.maxX + pad && p.y >= box.minY - pad && p.y <= box.maxY + pad;

/** Whether a route has a point inside `box`, or within `pad` of it. */
function crosses(key: string, box: Box, pad = 0): boolean {
  return (routePolyline(key) ?? []).some((p) => contains(box, p, pad));
}

type Anchor = MiniMapCity['anchor'];

/** Spots around a city for its label, most preferred first: [dx, dy] direction and text anchor. */
const SPOTS: { dx: number; dy: number; anchor: Anchor }[] = [
  { dx: 0, dy: -1, anchor: 'middle' },
  { dx: 0, dy: 1, anchor: 'middle' },
  { dx: 1, dy: 0, anchor: 'start' },
  { dx: -1, dy: 0, anchor: 'end' },
  { dx: 0.7, dy: -0.7, anchor: 'start' },
  { dx: -0.7, dy: -0.7, anchor: 'end' },
  { dx: 0.7, dy: 0.7, anchor: 'start' },
  { dx: -0.7, dy: 0.7, anchor: 'end' },
];

interface PlacedLabel {
  city: MiniMapCity;
  box: Box;
}

/** How many times further out a label may move, one font size each, when no spot next to its city is free. */
const MAX_RING = 4;

/**
 * A label at one spot around its city, `ring` font sizes further out than next to it: where the
 * text goes and the box it covers.
 */
function labelAt(name: string, spot: (typeof SPOTS)[number], fontSize: number, ring = 0): PlacedLabel {
  const { x, y, r } = CITY_POINTS[name];
  const width = name.length * CHAR_WIDTH * fontSize;
  const gap = fontSize * (0.3 + ring);
  const labelX = spot.dx === 0 ? x : x + spot.dx * (r + gap);
  // Above or below: clear the circle. Level with the city: center the capitals on it.
  const labelY =
    spot.dy < 0 ? y + spot.dy * (r + gap) : spot.dy > 0 ? y + spot.dy * (r + gap) + CAP_HEIGHT * fontSize : y + (CAP_HEIGHT / 2) * fontSize;
  const minX = spot.anchor === 'middle' ? labelX - width / 2 : spot.anchor === 'start' ? labelX : labelX - width;
  return {
    city: { name, x, y, labelX, labelY, anchor: spot.anchor },
    box: { minX, maxX: minX + width, minY: labelY - CAP_HEIGHT * fontSize, maxY: labelY + 0.1 * fontSize },
  };
}

/**
 * Labels for `names`, each at the spot around its city that covers the fewest route points and
 * city circles. A label never overlaps another or leaves the board art: when every spot next to
 * its city would, it moves further out, ring by ring. The busiest cities choose first. Returned
 * in the order of `names`.
 */
function placeLabels(names: string[], keys: string[], otherKeys: string[], fontSize: number): PlacedLabel[] {
  const routePoints = [...keys, ...otherKeys].flatMap((key) => routePolyline(key) ?? []);
  const routeCount = (name: string) => keys.filter((key) => citiesOf(key)?.includes(name)).length;
  const order = [...names].sort((a, b) => routeCount(b) - routeCount(a) || (a < b ? -1 : 1));
  const pad = fontSize * 0.2;
  const placed = new Map<string, PlacedLabel>();
  for (const name of order) {
    const fits = ({ box }: PlacedLabel): boolean =>
      box.minX >= 0 &&
      box.minY >= 0 &&
      box.maxX <= BOARD_WIDTH &&
      box.maxY <= BOARD_HEIGHT &&
      ![...placed.values()].some((other) => overlaps(box, other.box));
    const cost = ({ box }: PlacedLabel, preference: number): number => {
      const routeHits = routePoints.filter((p) => contains(box, p, pad)).length;
      const cityHits = names.filter((other) => contains(box, CITY_POINTS[other], CITY_POINTS[other].r)).length;
      return 3 * routeHits + 40 * cityHits + preference;
    };
    let best: { label: PlacedLabel; cost: number } | undefined;
    for (let ring = 0; ring <= MAX_RING && !best; ring++) {
      for (const [i, spot] of SPOTS.entries()) {
        const label = labelAt(name, spot, fontSize, ring);
        if (!fits(label)) continue;
        const c = cost(label, i * 0.5);
        if (!best || c < best.cost) best = { label, cost: c };
      }
    }
    // Nothing fits within MAX_RING (none did in 1,000 maps from grown games): keep the preferred spot.
    placed.set(name, best?.label ?? labelAt(name, SPOTS[0], fontSize));
  }
  return names.map((name) => placed.get(name)!);
}

function union(a: Box, b: Box): Box {
  return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) };
}

function buildMap(keys: string[], newKeys: ReadonlySet<string>, otherKeys: string[]): MiniMap {
  const names = [...citySet(keys)].sort();
  const content = boxOf(keys);

  // The font depends on the crop's width, and the crop on where the labels land and how big
  // they are; a tall railroad is widened rather than squashed past MAX_ASPECT. Settle both
  // before sizing anything, so labels stay readable.
  let width = Math.max(MIN_WIDTH, content.maxX - content.minX);
  let fontSize = width * FONT_RATIO;
  const nearby = otherKeys.filter((key) => !keys.includes(key) && crosses(key, content, width));
  let placed = placeLabels(names, keys, nearby, fontSize);
  let all = content;
  for (let pass = 0; pass < 6; pass++) {
    all = placed.reduce((box, label) => union(box, label.box), content);
    width = Math.max(MIN_WIDTH, all.maxX - all.minX + fontSize, (all.maxY - all.minY + fontSize) / MAX_ASPECT);
    fontSize = width * FONT_RATIO;
    placed = placeLabels(names, keys, nearby, fontSize);
  }
  // The last placement may have moved a label: make sure the crop holds every one.
  all = placed.reduce((box, label) => union(box, label.box), content);
  width = Math.max(width, all.maxX - all.minX + fontSize, (all.maxY - all.minY + fontSize) / MAX_ASPECT);
  const height = Math.min(Math.max(all.maxY - all.minY + fontSize, width * MIN_ASPECT), width * MAX_ASPECT);
  const left = clampToBoard((all.minX + all.maxX) / 2 - width / 2, width, BOARD_WIDTH);
  const top = clampToBoard((all.minY + all.maxY) / 2 - height / 2, height, BOARD_HEIGHT);
  const crop = { minX: left, minY: top, maxX: left + width, maxY: top + height };

  const own = new Set(keys);
  const routes: MapRoute[] = [
    ...keys.map((key): MapRoute => ({ key, kind: newKeys.has(key) ? 'new' : 'indie' })),
    ...otherKeys.filter((key) => !own.has(key) && crosses(key, crop)).map((key): MapRoute => ({ key, kind: 'faint' })),
  ];

  const round = (n: number) => Math.round(n);
  return {
    viewBox: `${round(left)} ${round(top)} ${round(width)} ${round(height)}`,
    routes,
    cities: placed.map((label) => label.city),
    fontSize,
    routeScale: width / MIN_WIDTH,
  };
}

/**
 * Mini maps for a railroad with routes `routeKeys`, of which `newKeys` were added this round:
 * one map, or one per separate piece when the whole railroad would be too wide to read.
 * `otherKeys` are other railroads' routes, drawn faintly where they cross a map.
 */
export function miniMapsFor(routeKeys: string[], newKeys: ReadonlySet<string>, otherKeys: Iterable<string> = []): MiniMap[] {
  const keys = [...new Set(routeKeys)].filter((k) => citiesOf(k) !== null && routePolyline(k) !== null);
  if (keys.length === 0) return [];
  const others = [...new Set(otherKeys)];
  const whole = boxOf(keys);
  const pieces = connectedPieces(keys);
  if (whole.maxX - whole.minX <= SPLIT_WIDTH || pieces.length === 1) return [buildMap(keys, newKeys, others)];
  // Only the pieces that grew are worth a map of their own.
  return pieces.filter((piece) => piece.some((k) => newKeys.has(k))).map((piece) => buildMap(piece, newKeys, others));
}
