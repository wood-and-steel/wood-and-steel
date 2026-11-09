import { describe, expect, test } from 'vitest';
import { checkPath, engineReach, roundhouseOptions, runOptions, suppliedAt } from './movement';
import { makeWorld } from './world.testHelper';

const ends = (runs: ReturnType<typeof runOptions>) =>
  runs.filter((r) => r.events.length === 0).map((r) => r.path[r.path.length - 1]).sort();

describe('engine reach', () => {
  test('engine distance, +1 with a Service Yard from the Consolidation on', () => {
    expect(engineReach(makeWorld(), 0)).toBe(1);
    expect(engineReach(makeWorld({ board: { engineTypes: { '0': ['mogul', null] }, upgrades: { '0': ['service-yard'] } } }), 0)).toBe(3);
    expect(engineReach(makeWorld({ board: { engineTypes: { '0': ['consolidation', null] }, upgrades: { '0': ['service-yard'] } } }), 0)).toBe(4);
  });
});

describe('runOptions', () => {
  test('plain moves reach own-track cities within the engine’s distance', () => {
    expect(ends(runOptions(makeWorld(), 0))).toEqual(['New York', 'Portland ME']);
    const american = makeWorld({ board: { engineTypes: { '0': ['american', null] } } });
    expect(ends(runOptions(american, 0))).toEqual(['New York', 'Philadelphia', 'Portland ME']);
  });

  test('never on track the bot doesn’t own', () => {
    const world = makeWorld({ board: { engineTypes: { '0': ['mikado', null] } } });
    expect(ends(runOptions(world, 0))).not.toContain('Syracuse');
  });

  test('picks up a wanted commodity and delivers it, ending the move', () => {
    const world = makeWorld({
      board: { engineTypes: { '0': ['american', null] } },
      contracts: [{ id: 'k1', commodity: 'machinery', destinationKey: 'Philadelphia' }],
    });
    const delivery = runOptions(world, 0).find((r) => r.events.some((e) => e.kind === 'deliver'));
    expect(delivery).toEqual({
      slot: 0,
      path: ['Boston', 'New York', 'Philadelphia'],
      events: [
        { at: 0, kind: 'pickup', commodity: 'machinery' },
        { at: 2, kind: 'deliver', contractId: 'k1' },
      ],
    });
  });

  test('a loaded engine stops at the delivery city without a Timetable', () => {
    const base = {
      board: { engineTypes: { '0': ['camelback', null] as ['camelback', null] }, engines: { '0': ['Portland ME', null] as [string, null] }, cargo: { '0': ['wood', null] as [string, null] } },
      contracts: [{ id: 'k2', commodity: 'wood', destinationKey: 'Boston' }],
    };
    const deliveries = runOptions(makeWorld(base), 0).filter((r) => r.events.length > 0);
    // Every longer path is cut at Boston, so they collapse into one run.
    expect(deliveries.map((r) => r.path[r.path.length - 1])).toEqual(['Boston']);
    const timetable = makeWorld({ ...base, board: { ...base.board, upgrades: { '0': ['timetable'] } } });
    const onward = runOptions(timetable, 0).filter((r) => r.events.length > 0).map((r) => r.path[r.path.length - 1]);
    expect(onward).toContain('Philadelphia');
  });

  test('market contracts can be claimed on pickup only with a Mogul or better', () => {
    const contracts = [{ id: 'm1', type: 'market' as const, playerID: null, commodity: 'imports', destinationKey: 'Boston' }];
    const claims = (engine: 'american' | 'mogul') =>
      runOptions(makeWorld({ contracts, board: { engineTypes: { '0': [engine, null] } } }), 0).filter((r) =>
        r.events.some((e) => e.kind === 'pickup' && e.claim === 'm1')
      );
    expect(claims('american')).toEqual([]);
    expect(claims('mogul').length).toBeGreaterThan(0);
  });

  test('an engine that already ran this turn has no options', () => {
    expect(runOptions(makeWorld({ turnState: { enginesRun: [0] } }), 0)).toEqual([]);
  });
});

describe('Railyard supply', () => {
  test('its city supplies everything within two segments', () => {
    const world = makeWorld({ board: { railyards: { '0': 'Philadelphia' } } });
    expect(suppliedAt(world, 'Philadelphia').has('machinery')).toBe(true); // Boston, two away
    expect(suppliedAt(world, 'Philadelphia').has('aluminum')).toBe(false); // Portland ME, three away
    expect(suppliedAt(world, 'Boston').has('imports')).toBe(false);
  });
});

describe('Roundhouse', () => {
  test('the empty engine meets the loaded one and delivers', () => {
    const world = makeWorld({
      board: {
        engineTypes: { '0': ['john-bull', 'american'] },
        engines: { '0': ['Portland ME', 'New York'] },
        cargo: { '0': ['wood', null] },
        upgrades: { '0': ['roundhouse'] },
      },
      contracts: [{ id: 'k3', commodity: 'wood', destinationKey: 'Philadelphia' }],
    });
    expect(roundhouseOptions(world)).toEqual([
      {
        runs: [
          { slot: 0, path: ['Portland ME', 'Boston'], events: [] },
          { slot: 1, path: ['Boston', 'New York', 'Philadelphia'], events: [{ at: 2, kind: 'deliver', contractId: 'k3' }] },
        ],
        roundhouse: { approach: ['New York', 'Boston'] },
      },
    ]);
  });

  test('none without a Roundhouse', () => {
    const world = makeWorld({
      board: { engineTypes: { '0': ['john-bull', 'american'] }, engines: { '0': ['Portland ME', 'New York'] }, cargo: { '0': ['wood', null] } },
      contracts: [{ commodity: 'wood', destinationKey: 'Philadelphia' }],
    });
    expect(roundhouseOptions(world)).toEqual([]);
  });
});

describe('checkPath', () => {
  test('requires the bot’s own track between consecutive cities', () => {
    const world = makeWorld();
    expect(checkPath(world, ['Boston', 'New York'])).toBeNull();
    expect(checkPath(world, ['Boston', 'Syracuse'])).toMatch(/no track/);
  });
});
