import { beforeEach, describe, expect, test } from 'vitest';
import { moneyValue, type Contract } from '../../Contract';
import { normalizeBoardState } from '../../board/boardOps';
import { useGameStore } from '../../stores/gameStore';
import { normalizeBotStates } from '../state/botStates';
import { runBotTurn } from './runTurn';
import { simplePolicy } from './simplePolicy.testHelper';
import { setUpHostGame, type HostGame } from './hostGame.testHelper';
import { stableStringify } from '../host/hostPorts';
import { serializeState } from '../../utils/stateSerialization';

const contract = (fields: Partial<Contract>): Contract => ({
  id: 'k1',
  destinationKey: 'New York',
  commodity: 'machinery',
  type: 'private',
  fulfilled: false,
  playerID: '0',
  creationTime: 0,
  turnsHeld: 0,
  ...fields,
});

const track = {
  'Boston-Portland ME': ['0'],
  'Boston-New York': ['0'],
  'New York-Philadelphia': ['0'],
  'Norfolk-Raleigh': ['1'],
};

/** Last item of a list. */
function last<T>(items: T[]): T {
  return items[items.length - 1];
}

function botRecord(game: HostGame) {
  return normalizeBotStates(game.botAdapter.rows.get(game.code)!.state).bots['0'];
}

async function storedMatchesStore(game: HostGame): Promise<boolean> {
  const stored = await game.storage.loadGame(game.code);
  const { G, ctx } = useGameStore.getState();
  const norm = (g: unknown, c: unknown) => stableStringify(serializeState(g as Record<string, unknown>, c as Record<string, unknown>));
  return norm(stored!.G, stored!.ctx) === norm(G, ctx);
}

beforeEach(() => {
  useGameStore.getState().resetState(2);
});

describe('runBotTurn', () => {
  test('setup: chooses starting cities, which ends the turn', async () => {
    const game = await setUpHostGame({ phase: 'setup' });
    expect(await runBotTurn({ playerID: '0', ports: game.ports, policy: simplePolicy, paceMs: 0 })).toBe('done');

    const { G, ctx } = useGameStore.getState();
    const me = G.players.find(([id]) => id === '0')![1];
    expect(me.activeCities).toHaveLength(2);
    expect(G.contracts.filter((c) => c.playerID === '0' && c.type === 'private')).toHaveLength(1);
    expect(ctx.currentPlayer).toBe('1');
    expect(await storedMatchesStore(game)).toBe(true);

    const record = botRecord(game);
    expect(record.turnInProgress).toBeNull();
    expect(last(record.log).lines).toEqual([`Chose starting cities ${me.activeCities[0]} & ${me.activeCities[1]}`]);
  });

  test('play: delivers, takes a new private contract, and ends the turn', async () => {
    const game = await setUpHostGame({
      phase: 'play',
      contracts: [contract({})],
      board: { track, engines: { '0': ['Boston', null], '1': [null, null] } },
    });
    expect(await runBotTurn({ playerID: '0', ports: game.ports, policy: simplePolicy, paceMs: 0 })).toBe('done');

    const { G, ctx } = useGameStore.getState();
    expect(G.contracts.find((c) => c.id === 'k1')!.fulfilled).toBe(true);
    expect(G.contracts.filter((c) => c.playerID === '0' && c.type === 'private' && !c.fulfilled)).toHaveLength(1);
    expect(ctx.currentPlayer).toBe('1');
    expect(await storedMatchesStore(game)).toBe(true);

    const board = normalizeBoardState(game.boardAdapter.rows.get(game.code)!.state);
    expect(board.engines['0'][0]).toBe('New York');

    const record = botRecord(game);
    expect(record.cash).toBe(10000 + moneyValue({ commodity: 'machinery', destinationKey: 'New York' }));
    expect(record.deliveries).toEqual({ machinery: 1 });
    expect(record.turnInProgress).toBeNull();
    const lines = last(record.log).lines;
    expect(lines[0]).toMatch(/^Ran light engine Boston to New York, picked up machinery in Boston & delivered machinery to New York for \$/);
    expect(lines[1]).toMatch(/^Chose private contract: /);
    expect(lines.some((l) => /ended/i.test(l))).toBe(false);
  });

  test('places the starting engine first if it isn’t on the board', async () => {
    const game = await setUpHostGame({ phase: 'play', contracts: [contract({})], board: { track } });
    await runBotTurn({ playerID: '0', ports: game.ports, policy: simplePolicy, paceMs: 0 });
    expect(last(botRecord(game).log).lines[0]).toMatch(/^Placed 2-4-0 John Bull in /);
  });

  test('resumes an interrupted action without repeating moves G already shows', async () => {
    const game = await setUpHostGame({
      phase: 'play',
      contracts: [contract({ fulfilled: true }), contract({ id: 'k2', commodity: 'wood', destinationKey: 'Boston' })],
      board: { track, engines: { '0': ['Boston', null], '1': [null, null] } },
    });
    // The reload happened after the delivery move but before the board op and narration.
    const states = normalizeBotStates(game.botAdapter.rows.get(game.code)!.state);
    states.bots['0'].turnInProgress = {
      turn: 3,
      playOrderPos: 0,
      steps: ['runTrains:0'],
      pending: {
        step: 'runTrains:0',
        effects: [
          { kind: 'move', move: { name: 'toggleContractFulfilled', args: ['k1'] } },
          { kind: 'boardOp', op: { type: 'moveEngine', playerID: '0', slot: 0, city: 'New York' } },
          { kind: 'narrate', line: 'Delivered machinery to New York' },
        ],
      },
    };
    game.botAdapter.write(game.code, states);

    expect(await runBotTurn({ playerID: '0', ports: game.ports, policy: simplePolicy, paceMs: 0 })).toBe('done');
    // Toggling again would have un-fulfilled it.
    expect(useGameStore.getState().G.contracts.find((c) => c.id === 'k1')!.fulfilled).toBe(true);
    expect(normalizeBoardState(game.boardAdapter.rows.get(game.code)!.state).engines['0'][0]).toBe('New York');
    const lines = last(botRecord(game).log).lines;
    expect(lines[0]).toBe('Delivered machinery to New York');
    // The engine already ran this turn, so it doesn't run again.
    expect(lines.filter((l) => l.includes('ran the light engine'))).toEqual([]);
  });

  test('does nothing when it isn’t the bot’s turn', async () => {
    const game = await setUpHostGame({ phase: 'play', currentPlayer: '1' });
    expect(await runBotTurn({ playerID: '0', ports: game.ports, policy: simplePolicy, paceMs: 0 })).toBe('not-my-turn');
    expect(botRecord(game).log).toEqual([]);
  });

  test('stops when asked', async () => {
    const game = await setUpHostGame({ phase: 'play', contracts: [contract({})], board: { track } });
    expect(await runBotTurn({ playerID: '0', ports: game.ports, policy: simplePolicy, paceMs: 0, shouldStop: () => true })).toBe('stopped');
    expect(useGameStore.getState().ctx.currentPlayer).toBe('0');
  });
});
