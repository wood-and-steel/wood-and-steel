/**
 * Narration templates (docs/BOT_PLAN.md, Narration): short, plain, third person by name, no
 * pronouns, no character voice. One line per action, shown in the bot's tray card on /board.
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

export function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
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
  'service-yard': 'a Service Yard',
  'upgraded-stations': 'Upgraded Stations',
  hub: 'a Hub',
  timetable: 'a Timetable',
  roundhouse: 'a Roundhouse',
  'employment-office': 'an Employment Office',
  railyard: 'a Railyard',
  'regional-office': 'a Regional Office',
  'commodities-exchange': 'a Commodities Exchange',
};

export function upgradeLabel(upgrade: UpgradeKey): string {
  return UPGRADE_LABELS[upgrade];
}

const REGION_NAMES: Record<string, string> = {
  NW: 'the Northwest',
  NC: 'the North Central region',
  NE: 'the Northeast',
  SW: 'the Southwest',
  SC: 'the South Central region',
  SE: 'the Southeast',
};

export function regionName(region: string): string {
  return REGION_NAMES[region] ?? region;
}
