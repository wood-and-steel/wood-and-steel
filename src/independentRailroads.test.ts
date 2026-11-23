import { describe, test, expect } from 'vitest';
import { routes } from './data';
import {
  canIndependentRailroadOccupy,
  initializeIndependentRailroads,
  growIndependentRailroads,
} from './independentRailroads';
import type { GameContext, GameState } from './stores/gameStore';

const longMountainousRoutes = [...routes.entries()]
  .filter(([, r]) => r.mountainous && r.length >= 4)
  .map(([key]) => key);

function allIndieRouteKeys(G: Pick<GameState, 'independentRailroads'>): string[] {
  return Object.values(G.independentRailroads).flatMap((rr) =>
    rr.routes.map((r) => r.key)
  );
}

describe('canIndependentRailroadOccupy', () => {
  test('rejects mountainous routes of length 4 or more', () => {
    expect(longMountainousRoutes.length).toBeGreaterThan(0);
    for (const key of longMountainousRoutes) {
      expect(canIndependentRailroadOccupy(key)).toBe(false);
    }
  });

  test('allows short mountainous routes and long flat routes', () => {
    expect(canIndependentRailroadOccupy('Boise-Butte')).toBe(true); // mountainous, length 2
    expect(canIndependentRailroadOccupy('Denver-Kansas City')).toBe(true); // flat, length 5
  });
});

describe('independent railroads avoid long mountainous routes', () => {
  test('starting and grown routes are never long and mountainous', () => {
    const forbidden = new Set(longMountainousRoutes);
    for (let game = 0; game < 30; game++) {
      const G: GameState = {
        contracts: [],
        players: [],
        independentRailroads: initializeIndependentRailroads(),
      };
      for (const key of allIndieRouteKeys(G)) expect(forbidden.has(key)).toBe(false);

      for (let round = 1; round <= 15; round++) {
        const ctx = { round } as GameContext;
        growIndependentRailroads(G, ctx);
      }
      for (const key of allIndieRouteKeys(G)) expect(forbidden.has(key)).toBe(false);
    }
  });
});
