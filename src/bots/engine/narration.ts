/**
 * Narration helpers (docs/BOT_PLAN.md, Narration). Lines are terse: no subject (they appear in the
 * bot's own tray card on /board), no articles, "&" for "and", no final period, no character voice.
 * One line per action; ending the turn isn't narrated.
 */
import { formatCommodity, getEngineType, type EngineTypeId } from '../../board/playerBoardData';
import { routeCities } from './network';
import type { UpgradeKey } from './rulesData';

export function money(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(amount).toLocaleString('en-US')}`;
}

export function routeLabel(routeKey: string): string {
  return routeCities(routeKey).join('–');
}

/** "a", "a & b", "a, b & c" */
export function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`;
}

/** Capitalize the first letter of a narration line. */
export function line(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function engineName(engine: EngineTypeId): string {
  return getEngineType(engine).name;
}

export function commodityName(commodity: string): string {
  return commodity.toLowerCase() === commodity ? commodity : formatCommodity(commodity);
}

const SLOT_LABEL = ['light', 'dark'] as const;
export function slotLabel(slot: 0 | 1): string {
  return SLOT_LABEL[slot];
}

const UPGRADE_LABELS: Record<UpgradeKey, string> = {
  'service-yard': 'Service Yard',
  'upgraded-stations': 'Upgraded Stations',
  hub: 'Hub',
  timetable: 'Timetable',
  roundhouse: 'Roundhouse',
  'employment-office': 'Employment Office',
  railyard: 'Railyard',
  'regional-office': 'Regional Office',
  'commodities-exchange': 'Commodities Exchange',
};

export function upgradeLabel(upgrade: UpgradeKey): string {
  return UPGRADE_LABELS[upgrade];
}

const REGION_NAMES: Record<string, string> = {
  NW: 'Northwest',
  NC: 'North Central',
  NE: 'Northeast',
  SW: 'Southwest',
  SC: 'South Central',
  SE: 'Southeast',
};

export function regionName(region: string): string {
  return REGION_NAMES[region] ?? region;
}
