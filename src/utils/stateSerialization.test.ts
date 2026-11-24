import { describe, expect, it } from 'vitest';
import { newPlayerProps, startingPlayerBoard } from '../stores/playerDefaults';
import { deserializeStateFromJSON, serializeStateToJSON } from './stateSerialization';

const ctx = { phase: 'play', currentPlayer: '0', numPlayers: 2, playOrder: ['0', '1'], playOrderPos: 0, turn: 3, round: 1 };

describe('state serialization', () => {
  it('loads a game saved before the app tracked money with each player on the starting board', () => {
    const saved = JSON.stringify({
      G: {
        contracts: [],
        players: [
          ['0', { name: 'Ada', activeCities: ['Boston', 'Portland ME'], hubCity: null, regionalOffice: null }],
          ['1', { name: 'Ben', activeCities: ['Norfolk', 'Raleigh'], hubCity: 'Raleigh', regionalOffice: null }],
        ],
        independentRailroads: {},
      },
      ctx,
    });
    const { G } = deserializeStateFromJSON(saved);
    expect(G.players).toEqual([
      ['0', { name: 'Ada', activeCities: ['Boston', 'Portland ME'], hubCity: null, regionalOffice: null, ...startingPlayerBoard() }],
      ['1', { name: 'Ben', activeCities: ['Norfolk', 'Raleigh'], hubCity: 'Raleigh', regionalOffice: null, ...startingPlayerBoard() }],
    ]);
    expect(G).not.toHaveProperty('turnLedger');
    expect(G).not.toHaveProperty('roundReport');
  });

  it('round-trips money, engines, cargo, upgrades, the turn ledger and the round report', () => {
    const ada = {
      ...newPlayerProps('Ada', '#abc'),
      cash: 6000,
      debt: 15000,
      engines: ['mountain', 'prairie'],
      cargo: ['wine', null],
      upgrades: ['upgraded-stations'],
      exchangeCommodity: 'grain',
      centralDebtServicePaid: true,
      westernDeliveryMade: true,
    };
    const G = {
      contracts: [],
      players: [['0', ada], ['1', newPlayerProps('Ben')]],
      independentRailroads: {},
      turnLedger: { playerID: '0', entries: [{ label: 'Borrowed', amount: 5000 }, { label: 'Paid for track', amount: -4000 }] },
      roundReport: {
        round: 6,
        routesAdded: { 'Erie Railroad': ['Buffalo-Cleveland'] },
        marketExpired: [{ id: 'c1', commodity: 'cattle', destinationKey: 'Boston' }],
        marketAdded: [{ id: 'c2', commodity: 'wine', destinationKey: 'Denver' }],
        marketLastRound: [{ id: 'c3', commodity: 'coal', destinationKey: 'Atlanta' }],
      },
    };
    const { G: loaded } = deserializeStateFromJSON(serializeStateToJSON(G, ctx));
    expect(loaded).toEqual(G);
  });

  it('drops a malformed turn ledger or round report, and bad ledger entries', () => {
    const { G } = deserializeStateFromJSON(
      JSON.stringify({
        G: {
          contracts: [],
          players: [],
          independentRailroads: {},
          turnLedger: { playerID: '0', entries: [{ label: 'Borrowed', amount: 5000 }, { label: 'Oops' }, null] },
          roundReport: { routesAdded: {} },
        },
        ctx,
      })
    );
    expect(G.turnLedger).toEqual({ playerID: '0', entries: [{ label: 'Borrowed', amount: 5000 }] });
    expect(G).not.toHaveProperty('roundReport');
  });

  it('drops the old "Added N routes" count, which the round report replaced', () => {
    const { G } = deserializeStateFromJSON(
      JSON.stringify({ G: { contracts: [], players: [], independentRailroads: {}, lastRoundRoutesAdded: 3 }, ctx })
    );
    expect(G).not.toHaveProperty('lastRoundRoutesAdded');
  });
});
