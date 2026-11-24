import { describe, expect, test } from 'vitest';
import { CITY_POINTS } from '../data/cityPoints';
import { miniMapsFor } from './miniMap';

const box = (viewBox: string) => {
  const [x, y, w, h] = viewBox.split(' ').map(Number);
  return { x, y, w, h };
};

describe('miniMapsFor', () => {
  test('draws the railroad and its cities only, marking the new routes, cropped around them', () => {
    const [map] = miniMapsFor(['Cleveland-Pittsburgh', 'Cleveland-Detroit'], new Set(['Cleveland-Detroit']));
    expect(map.cities.map((c) => c.name)).toEqual(['Cleveland', 'Detroit', 'Pittsburgh']);
    expect(map.routes.map((r) => [r.key, r.isNew])).toEqual([
      ['Cleveland-Pittsburgh', false],
      ['Cleveland-Detroit', true],
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
});
