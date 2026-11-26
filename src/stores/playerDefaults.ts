/**
 * Start values for a player, and normalization of players loaded from saves made before the
 * player board moved into the app (docs/PLAYER_APP_REDESIGN_PLAN.md, Data model). Pure: no store.
 */
import { DEFAULT_ENGINE_TYPES, isEngineTypeId, isPlayerUpgradeId } from '../rules/playerBoard';
import { BORROW_STEP, STARTING_CASH } from '../rules/rulesData';
import { commodities } from '../data/commodities';
import type { PlayerBoardFields, PlayerProps, RegionCode } from './gameStore';

const REGION_CODES: readonly RegionCode[] = ['NW', 'NC', 'NE', 'SW', 'SC', 'SE'];

/** A player's board at the start of the game: $10,000, no debt, a John Bull, nothing else. */
export function startingPlayerBoard(): PlayerBoardFields {
  return {
    cash: STARTING_CASH,
    debt: 0,
    engines: [DEFAULT_ENGINE_TYPES[0], DEFAULT_ENGINE_TYPES[1]],
    cargo: [null, null],
    upgrades: [],
    exchangeCommodity: null,
    centralDebtServicePaid: false,
    westernDeliveryMade: false,
    railroadsAcquired: 0,
  };
}

/** A new player with no cities yet. */
export function newPlayerProps(name: string, avatarColor?: string): PlayerProps {
  return {
    name,
    activeCities: [],
    hubCity: null,
    regionalOffice: null,
    ...(avatarColor !== undefined && { avatarColor }),
    ...startingPlayerBoard(),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The game's smallest unit of money. */
const MONEY_UNIT = 1000;

/** A nonnegative multiple of `step` dollars, or the fallback. */
const dollars = (value: unknown, step: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value % step === 0 ? value : fallback;

const commodityOrNull = (value: unknown): string | null =>
  typeof value === 'string' && commodities.has(value) ? value : null;

// A function declaration, not a generic arrow: the build parses .ts files as JSX too.
function pairOf<T>(value: unknown, item: (v: unknown) => T, fallback: [T, T]): [T, T] {
  return Array.isArray(value) && value.length === 2 ? [item(value[0]), item(value[1])] : fallback;
}

/**
 * A player as saved, with any missing or invalid field set to its start value. Players saved
 * before money and engines were tracked load with $10,000, no debt, a John Bull and no upgrades;
 * the playtest edit dialog can correct them.
 */
export function normalizePlayerProps(raw: unknown): PlayerProps {
  const p = isRecord(raw) ? raw : {};
  const start = startingPlayerBoard();
  const upgrades = Array.isArray(p.upgrades) ? [...new Set(p.upgrades.filter(isPlayerUpgradeId))] : start.upgrades;
  return {
    // Keep any field this module doesn't know about rather than silently dropping it on load.
    ...(p as Partial<PlayerProps>),
    name: typeof p.name === 'string' ? p.name : '',
    activeCities: Array.isArray(p.activeCities) ? p.activeCities.filter((c): c is string => typeof c === 'string') : [],
    hubCity: typeof p.hubCity === 'string' ? p.hubCity : null,
    regionalOffice: REGION_CODES.includes(p.regionalOffice as RegionCode) ? (p.regionalOffice as RegionCode) : null,
    ...(typeof p.avatarColor === 'string' && { avatarColor: p.avatarColor }),
    cash: dollars(p.cash, MONEY_UNIT, start.cash),
    // Debt comes only in borrowing steps; anything else would understate debt service.
    debt: dollars(p.debt, BORROW_STEP, start.debt),
    engines: pairOf(p.engines, (v) => (isEngineTypeId(v) ? v : null), start.engines),
    cargo: pairOf(p.cargo, commodityOrNull, start.cargo),
    upgrades,
    exchangeCommodity: commodityOrNull(p.exchangeCommodity),
    centralDebtServicePaid: p.centralDebtServicePaid === true,
    westernDeliveryMade: p.westernDeliveryMade === true,
    railroadsAcquired:
      typeof p.railroadsAcquired === 'number' && Number.isInteger(p.railroadsAcquired) && p.railroadsAcquired >= 0
        ? p.railroadsAcquired
        : start.railroadsAcquired,
  };
}

/** `G.players` as saved, each player normalized; entries that aren't [id, props] pairs are dropped. */
export function normalizePlayers(raw: unknown): [string, PlayerProps][] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is [unknown, unknown] => Array.isArray(entry) && entry.length === 2)
    .map(([id, props]) => [String(id), normalizePlayerProps(props)]);
}
