import { describe, expect, test } from 'vitest';
import { railroadTieValue } from '../../Contract';
import { breadthBonus, depthBonus } from './rulesData';
import { tieBreakdown } from './scoring';
import { makeWorld } from './world.testHelper';

describe('bonus formulas', () => {
  test('breadth: 1 tie each for the first 8 commodities, 2 for the next 4, then 3', () => {
    expect([0, 1, 8, 9, 12, 13, 14].map(breadthBonus)).toEqual([0, 1, 8, 10, 16, 19, 22]);
  });

  test('depth: one plus deliveries of the most-delivered commodity, nothing before a delivery', () => {
    expect([0, 1, 2, 5].map(depthBonus)).toEqual([0, 2, 3, 6]);
  });
});

describe('tieBreakdown', () => {
  test('fulfillment ties, breadth, and depth from fulfilled contracts', () => {
    const delivered = [
      { commodity: 'machinery', destinationKey: 'Philadelphia', fulfilled: true },
      { commodity: 'machinery', destinationKey: 'Boston', fulfilled: true, type: 'market' as const },
      { commodity: 'coal', destinationKey: 'Boston', fulfilled: true },
    ];
    const world = makeWorld({ contracts: [...delivered, { commodity: 'wood', destinationKey: 'Boston', fulfilled: false }] });
    const ties = tieBreakdown(world);
    expect(ties.fulfillment).toBe(delivered.reduce((sum, c) => sum + railroadTieValue(c), 0));
    expect(ties.breadth).toBe(2);
    expect(ties.depth).toBe(3);
    expect(ties.total).toBe(ties.fulfillment + 2 + 3);
  });

  test('end-of-game ties for a Regional Office and a Challenger', () => {
    const world = makeWorld({
      players: { '0': { regionalOffice: 'NE' }, '1': {} },
      board: { engineTypes: { '0': ['challenger', null] } },
    });
    expect(tieBreakdown(world)).toMatchObject({ regionalOffice: 2, challenger: 2, total: 4 });
  });

  test('monopoly ties when the exchange commodity is fully connected', () => {
    const track: Record<string, string[]> = {};
    for (const key of ['Boston-Syracuse', 'Syracuse-Toronto', 'Detroit-Toronto', 'Chicago-Detroit', 'Chicago-Milwaukee']) track[key] = ['0'];
    const world = makeWorld({ board: { track }, bot: { exchangeCommodity: 'machinery' } });
    expect(tieBreakdown(world).monopoly).toBe(4);
    expect(tieBreakdown(makeWorld({ bot: { exchangeCommodity: 'machinery' } })).monopoly).toBe(0);
  });
});
