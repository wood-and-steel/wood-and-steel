import {
  MAX_ROUTE_OWNERS,
  applyAcquisition,
  applyBoardOp,
  claimRoute,
  emptyBoardState,
  moveEngine,
  moveRailyard,
  normalizeBoardState,
  setRouteOwners,
  snapshotIndependentRailroads,
  unclaimRoute,
  type BoardState,
} from './boardOps';

const R = 'Atlanta-Birmingham';

describe('track ops', () => {
  it('claims an unclaimed route as primary, then adds parallel owners up to the cap', () => {
    let s = claimRoute(emptyBoardState(), R, '0');
    expect(s.track[R]).toEqual(['0']);
    s = claimRoute(s, R, '1');
    expect(s.track[R]).toEqual(['0', '1']);
    expect(claimRoute(s, R, '1')).toBe(s);
    for (const id of ['2', '3', '4']) s = claimRoute(s, R, id);
    expect(s.track[R]).toHaveLength(MAX_ROUTE_OWNERS);
    expect(s.track[R]).not.toContain('4');
  });

  it('sets owners (deduped, capped) and an empty list unclaims', () => {
    let s = setRouteOwners(emptyBoardState(), R, ['2', '2', '0', '1', '3', '4']);
    expect(s.track[R]).toEqual(['2', '0', '1', '3']);
    s = setRouteOwners(s, R, []);
    expect(R in s.track).toBe(false);
  });

  it('unclaims one owner (next becomes primary) or all', () => {
    const s = setRouteOwners(emptyBoardState(), R, ['0', '1']);
    expect(unclaimRoute(s, R, '0').track[R]).toEqual(['1']);
    expect(R in unclaimRoute(s, R).track).toBe(false);
    expect(unclaimRoute(s, 'Boston-New York')).toBe(s);
  });

  it('does not mutate its input', () => {
    const s = emptyBoardState();
    claimRoute(s, R, '0');
    expect(s.track).toEqual({});
  });
});

describe('token ops', () => {
  it('moves engines and the Railyard between cities and the tray', () => {
    let s = moveEngine(emptyBoardState(), '0', 1, 'Denver');
    expect(s.engines['0']).toEqual([null, 'Denver']);
    s = moveEngine(s, '0', 0, 'Omaha');
    s = moveEngine(s, '0', 1, null);
    expect(s.engines['0']).toEqual(['Omaha', null]);
    s = moveRailyard(s, '0', 'Chicago');
    expect(s.railyards['0']).toBe('Chicago');
  });
});

describe('independent railroad ops', () => {
  it('converts an acquired railroad to track (primary if free, else parallel) and drops it from the snapshot', () => {
    let s: BoardState = snapshotIndependentRailroads(emptyBoardState(), { Erie: [R, 'Boston-New York'], Reading: [] });
    s = setRouteOwners(s, R, ['1']);
    s = applyAcquisition(s, 'Erie', '0', [R, 'Boston-New York']);
    expect(s.track[R]).toEqual(['1', '0']);
    expect(s.track['Boston-New York']).toEqual(['0']);
    expect(Object.keys(s.seenIndependentRailroads)).toEqual(['Reading']);
  });

  it('with no acquirer only updates the snapshot', () => {
    const s = applyAcquisition(snapshotIndependentRailroads(emptyBoardState(), { Erie: [R] }), 'Erie', null, [R]);
    expect(s.track).toEqual({});
    expect(s.seenIndependentRailroads).toEqual({});
  });
});

describe('applyBoardOp', () => {
  it('replays a sequence of ops', () => {
    const s = [
      { type: 'claimRoute', routeKey: R, playerID: '0' },
      { type: 'claimRoute', routeKey: R, playerID: '1' },
      { type: 'unclaimRoute', routeKey: R, playerID: '0' },
      { type: 'moveEngine', playerID: '1', slot: 0, city: 'Atlanta' },
      { type: 'moveRailyard', playerID: '1', city: 'Birmingham' },
    ].reduce((state, op) => applyBoardOp(state, op as Parameters<typeof applyBoardOp>[1]), emptyBoardState());
    expect(s.track[R]).toEqual(['1']);
    expect(s.engines['1']).toEqual(['Atlanta', null]);
    expect(s.railyards['1']).toBe('Birmingham');
  });
});

describe('normalizeBoardState', () => {
  it('keeps valid data and drops malformed entries', () => {
    const s = normalizeBoardState({
      version: 1,
      seeded: true,
      track: { [R]: ['0', '0', '1'], bad: 'x', empty: [] },
      engines: { '0': ['Denver', 5], '1': 'x' },
      railyards: { '0': 'Omaha', '1': 3 },
      seenIndependentRailroads: { Erie: [R], bad: [1] },
    });
    expect(s).toEqual({
      version: 1,
      seeded: true,
      track: { [R]: ['0', '1'] },
      engines: { '0': ['Denver', null] },
      railyards: { '0': 'Omaha', '1': null },
      seenIndependentRailroads: { Erie: [R] },
    });
  });

  it('returns an empty state for junk and rejects newer versions', () => {
    expect(normalizeBoardState(null)).toEqual(emptyBoardState());
    expect(() => normalizeBoardState({ version: 2 })).toThrow(/newer/);
  });
});
