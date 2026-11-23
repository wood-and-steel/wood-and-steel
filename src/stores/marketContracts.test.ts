/**
 * Market contract tableau: once seeded, claiming an open market contract replaces it
 * one-for-one, open contracts can't be fulfilled directly, fulfilled contracts can't be
 * unfulfilled, and Undo restores the start-of-turn tableau.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { addContract, claimMarketContract, fillMarketTableau, generateMarketContract, toggleContractFulfilled } from './gameActions';
import { useGameStore } from './gameStore';
import { endTurn } from './events';

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

  test('fulfilling an open market contract is refused and changes nothing', () => {
    const [target] = openMarket();
    const before = useGameStore.getState().G;
    toggleContractFulfilled(target.id);
    expect(useGameStore.getState().G).toBe(before);
  });

  test('fulfilling a claimed market contract does not add another', () => {
    const [target] = openMarket();
    claimMarketContract(target.id);
    const before = useGameStore.getState().G.contracts.length;
    toggleContractFulfilled(target.id);
    expect(useGameStore.getState().G.contracts).toHaveLength(before);
    expect(openMarket()).toHaveLength(3);
  });

  test('a fulfilled claimed market contract cannot be unfulfilled', () => {
    const [target] = openMarket();
    claimMarketContract(target.id);
    toggleContractFulfilled(target.id);
    const before = useGameStore.getState().G;
    toggleContractFulfilled(target.id);
    expect(useGameStore.getState().G).toBe(before);
    expect(before.contracts.find((c) => c.id === target.id)).toMatchObject({ fulfilled: true, playerID: '0' });
  });

  test('a fulfilled private contract cannot be unfulfilled and keeps its active city', () => {
    addContract('coal', 'Chicago', 'private');
    const contract = useGameStore.getState().G.contracts.find((c) => c.type === 'private')!;
    toggleContractFulfilled(contract.id);
    const before = useGameStore.getState().G;
    expect(before.players[0][1].activeCities).toContain('Chicago');
    toggleContractFulfilled(contract.id);
    expect(useGameStore.getState().G).toBe(before);
    expect(useGameStore.getState().G.players[0][1].activeCities).toContain('Chicago');
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

  test('fillMarketTableau fills an empty tableau to 3', () => {
    setUp(0);
    fillMarketTableau();
    expect(openMarket()).toHaveLength(3);
  });

  test('fillMarketTableau keeps existing open contracts and tops up to 3', () => {
    setUp(1);
    const [existing] = openMarket();
    fillMarketTableau();
    expect(openMarket()).toHaveLength(3);
    expect(marketIds()).toContain(existing.id);
  });

  test('fillMarketTableau does nothing when the tableau is full', () => {
    const before = useGameStore.getState().G.contracts;
    fillMarketTableau();
    expect(useGameStore.getState().G.contracts).toBe(before);
  });

  test('Undo restores the start-of-turn tableau and drops replacements', () => {
    const original = marketIds();
    const [a] = openMarket();
    claimMarketContract(a.id);
    toggleContractFulfilled(a.id);
    expect(marketIds()).not.toEqual(original);

    useGameStore.getState().undoCurrentTurn();
    expect(marketIds()).toEqual(original);
    expect(useGameStore.getState().G.contracts.filter((c) => c.type === 'market')).toHaveLength(3);
  });

  test('claiming an expiring contract clears roundsLeft', () => {
    const [target] = openMarket();
    setRoundsLeft(target.id, 2);
    claimMarketContract(target.id);
    const claimed = useGameStore.getState().G.contracts.find((c) => c.id === target.id)!;
    expect(claimed.playerID).toBe('0');
    expect('roundsLeft' in claimed).toBe(false);
  });

  test('Undo after claiming an expiring contract restores the countdown', () => {
    const [target] = openMarket();
    setRoundsLeft(target.id, 2);
    const { G, ctx } = useGameStore.getState();
    useGameStore.getState().setTurnStartSnapshot({ G, ctx });
    claimMarketContract(target.id);
    useGameStore.getState().undoCurrentTurn();
    const restored = useGameStore.getState().G.contracts.find((c) => c.id === target.id)!;
    expect(restored.playerID).toBeNull();
    expect(restored.roundsLeft).toBe(2);
  });

  test('ending the last turn of a round in play runs expiration', () => {
    const [target] = openMarket();
    setRoundsLeft(target.id, 1);
    endTurn(); // player 0
    expect(useGameStore.getState().G.contracts.find((c) => c.id === target.id)?.roundsLeft).toBe(1);
    endTurn(); // player 1: round-end
    const { G } = useGameStore.getState();
    expect(G.contracts.find((c) => c.id === target.id)).toBeUndefined();
    expect(openMarket()).toHaveLength(3);
    expect(G.marketRoundsWithoutExpirationStart).toBeDefined();
  });
});

function setRoundsLeft(id: string, roundsLeft: number) {
  useGameStore.setState((s) => ({
    G: { ...s.G, contracts: s.G.contracts.map((c) => (c.id === id ? { ...c, roundsLeft } : c)) },
  }));
}
