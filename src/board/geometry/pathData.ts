/**
 * Route path data: absolute "M x y C x y x y x y [C ...]" strings as stored in routePaths.ts.
 */

export interface Point {
  x: number;
  y: number;
}

export interface BezierSegment {
  c1: Point;
  c2: Point;
  end: Point;
}

export interface BezierPath {
  start: Point;
  segments: BezierSegment[];
}

const NUMBER_RE = /-?\d+(?:\.\d+)?/g;

export function parsePathD(d: string): BezierPath {
  const match = /^\s*M\s*(.*)$/.exec(d);
  if (!match) throw new Error(`Route path must start with M: ${d}`);
  const [head, ...curves] = match[1].split('C');
  const startNums = (head.match(NUMBER_RE) ?? []).map(Number);
  if (startNums.length !== 2) throw new Error(`Bad M command: ${d}`);
  const segments = curves.map((curve) => {
    const n = (curve.match(NUMBER_RE) ?? []).map(Number);
    if (n.length !== 6) throw new Error(`Bad C command: ${d}`);
    return {
      c1: { x: n[0], y: n[1] },
      c2: { x: n[2], y: n[3] },
      end: { x: n[4], y: n[5] },
    };
  });
  if (segments.length === 0) throw new Error(`Route path has no C command: ${d}`);
  return { start: { x: startNums[0], y: startNums[1] }, segments };
}

const fmt = (p: Point): string => `${Math.round(p.x)} ${Math.round(p.y)}`;

export function formatPathD(path: BezierPath): string {
  const curves = path.segments.map((s) => `C ${fmt(s.c1)} ${fmt(s.c2)} ${fmt(s.end)}`);
  return [`M ${fmt(path.start)}`, ...curves].join(' ');
}
