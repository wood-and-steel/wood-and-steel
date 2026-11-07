import type { BezierPath, BezierSegment, Point } from '../geometry/pathData';

/**
 * A draggable point on a path. Anchor 0 is the start; anchor i is segments[i - 1].end.
 */
export type PathHandle =
  | { kind: 'anchor'; index: number }
  | { kind: 'c1' | 'c2'; segment: number };

export function getHandlePoint(path: BezierPath, handle: PathHandle): Point {
  if (handle.kind === 'anchor') {
    return handle.index === 0 ? path.start : path.segments[handle.index - 1].end;
  }
  return path.segments[handle.segment][handle.kind];
}

const add = (p: Point, dx: number, dy: number): Point => ({ x: p.x + dx, y: p.y + dy });

/**
 * Move one handle. Anchors carry their adjacent control points along; a control point next to an
 * interior joint rotates its partner so the joint stays smooth (partner keeps its length).
 */
export function moveHandle(path: BezierPath, handle: PathHandle, to: Point): BezierPath {
  const segments = path.segments.map((s) => ({ ...s }));
  let start = path.start;

  if (handle.kind === 'anchor') {
    const from = getHandlePoint(path, handle);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const before = handle.index - 1;
    const after = handle.index;
    if (handle.index === 0) start = to;
    if (before >= 0) {
      segments[before].end = to;
      segments[before].c2 = add(segments[before].c2, dx, dy);
    }
    if (after < segments.length) {
      segments[after].c1 = add(segments[after].c1, dx, dy);
    }
    return { start, segments };
  }

  segments[handle.segment][handle.kind] = to;
  const joint =
    handle.kind === 'c2' && handle.segment < segments.length - 1
      ? { at: segments[handle.segment].end, partner: segments[handle.segment + 1], key: 'c1' as const }
      : handle.kind === 'c1' && handle.segment > 0
        ? { at: segments[handle.segment - 1].end, partner: segments[handle.segment - 1], key: 'c2' as const }
        : null;
  if (joint) {
    const partnerPoint = joint.partner[joint.key];
    const length = Math.hypot(partnerPoint.x - joint.at.x, partnerPoint.y - joint.at.y);
    const dirX = joint.at.x - to.x;
    const dirY = joint.at.y - to.y;
    const dirLength = Math.hypot(dirX, dirY);
    if (dirLength > 0) {
      joint.partner[joint.key] = {
        x: joint.at.x + (dirX / dirLength) * length,
        y: joint.at.y + (dirY / dirLength) * length,
      };
    }
  }
  return { start, segments };
}

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Split one segment in two at t = 0.5 (de Casteljau); the curve shape is unchanged. */
export function splitSegment(path: BezierPath, index: number): BezierPath {
  const p0 = index === 0 ? path.start : path.segments[index - 1].end;
  const { c1, c2, end } = path.segments[index];
  const a = lerp(p0, c1, 0.5);
  const b = lerp(c1, c2, 0.5);
  const c = lerp(c2, end, 0.5);
  const d = lerp(a, b, 0.5);
  const e = lerp(b, c, 0.5);
  const mid = lerp(d, e, 0.5);
  const halves: BezierSegment[] = [
    { c1: a, c2: d, end: mid },
    { c1: e, c2: c, end },
  ];
  return {
    start: path.start,
    segments: [...path.segments.slice(0, index), ...halves, ...path.segments.slice(index + 1)],
  };
}

/** Collapse to one segment, keeping the outer control points. */
export function joinSegments(path: BezierPath): BezierPath {
  const first = path.segments[0];
  const last = path.segments[path.segments.length - 1];
  return { start: path.start, segments: [{ c1: first.c1, c2: last.c2, end: last.end }] };
}

/** Move the path ends onto the given points, carrying the end control points along. */
export function snapEnds(path: BezierPath, from: Point, to: Point): BezierPath {
  const moved = moveHandle(path, { kind: 'anchor', index: 0 }, from);
  return moveHandle(moved, { kind: 'anchor', index: moved.segments.length }, to);
}

export function pathBounds(path: BezierPath): { minX: number; minY: number; maxX: number; maxY: number } {
  const points = [path.start, ...path.segments.flatMap((s) => [s.c1, s.c2, s.end])];
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}
