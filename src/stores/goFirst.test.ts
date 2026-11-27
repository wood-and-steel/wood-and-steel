/** Go first next round: the taker starts the next round; the order otherwise keeps its cycle. */
import { describe, expect, test } from 'vitest';
import type { GameContext, GameState } from './gameStore';
import { executeTurnOnEnd, rotatedToStart } from './phaseConfig';

function lastTurnOfRound(goFirstNextRound?: string): { G: GameState; ctx: GameContext } {
  const G = { contracts: [], players: [], independentRailroads: {}, ...(goFirstNextRound && { goFirstNextRound }) } as GameState;
  const ctx: GameContext = {
    phase: 'play', currentPlayer: '2', numPlayers: 3, playOrder: ['0', '1', '2'], playOrderPos: 2, turn: 4, round: 0,
  };
  return { G, ctx };
}

describe('go first next round', () => {
  test('rotates play order to start with the taker', () => {
    expect(rotatedToStart(['A', 'B', 'C'], 'B')).toEqual(['B', 'C', 'A']);
    expect(rotatedToStart(['A', 'B', 'C'], 'C')).toEqual(['C', 'A', 'B']);
    expect(rotatedToStart(['A', 'B', 'C'], 'A')).toEqual(['A', 'B', 'C']);
  });

  test('the round end reorders, reports it, and unlocks the action', () => {
    const { G, ctx } = lastTurnOfRound('1');
    executeTurnOnEnd('play', G, ctx);
    expect(ctx.playOrder).toEqual(['1', '2', '0']);
    expect(G.roundReport?.goFirst).toBe('1');
    expect(G.goFirstNextRound).toBeUndefined();
  });

  test('without a taker the order stays the same', () => {
    const { G, ctx } = lastTurnOfRound();
    executeTurnOnEnd('play', G, ctx);
    expect(ctx.playOrder).toEqual(['0', '1', '2']);
    expect(G.roundReport?.goFirst).toBeUndefined();
  });
});
