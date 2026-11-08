import type { GameContext, GameState } from '../stores/gameStore';
import { findAcquirer, reconcileOp } from './boardAcquisitions';
import { applyBoardOp, emptyBoardState, setRouteOwners, type BoardState } from './boardOps';

const ERIE = ['Chicago-Cleveland', 'Chicago-Detroit'];

function game(
  active: Record<string, string[]>,
  railroads: Record<string, string[]>,
  currentPlayer = '0'
): { G: GameState; ctx: GameContext } {
  const ids = Object.keys(active);
  return {
    G: {
      contracts: [],
      players: ids.map((id) => [id, { name: `P${id}`, activeCities: active[id], hubCity: null, regionalOffice: null }]),
      independentRailroads: Object.fromEntries(
        Object.entries(railroads).map(([name, keys]) => [name, { name, routes: keys.map((key) => ({ key, addedInRound: 0 })) }])
      ),
    },
    ctx: { phase: 'play', currentPlayer, numPlayers: ids.length, playOrder: ids, playOrderPos: 0, turn: 0, round: 1 },
  };
}

function boardWith(seen: Record<string, string[]>): BoardState {
  return { ...emptyBoardState(), seeded: true, seenIndependentRailroads: seen };
}

describe('findAcquirer', () => {
  it('is the one player with all of the railroad cities active', () => {
    const { G, ctx } = game({ '0': ['Boston'], '1': ['Chicago', 'Cleveland', 'Detroit'] }, {});
    expect(findAcquirer(G, ctx, ERIE)).toBe('1');
  });

  it('prefers the current player when several qualify, else gives up', () => {
    const all = ['Chicago', 'Cleveland', 'Detroit'];
    expect(findAcquirer(game({ '0': all, '1': all }, {}, '1').G, game({ '0': all, '1': all }, {}, '1').ctx, ERIE)).toBe('1');
    const g = game({ '0': all, '1': all, '2': [] }, {}, '2');
    expect(findAcquirer(g.G, g.ctx, ERIE)).toBeNull();
    const none = game({ '0': ['Chicago'] }, {});
    expect(findAcquirer(none.G, none.ctx, ERIE)).toBeNull();
  });
});

describe('reconcileOp', () => {
  it('does nothing when the snapshot matches G', () => {
    const { G, ctx } = game({ '0': [] }, { Erie: ERIE });
    expect(reconcileOp(boardWith({ Erie: ERIE }), G, ctx)).toBeNull();
  });

  it('only updates the snapshot for end-of-round growth and new railroads', () => {
    const { G, ctx } = game({ '0': [] }, { Erie: [...ERIE, 'Cleveland-Pittsburgh'], Reading: ['Denver-Omaha'] });
    const board = boardWith({ Erie: ERIE });
    const next = applyBoardOp(board, reconcileOp(board, G, ctx)!);
    expect(next.track).toEqual({});
    expect(next.seenIndependentRailroads).toEqual({ Erie: [...ERIE, 'Cleveland-Pittsburgh'], Reading: ['Denver-Omaha'] });
  });

  it('converts an acquired railroad to track: primary where free, parallel where claimed', () => {
    const { G, ctx } = game({ '0': [], '1': ['Chicago', 'Cleveland', 'Detroit'] }, { Reading: ['Denver-Omaha'] }, '1');
    const board = setRouteOwners(boardWith({ Erie: ERIE, Reading: ['Denver-Omaha'] }), 'Chicago-Detroit', ['0']);
    const op = reconcileOp(board, G, ctx)!;
    expect(op).toMatchObject({ acquirers: { Erie: '1' } });
    const next = applyBoardOp(board, op);
    expect(next.track).toEqual({ 'Chicago-Cleveland': ['1'], 'Chicago-Detroit': ['0', '1'] });
    expect(next.seenIndependentRailroads).toEqual({ Reading: ['Denver-Omaha'] });
  });

  it('is idempotent when re-applied after another screen already converted', () => {
    const { G, ctx } = game({ '1': ['Chicago', 'Cleveland', 'Detroit'] }, {}, '1');
    const board = boardWith({ Erie: ERIE });
    const op = reconcileOp(board, G, ctx)!;
    // Another screen converted, then someone unclaimed one of the routes.
    const theirs = setRouteOwners(applyBoardOp(board, op), 'Chicago-Cleveland', []);
    expect(applyBoardOp(theirs, op)).toEqual(theirs);
  });
});
