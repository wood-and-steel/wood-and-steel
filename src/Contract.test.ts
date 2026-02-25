import { describe, test, expect } from 'vitest';
import {
  type Contract,
  generateMarketContract,
  moneyValue,
  newContract,
  generatePrivateContractSpec,
  generatePrivateContractOffers,
} from './Contract';
import { cities, commodities } from './data';

/** Minimal game state shape for contract tests (matches Contract's expected shape). */
function makeGameState(
  activeCities: string[],
  currentPlayer: string = '0'
): {
  G: { contracts: Contract[]; players: [string, { name: string; activeCities: string[]; hubCity: string | null; regionalOffice: string | null }][] };
  ctx: { currentPlayer: string };
} {
  return {
    G: {
      contracts: [],
      players: [
        ['0', { name: 'P0', activeCities, hubCity: null, regionalOffice: null }],
        ['1', { name: 'P1', activeCities: ['Chicago', 'Detroit'], hubCity: null, regionalOffice: null }],
      ],
    },
    ctx: {
      currentPlayer,
    },
  };
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
      players: [] as [string, { name: string; activeCities: string[]; hubCity: string | null; regionalOffice: string | null }][],
    };
    const ctx = { currentPlayer: '0' };
    const spec = generatePrivateContractSpec(G, ctx);
    expect(spec).toBeUndefined();
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
});

describe('generateMarketContract', () => {
  test('generates market contracts with value of at least $6000', () => {
    const G = {
      contracts: [] as Contract[],
      players: [
        ['0', { name: 'P0', activeCities: ['New York', 'Philadelphia', 'Pittsburgh'], hubCity: null, regionalOffice: null }],
        ['1', { name: 'P1', activeCities: ['Raleigh', 'Norfolk'], hubCity: null, regionalOffice: null }],
      ] as [string, { name: string; activeCities: string[]; hubCity: string | null; regionalOffice: string | null }][],
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
