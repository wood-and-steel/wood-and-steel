import { describe, expect, test } from 'vitest';
import type { Action } from '../engine/actions';
import { makeWorld } from '../engine/world.testHelper';
import { createRng } from '../rng';
import { createBotRecord } from '../state/botStates';
import { investments, worthwhile } from './invest';
import { chooseWithinBand, params, paramsFromWeights } from './params';
import { cheapestPath, planDelivery, rankPlans } from './plans';
import { EMERGENCY_DEBT, advance, heuristicPolicy } from './policy';
import { affinity, type StrategyId } from './strategies';
import { defaultWeights } from './weights';

const decide = (world: ReturnType<typeof makeWorld>, seed = 1) => heuristicPolicy(world, createRng(seed));
const lowVariability = (strategy: StrategyId = 'builder') => ({ ...defaultWeights(strategy), variability: 0 });

describe('params', () => {
  test('more debt tolerance, more debt; more variability, a wider band', () => {
    const base = defaultWeights('builder');
    expect(paramsFromWeights({ ...base, debtTolerance: 1 }).maxDebt).toBeGreaterThan(paramsFromWeights({ ...base, debtTolerance: 0 }).maxDebt);
    expect(paramsFromWeights({ ...base, debtTolerance: 0 }).maxDebt).toBe(10000);
    expect(paramsFromWeights({ ...base, variability: 1 }).band).toBeGreaterThan(paramsFromWeights({ ...base, variability: 0 }).band);
  });

  test('reach favors western destinations', () => {
    const far = paramsFromWeights({ ...defaultWeights('speculator'), reach: 1 });
    const near = paramsFromWeights({ ...defaultWeights('builder'), reach: 0 });
    expect(far.regionFactor('Denver')).toBeGreaterThan(far.regionFactor('Boston'));
    expect(near.regionFactor('Boston')).toBeGreaterThan(near.regionFactor('Denver'));
  });

  test('the endgame shortens the horizon and raises the value of ties', () => {
    const w = defaultWeights('consolidator');
    expect(paramsFromWeights(w, true).horizon).toBeLessThanOrEqual(4);
    expect(paramsFromWeights(w, true).tieDollars).toBeGreaterThan(paramsFromWeights(w).tieDollars);
  });

  test('chooseWithinBand picks only near the best, reproducibly', () => {
    const options = [{ id: 'a', score: 100 }, { id: 'b', score: 95 }, { id: 'c', score: 50 }];
    const picks = new Set(Array.from({ length: 50 }, (_, i) => chooseWithinBand(options, 0.1, createRng(i).next)!.id));
    expect([...picks].sort()).toEqual(['a', 'b']);
    expect(chooseWithinBand(options, 0, () => 0.99)!.id).toBe('a');
  });
});

describe('plans', () => {
  test('own track is free, other routes cost their build price, independent routes are off limits', () => {
    const world = makeWorld({ independentRailroads: { Erie: { name: 'Erie', routes: [{ key: 'Boston-Syracuse', addedInRound: 0 }] } } });
    const path = cheapestPath(world, ['Portland ME'], ['Philadelphia'])!;
    expect(path).toMatchObject({ cities: ['Portland ME', 'Boston', 'New York', 'Philadelphia'], toBuild: [], buildCost: 0 });
    const toSyracuse = cheapestPath(world, ['Boston'], ['Syracuse'])!;
    expect(toSyracuse.routes).not.toContain('Boston-Syracuse');
    expect(toSyracuse.toBuild.length).toBeGreaterThan(0);
  });

  test('a plan picks a supplier and counts the track it needs', () => {
    const world = makeWorld({ contracts: [{ id: 'k1', commodity: 'coal', destinationKey: 'Boston' }] });
    const plan = rankPlans(world, params(world))[0];
    expect(plan).toMatchObject({ contractId: 'k1', commodity: 'coal', destination: 'Boston', affordable: true });
    expect(['Pittsburgh', 'Cincinnati', 'Chicago', 'Atlanta']).toContain(plan.pickup);
    expect(plan.path.toBuild.length).toBeGreaterThan(0);
  });

  test('track beyond cash and borrowing room makes a plan unaffordable and slower', () => {
    const rich = makeWorld({ bot: { cash: 100000 } });
    const poor = makeWorld({ bot: { cash: 0, debt: 60000 } });
    const target = { contractId: 'x', commodity: 'grain', destination: 'Boston' };
    const a = planDelivery(rich, params(rich), target)!;
    const b = planDelivery(poor, params(poor), target)!;
    expect(a.affordable).toBe(true);
    expect(b.affordable).toBe(false);
    expect(b.turns).toBeGreaterThan(a.turns);
  });
});

describe('heuristic policy', () => {
  test('setup: chooses an available starting pair', () => {
    const world = makeWorld({ phase: 'setup', players: { '0': { activeCities: [] }, '1': { activeCities: ['Norfolk', 'Raleigh'] } } });
    const { action } = decide(world);
    expect(action.type).toBe('chooseStartingCities');
    expect((action as Extract<Action, { type: 'chooseStartingCities' }>).pair).not.toEqual(['Norfolk', 'Raleigh']);
  });

  test('chooses the offer it can deliver soonest over one far away', () => {
    const world = makeWorld({
      bot: { weights: lowVariability() },
      board: { engineTypes: { '0': ['american', null] } },
      turnState: {
        awaitingOffers: true,
        offers: [
          { commodity: 'fruit', destinationKey: 'Portland ME' },
          { commodity: 'machinery', destinationKey: 'Philadelphia' },
        ],
      },
    });
    expect(decide(world).action).toEqual({ type: 'choosePrivateContract', offer: { commodity: 'machinery', destinationKey: 'Philadelphia' } });
  });

  test('places its starting engine', () => {
    const world = makeWorld({ board: { engines: { '0': [null, null] } }, contracts: [{ commodity: 'machinery', destinationKey: 'Philadelphia' }] });
    expect(decide(world).action.type).toBe('placeEngine');
  });

  test('picks up for free when sitting at a supplier of its planned commodity', () => {
    const world = makeWorld({ contracts: [{ id: 'k1', commodity: 'machinery', destinationKey: 'Philadelphia' }] });
    const decision = decide(world);
    expect(decision.action).toEqual({ type: 'pickUp', slot: 0, commodity: 'machinery' });
    expect(decision.plan).toMatchObject({ contractId: 'k1', commodity: 'machinery' });
  });

  test('delivers whenever it can', () => {
    const world = makeWorld({
      board: { engineTypes: { '0': ['american', null] }, cargo: { '0': ['machinery', null] } },
      contracts: [{ id: 'k1', commodity: 'machinery', destinationKey: 'Philadelphia' }],
    });
    const { action } = decide(world);
    expect(action.type).toBe('runTrains');
    expect((action as Extract<Action, { type: 'runTrains' }>).runs[0].events).toContainEqual({ at: 2, kind: 'deliver', contractId: 'k1' });
  });

  test('builds the track its plan lacks, in order from its network', () => {
    const world = makeWorld({ contracts: [{ id: 'k1', commodity: 'coal', destinationKey: 'Syracuse' }], board: { cargo: { '0': ['coal', null] } } });
    const p = params(world);
    const plan = rankPlans(world, p)[0];
    const step = advance(world, p, plan)!;
    expect(step.action.type).toBe('buildTrack');
    expect((step.action as Extract<Action, { type: 'buildTrack' }>).routes[0]).toBe(plan.path.toBuild[0]);
  });

  test('borrows past its limit only to deliver cargo already aboard', () => {
    const base = {
      contracts: [{ id: 'k1', commodity: 'coal', destinationKey: 'Syracuse' }],
      bot: { cash: 0, weights: { ...defaultWeights('builder'), debtTolerance: 0 } },
    };
    const aboard = makeWorld({ ...base, board: { cargo: { '0': ['coal', null] } }, bot: { ...base.bot, debt: 10000 } });
    const p = params(aboard);
    const step = advance(aboard, p, rankPlans(aboard, p)[0])!;
    expect(step.action.type).toBe('borrow');
    expect(aboard.bot.debt + (step.action as Extract<Action, { type: 'borrow' }>).amount).toBeLessThanOrEqual(p.maxDebt + EMERGENCY_DEBT);
  });

  test('redraws a hopeless private contract, but never one whose commodity is aboard', () => {
    const contracts = [{ id: 'k1', commodity: 'fruit', destinationKey: 'Portland ME' }];
    const broke = { cash: 0, debt: 60000, weights: lowVariability() };
    expect(decide(makeWorld({ contracts, bot: broke })).action).toEqual({ type: 'redrawPrivateContract', contractId: 'k1' });
    const aboard = makeWorld({ contracts, bot: broke, board: { cargo: { '0': ['fruit', null] } } });
    expect(decide(aboard).action.type).not.toBe('redrawPrivateContract');
  });

  test('ends the turn with no actions left', () => {
    const world = makeWorld({ turnState: { actions: ['borrow', 'buildTrack'] }, board: { engines: { '0': ['Portland ME', null] } } });
    expect(decide(world).action).toEqual({ type: 'endTurn' });
  });

  test('every decision is legal and reproducible', () => {
    const world = makeWorld({ contracts: [{ commodity: 'coal', destinationKey: 'Boston' }, { type: 'market', playerID: null, commodity: 'imports', destinationKey: 'Boston' }] });
    for (let seed = 0; seed < 20; seed++) {
      const a = decide(world, seed);
      expect(decide(world, seed)).toEqual(a);
    }
  });
});

describe('signature purchases', () => {
  test('affinities favor each strategy’s signature purchases', () => {
    expect(affinity('express', 'engines')).toBeGreaterThan(affinity('builder', 'engines'));
    expect(affinity('regionalist', 'regionalOffice')).toBeGreaterThan(1);
    expect(affinity('consolidator', 'railroads')).toBeGreaterThan(1);
    expect(affinity('builder', 'hub')).toBe(1);
  });

  test('an Express bot values a faster engine more than a Builder does', () => {
    const value = (strategy: StrategyId) => {
      const world = makeWorld({
        bot: { ...createBotRecord({ name: 'Avery', strategy }, 1), weights: defaultWeights(strategy), cash: 30000 },
        board: { engineTypes: { '0': ['american', null] } },
        contracts: [{ commodity: 'machinery', destinationKey: 'Philadelphia' }],
      });
      const p = params(world);
      return investments(world, p, rankPlans(world, p)[0]).find((i) => i.label === 'engine mogul')!.value;
    };
    expect(value('express')).toBeGreaterThan(value('builder'));
  });

  test('a purchase must pay back within the bot’s patience, longer with idle cash', () => {
    const p = paramsFromWeights({ ...defaultWeights('merchant'), paybackPatience: 0 });
    const slow = { action: { type: 'endTurn' } as Action, cost: 10000, value: 12000, payback: 4, label: 'slow' };
    expect(worthwhile([slow], p, 0)).toEqual([]);
    expect(worthwhile([slow], p, 40000)).toEqual([slow]);
  });
});
