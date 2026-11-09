import { commodities } from '../data/commodities';
import { commodityIcons } from '../shared/assets/icons';
import {
  COMMODITY_GROUPS,
  DEFAULT_ENGINE_TYPES,
  ENGINE_TYPES,
  UPGRADES,
  engineDistance,
  formatSegments,
  getEngineType,
  isEngineTypeId,
  isUpgradeId,
} from './playerBoardData';

describe('commodity groups', () => {
  const grouped = COMMODITY_GROUPS.flatMap((group) => [...group.commodities]);

  it('cover exactly the commodities in the game, once each', () => {
    expect([...grouped].sort()).toEqual([...commodities.keys()].sort());
  });

  it('all have an icon', () => {
    const icons = commodityIcons as Record<string, string>;
    expect(grouped.filter((commodity) => !icons[commodity])).toEqual([]);
  });
});

describe('engine types', () => {
  it('lists the ten engines in upgrade order, starting from the default', () => {
    expect(ENGINE_TYPES).toHaveLength(10);
    expect(new Set(ENGINE_TYPES.map((engine) => engine.id)).size).toBe(10);
    expect(ENGINE_TYPES[0].id).toBe(DEFAULT_ENGINE_TYPES[0]);
    expect(ENGINE_TYPES[9].id).toBe('challenger');
  });

  it('looks up an engine by id and formats its distance', () => {
    expect(getEngineType('mikado').name).toBe('2-8-2 Mikado');
    expect(formatSegments(1)).toBe('1 segment');
    expect(formatSegments(3)).toBe('3 segments');
  });

  it('recognizes only known ids', () => {
    expect(isEngineTypeId('mogul')).toBe(true);
    expect(isEngineTypeId('hogwarts-express')).toBe(false);
    expect(isEngineTypeId(3)).toBe(false);
  });
});

describe('upgrades', () => {
  it('lists the six tracked upgrades with their prices', () => {
    expect(UPGRADES.map((upgrade) => [upgrade.id, upgrade.price])).toEqual([
      ['service-yard', 10000],
      ['upgraded-stations', 10000],
      ['roundhouse', 10000],
      ['employment-office', 10000],
      ['timetable', 15000],
      ['commodities-exchange', 20000],
    ]);
  });

  it('recognizes only known ids', () => {
    expect(isUpgradeId('timetable')).toBe(true);
    expect(isUpgradeId('hub')).toBe(false);
    expect(isUpgradeId(null)).toBe(false);
  });
});

describe('engineDistance', () => {
  it('is the printed distance without a Service Yard', () => {
    expect(engineDistance('consolidation', false)).toEqual({ base: 3, bonus: 0, total: 3 });
  });

  it('adds no bonus below the Consolidation', () => {
    expect(engineDistance('mogul', true)).toEqual({ base: 3, bonus: 0, total: 3 });
  });

  it('adds 1 at and above the Consolidation', () => {
    expect(engineDistance('consolidation', true)).toEqual({ base: 3, bonus: 1, total: 4 });
    expect(engineDistance('challenger', true)).toEqual({ base: 11, bonus: 1, total: 12 });
  });
});
