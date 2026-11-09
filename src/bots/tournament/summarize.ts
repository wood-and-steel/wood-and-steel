/**
 * Tournament summaries (docs/BOT_PLAN.md, Tournament): results by strategy as Markdown, and every
 * seat of every game as CSV.
 */
import { STRATEGIES, type StrategyId } from '../heuristic/strategies';
import type { GameResult, SeatResult } from './playGame';

export interface StrategySummary {
  strategy: StrategyId;
  seats: number;
  /** Share of seats that won. */
  winRate: number;
  ties: number;
  fulfillmentTies: number;
  deliveries: number;
  debt: number;
  cash: number;
  routes: number;
  /** Share of seats ending with each. */
  hub: number;
  railyard: number;
  regionalOffice: number;
  exchange: number;
  acquisitions: number;
  borrows: number;
  redraws: number;
  upgrades: number;
  idleTurns: number;
  errors: number;
  bestEngines: Record<string, number>;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function summarize(games: GameResult[]): StrategySummary[] {
  const seats = games.flatMap((g) => g.seats);
  return STRATEGIES.map(({ id }) => {
    const mine = seats.filter((s) => s.strategy === id);
    const avg = (f: (s: SeatResult) => number) => mean(mine.map(f));
    const bestEngines: Record<string, number> = {};
    for (const s of mine) if (s.bestEngine) bestEngines[s.bestEngine] = (bestEngines[s.bestEngine] ?? 0) + 1;
    return {
      strategy: id,
      seats: mine.length,
      winRate: avg((s) => (s.won ? 1 : 0)),
      ties: avg((s) => s.ties),
      fulfillmentTies: avg((s) => s.fulfillmentTies),
      deliveries: avg((s) => s.deliveries),
      debt: avg((s) => s.debt),
      cash: avg((s) => s.cash),
      routes: avg((s) => s.routes),
      hub: avg((s) => (s.hub ? 1 : 0)),
      railyard: avg((s) => (s.railyard ? 1 : 0)),
      regionalOffice: avg((s) => (s.regionalOffice ? 1 : 0)),
      exchange: avg((s) => (s.exchange ? 1 : 0)),
      acquisitions: avg((s) => s.acquisitions),
      borrows: avg((s) => s.borrows),
      redraws: avg((s) => s.redraws),
      upgrades: avg((s) => s.upgrades.length),
      idleTurns: avg((s) => s.idleTurns),
      errors: avg((s) => s.errors),
      bestEngines,
    };
  }).filter((s) => s.seats > 0);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n1 = (x: number) => x.toFixed(1);
const k = (x: number) => `$${Math.round(x / 1000)}k`;

export interface ReportOptions {
  players: number;
  seed: number;
  maxRounds: number;
  markets: number;
}

export function markdownReport(games: GameResult[], options: ReportOptions): string {
  const rows = summarize(games);
  const finished = games.filter((g) => g.finished);
  const lines = [
    '# Bot tournament',
    '',
    `${games.length} games, ${options.players} bots each, seed ${options.seed}, round limit ${options.maxRounds}, ` +
      `${options.markets} market contracts at the start. ${finished.length} games reached 30 fulfillment ties, ` +
      `in ${n1(mean(finished.map((g) => g.rounds)))} rounds on average. A fair win rate is ${pct(1 / options.players)}.`,
    '',
    '| Strategy | Seats | Win rate | Ties | Fulfillment ties | Deliveries | Routes | Debt | Cash | Borrows | Redraws | Idle turns | Errors |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.strategy} | ${r.seats} | ${pct(r.winRate)} | ${n1(r.ties)} | ${n1(r.fulfillmentTies)} | ${n1(r.deliveries)} | ${n1(r.routes)} | ` +
        `${k(r.debt)} | ${k(r.cash)} | ${n1(r.borrows)} | ${n1(r.redraws)} | ${n1(r.idleTurns)} | ${n1(r.errors)} |`
    ),
    '',
    '## Purchases',
    '',
    '| Strategy | Upgrades (avg) | Hub | Railyard | Regional Office | Commodities Exchange | Railroads acquired (avg) | Best engine (most common) |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => {
      const engines = Object.entries(r.bestEngines).sort((a, b) => b[1] - a[1]);
      const common = engines
        .slice(0, 2)
        .map(([e, c]) => `${e} ${pct(c / r.seats)}`)
        .join(', ');
      return `| ${r.strategy} | ${n1(r.upgrades)} | ${pct(r.hub)} | ${pct(r.railyard)} | ${pct(r.regionalOffice)} | ${pct(r.exchange)} | ${n1(r.acquisitions)} | ${common} |`;
    }),
    '',
  ];
  return lines.join('\n');
}

const CSV_HEADER = [
  'seed', 'rounds', 'finished', 'player', 'strategy', 'won', 'ties', 'fulfillment_ties', 'deliveries', 'cash', 'debt',
  'best_engine', 'upgrades', 'hub', 'railyard', 'regional_office', 'exchange', 'routes', 'acquisitions', 'borrows',
  'redraws', 'idle_turns', 'errors',
];

export function csvReport(games: GameResult[]): string {
  const rows = games.flatMap((g) =>
    g.seats.map((s) =>
      [
        g.seed, g.rounds, g.finished, s.playerID, s.strategy, s.won, s.ties, s.fulfillmentTies, s.deliveries, s.cash, s.debt,
        s.bestEngine ?? '', s.upgrades.join(' '), s.hub, s.railyard, s.regionalOffice, s.exchange, s.routes, s.acquisitions,
        s.borrows, s.redraws, s.idleTurns, s.errors,
      ].join(',')
    )
  );
  return [CSV_HEADER.join(','), ...rows].join('\n') + '\n';
}
