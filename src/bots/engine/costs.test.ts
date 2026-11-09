import { describe, expect, test } from 'vitest';
import {
  buildLimit,
  enginePurchases,
  indiePricePerRoute,
  indiePurchases,
  monopolizableCommodities,
  regionalOfficeRegions,
  trackCost,
  upgradePurchases,
} from './costs';
import { makeWorld } from './world.testHelper';

describe('trackCost', () => {
  test('base cost by length, doubled when mountainous', () => {
    const world = makeWorld();
    expect(trackCost(world, 'Boston-Syracuse')).toBe(3000);
    expect(trackCost(world, 'New York-Syracuse')).toBe(6000);
    expect(trackCost(world, 'Cleveland-New York')).toBe(10000);
  });

  test('parallel track costs $1,000 more, before doubling', () => {
    const world = makeWorld({ board: { track: { 'Norfolk-Raleigh': ['1'], 'New York-Syracuse': ['1'] } } });
    expect(trackCost(world, 'Norfolk-Raleigh')).toBe(3000);
    expect(trackCost(world, 'New York-Syracuse')).toBe(8000);
  });

  test('a Hub takes $1,000 off routes touching it or its neighbors, never below $1,000', () => {
    const world = makeWorld({ players: { '0': { activeCities: ['Boston'], hubCity: 'Boston' }, '1': {} } });
    expect(trackCost(world, 'Boston-Syracuse')).toBe(2000);
    expect(trackCost(world, 'Syracuse-Toronto')).toBe(1000);
    expect(trackCost(world, 'Cleveland-Syracuse')).toBe(2000);
    expect(trackCost(world, 'Cleveland-Pittsburgh')).toBe(2000);
  });
});

describe('buildLimit', () => {
  test('two routes, three with an Employment Office', () => {
    expect(buildLimit(makeWorld())).toBe(2);
    expect(buildLimit(makeWorld({ board: { upgrades: { '0': ['employment-office'] } } }))).toBe(3);
  });
});

describe('enginePurchases', () => {
  test('from a John Bull: only an American, trading the John Bull in', () => {
    expect(enginePurchases(makeWorld())).toEqual([
      { engine: 'american', slot: 0, tradeIn: 'john-bull', skip: false, cost: 5000 },
    ]);
  });

  test('a Hub allows skipping a level for $5,000 more', () => {
    const world = makeWorld({ players: { '0': { activeCities: ['Boston'], hubCity: 'Boston' }, '1': {} } });
    expect(enginePurchases(world).map((p) => [p.engine, p.cost])).toEqual([
      ['american', 5000],
      ['mogul', 12000],
    ]);
  });

  test('with one engine: trade it in for half its price, or add a second token', () => {
    const world = makeWorld({ board: { engineTypes: { '0': ['american', null] } } });
    expect(enginePurchases(world)).toEqual([
      { engine: 'mogul', slot: 0, tradeIn: 'american', skip: false, cost: 5000 },
      { engine: 'mogul', slot: 1, tradeIn: null, skip: false, cost: 7000 },
    ]);
  });

  test('with two engines: only trade-ins, rounded down to $1,000', () => {
    const world = makeWorld({ board: { engineTypes: { '0': ['mogul', 'camelback'] } } });
    expect(enginePurchases(world)).toEqual([
      { engine: 'prairie', slot: 0, tradeIn: 'mogul', skip: false, cost: 16000 - 3000 },
      { engine: 'prairie', slot: 1, tradeIn: 'camelback', skip: false, cost: 16000 - 6000 },
    ]);
  });

  test('nothing beyond the Challenger', () => {
    expect(enginePurchases(makeWorld({ board: { engineTypes: { '0': ['challenger', null] } } }))).toEqual([]);
  });
});

describe('independent railroads', () => {
  const indies = {
    Erie: { name: 'Erie', routes: [{ key: 'Boston-Syracuse', addedInRound: 0 }, { key: 'Syracuse-Toronto', addedInRound: 1 }] },
    Far: { name: 'Far', routes: [{ key: 'Denver-Omaha', addedInRound: 0 }] },
  };

  test('only connected railroads, at $3,000 per route', () => {
    expect(indiePurchases(makeWorld({ independentRailroads: indies }))).toEqual([
      { name: 'Erie', routes: ['Boston-Syracuse', 'Syracuse-Toronto'], cost: 6000 },
    ]);
  });

  test('$4,000 per route once anyone delivers in the West', () => {
    const world = makeWorld({ contracts: [{ destinationKey: 'Denver', commodity: 'grain', fulfilled: true, playerID: '1' }] });
    expect(indiePricePerRoute(world)).toBe(4000);
  });
});

describe('upgradePurchases', () => {
  const kinds = (world: ReturnType<typeof makeWorld>) => [...new Set(upgradePurchases(world).map((p) => p.upgrade))].sort();

  test('Service Yard opens once anyone owns a Consolidation or better', () => {
    expect(kinds(makeWorld())).not.toContain('service-yard');
    expect(kinds(makeWorld({ board: { engineTypes: { '1': ['camelback', null] } } }))).toContain('service-yard');
  });

  test('Hub and Railyard on network cities not taken by others', () => {
    const world = makeWorld({
      players: { '0': { activeCities: ['Boston'] }, '1': { hubCity: 'Boston' } },
      board: { railyards: { '1': 'New York' } },
    });
    const hubs = upgradePurchases(world).filter((p) => p.upgrade === 'hub').map((p) => p.city);
    const yards = upgradePurchases(world).filter((p) => p.upgrade === 'railyard').map((p) => p.city);
    expect(hubs).toEqual(['New York', 'Philadelphia', 'Portland ME']);
    expect(yards).toEqual(['Boston', 'Philadelphia', 'Portland ME']);
  });

  test('nothing already owned', () => {
    const world = makeWorld({ board: { upgrades: { '0': ['timetable'] } } });
    expect(kinds(world)).not.toContain('timetable');
    expect(kinds(world)).toContain('roundhouse');
  });

  test('Regional Office needs 5 uncontested cities in a region', () => {
    const track = {
      'Boston-Portland ME': ['0'],
      'Boston-New York': ['0'],
      'New York-Philadelphia': ['0'],
      'Boston-Syracuse': ['0'],
    };
    expect(regionalOfficeRegions(makeWorld({ board: { track } }))).toEqual(['NE']);
    const contested = { ...track, 'Pittsburgh-Washington': ['1'] };
    expect(regionalOfficeRegions(makeWorld({ board: { track: contested } }))).toEqual([]);
  });

  test('Commodities Exchange for a 4–6 city commodity the network reaches fully', () => {
    expect(monopolizableCommodities()).toContain('machinery');
    expect(monopolizableCommodities()).not.toContain('steel');
    const track: Record<string, string[]> = {};
    for (const key of ['Boston-Syracuse', 'Syracuse-Toronto', 'Detroit-Toronto', 'Chicago-Detroit', 'Chicago-Milwaukee']) track[key] = ['0'];
    const exchange = upgradePurchases(makeWorld({ board: { track } })).filter((p) => p.upgrade === 'commodities-exchange');
    expect(exchange.map((p) => p.commodity)).toEqual(['machinery']);
  });
});
