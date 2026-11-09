/**
 * Run a bot tournament (docs/BOT_PLAN.md, Tournament):
 *
 *   npm run bots:tournament -- --games 200 --players 4 --seed 1 --rounds 80 --markets 3
 *
 * Plays headless bot-only games through the real moves, store, runner, and heuristic, then writes
 * src/bots/tournament/results/summary.md (by strategy) and games.csv (every seat of every game).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? Number(process.argv[i + 1]) : fallback;
  if (!Number.isFinite(value)) throw new Error(`--${name} must be a number`);
  return value;
}

// The app's modules expect a browser's localStorage; with no current game code, moves don't save.
const memory = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
} as Storage;

// The app logs a lot during play; keep the output to progress and the summary.
const print = console.log.bind(console);
const printError = console.error.bind(console);
console.log = () => {};
console.info = () => {};
console.warn = () => {};
console.error = (...args: unknown[]) => {
  if (String(args[0]).startsWith('[tournament]')) printError(...args);
};

const options = {
  games: arg('games', 60),
  players: arg('players', 4),
  seed: arg('seed', 1),
  maxRounds: arg('rounds', 80),
  markets: arg('markets', 3),
};

const { runTournament } = await import('./runTournament');
const { csvReport, markdownReport } = await import('./summarize');

const started = Date.now();
const games = await runTournament({
  ...options,
  onGame: (_result, i) => {
    if ((i + 1) % 10 === 0 || i + 1 === options.games) {
      print(`${i + 1}/${options.games} games (${Math.round((Date.now() - started) / 1000)}s)`);
    }
  },
});

const out = join(process.cwd(), 'src/bots/tournament/results');
mkdirSync(out, { recursive: true });
const summary = markdownReport(games, options);
writeFileSync(join(out, 'summary.md'), summary);
writeFileSync(join(out, 'games.csv'), csvReport(games));
print(`\n${summary}`);
print(`Wrote ${join('src/bots/tournament/results', 'summary.md')} and games.csv`);
