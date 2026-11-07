import type { GameContext, GameState } from '../stores/gameStore';
import { applyBoardOp, emptyBoardState, type BoardState } from './boardOps';
import { useBoardStore } from './boardStore';
import { closeBoard, dispatchBoardOp, openBoard, trySeedBoard } from './boardSync';
import { MemoryBoardStateAdapter } from './memoryBoardStateAdapter.testHelper';

const CODE = 'BCDFG';
const R1 = 'Atlanta-Birmingham';
const R2 = 'Boston-New York';

const G = {
  contracts: [],
  players: [['0', { name: 'Ada', activeCities: ['Boston', 'Portland ME'], hubCity: null, regionalOffice: null }]],
  independentRailroads: {},
} as GameState;
const ctx = { phase: 'play', currentPlayer: '0', numPlayers: 1, playOrder: ['0'], playOrderPos: 0, turn: 0, round: 1 } as GameContext;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await tick();
}
const stored = (adapter: MemoryBoardStateAdapter) => adapter.rows.get(CODE)?.state as BoardState | undefined;
const state = () => useBoardStore.getState();

function seeded(): BoardState {
  return { ...emptyBoardState(), seeded: true };
}

describe('boardSync', () => {
  let adapter: MemoryBoardStateAdapter;

  beforeEach(() => {
    adapter = new MemoryBoardStateAdapter();
  });

  afterEach(() => closeBoard());

  it('loads an existing row', async () => {
    adapter.write(CODE, { ...seeded(), track: { [R1]: ['0'] } });
    await openBoard(CODE, adapter);
    expect(state().status).toBe('ready');
    expect(state().board?.track).toEqual({ [R1]: ['0'] });
  });

  it('seeds a missing row from G only once setup is over', async () => {
    await openBoard(CODE, adapter);
    expect(state().status).toBe('unseeded');

    await trySeedBoard(G, { ...ctx, phase: 'setup' });
    expect(adapter.rows.has(CODE)).toBe(false);

    await trySeedBoard(G, ctx);
    expect(state().status).toBe('ready');
    expect(stored(adapter)?.track).toEqual({ 'Boston-Portland ME': ['0'] });
  });

  it("uses another screen's seed if it got there first", async () => {
    await openBoard(CODE, adapter);
    adapter.beforeSave = () => adapter.write(CODE, { ...seeded(), track: { [R1]: ['9'] } });
    await trySeedBoard(G, ctx);
    await settle();
    expect(state().board?.track).toEqual({ [R1]: ['9'] });
    expect(adapter.saves).toBe(1);
  });

  it('applies ops immediately and saves them in order', async () => {
    adapter.write(CODE, seeded());
    await openBoard(CODE, adapter);
    dispatchBoardOp({ type: 'claimRoute', routeKey: R1, playerID: '0' });
    dispatchBoardOp({ type: 'moveEngine', playerID: '0', slot: 0, city: 'Atlanta' });
    expect(state().board?.track[R1]).toEqual(['0']);
    expect(state().pending).toHaveLength(2);

    await settle();
    expect(state().pending).toHaveLength(0);
    expect(stored(adapter)?.track[R1]).toEqual(['0']);
    expect(stored(adapter)?.engines['0']).toEqual(['Atlanta', null]);
  });

  it('on conflict, reloads and re-applies the op so both screens keep their edits', async () => {
    adapter.write(CODE, seeded());
    await openBoard(CODE, adapter);
    // Another screen claims R2 just before our save lands.
    adapter.beforeSave = () =>
      adapter.write(CODE, applyBoardOp(stored(adapter)!, { type: 'claimRoute', routeKey: R2, playerID: '1' }));
    dispatchBoardOp({ type: 'claimRoute', routeKey: R1, playerID: '0' });
    await settle();
    expect(stored(adapter)?.track).toEqual({ [R1]: ['0'], [R2]: ['1'] });
    expect(state().board?.track).toEqual({ [R1]: ['0'], [R2]: ['1'] });
    expect(state().error).toBeNull();
  });

  it('applies realtime updates from other screens', async () => {
    adapter.write(CODE, seeded());
    await openBoard(CODE, adapter);
    adapter.write(CODE, { ...seeded(), track: { [R2]: ['1'] } });
    await settle();
    expect(state().board?.track).toEqual({ [R2]: ['1'] });
  });

  it('reports save errors and rolls back the unsaved op', async () => {
    adapter.write(CODE, seeded());
    await openBoard(CODE, adapter);
    adapter.save = () => Promise.reject(new Error('network down'));
    dispatchBoardOp({ type: 'claimRoute', routeKey: R1, playerID: '0' });
    await settle();
    expect(state().board?.track).toEqual({});
    expect(state().error).toMatch(/network down/);
  });

  it('reports load errors such as a missing table', async () => {
    adapter.load = () => Promise.reject(new Error('board_states table does not exist'));
    await openBoard(CODE, adapter);
    expect(state().status).toBe('error');
    expect(state().error).toMatch(/does not exist/);
  });
});
