import { describe, expect, test } from 'vitest';
import { STRATEGIES } from '../heuristic/strategies';
import { playGame } from './playGame';
import { runTournament, seating } from './runTournament';
import { csvReport, markdownReport, summarize } from './summarize';

describe('tournament seating', () => {
  test('a seeded shuffle of distinct strategies', () => {
    const seats = seating(1, 0, 4);
    expect(new Set(seats).size).toBe(4);
    expect(seating(1, 0, 4)).toEqual(seats);
    expect(seating(1, 1, 4)).not.toEqual(seats);
  });

  test('every strategy gets seats over a run', () => {
    const seen = new Set(Array.from({ length: 12 }, (_, i) => seating(3, i, 3)).flat());
    expect([...seen].sort()).toEqual(STRATEGIES.map((s) => s.id).sort());
  });
});

describe('headless games', () => {
  test('bots play a whole game through the real moves, and a seed replays it exactly', async () => {
    const a = await playGame({ strategies: ['builder', 'express', 'merchant'], seed: 5, maxRounds: 15 });
    const b = await playGame({ strategies: ['builder', 'express', 'merchant'], seed: 5, maxRounds: 15 });
    expect(b).toEqual(a);
    expect(a.seats).toHaveLength(3);
    expect(a.rounds).toBeGreaterThan(10);
    expect(a.seats.some((s) => s.deliveries > 0)).toBe(true);
    expect(a.seats.every((s) => s.errors === 0)).toBe(true);
    expect(a.seats.filter((s) => s.won).length).toBeGreaterThanOrEqual(1);
  }, 60000);

  test('summaries and reports cover each strategy that played', async () => {
    const games = await runTournament({ games: 2, players: 2, seed: 9, maxRounds: 8 });
    const rows = summarize(games);
    expect(rows.reduce((n, r) => n + r.seats, 0)).toBe(4);
    const md = markdownReport(games, { players: 2, seed: 9, maxRounds: 8, markets: 3 });
    expect(md).toContain('# Bot tournament');
    for (const r of rows) expect(md).toContain(`| ${r.strategy} |`);
    expect(csvReport(games).trim().split('\n')).toHaveLength(1 + 4);
  }, 60000);
});
