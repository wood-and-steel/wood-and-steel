import type { BezierPath, Point } from '../geometry/pathData';
import { joinSegments, moveHandle, snapEnds, splitSegment } from './pathEditing';

function evalSegment(p0: Point, c1: Point, c2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * c1.x + c * c2.x + d * p3.x, y: a * p0.y + b * c1.y + c * c2.y + d * p3.y };
}

const single: BezierPath = {
  start: { x: 0, y: 0 },
  segments: [{ c1: { x: 100, y: 0 }, c2: { x: 200, y: 100 }, end: { x: 300, y: 100 } }],
};

describe('pathEditing', () => {
  it('splits a segment without changing the curve', () => {
    const split = splitSegment(single, 0);
    expect(split.segments).toHaveLength(2);
    const [first, second] = split.segments;
    const original = single.segments[0];
    expect(first.end).toEqual(evalSegment(single.start, original.c1, original.c2, original.end, 0.5));
    const quarter = evalSegment(single.start, original.c1, original.c2, original.end, 0.25);
    const quarterFromHalf = evalSegment(single.start, first.c1, first.c2, first.end, 0.5);
    expect(quarterFromHalf.x).toBeCloseTo(quarter.x);
    expect(quarterFromHalf.y).toBeCloseTo(quarter.y);
    expect(second.end).toEqual(original.end);
  });

  it('joins back to one segment keeping the outer control points', () => {
    const joined = joinSegments(splitSegment(single, 0));
    expect(joined.segments).toHaveLength(1);
    expect(joined.segments[0].end).toEqual(single.segments[0].end);
  });

  it('carries adjacent control points when an anchor moves', () => {
    const split = splitSegment(single, 0);
    const moved = moveHandle(split, { kind: 'anchor', index: 1 }, { x: split.segments[0].end.x + 10, y: split.segments[0].end.y });
    expect(moved.segments[0].c2.x).toBeCloseTo(split.segments[0].c2.x + 10);
    expect(moved.segments[1].c1.x).toBeCloseTo(split.segments[1].c1.x + 10);
    expect(moved.segments[0].c1).toEqual(split.segments[0].c1);
  });

  it('keeps an interior joint smooth when a control point moves', () => {
    const split = splitSegment(single, 0);
    const joint = split.segments[0].end;
    const moved = moveHandle(split, { kind: 'c2', segment: 0 }, { x: joint.x - 50, y: joint.y - 20 });
    const partner = moved.segments[1].c1;
    const cross = (joint.x - (joint.x - 50)) * (partner.y - joint.y) - (joint.y - (joint.y - 20)) * (partner.x - joint.x);
    expect(cross).toBeCloseTo(0);
    const oldLength = Math.hypot(split.segments[1].c1.x - joint.x, split.segments[1].c1.y - joint.y);
    expect(Math.hypot(partner.x - joint.x, partner.y - joint.y)).toBeCloseTo(oldLength);
  });

  it('snaps both ends', () => {
    const snapped = snapEnds(single, { x: 5, y: 5 }, { x: 310, y: 90 });
    expect(snapped.start).toEqual({ x: 5, y: 5 });
    expect(snapped.segments[0].end).toEqual({ x: 310, y: 90 });
    expect(snapped.segments[0].c1).toEqual({ x: 105, y: 5 });
  });
});
