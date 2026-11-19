/**
 * Market contract tableau: once seeded, claiming or fulfilling an unclaimed market contract
 * replaces it one-for-one, and Undo restores the start-of-turn tableau.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { claimMarketContract, generateMarketContract, toggleContractFulfilled } from './gameActions';
import { useGameStore } from './gameStore';

const openMarket = () =>
  useGameStore.getState().G.contracts.filter((c) => c.type === 'market' && c.playerID === null);

const marketIds = () => openMarket().map((c) => c.id).sort();

/** Two players in play with starting cities; `seeded` market contracts on the table; snapshot taken. */
function setUp(seeded: number) {
  useGameStore.getState().resetState(2);
  useGameStore.setState((s) => ({
    G: {
      ...s.G,
      players: s.G.players.map(([id, p], i) => [
        id,
        { ...p, activeCities: i === 0 ? ['Boston', 'Portland ME'] : ['Norfolk', 'Raleigh'] },
      ]),
    },
    ctx: { ...s.ctx, phase: 'play' },
  }));
  for (let i = 0; i < seeded; i++) generateMarketContract();
  const { G, ctx } = useGameStore.getState();
  useGameStore.getState().setTurnStartSnapshot({ G, ctx });
}

beforeEach(() => setUp(3));

describe('market contract tableau', () => {
  test('claiming keeps 3 open market contracts', () => {
    const [target] = openMarket();
    claimMarketContract(target.id);
    expect(openMarket()).toHaveLength(3);
    expect(marketIds()).not.toContain(target.id);
  });

  test('fulfilling an unclaimed market contract keeps 3 open market contracts', () => {
    const [target] = openMarket();
    toggleContractFulfilled(target.id);
    expect(openMarket()).toHaveLength(3);
    expect(marketIds()).not.toContain(target.id);
  });

  test('fulfilling a claimed market contract does not add another', () => {
    const [target] = openMarket();
    claimMarketContract(target.id);
    const before = useGameStore.getState().G.contracts.length;
    toggleContractFulfilled(target.id);
    expect(useGameStore.getState().G.contracts).toHaveLength(before);
    expect(openMarket()).toHaveLength(3);
  });

  test('replacement is one-for-one, not a top-up to 3', () => {
    setUp(1);
    const [target] = openMarket();
    claimMarketContract(target.id);
    expect(openMarket()).toHaveLength(1);
  });

  test('nothing is created before the market is seeded', () => {
    setUp(0);
    expect(openMarket()).toHaveLength(0);
  });

  test('Undo restores the start-of-turn tableau and drops replacements', () => {
    const original = marketIds();
    const [a, b] = openMarket();
    claimMarketContract(a.id);
    toggleContractFulfilled(b.id);
    expect(marketIds()).not.toEqual(original);

    useGameStore.getState().undoCurrentTurn();
    expect(marketIds()).toEqual(original);
    expect(useGameStore.getState().G.contracts.filter((c) => c.type === 'market')).toHaveLength(3);
  });
});
