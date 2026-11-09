import { beforeEach, describe, expect, test } from 'vitest';
import { useGameStore, type GameContext, type GameState } from '../../stores/gameStore';
import { saveGameState } from '../../utils/gameManager';
import { runBotTurn } from '../runner/runTurn';
import { fastClock, setUpHostGame, type HostGame } from '../runner/hostGame.testHelper';
import { simplePolicy } from '../runner/simplePolicy.testHelper';
import { settleStore, stableStringify, waitForSavedGame } from './hostPorts';

let game: HostGame;
const snapshot = () => structuredClone({ G: useGameStore.getState().G, ctx: useGameStore.getState().ctx });
const withTurn = (s: { G: GameState; ctx: GameContext }, currentPlayer: string, playOrderPos: number) => ({
  G: s.G,
  ctx: { ...s.ctx, currentPlayer, playOrderPos },
});

beforeEach(async () => {
  useGameStore.getState().resetState(2);
  game = await setUpHostGame({ phase: 'play' });
});

describe('stableStringify', () => {
  test('ignores key order and undefined values', () => {
    expect(stableStringify({ b: 1, a: [{ d: undefined, c: 2 }] })).toBe(stableStringify({ a: [{ c: 2 }], b: 1 }));
  });
});

describe('echo-safe saving', () => {
  test('re-saves the state the move produced, not a rewound store', async () => {
    const before = snapshot();
    const after = withTurn(before, '1', 1);
    // The row and the store both still show the older state (a slow save landed last, then echoed back).
    useGameStore.setState(before);
    await waitForSavedGame(game.code, after, { clock: fastClock, resaveAfterMs: 0 });
    const stored = await game.storage.loadGame(game.code);
    expect((stored!.ctx as GameContext).currentPlayer).toBe('1');
  });

  test('restores the store if it stays rewound', async () => {
    const before = snapshot();
    const after = withTurn(before, '1', 1);
    useGameStore.setState(before);
    await settleStore(after, fastClock, 150, 300);
    expect(useGameStore.getState().ctx.currentPlayer).toBe('1');
  });
});

describe('settling before a turn', () => {
  test('a bot doesn’t act on a store a stale echo rewound to its turn', async () => {
    // Stored: it's the human's turn. Store: rewound to the bot's.
    const stored = withTurn(snapshot(), '1', 1);
    await saveGameState(game.code, stored.G, stored.ctx);
    useGameStore.setState(withTurn(snapshot(), '0', 0));
    expect(await runBotTurn({ playerID: '0', ports: game.ports, policy: simplePolicy, paceMs: 0 })).toBe('not-my-turn');
    expect(useGameStore.getState().ctx.currentPlayer).toBe('1');
  });
});
