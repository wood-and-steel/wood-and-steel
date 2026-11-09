import { describe, expect, test } from 'vitest';
import { moneyValue } from '../../Contract';
import { applyAction, listActions, setOffers, type Action, type Effect } from './actions';
import type { BotWorld } from './world';
import { makeWorld } from './world.testHelper';

function apply(world: BotWorld, action: Action) {
  const result = applyAction(world, action);
  if (!result.ok) throw new Error(result.error);
  return result;
}

const moves = (effects: Effect[]) => effects.flatMap((e) => (e.kind === 'move' ? [e.move] : []));
const ops = (effects: Effect[]) => effects.flatMap((e) => (e.kind === 'boardOp' ? [e.op] : []));
const lines = (effects: Effect[]) => effects.flatMap((e) => (e.kind === 'narrate' ? [e.line] : []));
const types = (actions: Action[]) => [...new Set(actions.map((a) => a.type))].sort();

describe('turn order and phase', () => {
  test('nothing when it isn’t the bot’s turn', () => {
    const world = makeWorld({ currentPlayer: '1' });
    expect(listActions(world)).toEqual([]);
    expect(applyAction(world, { type: 'endTurn' })).toEqual({ ok: false, error: 'not this bot’s turn' });
  });

  test('setup: choose a starting pair no one else has a city of', () => {
    const world = makeWorld({ phase: 'setup', players: { '0': { activeCities: [] }, '1': { activeCities: ['New York', 'Philadelphia'] } } });
    const pairs = listActions(world).map((a) => (a.type === 'chooseStartingCities' ? a.pair.join('/') : a.type));
    expect(pairs).toEqual(['Montreal/Quebec City', 'Boston/Portland ME', 'Norfolk/Raleigh', 'Charleston/Savannah']);
    const { effects } = apply(world, { type: 'chooseStartingCities', pair: ['Boston', 'Portland ME'] });
    expect(moves(effects)).toEqual([{ name: 'generateStartingContract', args: [['Boston', 'Portland ME'], '0'] }]);
    expect(lines(effects)).toEqual(['Avery chose Boston and Portland ME as starting cities.']);
    expect(applyAction(world, { type: 'chooseStartingCities', pair: ['Philadelphia', 'Washington'] }).ok).toBe(false);
  });

  test('the starting engine is placed first, on a network city', () => {
    const world = makeWorld({ board: { engines: { '0': [null, null] } } });
    expect(types(listActions(world))).toEqual(['placeEngine']);
    const { effects, world: next } = apply(world, { type: 'placeEngine', slot: 0, city: 'Boston' });
    expect(ops(effects)).toEqual([{ type: 'moveEngine', playerID: '0', slot: 0, city: 'Boston' }]);
    expect(lines(effects)).toEqual(['Avery placed the 2-4-0 John Bull in Boston.']);
    expect(types(listActions(next))).toContain('runTrains');
  });

  test('two actions a turn, none repeated except running other engines', () => {
    let world = makeWorld({ board: { engineTypes: { '0': ['american', 'american'] }, engines: { '0': ['Boston', 'New York'] } } });
    world = apply(world, { type: 'borrow', amount: 5000 }).world;
    expect(types(listActions(world))).not.toContain('borrow');
    expect(applyAction(world, { type: 'borrow', amount: 5000 }).ok).toBe(false);
    world = apply(world, { type: 'runTrains', runs: [{ slot: 0, path: ['Boston', 'Portland ME'], events: [] }] }).world;
    expect(listActions(world)).toEqual([{ type: 'endTurn' }]);
    expect(applyAction(world, { type: 'repay', amount: 5000 }).ok).toBe(false);
  });

  test('ending the turn', () => {
    const { effects } = apply(makeWorld(), { type: 'endTurn' });
    expect(moves(effects)).toEqual([{ name: 'endTurn', args: [] }]);
    expect(lines(effects)).toEqual(['Avery ended the turn.']);
  });

  test('never offers anything but known actions (no "go first")', () => {
    const world = makeWorld({ bot: { cash: 100000 }, contracts: [{ commodity: 'machinery', destinationKey: 'Philadelphia' }] });
    const known = ['acquireRailroad', 'borrow', 'buildTrack', 'buyEngine', 'buyUpgrade', 'endTurn', 'redrawPrivateContract', 'repay', 'runTrains'];
    expect(types(listActions(world)).every((t) => known.includes(t))).toBe(true);
  });
});

describe('build track', () => {
  test('claims the routes, pays for them, and narrates', () => {
    const { world, effects } = apply(makeWorld(), { type: 'buildTrack', routes: ['Boston-Syracuse', 'Syracuse-Toronto'] });
    expect(ops(effects)).toEqual([
      { type: 'claimRoute', routeKey: 'Boston-Syracuse', playerID: '0' },
      { type: 'claimRoute', routeKey: 'Syracuse-Toronto', playerID: '0' },
    ]);
    expect(world.bot.cash).toBe(10000 - 5000);
    expect(world.board.track['Syracuse-Toronto']).toEqual(['0']);
    expect(lines(effects)).toEqual(['Avery built Boston–Syracuse and Syracuse–Toronto for $5,000.']);
  });

  test('refuses unconnected track, too many routes, and too little cash', () => {
    const world = makeWorld();
    expect(applyAction(world, { type: 'buildTrack', routes: ['Cleveland-Pittsburgh'] }).ok).toBe(false);
    expect(applyAction(world, { type: 'buildTrack', routes: ['Boston-Syracuse', 'Syracuse-Toronto', 'Montreal-Syracuse'] }).ok).toBe(false);
    expect(applyAction(makeWorld({ bot: { cash: 2000 } }), { type: 'buildTrack', routes: ['Boston-Syracuse'] }).ok).toBe(false);
  });

  test('listActions offers only affordable, connected combinations', () => {
    const builds = listActions(makeWorld({ bot: { cash: 3000 } })).filter((a) => a.type === 'buildTrack');
    expect(builds.length).toBeGreaterThan(0);
    expect(builds).toContainEqual({ type: 'buildTrack', routes: ['Boston-Syracuse'] });
    expect(builds).not.toContainEqual({ type: 'buildTrack', routes: ['New York-Syracuse'] }); // $6,000
  });
});

describe('buy an engine', () => {
  test('trading in keeps the city', () => {
    const { world, effects } = apply(makeWorld(), { type: 'buyEngine', engine: 'american', slot: 0 });
    expect(ops(effects)).toEqual([{ type: 'setEngineType', playerID: '0', slot: 0, engineType: 'american' }]);
    expect(world.bot.cash).toBe(5000);
    expect(lines(effects)).toEqual(['Avery bought a 4-4-0 American for $5,000, trading in the 2-4-0 John Bull.']);
  });

  test('a second engine goes on a network city', () => {
    const base = makeWorld({ board: { engineTypes: { '0': ['american', null] } } });
    const { world, effects } = apply(base, { type: 'buyEngine', engine: 'mogul', slot: 1, city: 'New York' });
    expect(ops(effects)).toEqual([
      { type: 'setEngineType', playerID: '0', slot: 1, engineType: 'mogul' },
      { type: 'moveEngine', playerID: '0', slot: 1, city: 'New York' },
    ]);
    expect(world.board.engines['0']).toEqual(['Boston', 'New York']);
    expect(applyAction(base, { type: 'buyEngine', engine: 'mogul', slot: 1, city: 'Chicago' }).ok).toBe(false);
  });

  test('a John Bull can stay as a second engine', () => {
    const { world } = apply(makeWorld(), { type: 'buyEngine', engine: 'american', slot: 1, city: 'New York' });
    expect(world.board.engineTypes['0']).toEqual(['john-bull', 'american']);
  });

  test('a new engine can pick up where it is placed, and a new Mogul can claim a market contract', () => {
    const world = makeWorld({
      board: { engineTypes: { '0': ['american', null] } },
      contracts: [{ id: 'm1', type: 'market', playerID: null, commodity: 'imports', destinationKey: 'Boston' }],
    });
    const action: Action = { type: 'buyEngine', engine: 'mogul', slot: 1, city: 'New York', pickup: { commodity: 'imports', claim: 'm1' } };
    expect(listActions(world)).toContainEqual(action);
    const { world: next, effects } = apply(world, action);
    expect(moves(effects)).toEqual([{ name: 'claimMarketContract', args: ['m1'] }]);
    expect(ops(effects)).toEqual([
      { type: 'setEngineType', playerID: '0', slot: 1, engineType: 'mogul' },
      { type: 'moveEngine', playerID: '0', slot: 1, city: 'New York' },
      { type: 'setCargo', playerID: '0', slot: 1, commodity: 'imports' },
    ]);
    expect(next.board.cargo['0']).toEqual([null, 'imports']);
    expect(lines(effects)).toEqual([
      'Avery bought a 2-6-0 Mogul for $7,000, placed it in New York, and picked up imports, claiming the market contract for imports to Boston.',
    ]);
  });

  test('no pickup where the city doesn’t supply it, or on a trade-in', () => {
    const world = makeWorld({ board: { engineTypes: { '0': ['american', null] } } });
    expect(applyAction(world, { type: 'buyEngine', engine: 'mogul', slot: 1, city: 'Boston', pickup: { commodity: 'imports' } }).ok).toBe(false);
    expect(applyAction(world, { type: 'buyEngine', engine: 'mogul', slot: 0, pickup: { commodity: 'machinery' } }).ok).toBe(false);
  });
});

describe('independent railroads', () => {
  test('acquiring moves the railroad to the bot and tells the board who acquired it', () => {
    const world = makeWorld({
      independentRailroads: { Erie: { name: 'Erie', routes: [{ key: 'Boston-Syracuse', addedInRound: 0 }] } },
    });
    const { world: next, effects } = apply(world, { type: 'acquireRailroad', name: 'Erie' });
    expect(moves(effects)).toEqual([{ name: 'acquireIndependentRailroad', args: ['Erie'] }]);
    expect(ops(effects)).toEqual([{ type: 'reconcileIndependentRailroads', railroads: {}, acquirers: { Erie: '0' } }]);
    expect(next.board.track['Boston-Syracuse']).toEqual(['0']);
    expect(next.bot.cash).toBe(7000);
    expect(lines(effects)).toEqual(['Avery acquired the Erie for $3,000.']);
  });
});

describe('money', () => {
  test('borrow and repay', () => {
    const borrowed = apply(makeWorld({ bot: { debt: 15000 } }), { type: 'borrow', amount: 10000 });
    expect(borrowed.world.bot).toMatchObject({ cash: 20000, debt: 25000 });
    expect(lines(borrowed.effects)).toEqual(['Avery borrowed $10,000.']);
    const repaid = apply(makeWorld({ bot: { debt: 25000 } }), { type: 'repay', amount: 10000 });
    expect(repaid.world.bot).toMatchObject({ cash: 0, debt: 15000 });
    expect(applyAction(makeWorld({ bot: { debt: 15000 } }), { type: 'repay', amount: 5000 }).ok).toBe(false);
  });
});

describe('upgrades', () => {
  const rich = { bot: { cash: 50000 } };

  test('a Hub is claimed in the app', () => {
    const { world, effects } = apply(makeWorld(rich), { type: 'buyUpgrade', upgrade: 'hub', city: 'New York' });
    expect(moves(effects)).toEqual([{ name: 'claimHubCity', args: ['New York'] }]);
    expect(world.bot.cash).toBe(35000);
    expect(lines(effects)).toEqual(['Avery bought a Hub in New York for $15,000.']);
  });

  test('a Railyard is placed on the board', () => {
    const { effects } = apply(makeWorld(rich), { type: 'buyUpgrade', upgrade: 'railyard', city: 'Boston' });
    expect(ops(effects)).toEqual([{ type: 'moveRailyard', playerID: '0', city: 'Boston' }]);
  });

  test('tracked upgrades are checked on the board', () => {
    const { world, effects } = apply(makeWorld(rich), { type: 'buyUpgrade', upgrade: 'timetable' });
    expect(ops(effects)).toEqual([{ type: 'setUpgrade', playerID: '0', upgrade: 'timetable', owned: true }]);
    expect(world.board.upgrades['0']).toEqual(['timetable']);
    expect(lines(effects)).toEqual(['Avery bought a Timetable for $15,000.']);
  });

  test('a Regional Office is claimed in the app', () => {
    const track = { 'Boston-Portland ME': ['0'], 'Boston-New York': ['0'], 'New York-Philadelphia': ['0'], 'Boston-Syracuse': ['0'] };
    const { effects } = apply(makeWorld({ ...rich, board: { track } }), { type: 'buyUpgrade', upgrade: 'regional-office', region: 'NE' });
    expect(moves(effects)).toEqual([{ name: 'claimRegionalOffice', args: ['NE'] }]);
    expect(lines(effects)).toEqual(['Avery bought a Regional Office in the Northeast for $20,000.']);
  });

  test('refused when not open to the bot', () => {
    expect(applyAction(makeWorld(rich), { type: 'buyUpgrade', upgrade: 'service-yard' }).ok).toBe(false);
    expect(applyAction(makeWorld(), { type: 'buyUpgrade', upgrade: 'timetable' }).ok).toBe(false);
  });
});

describe('running trains and contracts', () => {
  const deliverWorld = (bot = {}) =>
    makeWorld({
      board: { engineTypes: { '0': ['american', null] } },
      contracts: [{ id: 'k1', commodity: 'machinery', destinationKey: 'Philadelphia' }],
      bot,
    });
  const delivery: Action = {
    type: 'runTrains',
    runs: [
      {
        slot: 0,
        path: ['Boston', 'New York', 'Philadelphia'],
        events: [
          { at: 0, kind: 'pickup', commodity: 'machinery' },
          { at: 2, kind: 'deliver', contractId: 'k1' },
        ],
      },
    ],
  };
  const value = moneyValue({ commodity: 'machinery', destinationKey: 'Philadelphia' });

  test('delivering a private contract pays, fulfills it, and asks for offers', () => {
    expect(listActions(deliverWorld())).toContainEqual(delivery);
    const { world, effects } = apply(deliverWorld(), delivery);
    expect(moves(effects)).toEqual([{ name: 'toggleContractFulfilled', args: ['k1'] }]);
    expect(effects.some((e) => e.kind === 'requestOffers')).toBe(true);
    expect(ops(effects)).toEqual([{ type: 'moveEngine', playerID: '0', slot: 0, city: 'Philadelphia' }]);
    expect(world.bot.cash).toBe(10000 + value);
    expect(world.bot.deliveries).toEqual({ machinery: 1 });
    expect(lines(effects)).toEqual([
      `Avery ran the light engine from Boston to Philadelphia, picked up machinery in Boston, and delivered machinery to Philadelphia for $${value.toLocaleString('en-US')}.`,
    ]);

    // Nothing else until the runner fetches offers; then only the offers.
    expect(listActions(world)).toEqual([]);
    const offered = setOffers(world, [{ commodity: 'coal', destinationKey: 'Boston' }, { commodity: 'wood', destinationKey: 'New York' }]);
    expect(types(listActions(offered))).toEqual(['choosePrivateContract']);
    const chosen = apply(offered, { type: 'choosePrivateContract', offer: { commodity: 'wood', destinationKey: 'New York' } });
    expect(moves(chosen.effects)).toEqual([{ name: 'addContract', args: ['wood', 'New York', 'private'] }]);
    expect(lines(chosen.effects)).toEqual(['Avery chose a private contract: wood to New York.']);
    expect(types(listActions(chosen.world))).toContain('endTurn');
  });

  test('debt service is taken from the payment once Western deliveries begin', () => {
    const { world, effects } = apply(deliverWorld({ debt: 15000, westernDeliveryMade: true }), delivery);
    expect(world.bot.cash).toBe(10000 + value - 3000);
    expect(lines(effects)[0]).toContain('less $3,000 debt service');
  });

  test('a delivery that would bankrupt the bot is refused and not offered', () => {
    const broke = deliverWorld({ cash: 0, debt: 200000, westernDeliveryMade: true });
    expect(applyAction(broke, delivery)).toEqual({ ok: false, error: 'that delivery would bankrupt the bot' });
    expect(listActions(broke)).not.toContainEqual(delivery);
  });

  test('picking up for a market contract claims it', () => {
    const world = makeWorld({
      board: { engineTypes: { '0': ['mogul', null] }, engines: { '0': ['New York', null] } },
      contracts: [{ id: 'm1', type: 'market', playerID: null, commodity: 'imports', destinationKey: 'Boston' }],
    });
    const action: Action = {
      type: 'runTrains',
      runs: [{ slot: 0, path: ['New York', 'Boston'], events: [{ at: 0, kind: 'pickup', commodity: 'imports', claim: 'm1' }, { at: 1, kind: 'deliver', contractId: 'm1' }] }],
    };
    const { world: next, effects } = apply(world, action);
    expect(moves(effects)).toEqual([
      { name: 'claimMarketContract', args: ['m1'] },
      { name: 'toggleContractFulfilled', args: ['m1'] },
    ]);
    expect(effects.some((e) => e.kind === 'requestOffers')).toBe(false);
    expect(next.contracts.find((c) => c.id === 'm1')).toMatchObject({ playerID: '0', fulfilled: true });
  });

  test('refuses moving off own track, too far, or delivering mid-path without a Timetable', () => {
    const world = deliverWorld();
    const run = (path: string[], events: never[] = []) => applyAction(world, { type: 'runTrains', runs: [{ slot: 0, path, events }] });
    expect(run(['Boston', 'Syracuse']).ok).toBe(false);
    expect(run(['Boston', 'New York', 'Philadelphia', 'New York']).ok).toBe(false);
  });

  test('a Roundhouse hands the commodity over and the second engine delivers', () => {
    const world = makeWorld({
      board: {
        engineTypes: { '0': ['john-bull', 'american'] },
        engines: { '0': ['Portland ME', 'New York'] },
        cargo: { '0': ['wood', null] },
        upgrades: { '0': ['roundhouse'] },
      },
      contracts: [{ id: 'k3', commodity: 'wood', destinationKey: 'Philadelphia' }],
    });
    const action = listActions(world).find((a) => a.type === 'runTrains' && a.roundhouse);
    expect(action).toBeDefined();
    const { world: next, effects } = apply(world, action!);
    expect(next.board.engines['0']).toEqual(['Boston', 'Philadelphia']);
    expect(next.board.cargo['0']).toEqual([null, null]);
    expect(next.contracts.find((c) => c.id === 'k3')!.fulfilled).toBe(true);
    expect(next.turnState.enginesRun.sort()).toEqual([0, 1]);
    expect(lines(effects)).toContain('Avery used the Roundhouse to hand wood to the dark engine in Boston.');
  });

  test('discard and redraw a private contract', () => {
    const world = makeWorld({ contracts: [{ id: 'k9', commodity: 'coal', destinationKey: 'Boston' }] });
    const { world: next, effects } = apply(world, { type: 'redrawPrivateContract', contractId: 'k9' });
    expect(moves(effects)).toEqual([{ name: 'deleteContract', args: ['k9'] }]);
    expect(effects.some((e) => e.kind === 'requestOffers')).toBe(true);
    expect(lines(effects)).toEqual(['Avery discarded the private contract for coal to Boston.']);
    expect(next.turnState.awaitingOffers).toBe(true);
  });
});
