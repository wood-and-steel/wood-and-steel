/**
 * The round report: what changed at a round end, worked out by comparing the independent
 * railroads and the open market before and after the end-of-round hook runs
 * (docs/PLAYER_APP_REDESIGN_PLAN.md, Stage 4).
 */
import type { Contract } from '../Contract';
import { openMarketContracts } from './marketExpiration';
import type { GameState, ReportedContract, RoundReport } from './gameStore';

/** The parts of `G` a round end can change that the report describes. */
export interface RoundSnapshot {
  routes: Record<string, string[]>;
  openMarket: Contract[];
}

export function snapshotForReport(G: GameState): RoundSnapshot {
  const routes: Record<string, string[]> = {};
  for (const [name, railroad] of Object.entries(G.independentRailroads)) {
    routes[name] = railroad.routes.map((r) => r.key);
  }
  return { routes, openMarket: openMarketContracts(G.contracts) };
}

function reported(c: Contract): ReportedContract {
  return { id: c.id, commodity: c.commodity, destinationKey: c.destinationKey };
}

/** The report for round `round`, from the state before the round end and `G` after it. */
export function roundReportFrom(before: RoundSnapshot, G: GameState, round: number): RoundReport {
  const routesAdded: Record<string, string[]> = {};
  for (const [name, railroad] of Object.entries(G.independentRailroads)) {
    const had = new Set(before.routes[name] ?? []);
    const added = railroad.routes.map((r) => r.key).filter((key) => !had.has(key));
    if (added.length > 0) routesAdded[name] = added;
  }
  const after = openMarketContracts(G.contracts);
  const afterIds = new Set(after.map((c) => c.id));
  const beforeIds = new Set(before.openMarket.map((c) => c.id));
  const roundsLeftBefore = new Map(before.openMarket.map((c) => [c.id, c.roundsLeft]));
  return {
    round,
    routesAdded,
    marketExpired: before.openMarket.filter((c) => !afterIds.has(c.id)).map(reported),
    marketAdded: after.filter((c) => !beforeIds.has(c.id)).map(reported),
    marketLastRound: after.filter((c) => c.roundsLeft === 1 && roundsLeftBefore.get(c.id) !== 1).map(reported),
  };
}

/**
 * Whether a report has any news: railroads that grew, market contracts that came or went, or
 * market contracts that entered their last round.
 */
export function reportHasNews(report: RoundReport): boolean {
  return (
    Object.keys(report.routesAdded).length > 0 ||
    report.marketExpired.length > 0 ||
    report.marketAdded.length > 0 ||
    report.marketLastRound.length > 0 ||
    report.goFirst !== undefined
  );
}
