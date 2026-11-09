import { describe, expect, test } from 'vitest';
import type { GameContext, GameState } from '../../stores/gameStore';
import { isMoveDone, stepKey, turnStateFromSteps } from './steps';

describe('step keys', () => {
  test('counted actions, runs with their engines, and free actions', () => {
    expect(stepKey({ type: 'borrow', amount: 5000 })).toBe('borrow');
    expect(stepKey({ type: 'runTrains', runs: [{ slot: 1, path: ['A'], events: [] }, { slot: 0, path: ['B'], events: [] }] })).toBe('runTrains:1,0');
    expect(stepKey({ type: 'pickUp', slot: 0, commodity: 'coal' })).toBe('free:pickUp');
  });

  test('rebuild the turn’s actions and run engines', () => {
    expect(turnStateFromSteps(['free:placeEngine', 'runTrains:0', 'free:choosePrivateContract', 'buildTrack'])).toEqual({
      actions: ['runTrains', 'buildTrack'],
      enginesRun: [0],
      awaitingOffers: false,
      offers: null,
    });
  });
});

describe('isMoveDone', () => {
  const G = {
    contracts: [
      { id: 'k1', type: 'private', playerID: '0', fulfilled: true, commodity: 'coal', destinationKey: 'Boston' },
      { id: 'k2', type: 'private', playerID: '0', fulfilled: false, commodity: 'wood', destinationKey: 'New York' },
      { id: 'm1', type: 'market', playerID: null, fulfilled: false, commodity: 'imports', destinationKey: 'Boston' },
    ],
    players: [['0', { name: 'Avery', activeCities: ['Boston'], hubCity: null, regionalOffice: 'NE' }]],
    independentRailroads: { Erie: { name: 'Erie', routes: [] } },
  } as unknown as GameState;
  const ctx = { phase: 'play', currentPlayer: '0', turn: 3, playOrderPos: 0 } as GameContext;
  const turn = { turn: 3, playOrderPos: 0 };
  const done = (move: Parameters<typeof isMoveDone>[0], c = ctx) => isMoveDone(move, G, c, '0', turn);

  test('reads each move’s result from G and ctx', () => {
    expect(done({ name: 'toggleContractFulfilled', args: ['k1'] })).toBe(true);
    expect(done({ name: 'toggleContractFulfilled', args: ['k2'] })).toBe(false);
    expect(done({ name: 'claimMarketContract', args: ['m1'] })).toBe(false);
    expect(done({ name: 'addContract', args: ['wood', 'New York', 'private'] })).toBe(true);
    expect(done({ name: 'addContract', args: ['coal', 'Boston', 'private'] })).toBe(false);
    expect(done({ name: 'deleteContract', args: ['gone'] })).toBe(true);
    expect(done({ name: 'acquireIndependentRailroad', args: ['Erie'] })).toBe(false);
    expect(done({ name: 'claimHubCity', args: ['Boston'] })).toBe(false);
    expect(done({ name: 'claimRegionalOffice', args: ['NE'] })).toBe(true);
    expect(done({ name: 'generateStartingContract', args: [['Boston', 'Portland ME'], '0'] })).toBe(true);
    expect(done({ name: 'endTurn', args: [] })).toBe(false);
    expect(done({ name: 'endTurn', args: [] }, { ...ctx, currentPlayer: '1', playOrderPos: 1 })).toBe(true);
  });
});
