import { describe, expect, it } from 'vitest';
import type { GameContext } from '../stores/gameStore';
import { createBotRecord, emptyBotStates, type BotStates } from '../bots/state/botStates';
import { RUNNER_STALE_MS, botTrayInfo } from './botNarration';

const NOW = Date.parse('2026-11-09T12:00:00Z');
const ctx = { phase: 'play', currentPlayer: '1', turn: 4, round: 2, playOrder: ['1', '0'], playOrderPos: 0, numPlayers: 2 } as GameContext;

function states(log: { round: number; turn: number; lines: string[] }[], seenAgo: number | null): BotStates {
  const bot = createBotRecord({ name: 'Ben', strategy: 'builder' }, 1);
  return {
    ...emptyBotStates(),
    bots: { '1': { ...bot, log, runnerSeenAt: seenAgo === null ? null : new Date(NOW - seenAgo).toISOString() } },
  };
}

describe('botTrayInfo', () => {
  it('shows the current turn as it happens', () => {
    const info = botTrayInfo(states([{ round: 2, turn: 4, lines: ['Ben built Boston–Syracuse for $3,000.'] }], 1000), ctx, NOW);
    expect(info['1']).toEqual({ heading: 'This turn', lines: ['Ben built Boston–Syracuse for $3,000.'], waiting: false });
  });

  it('shows the last turn when it isn’t the bot’s turn, or before it acts this turn', () => {
    const s = states([{ round: 1, turn: 3, lines: ['Ben ended the turn.'] }], 1000);
    expect(botTrayInfo(s, ctx, NOW)['1'].heading).toBe('Last turn');
    expect(botTrayInfo(s, { ...ctx, currentPlayer: '0' }, NOW)['1']).toEqual({ heading: 'Last turn', lines: ['Ben ended the turn.'], waiting: false });
  });

  it('nothing before the first turn', () => {
    expect(botTrayInfo(states([], 1000), { ...ctx, currentPlayer: '0' }, NOW)['1']).toEqual({ heading: null, lines: [], waiting: false });
  });

  it('waiting for the host’s app when it’s the bot’s turn and the heartbeat is stale or missing', () => {
    expect(botTrayInfo(states([], RUNNER_STALE_MS + 1), ctx, NOW)['1'].waiting).toBe(true);
    expect(botTrayInfo(states([], null), ctx, NOW)['1'].waiting).toBe(true);
    expect(botTrayInfo(states([], RUNNER_STALE_MS - 1), ctx, NOW)['1'].waiting).toBe(false);
    expect(botTrayInfo(states([], null), { ...ctx, currentPlayer: '0' }, NOW)['1'].waiting).toBe(false);
    expect(botTrayInfo(states([], null), { ...ctx, phase: 'scoring' }, NOW)['1'].waiting).toBe(false);
  });

  it('no bots, no info', () => {
    expect(botTrayInfo(null, ctx, NOW)).toEqual({});
  });
});
