/**
 * Money: contract payouts, debt service, borrowing and repaying (docs/Game rules.md, Fulfilling a
 * contract, Borrow money, Repay debt). Amounts are in dollars. Shared by the player app and the bots.
 */
import { moneyValue, type Contract } from '../Contract';
import type { RegionCode } from '../stores/gameStore';
import type { EngineTypeId } from './playerBoard';
import { cityRegion } from './regions';
import {
  BONUS_VALUE_ENGINES,
  BONUS_VALUE_MULTIPLIER,
  BORROW_OPTIONS_MAX,
  BORROW_STEP,
  CENTRAL_REGIONS,
  DEBT_FLOOR,
  DEBT_SERVICE_PER_STEP,
  REPAY_AMOUNTS,
  UPGRADED_STATIONS_BONUS,
  WESTERN_REGIONS,
} from './rulesData';

/** Debt service on $X of debt: $1,000 per $5,000 borrowed. */
export function serviceOn(debt: number): number {
  return Math.floor(debt / BORROW_STEP) * DEBT_SERVICE_PER_STEP;
}

/** What debt service depends on: the debt, and where the player has delivered so far. */
export interface DebtServiceState {
  debt: number;
  centralDebtServicePaid: boolean;
  westernDeliveryMade: boolean;
}

export interface DebtServiceResult {
  service: number;
  centralDebtServicePaid: boolean;
  westernDeliveryMade: boolean;
}

/**
 * Debt service due on a delivery to `destination`. None while only the Northeast and Southeast
 * have had deliveries; once on the first Central delivery; on every delivery from the first
 * Western one on.
 */
export function debtServiceForDelivery(state: DebtServiceState, destination: string): DebtServiceResult {
  const region = cityRegion(destination) as RegionCode | undefined;
  const western = state.westernDeliveryMade || (region !== undefined && WESTERN_REGIONS.includes(region));
  const central = region !== undefined && CENTRAL_REGIONS.includes(region);
  const firstCentral = central && !state.centralDebtServicePaid;
  const due = western || firstCentral;
  return {
    service: due ? serviceOn(state.debt) : 0,
    centralDebtServicePaid: state.centralDebtServicePaid || central,
    westernDeliveryMade: western,
  };
}

/** Gross payment for a contract: its value (x1 1/3 for a Mountain or Challenger) plus Upgraded Stations. */
export function deliveryPayment(
  contract: Pick<Contract, 'destinationKey' | 'commodity'>,
  engine: EngineTypeId | null,
  upgradedStations: boolean
): number {
  let value = moneyValue(contract);
  if (engine && BONUS_VALUE_ENGINES.includes(engine)) {
    value = Math.floor((value * BONUS_VALUE_MULTIPLIER) / 1000) * 1000;
  }
  return value + (upgradedStations ? UPGRADED_STATIONS_BONUS : 0);
}

/** Amounts a bot may borrow in one action (the rules set no limit; the list is capped). */
export function borrowOptions(): number[] {
  const options: number[] = [];
  for (let amount = BORROW_STEP; amount <= BORROW_OPTIONS_MAX; amount += BORROW_STEP) options.push(amount);
  return options;
}

/** Amounts a player may repay: $5,000 or $10,000, never leaving less than the debt floor, and only with the cash. */
export function repayOptions(state: { debt: number; cash: number }): number[] {
  return REPAY_AMOUNTS.filter((amount) => state.debt - amount >= DEBT_FLOOR && state.cash >= amount);
}

/** Why debt service is or isn't due on a delivery, for the receipt's explanation line. */
export type DebtServiceReason = 'none' | 'firstCentral' | 'western';

/** A delivery's money, line by line, for the delivery receipt and the fulfil move. */
export interface DeliveryBreakdown {
  /** The contract's own value. */
  value: number;
  /** Extra from a Mountain or Challenger (1 1/3x, rounded down to $1,000); 0 otherwise. */
  engineBonus: number;
  /** Upgraded Stations' $3,000; 0 without it. */
  stationsBonus: number;
  /** Debt service due on this delivery. */
  debtService: number;
  debtServiceReason: DebtServiceReason;
  /** value + bonuses - debt service; negative when service exceeds the payout. */
  net: number;
  /** Whether cash would stay at $0 or more. Deliveries that would bankrupt the player are blocked. */
  affordable: boolean;
  /** The player's debt-service progress after the delivery. */
  centralDebtServicePaid: boolean;
  westernDeliveryMade: boolean;
}

/**
 * Money for delivering `contract` with `engine` (null when the delivering engine doesn't matter
 * or isn't known: no engine bonus). Every line is separate so the receipt can show only the ones
 * that apply.
 */
export function deliveryBreakdown(
  player: DebtServiceState & { cash: number; upgrades: readonly string[] },
  contract: Pick<Contract, 'destinationKey' | 'commodity'>,
  engine: EngineTypeId | null
): DeliveryBreakdown {
  const value = moneyValue(contract);
  const engineBonus = deliveryPayment(contract, engine, false) - value;
  const stationsBonus = player.upgrades.includes('upgraded-stations') ? UPGRADED_STATIONS_BONUS : 0;
  const service = debtServiceForDelivery(player, contract.destinationKey);
  const debtServiceReason: DebtServiceReason =
    service.service === 0 ? 'none' : player.westernDeliveryMade || service.westernDeliveryMade ? 'western' : 'firstCentral';
  const net = value + engineBonus + stationsBonus - service.service;
  return {
    value,
    engineBonus,
    stationsBonus,
    debtService: service.service,
    debtServiceReason,
    net,
    affordable: player.cash + net >= 0,
    centralDebtServicePaid: service.centralDebtServicePaid,
    westernDeliveryMade: service.westernDeliveryMade,
  };
}

/** Whether a player's two engines would pay differently, so the receipt must ask which one delivered. */
export function deliveringEngineMatters(engines: readonly (EngineTypeId | null)[]): boolean {
  const owned = engines.filter((e): e is EngineTypeId => e !== null);
  return new Set(owned.map((e) => BONUS_VALUE_ENGINES.includes(e))).size > 1;
}

/** The engine whose bonus applies when the player didn't say which delivered: one only if they all pay alike. */
export function defaultDeliveringEngine(engines: readonly (EngineTypeId | null)[]): EngineTypeId | null {
  const owned = engines.filter((e): e is EngineTypeId => e !== null);
  return owned.length > 0 && !deliveringEngineMatters(engines) ? owned[0] : null;
}

/** Money-log labels for the moves that happen at most once a turn; the bot runner looks for them on resume. */
export const LEDGER_LABELS = {
  borrowed: 'Borrowed',
  repaid: 'Repaid debt',
  paidForTrack: 'Paid for track',
  debtService: 'Debt service',
} as const;

/**
 * What a delivery would pay with the lowest- and highest-paying of the player's engines. They
 * differ only when one engine is a Mountain or Challenger and the other isn't; with no engines,
 * both are the no-bonus payout.
 */
export function deliveryRange(
  player: DebtServiceState & { cash: number; upgrades: readonly string[]; engines: readonly (EngineTypeId | null)[] },
  contract: Pick<Contract, 'destinationKey' | 'commodity'>
): { low: DeliveryBreakdown; high: DeliveryBreakdown } {
  const owned = player.engines.filter((e): e is EngineTypeId => e !== null);
  const all = (owned.length > 0 ? owned : [null]).map((e) => deliveryBreakdown(player, contract, e));
  const byNet = [...all].sort((a, b) => a.net - b.net);
  return { low: byNet[0], high: byNet[byNet.length - 1] };
}
