/**
 * Money: contract payouts, debt service, borrowing and repaying (docs/Game rules.md, Fulfilling a
 * contract, Borrow money, Repay debt). Amounts are in dollars.
 */
import { moneyValue, type Contract } from '../../Contract';
import type { EngineTypeId } from '../../board/playerBoardData';
import type { RegionCode } from '../../stores/gameStore';
import type { BotRecord } from '../state/botStates';
import { cityRegion } from './network';
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
export function debtServiceForDelivery(
  record: Pick<BotRecord, 'debt' | 'centralDebtServicePaid' | 'westernDeliveryMade'>,
  destination: string
): DebtServiceResult {
  const region = cityRegion(destination) as RegionCode | undefined;
  const western = record.westernDeliveryMade || (region !== undefined && WESTERN_REGIONS.includes(region));
  const central = region !== undefined && CENTRAL_REGIONS.includes(region);
  const firstCentral = central && !record.centralDebtServicePaid;
  const due = western || firstCentral;
  return {
    service: due ? serviceOn(record.debt) : 0,
    centralDebtServicePaid: record.centralDebtServicePaid || central,
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

/** Amounts the bot may borrow in one action (the rules set no limit; the list is capped). */
export function borrowOptions(): number[] {
  const options: number[] = [];
  for (let amount = BORROW_STEP; amount <= BORROW_OPTIONS_MAX; amount += BORROW_STEP) options.push(amount);
  return options;
}

/** Amounts the bot may repay: $5,000 or $10,000, never leaving less than the debt floor, and only with the cash. */
export function repayOptions(record: Pick<BotRecord, 'debt' | 'cash'>): number[] {
  return REPAY_AMOUNTS.filter((amount) => record.debt - amount >= DEBT_FLOOR && record.cash >= amount);
}
