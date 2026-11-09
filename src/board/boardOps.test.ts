import {
  BOARD_STATE_VERSION,
  MAX_ROUTE_OWNERS,
  applyAcquisition,
  applyBoardOp,
  claimRoute,
  emptyBoardState,
  moveEngine,
  moveRailyard,
  normalizeBoardState,
  playerEngineTypes,
  setCargo,
  setEngineType,
  setRouteOwners,
  setUpgrade,
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

describe('player tracking ops', () => {
  it('defaults to a John Bull on the light token, for a null board too', () => {
    expect(playerEngineTypes(null, '0')).toEqual(['john-bull', null]);
    expect(playerEngineTypes(emptyBoardState(), '0')).toEqual(['john-bull', null]);
  });

  it('sets one token type on top of the default', () => {
    const s = setEngineType(emptyBoardState(), '0', 1, 'mogul');
    expect(s.engineTypes['0']).toEqual(['john-bull', 'mogul']);
  });

  it('keeps an explicitly empty pair instead of falling back to the default', () => {
    const s = setEngineType(emptyBoardState(), '0', 0, null);
    expect(playerEngineTypes(s, '0')).toEqual([null, null]);
  });

  it('sets and empties cargo per token', () => {
    let s = setCargo(emptyBoardState(), '0', 1, 'coal');
    expect(s.cargo['0']).toEqual([null, 'coal']);
    s = setCargo(s, '0', 1, null);
    expect(s.cargo['0']).toEqual([null, null]);
  });

  it('changing an engine keeps its cargo', () => {
    const s = setEngineType(setCargo(emptyBoardState(), '0', 0, 'coal'), '0', 0, 'american');
    expect(s.cargo['0']).toEqual(['coal', null]);
  });

  it('clearing an engine empties only that token', () => {
    let s = setCargo(setCargo(emptyBoardState(), '0', 0, 'coal'), '0', 1, 'wood');
    s = setEngineType(s, '0', 0, null);
    expect(s.cargo['0']).toEqual([null, 'wood']);
  });

  it('sets upgrades absolutely, so re-applying changes nothing', () => {
    const bought = setUpgrade(emptyBoardState(), '0', 'timetable', true);
    expect(bought.upgrades['0']).toEqual(['timetable']);
    expect(setUpgrade(bought, '0', 'timetable', true)).toBe(bought);
    const sold = setUpgrade(bought, '0', 'timetable', false);
    expect(sold.upgrades['0']).toEqual([]);
    expect(setUpgrade(sold, '0', 'timetable', false)).toBe(sold);
  });

  it('tracks players independently and does not mutate its input', () => {
    const start = setUpgrade(emptyBoardState(), '0', 'roundhouse', true);
    const next = setUpgrade(setCargo(start, '1', 0, 'oil'), '1', 'timetable', true);
    expect(next.upgrades).toEqual({ '0': ['roundhouse'], '1': ['timetable'] });
    expect(start.upgrades).toEqual({ '0': ['roundhouse'] });
    expect(start.cargo).toEqual({});
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
      { type: 'setEngineType', playerID: '1', slot: 1, engineType: 'pacific' },
      { type: 'setCargo', playerID: '1', slot: 1, commodity: 'iron ore' },
      { type: 'setUpgrade', playerID: '1', upgrade: 'service-yard', owned: true },
    ].reduce((state, op) => applyBoardOp(state, op as Parameters<typeof applyBoardOp>[1]), emptyBoardState());
    expect(s.track[R]).toEqual(['1']);
    expect(s.engines['1']).toEqual(['Atlanta', null]);
    expect(s.railyards['1']).toBe('Birmingham');
    expect(s.engineTypes['1']).toEqual(['john-bull', 'pacific']);
    expect(s.cargo['1']).toEqual([null, 'iron ore']);
    expect(s.upgrades['1']).toEqual(['service-yard']);
  });
});

describe('normalizeBoardState', () => {
  it('keeps valid data and drops malformed entries', () => {
    const s = normalizeBoardState({
      version: BOARD_STATE_VERSION,
      seeded: true,
      track: { [R]: ['0', '0', '1'], bad: 'x', empty: [] },
      engines: { '0': ['Denver', 5], '1': 'x' },
      railyards: { '0': 'Omaha', '1': 3 },
      engineTypes: { '0': ['mogul', 'hogwarts-express'], '1': 'x' },
      cargo: { '0': ['coal', 'kryptonite'], '1': 7 },
      upgrades: { '0': ['timetable', 'timetable', 'hub', 4], '1': 'timetable' },
      seenIndependentRailroads: { Erie: [R], bad: [1] },
    });
    expect(s).toEqual({
      version: BOARD_STATE_VERSION,
      seeded: true,
      track: { [R]: ['0', '1'] },
      engines: { '0': ['Denver', null] },
      railyards: { '0': 'Omaha', '1': null },
      engineTypes: { '0': ['mogul', null] },
      cargo: { '0': ['coal', null] },
      upgrades: { '0': ['timetable'] },
      seenIndependentRailroads: { Erie: [R] },
    });
  });

  it('loads a version 1 row without player tracking', () => {
    const s = normalizeBoardState({ version: 1, seeded: true, track: { [R]: ['0'] } });
    expect(s.version).toBe(BOARD_STATE_VERSION);
    expect(s.track[R]).toEqual(['0']);
    expect(s.engineTypes).toEqual({});
    expect(s.cargo).toEqual({});
    expect(s.upgrades).toEqual({});
    expect(playerEngineTypes(s, '0')).toEqual(['john-bull', null]);
  });

  it('returns an empty state for junk and rejects newer versions', () => {
    expect(normalizeBoardState(null)).toEqual(emptyBoardState());
    expect(() => normalizeBoardState({ version: BOARD_STATE_VERSION + 1 })).toThrow(/newer/);
  });
});
