/**
 * Player track geometry: each route's Bézier is sampled into a polyline, trimmed at the two
 * city circles, and offset sideways so parallel owners sit next to each other.
 */
import { routes } from '../../data/routes';
import { CITY_POINTS } from './cityPoints';
import { parsePathD, type BezierPath, type Point } from './pathData';
import { ROUTE_PATHS } from './routePaths';

/** Track stroke width in board pixels (printed route strokes are ~23px). */
export const TRACK_WIDTH = 18;
/** Center-to-center distance between side-by-side owners. */
export const TRACK_SPACING = TRACK_WIDTH + 4;
const SAMPLES_PER_SEGMENT = 32;
/** Extra gap between the end of the track and the city circle. */
const CITY_GAP = 4;

function cubic(p0: Point, c1: Point, c2: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * c1.x + c * c2.x + d * p1.x, y: a * p0.y + b * c1.y + c * c2.y + d * p1.y };
}

export function samplePath(path: BezierPath): Point[] {
  const points: Point[] = [path.start];
  let p0 = path.start;
  for (const seg of path.segments) {
    for (let i = 1; i <= SAMPLES_PER_SEGMENT; i++) {
      points.push(cubic(p0, seg.c1, seg.c2, seg.end, i / SAMPLES_PER_SEGMENT));
    }
    p0 = seg.end;
  }
  return points;
}

const dist = (a: Point, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Drop points inside either end's city circle. */
export function trimToCities(points: Point[], cityA: { x: number; y: number; r: number }, cityB: { x: number; y: number; r: number }): Point[] {
  // The path may run in either direction between the two cities.
  const [first, last] = dist(points[0], cityA) <= dist(points[0], cityB) ? [cityA, cityB] : [cityB, cityA];
  let start = 0;
  let end = points.length - 1;
  while (start < end && dist(points[start], first) < first.r + CITY_GAP) start++;
  while (end > start && dist(points[end], last) < last.r + CITY_GAP) end--;
  const trimmed = points.slice(start, end + 1);
  return trimmed.length >= 2 ? trimmed : points;
}

/** Shift every point along the local normal (left of travel direction for positive offsets). */
export function offsetPolyline(points: Point[], offset: number): Point[] {
  if (offset === 0) return points;
  return points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x - (dy / len) * offset, y: p.y + (dx / len) * offset };
  });
}

const polylineD = (points: Point[]): string =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

/**
 * Sideways slot (in TRACK_SPACING units) for each owner: primary on the curve, parallels
 * alternating sides. When an indie railroad also owns the route, the center stays clear for it.
 */
export function ownerSlots(ownerCount: number, indieOnRoute: boolean): number[] {
  const sequence = [0, 1, -1, 2, -2, 3];
  return sequence.slice(indieOnRoute ? 1 : 0).slice(0, ownerCount);
}

const trimmedCache = new Map<string, Point[] | null>();
const dCache = new Map<string, string | null>();

function trimmedPoints(routeKey: string): Point[] | null {
  if (!trimmedCache.has(routeKey)) {
    const d = ROUTE_PATHS[routeKey];
    const route = routes.get(routeKey);
    const [a, b] = route?.cities.map((c) => CITY_POINTS[c]) ?? [];
    trimmedCache.set(routeKey, d && a && b ? trimToCities(samplePath(parsePathD(d)), a, b) : null);
  }
  return trimmedCache.get(routeKey)!;
}

/** SVG path d for one owner's stroke on a route, `slot` track widths to the side. Null if the route has no geometry. */
export function trackPathD(routeKey: string, slot: number): string | null {
  const cacheKey = `${routeKey}|${slot}`;
  if (!dCache.has(cacheKey)) {
    const points = trimmedPoints(routeKey);
    dCache.set(cacheKey, points ? polylineD(offsetPolyline(points, slot * TRACK_SPACING)) : null);
  }
  return dCache.get(cacheKey)!;
}
