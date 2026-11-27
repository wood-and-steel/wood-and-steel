import { describe, test, expect } from 'vitest';
import {
  type Contract,
  commodityDistanceFrom,
  generateMarketContract,
  leastServedPlayer,
  marketAccessDistance,
  moneyValue,
  newContract,
  generatePrivateContractSpec,
  generatePrivateContractOffers,
} from './Contract';
import { cities, commodities } from './data';
import type { GameContext, GameState, PlayerProps, RegionCode } from './stores/gameStore';
import { startingPlayerBoard } from './stores/playerDefaults';
import { citiesConnectedTo } from './utils/graph';

/** Minimal game context for contract tests; only currentPlayer matters. */
function makeCtx(currentPlayer: string): GameContext {
  return { phase: 'play', currentPlayer, numPlayers: 2, playOrder: ['0', '1'], playOrderPos: 0, turn: 1, round: 1 };
}

/** Minimal game state shape for contract tests (matches Contract's expected shape). */
function makeGameState(
  activeCities: string[],
  options: {
    currentPlayer?: string;
    contracts?: Contract[];
    regionalOffice?: RegionCode | null;
    hubCity?: string | null;
  } = {}
): {
  G: GameState;
  ctx: GameContext;
} {
  const {
    currentPlayer = '0',
    contracts = [],
    regionalOffice = null,
    hubCity = null,
  } = options;
  return {
    G: {
      contracts,
      independentRailroads: {},
      players: [
        ['0', { ...startingPlayerBoard(), name: 'P0', activeCities, hubCity, regionalOffice }],
        ['1', { ...startingPlayerBoard(), name: 'P1', activeCities: ['Chicago', 'Detroit'], hubCity: null, regionalOffice: null }],
      ],
    },
    ctx: makeCtx(currentPlayer),
  };
}

/** Build fulfilled contracts attributed to a player (any commodity/destination is fine for counting). */
function makeFulfilledContracts(playerID: string, count: number): Contract[] {
  const samples: Array<{ destinationKey: string; commodity: string }> = [
    { destinationKey: 'Chicago', commodity: 'coal' },
    { destinationKey: 'Boston', commodity: 'imports' },
    { destinationKey: 'Atlanta', commodity: 'machinery' },
    { destinationKey: 'Denver', commodity: 'grain' },
  ];
  return Array.from({ length: count }, (_, i) => {
    const sample = samples[i % samples.length];
    const contract = newContract(sample.destinationKey, sample.commodity, {
      type: i % 2 === 0 ? 'private' : 'market',
      fulfilled: true,
      playerID,
    });
    if (!contract) throw new Error('Failed to create fulfilled contract fixture');
    return contract;
  });
}

describe('generatePrivateContractSpec', () => {
  test('returns valid spec with commodity and destinationKey when given valid G and ctx', () => {
    const { G, ctx } = makeGameState(['New York', 'Philadelphia']);
    for (let i = 0; i < 30; i++) {
      const spec = generatePrivateContractSpec(G, ctx);
      if (!spec) continue;
      expect(spec).toHaveProperty('commodity');
      expect(spec).toHaveProperty('destinationKey');
      expect(commodities.has(spec.commodity)).toBe(true);
      expect(cities.has(spec.destinationKey)).toBe(true);
      const destCity = cities.get(spec.destinationKey);
      expect(destCity!.commodities.includes(spec.commodity)).toBe(false);
    }
  });

  test('returns undefined when player not found', () => {
    const { G, ctx } = makeGameState(['New York', 'Philadelphia']);
    ctx.currentPlayer = '99';
    const spec = generatePrivateContractSpec(G, ctx);
    expect(spec).toBeUndefined();
  });

  test('returns undefined when players array is empty', () => {
    const G = {
      contracts: [] as Contract[],
      players: [] as [string, PlayerProps][],
      independentRailroads: {},
    };
    const ctx = makeCtx('0');
    const spec = generatePrivateContractSpec(G, ctx);
    expect(spec).toBeUndefined();
  });

  test('with fewer than 3 fulfilled contracts, can still generate specs worth less than $6000', () => {
    const { G, ctx } = makeGameState(['New York', 'Philadelphia'], {
      contracts: makeFulfilledContracts('0', 2),
    });
    let sawLowValue = false;
    for (let i = 0; i < 80; i++) {
      const spec = generatePrivateContractSpec(G, ctx);
      if (spec && moneyValue(spec) < 6000) {
        sawLowValue = true;
        break;
      }
    }
    expect(sawLowValue).toBe(true);
  });

  test('with 3+ fulfilled contracts, prefers specs worth at least $6000 when enough commodities qualify', () => {
    // Use a distant commodityRegion so many candidates are ≥ 2 segments from NE destinations
    // (ensuring the filtered pool has ≥ 2 commodities and the floor applies).
    const { G, ctx } = makeGameState(['New York', 'Philadelphia', 'Pittsburgh'], {
      contracts: makeFulfilledContracts('0', 3),
    });
    for (let i = 0; i < 40; i++) {
      const spec = generatePrivateContractSpec(G, ctx, 'SW');
      if (!spec) continue;
      expect(moneyValue(spec)).toBeGreaterThanOrEqual(6000);
    }
  });

  test('with 3+ fulfilled contracts, falls back to unfiltered list when fewer than 2 high-value commodities', () => {
    // Seattle's nearby commodity set is small; many destinations leave 0–1 commodities at distance ≥ 2.
    const { G, ctx } = makeGameState(['Seattle'], {
      contracts: makeFulfilledContracts('0', 3),
    });
    let gotSpec = false;
    let sawLowValue = false;
    for (let i = 0; i < 50; i++) {
      const spec = generatePrivateContractSpec(G, ctx);
      if (!spec) continue;
      gotSpec = true;
      if (moneyValue(spec) < 6000) {
        sawLowValue = true;
      }
    }
    expect(gotSpec).toBe(true);
    // Fallback must allow sub-$6k contracts rather than failing generation.
    expect(sawLowValue).toBe(true);
  });
});

describe('generatePrivateContractOffers', () => {
  test('returns array of specs, each with commodity and destinationKey', () => {
    const { G, ctx } = makeGameState(['New York', 'Philadelphia', 'Pittsburgh']);
    for (let i = 0; i < 20; i++) {
      const offers = generatePrivateContractOffers(G, ctx);
      expect(Array.isArray(offers)).toBe(true);
      offers.forEach((offer) => {
        expect(offer).toHaveProperty('commodity');
        expect(offer).toHaveProperty('destinationKey');
      });
    }
  });

  test('returns no duplicate offers (uniqueness by commodity|destinationKey)', () => {
    const { G, ctx } = makeGameState([
      'New York',
      'Philadelphia',
      'Pittsburgh',
      'Chicago',
      'Cincinnati',
    ]);
    for (let i = 0; i < 50; i++) {
      const offers = generatePrivateContractOffers(G, ctx);
      const keys = new Set(offers.map((o) => `${o.commodity}|${o.destinationKey}`));
      expect(keys.size).toBe(offers.length);
    }
  });

  test('returns exactly 2 offers', () => {
    const { G, ctx } = makeGameState(['New York', 'Philadelphia']);
    for (let i = 0; i < 20; i++) {
      const offers = generatePrivateContractOffers(G, ctx);
      expect(offers.length).toEqual(2);
    }
  });

  test('each offer has valid commodity and destinationKey', () => {
    const { G, ctx } = makeGameState(['New York', 'Philadelphia']);
    const offers = generatePrivateContractOffers(G, ctx);
    offers.forEach((offer) => {
      expect(commodities.has(offer.commodity)).toBe(true);
      expect(cities.has(offer.destinationKey)).toBe(true);
      const destCity = cities.get(offer.destinationKey);
      expect(destCity!.commodities.includes(offer.commodity)).toBe(false);
    });
  });

  test('with 3+ fulfilled contracts, regional-office offer prefers $6000+ when enough commodities qualify', () => {
    // SW regional office from NE active cities: first offer uses SW commodities, which are
    // far from NE destinations, so the $6k floor applies to that offer.
    const { G, ctx } = makeGameState(['New York', 'Philadelphia', 'Pittsburgh'], {
      contracts: makeFulfilledContracts('0', 3),
      regionalOffice: 'SW',
    });
    for (let i = 0; i < 30; i++) {
      const offers = generatePrivateContractOffers(G, ctx);
      expect(offers.length).toBeGreaterThanOrEqual(3);
      // First offer is the regional-office offer
      expect(moneyValue(offers[0])).toBeGreaterThanOrEqual(6000);
    }
  });
});

describe('generateMarketContract', () => {
  test('generates market contracts with value of at least $6000', () => {
    const G = {
      contracts: [] as Contract[],
      players: [
        ['0', { ...startingPlayerBoard(), name: 'P0', activeCities: ['New York', 'Philadelphia', 'Pittsburgh'], hubCity: null, regionalOffice: null }],
        ['1', { ...startingPlayerBoard(), name: 'P1', activeCities: ['Raleigh', 'Norfolk'], hubCity: null, regionalOffice: null }],
      ] as [string, PlayerProps][],
      independentRailroads: {},
    };

    for (let i = 0; i < 20; i++) {
      const contract = generateMarketContract(G);

      if (contract) {
        const value = moneyValue(contract);

        expect(value).toBeGreaterThanOrEqual(6000);
      }
    }
  });
});

describe('market contract anchoring', () => {
  const EAST = ['Boston', 'Portland ME'];
  const WEST = ['Portland OR', 'Seattle'];
  const SOUTH = ['Dallas', 'Houston'];

  function marketState(contracts: Contract[] = []): GameState {
    return {
      contracts,
      independentRailroads: {},
      players: [EAST, WEST, SOUTH].map((activeCities, i) => [
        String(i),
        { ...startingPlayerBoard(), name: `P${i}`, activeCities, hubCity: null, regionalOffice: null },
      ]) as [string, PlayerProps][],
    };
  }

  const openMarket = (commodity: string): Contract => newContract('Chicago', commodity, { type: 'market' })!;

  /** Commodities produced within 1 segment of the given cities (including them). */
  function commoditiesNear(cityKeys: string[]): Set<string> {
    const near = new Set<string>();
    citiesConnectedTo(cityKeys, { distance: 1, includeFromCities: true }).forEach((key: string) =>
      cities.get(key)?.commodities.forEach((c) => near.add(c))
    );
    return near;
  }

  test('commodityDistanceFrom measures segments to the nearest producing city', () => {
    expect(commodityDistanceFrom(['Boston'], 'machinery')).toBe(0);
    expect(commodityDistanceFrom(['Boston'], 'aluminum')).toBe(1);
    expect(commodityDistanceFrom(['Boston', 'Houston'], 'oil')).toBe(0);
    expect(commodityDistanceFrom([], 'coal')).toBe(Infinity);
  });

  test('marketAccessDistance is the nearest open commodity, Infinity with no open contracts', () => {
    expect(marketAccessDistance(EAST, [openMarket('oil'), openMarket('aluminum')])).toBe(0);
    expect(marketAccessDistance(EAST, [])).toBe(Infinity);
  });

  test('leastServedPlayer picks the player farthest from every open commodity', () => {
    const G = marketState();
    // Aluminum is in Portland ME (east) and oil in Dallas and Houston (south); the west is left out.
    expect(leastServedPlayer(G, [openMarket('aluminum'), openMarket('oil')])).toBe('1');
    // Wood is in Portland ME and Portland OR; only the south is far from it.
    expect(leastServedPlayer(G, [openMarket('wood')])).toBe('2');
  });

  test('leastServedPlayer breaks ties at random and skips players without active cities', () => {
    const G = marketState();
    expect(leastServedPlayer(G, [], () => 0)).toBe('0');
    expect(leastServedPlayer(G, [], () => 0.99)).toBe('2');
    G.players[0][1].activeCities = [];
    expect(leastServedPlayer(G, [], () => 0)).toBe('1');
    G.players.forEach(([, p]) => (p.activeCities = []));
    expect(leastServedPlayer(G, [])).toBeUndefined();
  });

  test.each([['0', EAST], ['1', WEST], ['2', SOUTH]])(
    'a contract anchored on player %s has a commodity from near their cities',
    (anchor, anchorCities) => {
      const G = marketState();
      const near = commoditiesNear(anchorCities);
      const allActive = new Set([...EAST, ...WEST, ...SOUTH]);
      const destinations = citiesConnectedTo([...allActive], { distance: 2 });
      for (let i = 0; i < 40; i++) {
        const contract = generateMarketContract(G, anchor)!;
        expect(near.has(contract.commodity)).toBe(true);
        expect(moneyValue(contract)).toBeGreaterThanOrEqual(6000);
        // The destination is still drawn from the union of everyone's active cities, never one of them.
        expect(allActive.has(contract.destinationKey)).toBe(false);
        expect(destinations.has(contract.destinationKey)).toBe(true);
      }
    }
  );

  test('an unknown anchor falls back to the whole market area', () => {
    const contract = generateMarketContract(marketState(), 'nobody');
    expect(contract).toBeDefined();
    expect(moneyValue(contract!)).toBeGreaterThanOrEqual(6000);
  });
});

describe('moneyValue', () => {
  test('calculates correct dollar value based on distance', () => {
    const contract = newContract('Chicago', 'coal', { type: 'market' });

    if (contract) {
      const value = moneyValue(contract);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value % 3000).toBe(0);
    }
  });
});
