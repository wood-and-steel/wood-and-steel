/**
 * The six bot strategies (docs/BOT_PLAN.md, Strategies). M1 defines their IDs, labels and
 * summaries for the waiting screen; weight ranges are added with the heuristic player (M5).
 */

export type StrategyId = 'builder' | 'speculator' | 'consolidator' | 'express' | 'merchant' | 'regionalist';

export interface Strategy {
  id: StrategyId;
  label: string;
  /** One line for the host, shown as the option's title on the waiting screen. */
  summary: string;
}

export const STRATEGIES: readonly Strategy[] = [
  {
    id: 'builder',
    label: 'Builder',
    summary: 'Grows outward a segment or two at a time, keeps debt near zero, buys upgrades once they pay for themselves.',
  },
  {
    id: 'speculator',
    label: 'Speculator',
    summary: 'Borrows early and builds west to chase contracts worth 3–4 ties.',
  },
  {
    id: 'consolidator',
    label: 'Consolidator',
    summary: 'Buys independent railroads for long networks, then a Hub and upgrades.',
  },
  {
    id: 'express',
    label: 'Express',
    summary: 'Keeps a compact network but buys the best engines and movement upgrades.',
  },
  {
    id: 'merchant',
    label: 'Merchant',
    summary: 'Buys a Mogul early for market contracts, builds money first, turns it into ties late.',
  },
  {
    id: 'regionalist',
    label: 'Regionalist',
    summary: 'Commits to one region for a Hub, a Regional Office, and a monopoly.',
  },
];

export function isStrategyId(value: unknown): value is StrategyId {
  return STRATEGIES.some((s) => s.id === value);
}

export function getStrategy(id: StrategyId): Strategy {
  const strategy = STRATEGIES.find((s) => s.id === id);
  if (!strategy) throw new Error(`Unknown strategy: ${id}`);
  return strategy;
}
