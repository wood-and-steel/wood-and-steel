import { routes } from '../../data/routes';
import { CITY_POINTS } from './cityPoints';
import { offsetPolyline, ownerSlots, samplePath, trackPathD, trimToCities, TRACK_SPACING } from './trackPaths';

const NUM = /-?\d+(?:\.\d+)?/g;
function points(d: string): { x: number; y: number }[] {
  const n = (d.match(NUM) ?? []).map(Number);
  return Array.from({ length: n.length / 2 }, (_, i) => ({ x: n[2 * i], y: n[2 * i + 1] }));
}

describe('track geometry', () => {
  it('samples a straight Bézier along its chord', () => {
    const pts = samplePath({ start: { x: 0, y: 0 }, segments: [{ c1: { x: 10, y: 0 }, c2: { x: 20, y: 0 }, end: { x: 30, y: 0 } }] });
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 30, y: 0 });
    expect(pts.every((p) => p.y === 0)).toBe(true);
  });

  it('offsets perpendicular to travel and trims inside city circles', () => {
    const line = [0, 25, 50, 75, 100].map((x) => ({ x, y: 0 }));
    expect(offsetPolyline(line, 10).every((p) => p.y === 10)).toBe(true);
    const trimmed = trimToCities(line, { x: 100, y: 0, r: 20 }, { x: 0, y: 0, r: 20 });
    expect(trimmed.map((p) => p.x)).toEqual([25, 50, 75]);
  });

  it('keeps the primary on the curve and alternates parallels, leaving the center to an indie', () => {
    expect(ownerSlots(3, false)).toEqual([0, 1, -1]);
    expect(ownerSlots(2, true)).toEqual([1, -1]);
  });

  it('draws every route, starting and ending outside both city circles', () => {
    const problems: string[] = [];
    for (const [key, route] of routes) {
      const d = trackPathD(key, 0);
      if (!d) {
        problems.push(`${key}: no path`);
        continue;
      }
      const pts = points(d);
      const cities = route.cities.map((c) => CITY_POINTS[c]);
      for (const end of [pts[0], pts[pts.length - 1]]) {
        if (cities.some((c) => Math.hypot(end.x - c.x, end.y - c.y) < c.r)) problems.push(`${key}: end inside a city`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('places a parallel stroke one spacing away from the primary', () => {
    const [p0] = points(trackPathD('Atlanta-Birmingham', 0)!);
    const [p1] = points(trackPathD('Atlanta-Birmingham', 1)!);
    expect(Math.hypot(p1.x - p0.x, p1.y - p0.y)).toBeCloseTo(TRACK_SPACING, 0);
  });
});
