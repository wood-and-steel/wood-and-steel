import { describe, expect, test } from 'vitest';
import { BOARD_HEIGHT, BOARD_WIDTH, CITY_POINTS } from '../data/cityPoints';
import { miniMapsFor } from './miniMap';
import { routePolyline } from './trackPaths';

const box = (viewBox: string) => {
  const [x, y, w, h] = viewBox.split(' ').map(Number);
  return { x, y, w, h };
};

describe('miniMapsFor', () => {
  test('draws the railroad and its cities only, marking the new routes, cropped around them', () => {
    const [map] = miniMapsFor(['Cleveland-Pittsburgh', 'Cleveland-Detroit'], new Set(['Cleveland-Detroit']));
    expect(map.cities.map((c) => c.name)).toEqual(['Cleveland', 'Detroit', 'Pittsburgh']);
    expect(map.routes).toEqual([
      { key: 'Cleveland-Pittsburgh', kind: 'indie' },
      { key: 'Cleveland-Detroit', kind: 'new' },
    ]);
    const { x, y, w, h } = box(map.viewBox);
    for (const c of map.cities) {
      expect(c.x).toBeGreaterThan(x);
      expect(c.x).toBeLessThan(x + w);
      expect(c.y).toBeGreaterThan(y);
      expect(c.y).toBeLessThan(y + h);
    }
    // Far smaller than the whole board.
    expect(w).toBeLessThan(2500);
  });

  test('keeps labels readable on a tall railroad: the font fits the final crop, which stays within its aspect', () => {
    const [map] = miniMapsFor(
      ['Seattle-Vancouver', 'Portland OR-Seattle', 'Portland OR-San Francisco'],
      new Set(['Portland OR-San Francisco'])
    );
    const { y, w, h } = box(map.viewBox);
    // About 12px on a 290px-wide map, as on any other map.
    expect((map.fontSize / w) * 290).toBeCloseTo(12.2, 0);
    expect(h / w).toBeLessThanOrEqual(0.8 + 1e-3);
    for (const c of map.cities) {
      expect(c.y).toBeGreaterThan(y);
      expect(c.y).toBeLessThan(y + h);
    }
  });

  test('ignores route keys it has no geometry for', () => {
    expect(miniMapsFor(['Nowhere-Elsewhere'], new Set())).toEqual([]);
  });

  test('splits a railroad in far-apart pieces into one map per piece that grew', () => {
    expect(CITY_POINTS['Seattle'].x).toBeLessThan(CITY_POINTS['Boston'].x - 4000);
    const maps = miniMapsFor(
      ['Seattle-Spokane', 'Boston-Portland ME', 'Boston-New York'],
      new Set(['Seattle-Spokane', 'Boston-New York'])
    );
    expect(maps.map((m) => m.cities.map((c) => c.name))).toEqual([
      ['Seattle', 'Spokane'],
      ['Boston', 'New York', 'Portland ME'],
    ]);
  });

  test('crops around the route curves, not just their cities', () => {
    const key = 'Boise-Salt Lake City';
    const [map] = miniMapsFor([key], new Set([key]));
    const { x, y, w, h } = box(map.viewBox);
    for (const p of routePolyline(key)!) {
      expect(p.x).toBeGreaterThanOrEqual(x);
      expect(p.x).toBeLessThanOrEqual(x + w);
      expect(p.y).toBeGreaterThanOrEqual(y);
      expect(p.y).toBeLessThanOrEqual(y + h);
    }
  });

  test('keeps the crop on the board art near its edge', () => {
    const [map] = miniMapsFor(['Seattle-Vancouver'], new Set(['Seattle-Vancouver']));
    const { x, y, w, h } = box(map.viewBox);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(BOARD_WIDTH);
    expect(y + h).toBeLessThanOrEqual(BOARD_HEIGHT);
  });

  test("draws other railroads' routes faintly where they cross the crop, and not far-off ones", () => {
    const [map] = miniMapsFor(['Cleveland-Detroit'], new Set(['Cleveland-Detroit']), [
      'Cleveland-Pittsburgh',
      'Cleveland-Detroit',
      'Seattle-Spokane',
    ]);
    expect(map.routes).toEqual([
      { key: 'Cleveland-Detroit', kind: 'new' },
      { key: 'Cleveland-Pittsburgh', kind: 'faint' },
    ]);
  });

  test('scales route strokes with the crop, so wide maps keep their routes visible', () => {
    const [narrow] = miniMapsFor(['Cleveland-Detroit'], new Set());
    const [wide] = miniMapsFor(['Seattle-Spokane', 'Butte-Spokane', 'Bismarck-Butte'], new Set());
    expect(narrow.routeScale).toBeCloseTo(1);
    expect(wide.routeScale).toBeGreaterThan(1);
    expect(wide.routeScale).toBeCloseTo(box(wide.viewBox).w / 1300, 1);
  });

  test('keeps every label inside its map, on a railroad at the edge of the board', () => {
    const keys = ['Portland OR-San Francisco', 'Portland OR-Seattle', 'Seattle-Spokane'];
    const [map] = miniMapsFor(keys, new Set(['Portland OR-San Francisco']));
    const { x, y, w, h } = box(map.viewBox);
    for (const c of map.cities) {
      const width = c.name.length * 0.56 * map.fontSize;
      const left = c.anchor === 'start' ? c.labelX : c.anchor === 'end' ? c.labelX - width : c.labelX - width / 2;
      expect(left).toBeGreaterThanOrEqual(x);
      expect(left + width).toBeLessThanOrEqual(x + w);
      expect(c.labelY - 0.72 * map.fontSize).toBeGreaterThanOrEqual(y);
      expect(c.labelY).toBeLessThanOrEqual(y + h);
    }
  });

  test('puts labels where they cover no route of the railroad when there is room', () => {
    // Bismarck-Fargo runs east-west, so neither label belongs beside its city on the line.
    const [map] = miniMapsFor(['Bismarck-Fargo'], new Set());
    expect(map.cities.map((c) => c.anchor)).toEqual(['middle', 'middle']);
  });
});
