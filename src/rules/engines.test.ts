import { describe, expect, it } from 'vitest';
import { bestEngineLevel, enginePurchaseOptions, monopolizableCommodities, serviceYardOpen } from './engines';

describe('bestEngineLevel', () => {
  it('is the highest level owned, or -1 with no engines', () => {
    expect(bestEngineLevel(['john-bull', null])).toBe(0);
    expect(bestEngineLevel(['american', 'mogul'])).toBe(2);
    expect(bestEngineLevel([null, null])).toBe(-1);
  });
});

describe('enginePurchaseOptions', () => {
  it('offers the next engine up, as a trade-in or on an empty token', () => {
    expect(enginePurchaseOptions(['john-bull', null], false)).toEqual([
      { engine: 'american', slot: 0, tradeIn: 'john-bull', skip: false, cost: 5000 },
      { engine: 'american', slot: 1, tradeIn: null, skip: false, cost: 5000 },
    ]);
  });

  it('credits half the traded-in price, rounded down to $1,000', () => {
    // Mogul $7,000 -> $3,000 credit; Consolidation costs $10,000.
    expect(enginePurchaseOptions(['american', 'mogul'], false)).toEqual([
      { engine: 'consolidation', slot: 0, tradeIn: 'american', skip: false, cost: 8000 },
      { engine: 'consolidation', slot: 1, tradeIn: 'mogul', skip: false, cost: 7000 },
    ]);
  });

  it('with a Hub, also offers two levels up for $5,000 more', () => {
    const skip = enginePurchaseOptions(['mogul', null], true).filter((o) => o.skip);
    expect(skip).toEqual([
      { engine: 'prairie', slot: 0, tradeIn: 'mogul', skip: true, cost: 14000 + 5000 - 3000 },
      { engine: 'prairie', slot: 1, tradeIn: null, skip: true, cost: 19000 },
    ]);
  });

  it('offers nothing above the Challenger', () => {
    expect(enginePurchaseOptions(['challenger', 'mountain'], true)).toEqual([]);
  });
});

describe('serviceYardOpen', () => {
  it('opens once any player owns a Consolidation or better', () => {
    expect(serviceYardOpen([['mogul', 'american'], ['john-bull', null]])).toBe(false);
    expect(serviceYardOpen([['mogul', null], ['consolidation', null]])).toBe(true);
  });
});

describe('monopolizableCommodities', () => {
  it('lists the ten commodities supplied by 4, 5, or 6 cities', () => {
    expect(monopolizableCommodities()).toEqual([
      'cattle',
      'coal',
      'copper',
      'grain',
      'imports',
      'iron ore',
      'lead',
      'machinery',
      'textiles',
      'wood',
    ]);
  });
});
