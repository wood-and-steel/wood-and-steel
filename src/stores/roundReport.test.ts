/**
 * The round report (docs/PLAYER_APP_REDESIGN_PLAN.md, Stage 4): written by the end-of-round
 * hook from what changed in the independent railroads and the open market.
 */
import { describe, expect, test } from 'vitest';
import type { Contract } from '../Contract';
import type { GameContext, GameState } from './gameStore';
import { executeTurnOnEnd } from './phaseConfig';
import { reportHasNews, roundReportFrom, snapshotForReport } from './roundReport';

function market(id: string, overrides: Partial<Contract> = {}): Contract {
  return {
    id,
    destinationKey: 'Chicago',
    commodity: 'coal',
    type: 'market',
    fulfilled: false,
    playerID: null,
    creationTime: 0,
    turnsHeld: null,
    ...overrides,
  };
}

function game(overrides: Partial<GameState> = {}): GameState {
  return {
    contracts: [],
    players: [],
    independentRailroads: {
      'Erie Railroad': { name: 'Erie Railroad', routes: [{ key: 'Buffalo-Rochester', addedInRound: 1 }] },
    },
    ...overrides,
  } as GameState;
}

describe('roundReportFrom', () => {
  test('lists the routes each railroad gained, and only railroads that grew', () => {
    const before = snapshotForReport(
      game({
        independentRailroads: {
          'Erie Railroad': { name: 'Erie Railroad', routes: [{ key: 'Pittsburgh-Cleveland', addedInRound: 1 }] },
          'Gulf Line': { name: 'Gulf Line', routes: [{ key: 'Houston-New Orleans', addedInRound: 1 }] },
        },
      })
    );
    const after = game({
      independentRailroads: {
        'Erie Railroad': {
          name: 'Erie Railroad',
          routes: [
            { key: 'Pittsburgh-Cleveland', addedInRound: 1 },
            { key: 'Cleveland-Detroit', addedInRound: 3 },
          ],
        },
        'Gulf Line': { name: 'Gulf Line', routes: [{ key: 'Houston-New Orleans', addedInRound: 1 }] },
        'New Line': { name: 'New Line', routes: [{ key: 'Boise-Butte', addedInRound: 3 }] },
      },
    });
    expect(roundReportFrom(before, after, 3).routesAdded).toEqual({
      'Erie Railroad': ['Cleveland-Detroit'],
      'New Line': ['Boise-Butte'],
    });
  });

  test('lists the open market contracts that left and the ones that replaced them, as copies', () => {
    const before = snapshotForReport(
      game({ contracts: [market('old', { commodity: 'cattle', destinationKey: 'Boston' }), market('stays')] })
    );
    const after = game({
      contracts: [market('new', { commodity: 'wine', destinationKey: 'Denver' }), market('stays'), market('claimed', { playerID: '0' })],
    });
    const report = roundReportFrom(before, after, 4);
    expect(report.round).toBe(4);
    expect(report.marketExpired).toEqual([{ id: 'old', commodity: 'cattle', destinationKey: 'Boston' }]);
    expect(report.marketAdded).toEqual([{ id: 'new', commodity: 'wine', destinationKey: 'Denver' }]);
    expect(reportHasNews(report)).toBe(true);
  });

  test('lists open market contracts entering their last round, which counts as news', () => {
    const before = snapshotForReport(game({ contracts: [market('a', { roundsLeft: 2 }), market('b', { roundsLeft: 1 })] }));
    const after = game({ contracts: [market('a', { roundsLeft: 1, commodity: 'wine' }), market('b', { roundsLeft: 1 })] });
    const report = roundReportFrom(before, after, 5);
    expect(report.marketLastRound).toEqual([{ id: 'a', commodity: 'wine', destinationKey: 'Chicago' }]);
    expect(report.marketExpired).toEqual([]);
    expect(report.marketAdded).toEqual([]);
    expect(reportHasNews(report)).toBe(true);
  });

  test('a round with no changes has no news', () => {
    const G = game({ contracts: [market('a')] });
    expect(reportHasNews(roundReportFrom(snapshotForReport(G), G, 2))).toBe(false);
  });
});

describe('end-of-round hook', () => {
  const ctx = (overrides: Partial<GameContext>): GameContext => ({
    phase: 'play',
    currentPlayer: '1',
    numPlayers: 2,
    playOrder: ['0', '1'],
    playOrderPos: 1,
    turn: 4,
    round: 0,
    ...overrides,
  });

  test('writes the report for the round that ended when the last player ends their turn', () => {
    const G = game({ contracts: [market('a')] });
    const c = ctx({ round: 0 });
    executeTurnOnEnd('play', G, c);
    expect(c.round).toBe(1);
    expect(G.roundReport).toEqual({ round: 0, routesAdded: {}, marketExpired: [], marketAdded: [], marketLastRound: [] });
  });

  test('replaces the report at each round end, and leaves it alone mid-round', () => {
    const G = game();
    executeTurnOnEnd('play', G, ctx({ round: 0 }));
    executeTurnOnEnd('play', G, ctx({ round: 1, playOrderPos: 0, currentPlayer: '0' }));
    expect(G.roundReport?.round).toBe(0);
    executeTurnOnEnd('play', G, ctx({ round: 1 }));
    expect(G.roundReport?.round).toBe(1);
  });
});
