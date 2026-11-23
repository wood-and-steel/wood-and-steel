/**
 * Market contract expiration at round-end: market opening, ticking, expiring with a
 * one-for-one replacement, and the chance/guarantee for starting a new countdown.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { advanceMarketExpirations, openMarketContracts } from './marketExpiration';
import { useGameStore } from './gameStore';
import type { GameState } from './gameStore';
import type { Contract } from '../Contract';
import { MARKET_EXPIRATION_ROUNDS } from '../Contract';

/** Random source that returns `values` in order, then repeats the last one. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

const NO_START = () => 0.99;

function market(id: string, overrides: Partial<Contract> = {}): Contract {
  return {
    id,
    destinationKey: 'Chicago',
    commodity: id,
    type: 'market',
    fulfilled: false,
    playerID: null,
    creationTime: 0,
    turnsHeld: null,
    ...overrides,
  };
}

let G: GameState;

beforeEach(() => {
  useGameStore.getState().resetState(2);
  const base = useGameStore.getState().G;
  G = structuredClone({
    ...base,
    players: base.players.map(([id, p], i) => [
      id,
      { ...p, activeCities: i === 0 ? ['Boston', 'Portland ME'] : ['Norfolk', 'Raleigh'] },
    ]),
    contracts: [market('a'), market('b'), market('c')],
  }) as GameState;
});

const byId = (id: string) => G.contracts.find((c) => c.id === id);
const countingDown = () => G.contracts.filter((c) => c.roundsLeft !== undefined);

describe('advanceMarketExpirations', () => {
  test('before the market opens, round-ends change nothing', () => {
    G.contracts = [];
    advanceMarketExpirations(G, () => 0);
    expect(G.marketRoundsWithoutExpirationStart).toBeUndefined();
    expect(G.contracts).toEqual([]);
  });

  test('first market round-end opens the clock and rolls the chance (no start at 0.99)', () => {
    advanceMarketExpirations(G, NO_START);
    expect(G.marketRoundsWithoutExpirationStart).toBe(1);
    expect(countingDown()).toHaveLength(0);
  });

  test('first market round-end starts a countdown when the roll is under 35%', () => {
    advanceMarketExpirations(G, seq(0.1, 0));
    expect(G.marketRoundsWithoutExpirationStart).toBe(0);
    expect(countingDown()).toHaveLength(1);
    expect(countingDown()[0].roundsLeft).toBe(MARKET_EXPIRATION_ROUNDS);
  });

  test('chance boundary: starts below 0.35, not at 0.35', () => {
    G.marketRoundsWithoutExpirationStart = 0;
    advanceMarketExpirations(G, seq(0.35, 0));
    expect(countingDown()).toHaveLength(0);
    advanceMarketExpirations(G, seq(0.3499, 0));
    expect(countingDown()).toHaveLength(1);
  });

  test('third market round-end is guaranteed after two with no start', () => {
    advanceMarketExpirations(G, NO_START);
    advanceMarketExpirations(G, NO_START);
    expect(countingDown()).toHaveLength(0);
    advanceMarketExpirations(G, NO_START);
    expect(countingDown()).toHaveLength(1);
    expect(countingDown()[0].roundsLeft).toBe(MARKET_EXPIRATION_ROUNDS);
    expect(G.marketRoundsWithoutExpirationStart).toBe(0);
  });

  test('picks uniformly among open contracts with no countdown', () => {
    G.contracts = [market('a', { roundsLeft: 3 }), market('b'), market('c')];
    G.marketRoundsWithoutExpirationStart = 2;
    advanceMarketExpirations(G, () => 0.99);
    expect(byId('c')?.roundsLeft).toBe(MARKET_EXPIRATION_ROUNDS);
    expect(byId('b')?.roundsLeft).toBeUndefined();
  });

  test('when all open contracts are counting down, nothing starts and the counter goes up', () => {
    G.contracts = [market('a', { roundsLeft: 4 }), market('b', { roundsLeft: 4 })];
    G.marketRoundsWithoutExpirationStart = 2;
    advanceMarketExpirations(G, () => 0);
    expect(countingDown().map((c) => c.roundsLeft)).toEqual([3, 3]);
    expect(G.marketRoundsWithoutExpirationStart).toBe(3);
  });

  test('countdowns tick by 1; a newly started one is not ticked the same round-end', () => {
    G.contracts = [market('a', { roundsLeft: 3 }), market('b'), market('c')];
    G.marketRoundsWithoutExpirationStart = 0;
    advanceMarketExpirations(G, seq(0, 0));
    expect(byId('a')?.roundsLeft).toBe(2);
    expect(byId('b')?.roundsLeft).toBe(MARKET_EXPIRATION_ROUNDS);
  });

  test('a contract started at 5 shows 5..1 and leaves on the fifth round-end', () => {
    G.marketRoundsWithoutExpirationStart = 2;
    advanceMarketExpirations(G, () => 0); // starts on 'a'
    const shown = [byId('a')?.roundsLeft];
    for (let i = 0; i < 4; i++) {
      advanceMarketExpirations(G, NO_START);
      shown.push(byId('a')?.roundsLeft);
    }
    expect(shown).toEqual([5, 4, 3, 2, 1]);
    advanceMarketExpirations(G, NO_START);
    expect(byId('a')).toBeUndefined();
  });

  test('at 0 the contract is replaced one-for-one by a non-duplicate', () => {
    G.contracts = [market('a', { roundsLeft: 1, commodity: 'coal', destinationKey: 'Chicago' }), market('b'), market('c')];
    G.marketRoundsWithoutExpirationStart = 0;
    advanceMarketExpirations(G, NO_START);
    const open = openMarketContracts(G.contracts);
    expect(open).toHaveLength(3);
    expect(byId('a')).toBeUndefined();
    const replacement = open.find((c) => !['b', 'c'].includes(c.id))!;
    expect(`${replacement.commodity}|${replacement.destinationKey}`).not.toBe('coal|Chicago');
  });

  test('claimed, fulfilled and private contracts are never ticked, expired or picked', () => {
    const claimed = market('k', { playerID: '0', turnsHeld: 1, roundsLeft: 1 });
    const fulfilled = market('f', { playerID: '0', turnsHeld: 1, fulfilled: true, roundsLeft: 1 });
    const priv: Contract = { ...market('p', { playerID: '1', turnsHeld: null }), type: 'private' };
    G.contracts = [claimed, fulfilled, priv, market('a')];
    G.marketRoundsWithoutExpirationStart = 2;
    advanceMarketExpirations(G, () => 0);
    expect(byId('k')).toEqual(claimed);
    expect(byId('f')).toEqual(fulfilled);
    expect(byId('p')).toEqual(priv);
    expect(byId('a')?.roundsLeft).toBe(MARKET_EXPIRATION_ROUNDS);
  });
});
