/**
 * Static reference data for per-player tracking (docs/BOARD_APP_PHASE_2_PLAN.md): engine types,
 * the six tracked upgrades, and commodity groups as printed on the player board.
 * Values come from docs/Game rules.md. Only used for display; the board enforces no rules.
 */

export type EngineTypeId =
  | 'john-bull'
  | 'american'
  | 'mogul'
  | 'consolidation'
  | 'camelback'
  | 'prairie'
  | 'pacific'
  | 'mikado'
  | 'mountain'
  | 'challenger';

export interface EngineType {
  id: EngineTypeId;
  name: string;
  /** Segments per Run Trains action, before any Service Yard bonus */
  distance: number;
  /** Effects noted in the rules, or null */
  effects: string | null;
}

/** In upgrade order. */
export const ENGINE_TYPES: readonly EngineType[] = [
  { id: 'john-bull', name: '2-4-0 John Bull', distance: 1, effects: 'Must be traded in for the American' },
  { id: 'american', name: '4-4-0 American', distance: 2, effects: null },
  { id: 'mogul', name: '2-6-0 Mogul', distance: 3, effects: 'After buying, player can fulfill market contracts' },
  {
    id: 'consolidation',
    name: '2-8-0 Consolidation',
    distance: 3,
    effects: 'After buying, Service Yard is available to all players',
  },
  { id: 'camelback', name: '4-6-0 Camelback', distance: 4, effects: null },
  { id: 'prairie', name: '2-6-2 Prairie', distance: 5, effects: null },
  { id: 'pacific', name: '4-6-2 Pacific', distance: 7, effects: null },
  { id: 'mikado', name: '2-8-2 Mikado', distance: 8, effects: null },
  { id: 'mountain', name: '4-8-2 Mountain', distance: 9, effects: 'Earn 1 1/3x value when fulfilling a contract' },
  {
    id: 'challenger',
    name: '4-6-6-4 Challenger',
    distance: 11,
    effects: 'Gain 2 railroad ties at end of game and earn 1 1/3x value when fulfilling a contract',
  },
];

/** Every player starts with a John Bull on the light token and nothing on the dark one. */
export const DEFAULT_ENGINE_TYPES: readonly [EngineTypeId | null, EngineTypeId | null] = ['john-bull', null];

export type UpgradeId =
  | 'service-yard'
  | 'upgraded-stations'
  | 'roundhouse'
  | 'employment-office'
  | 'timetable'
  | 'commodities-exchange';

export interface Upgrade {
  id: UpgradeId;
  name: string;
  /** Purchase price in US dollars */
  price: number;
  effect: string;
}

/** In player-board order. */
export const UPGRADES: readonly Upgrade[] = [
  {
    id: 'service-yard',
    name: 'Service Yard',
    price: 10000,
    effect: 'Your 2-8-0 Consolidation and better engines can move one space farther when taking the Run Trains action.',
  },
  {
    id: 'upgraded-stations',
    name: 'Upgraded Stations',
    price: 10000,
    effect: 'Receive an additional $3,000 for each delivery.',
  },
  {
    id: 'roundhouse',
    name: 'Roundhouse',
    price: 10000,
    effect: 'Combine the movement of two engines, transferring a commodity from the first to the second.',
  },
  {
    id: 'employment-office',
    name: 'Employment Office',
    price: 10000,
    effect: 'Build three segments of track instead of two with the Build Track action.',
  },
  {
    id: 'timetable',
    name: 'Timetable',
    price: 15000,
    effect: 'After fulfilling a contract, your train can continue moving up to its maximum number of segments.',
  },
  {
    id: 'commodities-exchange',
    name: 'Commodities Exchange',
    price: 20000,
    effect: 'If your railway network connects to all the cities providing a commodity that can be monopolized, gain the benefits of a monopoly in it.',
  },
];

export interface CommodityGroup {
  name: string;
  /** Keys of `commodities` in src/data/commodities.ts */
  commodities: readonly string[];
}

/** The player board's commodity groups, for the cargo picker. */
export const COMMODITY_GROUPS: readonly CommodityGroup[] = [
  { name: 'Metals', commodities: ['aluminum', 'copper', 'lead', 'nickel', 'precious metals'] },
  { name: 'Mined goods', commodities: ['bauxite', 'coal', 'iron ore', 'oil'] },
  { name: 'Livestock', commodities: ['cattle', 'fish', 'pork', 'sheep'] },
  { name: 'Crops', commodities: ['cotton', 'fruit', 'grain', 'rice', 'tobacco', 'wood'] },
  { name: 'Finished goods', commodities: ['imports', 'machinery', 'steel', 'textiles', 'tourists', 'wine'] },
];

const ENGINE_INDEX = new Map(ENGINE_TYPES.map((engine, index) => [engine.id, index]));
const UPGRADE_IDS = new Set<string>(UPGRADES.map((upgrade) => upgrade.id));
/** The Service Yard helps this engine and every later one. */
const SERVICE_YARD_FIRST_ENGINE = ENGINE_INDEX.get('consolidation')!;

export function isEngineTypeId(value: unknown): value is EngineTypeId {
  return ENGINE_INDEX.has(value as EngineTypeId);
}

export function isUpgradeId(value: unknown): value is UpgradeId {
  return UPGRADE_IDS.has(value as string);
}

export function getEngineType(typeId: EngineTypeId): EngineType {
  return ENGINE_TYPES[ENGINE_INDEX.get(typeId)!];
}

/** "1 segment", "3 segments" */
export function formatSegments(count: number): string {
  return `${count} segment${count === 1 ? '' : 's'}`;
}

export interface EngineDistance {
  base: number;
  bonus: number;
  total: number;
}

/** An engine's distance, including the +1 from a Service Yard where it applies. */
export function engineDistance(typeId: EngineTypeId, hasServiceYard: boolean): EngineDistance {
  const index = ENGINE_INDEX.get(typeId)!;
  const base = ENGINE_TYPES[index].distance;
  const bonus = hasServiceYard && index >= SERVICE_YARD_FIRST_ENGINE ? 1 : 0;
  return { base, bonus, total: base + bonus };
}
