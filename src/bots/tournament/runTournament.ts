/**
 * Many headless bot-only games with strategies mixed across seats (docs/BOT_PLAN.md, Tournament).
 * Each game seats a different subset and order of the six strategies, so every strategy meets
 * every other over a run. Deterministic for a given seed.
 */
import { STRATEGIES, type StrategyId } from '../heuristic/strategies';
import { createRng } from '../rng';
import { playGame, type GameResult } from './playGame';

export interface TournamentOptions {
  games: number;
  players: number;
  seed: number;
  maxRounds: number;
  markets?: number;
  /** Called after each game, e.g. for progress. */
  onGame?: (result: GameResult, index: number) => void;
}

/** Seats for game `index`: a seeded shuffle of the strategies, then the first `players`. */
export function seating(seed: number, index: number, players: number): StrategyId[] {
  const rng = createRng((seed * 1_000_003 + index * 7_919) >>> 0);
  const ids = STRATEGIES.map((s) => s.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return Array.from({ length: players }, (_, i) => ids[i % ids.length]);
}

export async function runTournament({ games, players, seed, maxRounds, markets, onGame }: TournamentOptions): Promise<GameResult[]> {
  const results: GameResult[] = [];
  for (let i = 0; i < games; i++) {
    const result = await playGame({ strategies: seating(seed, i, players), seed: (seed + i * 104_729) >>> 0, maxRounds, markets });
    results.push(result);
    onGame?.(result, i);
  }
  return results;
}
