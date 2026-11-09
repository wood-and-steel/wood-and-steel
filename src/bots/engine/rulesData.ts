/**
 * Rules numbers the bot engine needs that the app and board don't hold, from docs/Game rules.md.
 * The rules fingerprint test (src/bots/rules/) fails when the rules change, so review these then.
 *
 * Terms: a "segment" in the rules is one route between two cities (moving, building, Hub and
 * Railyard ranges all count routes). A route's `length` (1–5) only sets its building cost.
 *
 * Where the rules are unclear, the default chosen here is marked DEFAULT and listed in
 * docs/BOT_AGENT_GUIDE.md (Rules defaults).
 */
import type { RegionCode } from '../../stores/gameStore';
import type { EngineTypeId, UpgradeId } from '../../board/playerBoardData';

// --- Turn -------------------------------------------------------------------

/** "On a player's turn, they may do one or two actions." */
export const ACTIONS_PER_TURN = 2;

// --- Build track --------------------------------------------------------------

/** Routes per Build Track action, and with an Employment Office. */
export const BUILD_LIMIT = 2;
export const BUILD_LIMIT_EMPLOYMENT_OFFICE = 3;

/** Base cost by route length: $2,000 for length 1, +$1,000 per extra length. */
export function baseTrackCost(length: number): number {
  return (length + 1) * 1000;
}
/** A parallel track (the route already has another owner) costs $1,000 more; mountainous doubles the total. */
export const PARALLEL_SURCHARGE = 1000;
export const MOUNTAIN_MULTIPLIER = 2;
/**
 * Hub: "Building track costs $1,000 less per segment within two links of a hub."
 * DEFAULT: a route qualifies when one of its cities is the Hub or next to it (so the whole
 * route lies within two links). The discount applies after doubling, and never below $1,000.
 */
export const HUB_DISCOUNT = 1000;
export const HUB_DISCOUNT_RANGE = 1;
export const MIN_TRACK_COST = 1000;
/** DEFAULT: new track must touch a city already in the builder's network (or built earlier in the same action). */
export const BUILD_MUST_CONNECT = true;

// --- Engines -----------------------------------------------------------------

export const ENGINE_PRICES: Record<EngineTypeId, number> = {
  'john-bull': 0,
  american: 5000,
  mogul: 7000,
  consolidation: 10000,
  camelback: 13000,
  prairie: 16000,
  pacific: 20000,
  mikado: 24000,
  mountain: 28000,
  challenger: 32000,
};
export const MAX_ENGINES = 2;
/** With a Hub, a player may order one engine ahead (two levels up) for $5,000 more. */
export const HUB_ENGINE_SKIP_SURCHARGE = 5000;
/** Trade-in: half the price, rounded down to $1,000; the John Bull is worth $0. */
export function tradeInValue(engine: EngineTypeId): number {
  return Math.floor(ENGINE_PRICES[engine] / 2 / 1000) * 1000;
}
/** DEFAULT: a John Bull is always the engine traded in by the next purchase ("must be traded in for the American"). */
export const JOHN_BULL_MUST_TRADE_IN = true;
/** Market contracts can be claimed only by owners of a Mogul or better. */
export const MARKET_CONTRACT_MIN_ENGINE: EngineTypeId = 'mogul';
/** Service Yard is available to everyone once any player owns a Consolidation (DEFAULT: or better). */
export const SERVICE_YARD_UNLOCK_ENGINE: EngineTypeId = 'consolidation';
/** Mountain and Challenger earn 1 1/3x a contract's value (DEFAULT: rounded down to $1,000, before Upgraded Stations). */
export const BONUS_VALUE_ENGINES: readonly EngineTypeId[] = ['mountain', 'challenger'];
export const BONUS_VALUE_MULTIPLIER = 4 / 3;
/** The Challenger gains 2 railroad ties at the end of the game. */
export const CHALLENGER_END_TIES = 2;

// --- Money -------------------------------------------------------------------

export const BORROW_STEP = 5000;
/** listActions offers borrowing up to this much in one action (the rules set no limit). */
export const BORROW_OPTIONS_MAX = 30000;
export const REPAY_AMOUNTS: readonly number[] = [5000, 10000];
/**
 * "Debt cannot be reduced below $15,000." Taken literally: a repayment may not leave less than
 * $15,000 of debt, so debt of $15,000 or less can't be repaid. Flagged in the guide as a rules question.
 */
export const DEBT_FLOOR = 15000;
/** Debt service: $1,000 per $5,000 borrowed. */
export const DEBT_SERVICE_PER_STEP = 1000;
export const UPGRADED_STATIONS_BONUS = 3000;

export const CENTRAL_REGIONS: readonly RegionCode[] = ['NC', 'SC'];
export const WESTERN_REGIONS: readonly RegionCode[] = ['NW', 'SW'];

// --- Independent railroads ----------------------------------------------------

/** Per route, until any player fulfills a contract in a Western region; then $4,000. */
export const INDIE_PRICE_PER_ROUTE = 3000;
export const INDIE_PRICE_PER_ROUTE_AFTER_WEST = 4000;
/** DEFAULT: a railroad can be acquired only if it touches a city in the acquirer's network. */
export const INDIE_MUST_CONNECT = true;

// --- Upgrades ----------------------------------------------------------------

/** Upgrades the board tracks with a checkbox, plus the three placed or claimed ones. */
export type UpgradeKey = UpgradeId | 'hub' | 'railyard' | 'regional-office';

export const UPGRADE_PRICES: Record<UpgradeKey, number> = {
  'service-yard': 10000,
  'upgraded-stations': 10000,
  hub: 15000,
  timetable: 15000,
  roundhouse: 10000,
  'employment-office': 10000,
  railyard: 10000,
  'regional-office': 20000,
  'commodities-exchange': 20000,
};
/** Roundhouse: the second engine moves at most 4 segments to meet the first. */
export const ROUNDHOUSE_APPROACH = 4;
/** Railyard: its city supplies every commodity available within two segments. */
export const RAILYARD_RANGE = 2;
/** Regional Office: connections to at least 5 cities in a region where no one else has connections. */
export const REGIONAL_OFFICE_MIN_CITIES = 5;
export const REGIONAL_OFFICE_END_TIES = 2;

// --- Scoring -----------------------------------------------------------------

/** The game ends when a player has 30 railroad ties from contract fulfillment. */
export const GAME_END_TIES = 30;
/** Breadth bonus per distinct commodity delivered: the first 8 are worth 1 tie, the next 4 are worth 2, the rest 3. */
export function breadthBonus(distinctCommodities: number): number {
  const n = Math.max(0, distinctCommodities);
  return Math.min(n, 8) + 2 * Math.min(Math.max(n - 8, 0), 4) + 3 * Math.max(n - 12, 0);
}
/**
 * Depth bonus: "for the number of times beyond the first delivery a railroad delivers a particular
 * commodity ... one plus the number of times you have delivered your most delivered commodity."
 * DEFAULT: deliveries of the most-delivered commodity beyond the first (0 until a repeat).
 */
export function depthBonus(mostDeliveredCount: number): number {
  return Math.max(0, mostDeliveredCount - 1);
}
/** Monopoly ties by how many cities supply the commodity (4, 5, or 6); other commodities can't be monopolized. */
export const MONOPOLY_TIES: Record<number, number> = { 4: 2, 5: 3, 6: 4 };
