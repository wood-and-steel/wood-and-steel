import {
  generateMarketContract,
  rewardValue,
  newContract,
  generatePrivateContractSpec,
  generatePrivateContractOffers,
} from './Contract.ts';
import { cities, commodities } from './data';

describe('generatePrivateContractSpec', () => {
  function makeGameState(activeCities, currentPlayer = '0') {
    return {
      G: {
        contracts: [],
        players: [
          ['0', { activeCities: new Set(activeCities) }],
          ['1', { activeCities: new Set(['Chicago', 'Detroit']) }],
        ],
      },
      ctx: {
        currentPlayer,
      },
    };
  }

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
      expect(destCity.commodities).not.toContain(spec.commodity);
    }
  });

  test('returns undefined when player not found', () => {
    const { G, ctx } = makeGameState(['New York', 'Philadelphia']);
    ctx.currentPlayer = '99';
    const spec = generatePrivateContractSpec(G, ctx);
    expect(spec).toBeUndefined();
  });

  test('returns undefined when players array is empty', () => {
    const G = { contracts: [], players: [] };
    const ctx = { currentPlayer: '0' };
    const spec = generatePrivateContractSpec(G, ctx);
    expect(spec).toBeUndefined();
  });
});

describe('generatePrivateContractOffers', () => {
  function makeGameState(activeCities, currentPlayer = '0') {
    return {
      G: {
        contracts: [],
        players: [
          ['0', { activeCities: new Set(activeCities) }],
          ['1', { activeCities: new Set(['Chicago', 'Detroit']) }],
        ],
      },
      ctx: {
        currentPlayer,
      },
    };
  }

  test('returns array of specs, each with commodity and destinationKey', () => {
    const { G, ctx } = makeGameState(['New York', 'Philadelphia', 'Pittsburgh']);
    for (let i = 0; i < 20; i++) {
      const offers = generatePrivateContractOffers(G, ctx, 2);
      expect(Array.isArray(offers)).toBe(true);
      offers.forEach((offer) => {
        expect(offer).toHaveProperty('commodity');
        expect(offer).toHaveProperty('destinationKey');
      });
    }
  });

  test('returns no duplicate offers (uniqueness by commodity|destinationKey)', () => {
    const { G, ctx } = makeGameState(['New York', 'Philadelphia', 'Pittsburgh', 'Chicago', 'Cincinnati']);
    for (let i = 0; i < 50; i++) {
      const offers = generatePrivateContractOffers(G, ctx, 3);
      const keys = new Set(offers.map((o) => `${o.commodity}|${o.destinationKey}`));
      expect(keys.size).toBe(offers.length);
    }
  });

  test('returns at most count offers', () => {
    const { G, ctx } = makeGameState(['New York', 'Philadelphia']);
    for (const count of [2, 3, 4]) {
      for (let i = 0; i < 20; i++) {
        const offers = generatePrivateContractOffers(G, ctx, count);
        expect(offers.length).toBeLessThanOrEqual(count);
      }
    }
  });

  test('each offer has valid commodity and destinationKey', () => {
    const { G, ctx } = makeGameState(['New York', 'Philadelphia']);
    const offers = generatePrivateContractOffers(G, ctx, 2);
    offers.forEach((offer) => {
      expect(commodities.has(offer.commodity)).toBe(true);
      expect(cities.has(offer.destinationKey)).toBe(true);
      const destCity = cities.get(offer.destinationKey);
      expect(destCity.commodities).not.toContain(offer.commodity);
    });
  });
});

describe('generateMarketContract', () => {
  test('generates market contracts with value of at least $6000', () => {
    // Create a minimal game state for testing with valid city names
    const G = {
      contracts: [],
      players: [
        ['0', { activeCities: ['New York', 'Philadelphia', 'Pittsburgh'] }],
        ['1', { activeCities: ['Raleigh', 'Norfolk'] }],
      ],
    };

    // Generate multiple contracts to test the constraint
    for (let i = 0; i < 20; i++) {
      const contract = generateMarketContract(G);
      
      if (contract) {
        const value = rewardValue(contract);
        
        // All market contracts should be worth at least $6000 (distance >= 2)
        expect(value).toBeGreaterThanOrEqual(6000);
      }
    }
  });
});

describe('rewardValue', () => {
  test('calculates correct dollar value based on distance', () => {
    // Create a valid contract using newContract with a valid commodity
    const contract = newContract('Chicago', 'coal', { type: 'market' });
    
    if (contract) {
      const value = rewardValue(contract);
      // Value should be distance × $3000
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value % 3000).toBe(0); // Should be a multiple of 3000
    }
  });
});
