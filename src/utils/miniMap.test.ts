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
